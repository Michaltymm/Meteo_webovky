"""Offline hourly provenance integration with real Chromium, Chart.js and CSV parsing.

Uses the three existing station configs; external services are routed to fixtures.
Run separately from timed profiles. Screenshots stay next to --output (use /tmp).
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()


async def main():
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    html, chart = Path('index.html').read_text(), Path(args.chartjs).read_text()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    now = datetime.fromisoformat('2026-10-21T12:00:00+02:00')
    bodies = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            time = now - timedelta(seconds=15 * (i // 2))  # Keep duplicate timestamps.
            temp = '' if i % 11 == 0 else 0 if i % 19 == 0 else 20 + station * 10 + i / 1000
            hum = '' if station == 1 or i % 13 == 0 else 0 if i % 23 == 0 else 45 + i / 100
            pressure = '' if station == 2 or i % 17 == 0 else 0 if i % 29 == 0 else 1000 + i / 1000
            voltage = '' if station == 1 else 0 if station == 2 else 4
            lines.append(f'{time:%d.%m.%Y},{time:%H:%M:%S},{temp},{pressure},{hum},0,0,,{voltage}')
        bodies.append(lines)

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width': 390, 'height': 844},
                                      timezone_id='Europe/Prague', reduced_motion='reduce')
        await page.clock.set_fixed_time(now)
        errors, requests, results, mobile = [], [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))

        async def route(r):
            url = r.request.url
            filename = urlparse(url).path.split('/')[-1]
            if url == 'http://meteo.test/dev/':
                await r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in url:
                await r.fulfill(body=chart, content_type='text/javascript')
            elif filename in files:
                await r.fulfill(body=json.dumps(configs[files.index(filename)]), content_type='application/json')
            elif 'docs.google.com' in url:
                station = next(i for i, c in enumerate(configs) if c['sheetId'] in url)
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq', [''])[0]
                requests.append({'station': station, 'quick': quick})
                await asyncio.sleep(.1 if quick else .2)
                await r.fulfill(body='\n'.join(bodies[station][:401] if quick else bodies[station]),
                                content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly': {'uv_index': [0] * 24}}), content_type='application/json')
            else:
                await r.abort()

        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')

        async def open_native():
            if not await page.locator('#cmpEvidence').evaluate('(node)=>node.open'):
                await page.locator('#cmpEvidence > summary').focus()
                await page.keyboard.press('Enter')
            if not await page.locator('#cmpRecords').evaluate('(node)=>node.open'):
                await page.locator('#cmpRecords > summary').focus()
                await page.keyboard.press('Enter')
            await page.wait_for_function('comparisonRecordView!==null')
            await page.wait_for_timeout(50)  # Drain native toggle before changing pages.

        async def verify_hour(metric, hour='11'):
            await page.select_option('#cmpRecordsDay', '2026-10-21')
            await page.select_option('#cmpRecordsMetric', metric)
            await page.select_option('#cmpRecordsHour', hour)
            expected = await page.evaluate('''({metric,hour})=>{
              const rows=store.rows.map((r,i)=>({r,index:i+1})).filter(({r})=>
                r.ts.getFullYear()===2026 && r.ts.getMonth()===9 && r.ts.getDate()===21 && r.ts.getHours()===Number(hour));
              const ascending=rows.slice().sort((a,b)=>a.r.ts-b.r.ts);
              const used=ascending.filter(({r})=>Number.isFinite(r[metric]));
              const sum=used.reduce((n,{r})=>n+r[metric],0);
              return {total:rows.length,count:used.length,sum,
                avg:used.length?+(sum/used.length).toFixed(1):null,
                unique:new Set(used.map(({r})=>+r.ts)).size,
                first:rows.slice(0,50).map(({r,index})=>({index,value:Number.isFinite(r[metric])?String(r[metric]):'–',valid:Number.isFinite(r[metric])}))};
            }''', {'metric': metric, 'hour': hour})
            actual = await page.locator('#cmpRecordsBody tr').evaluate_all('rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent))')
            assert len(actual) == min(50, expected['total'])
            for cells, source in zip(actual, expected['first']):
                assert cells[0] == str(source['index']) and cells[2] == source['value'], (cells, source)
                assert 'UTC+02:00' in cells[1]
                assert cells[3] == ('Použitá hodnota' if source['valid'] else 'Vynecháno: chybí nebo není číselná hodnota')
            stat = await page.evaluate('''({metric,hour})=>{
              const s=hourlyDay('2026-10-21').values[metric][Number(hour)];return {count:s.count,sum:s.sum,avg:s.avg,unique:s.unique};
            }''', {'metric': metric, 'hour': hour})
            assert stat == {k: expected[k] for k in ['count', 'sum', 'avg', 'unique']}
            info = await page.locator('#cmpRecordsInfo').inner_text()
            assert f"{expected['count']} použitých hodnot" in info
            assert f"{expected['total']-expected['count']} vynechaných" in info
            assert 'Celá dostupná načtená historie' in info
            assert await page.locator('#appVersion').inner_text() in await page.locator('#cmpRecordsFormula').inner_text()
            return {'metric': metric, 'hour': hour, **stat, 'total': expected['total']}

        for station in range(3):
            if station:
                await page.evaluate('(i)=>switchStation(i)', station)
                assert await page.evaluate('comparisonRecordView===null && !el("cmpRecords").open')
                assert await page.locator('#cmpRecordsBody tr').count() == 0
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400', arg=station)
            before_load = len(requests)
            await page.locator('.tab-btn[data-tab="compare"]').click()
            await page.wait_for_function('store.fullLoaded && store.rows.length===1000')
            await page.select_option('#cmpMetric', 'temp_hum')
            assert len(requests) - before_load == 1
            assert await page.locator('#cmpRecordsBody tr').count() == 0
            request_count = len(requests)
            charts = await page.evaluate('Object.keys(Chart.instances).length')
            await open_native()
            checks = [await verify_hour('temp'), await verify_hour('hum')]
            info = await page.locator('#cmpRecordsInfo').inner_text()
            graph = await page.evaluate('JSON.stringify(chartCompare.data)')
            await page.locator('#cmpRecordsNext').click()
            assert await page.evaluate('comparisonRecordView.page') == 1
            assert await page.locator('#cmpRecordsBody tr').count() == 50
            assert '51–100' in await page.locator('#cmpRecordsPage').inner_text()
            assert await page.locator('#cmpRecordsInfo').inner_text() == info
            assert await page.evaluate('JSON.stringify(chartCompare.data)') == graph
            await page.select_option('#cmpRecordsHour', '12')
            assert await page.evaluate('comparisonRecordView.page') == 0
            assert await page.locator('#cmpRecordsBody tr').count() == 2
            await page.select_option('#cmpRecordsDay', '2026-10-20')
            assert await page.locator('#cmpRecordsBody tr').count() == 0
            assert 'Žádné záznamy' in await page.locator('#cmpRecordsPage').inner_text()
            assert await page.locator('#cmpRecordsPrev').is_disabled()
            assert await page.locator('#cmpRecordsNext').is_disabled()
            await page.select_option('#cmpMetric', 'pressure')
            assert await page.evaluate('comparisonRecordView===null && !el("cmpRecords").open')
            await open_native()
            checks.append(await verify_hour('pressure'))

            # Click a real Chart.js point, preserving source day/metric metadata.
            await page.select_option('#cmpMetric', 'temp')
            canvas = page.locator('#chartCompare')
            await canvas.scroll_into_view_if_needed()
            await page.wait_for_timeout(100)
            point = await page.evaluate('''()=>{const p=chartCompare.getDatasetMeta(0).data[11];return {x:p.x,y:p.y}}''')
            await canvas.click(position=point)
            await page.wait_for_function('comparisonRecordView?.hour===11 && comparisonRecordView.metric==="temp"')
            assert await page.locator('#cmpRecordsDay').input_value() == '2026-10-21'
            assert await page.locator('#cmpRecordsContent').is_visible()
            await page.wait_for_timeout(50)

            if station == 0:
                for width in [320, 390]:
                    await page.set_viewport_size({'width': width, 'height': 844})
                    await page.wait_for_timeout(150)  # Chart.js resize observer updates its canvas asynchronously.
                    for theme in ['darkblue', 'light']:
                        await page.evaluate('(t)=>setTheme(t)', theme)
                        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'), await page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({id:e.id,tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))})''')
                        scroll = page.locator('#cmpRecords .battery-record-scroll')
                        await scroll.evaluate('(node)=>node.scrollLeft=0')
                        await scroll.focus()
                        await page.keyboard.press('ArrowRight')
                        await page.wait_for_timeout(100)
                        assert await scroll.evaluate('(node)=>node.scrollWidth>node.clientWidth && node.scrollLeft>0')
                        mobile.append({'width': width, 'theme': theme, 'horizontalKeyboardScroll': True, 'overflow': False})
                await page.evaluate('setTheme("darkblue")')
                await page.locator('#cmpRecords').screenshot(path=str(output.with_suffix('.png')))

            # Parse a correction through the production CSV parser: current view must close.
            old = await page.evaluate('hourlyDay("2026-10-21").values.temp[11].sum')
            corrected = bodies[station].copy()
            cells = corrected[101].split(',')
            cells[2] = '123.456789'
            corrected[101] = ','.join(cells)
            assert await page.evaluate('(csv)=>parseAndStore(csv)', '\n'.join(corrected))
            assert await page.evaluate('comparisonRecordView===null && !el("cmpRecords").open')
            assert await page.locator('#cmpRecordsBody tr').count() == 0
            await open_native()
            await page.select_option('#cmpRecordsDay', '2026-10-21')
            await page.select_option('#cmpRecordsHour', '11')
            assert await page.evaluate('hourlyDay("2026-10-21").values.temp[11].sum') != old
            assert len(requests) == request_count
            assert await page.evaluate('Object.keys(Chart.instances).length') == charts
            results.append({'station': station, 'checks': checks, 'keyboardOpen': True,
                            'paginationAndEmptyHour': True, 'graphPointDrilldown': True,
                            'csvCorrectionClosesStaleView': True, 'extraRequests': 0, 'extraCharts': 0})
        assert not errors, errors
        version = browser.version
        await browser.close()
    output.write_text(json.dumps({'browser': version, 'results': results, 'mobile': mobile,
                                 'pageErrors': errors, 'requests': requests,
                                 'transport': 'Three original configs; fixture CSV and UV; MQTT CDN blocked'}, indent=2))
    print(output)


asyncio.run(main())
