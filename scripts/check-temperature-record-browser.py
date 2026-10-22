"""Offline temperature provenance integration using actual startup, parser and Chart.js.

Run separately from timed profiles. Use /tmp for output/screenshot artifacts.
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
    now = datetime.fromisoformat('2026-10-22T12:00:00+02:00')
    bodies = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            ts = now-timedelta(minutes=i//2)
            temp = '' if station == 2 or i%11 == 0 else 0 if station == 1 else 10+i/1000
            if station == 0:
                if i in [50, 51]: temp = 42.123456789
                if i in [500, 501]: temp = -5.123456789
                if i == 52: temp = 42.1234567
                if i == 4: temp = 0
            hum = '' if station == 1 else 0 if i%7 == 0 else 50+i/100
            pressure = '' if station == 2 else 1000+i/100
            voltage = '' if station == 1 else 0 if station == 2 else 4
            lines.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{temp},{pressure},{hum},0,0,,{voltage}')
        bodies.append(lines)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width':390, 'height':844}, timezone_id='Europe/Prague', reduced_motion='reduce')
        await page.clock.set_fixed_time(now)
        requests, errors, results, mobile = [], [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
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
                station = next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                requests.append({'station':station, 'quick':quick})
                await asyncio.sleep(.1 if quick else .2)
                await r.fulfill(body='\n'.join(bodies[station][:401] if quick else bodies[station]), content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}), content_type='application/json')
            else:
                await r.abort()
        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')
        async def verify(kind, full):
            await page.locator('#statTemp'+kind.title()+'Source').focus()
            await page.keyboard.press('Enter')
            await page.wait_for_function('(k)=>temperatureRecordView?.kind===k', arg=kind)
            await page.wait_for_timeout(50)
            actual = await page.evaluate('temperatureRecordData()')
            expected = await page.evaluate('''kind=>{
              const valid=store.rows.map((row,index)=>({row,index})).filter(x=>Number.isFinite(x.row.temp));
              const winner=valid.reduce((a,b)=>(kind==='min'?b.row.temp<a.row.temp:b.row.temp>a.row.temp)?b:a);
              const raw=v=>Number.isFinite(v)?String(v):'–';
              return {kind,index:winner.index+1,temp:raw(winner.row.temp),hum:raw(winner.row.hum),pressure:raw(winner.row.pressure),voltage:raw(winner.row.voltage),
                ties:valid.filter(x=>x.row.temp===winner.row.temp).length,count:valid.length,excluded:store.rows.length-valid.length,total:store.rows.length};
            }''', kind)
            for key,value in expected.items(): assert actual[key] == value, (key,actual,expected)
            assert 'UTC+02:00' in actual['time']
            info = await page.locator('#tempRecordInfo').inner_text()
            assert ('Celá dostupná' if full else 'Částečná') in info
            assert f"{actual['ties']} záznamů" in info
            assert await page.locator('#appVersion').inner_text() in await page.locator('#tempRecordFormula').inner_text()
            assert await page.locator('#tempRecordBody tr').count() == 1
            cells = await page.locator('#tempRecordBody tr').evaluate('(row)=>[...row.cells].map(cell=>cell.textContent)')
            assert cells == [str(actual['index']),actual['time'],actual['temp'],actual['hum'],actual['pressure'],actual['voltage']]
            return expected
        for station in range(3):
            if station:
                await page.evaluate('(i)=>switchStation(i)', station)
                assert await page.evaluate('temperatureRecordView===null')
                assert await page.locator('#tempRecordBody tr').count() == 0
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400', arg=station)
            charts = await page.evaluate('Object.keys(Chart.instances).length')
            checks = []
            before = len(requests)
            if station != 2:
                checks.append(await verify('max',False))
                assert len(requests) == before
            else:
                assert not await page.locator('#statTempMaxSource').is_visible()
                assert not await page.locator('#tempRecord').is_visible()
            await page.evaluate('ensureFullData(()=>{})')
            await page.wait_for_function('store.fullLoaded && store.rows.length===1000')
            assert len(requests) == before+1
            assert await page.evaluate('temperatureRecordView===null && !el("tempRecord").open')
            assert await page.locator('#tempRecordBody tr').count() == 0
            before = len(requests)
            if station != 2:
                checks.extend([await verify('max',True),await verify('min',True)])
                await page.select_option('#tempRecordKind','max')
                assert await page.evaluate('temperatureRecordView.kind') == 'max'
                await page.locator('#tempRecord > summary').focus()
                await page.keyboard.press('Enter')
                await page.wait_for_function('temperatureRecordView===null')
                assert await page.locator('#tempRecordBody tr').count() == 0
                await page.keyboard.press('Enter')
                await page.wait_for_function('temperatureRecordView!==null')
                if station == 0:
                    for width in [320,390]:
                        await page.set_viewport_size({'width':width,'height':844})
                        await page.wait_for_timeout(150)
                        for theme in ['darkblue','light']:
                            await page.evaluate('(t)=>setTheme(t)',theme)
                            await page.wait_for_timeout(100)
                            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
                            scroll=page.locator('#tempRecord .battery-record-scroll')
                            await scroll.evaluate('(node)=>node.scrollLeft=0')
                            await scroll.focus()
                            await page.keyboard.press('ArrowRight')
                            await page.wait_for_timeout(100)
                            assert await scroll.evaluate('(node)=>node.scrollWidth>node.clientWidth && node.scrollLeft>0')
                            mobile.append({'width':width,'theme':theme,'overflow':False,'keyboardScroll':True})
                    await page.evaluate('setTheme("darkblue")')
                    await page.locator('#tempRecord').screenshot(path=str(output.with_suffix('.png')))
                old = await page.evaluate('dataAggregates().temperature.max')
                corrected = bodies[station].copy()
                cells=corrected[901].split(',');cells[2]='123.456789';corrected[901]=','.join(cells)
                assert await page.evaluate('(csv)=>parseAndStore(csv)','\n'.join(corrected))
                assert await page.evaluate('temperatureRecordView===null && !el("tempRecord").open')
                await verify('max',True)
                assert await page.evaluate('dataAggregates().temperature.max') != old
            else:
                assert await page.evaluate('dataAggregates().temperature.count') == 0
                assert not await page.locator('#statTempMinSource').is_visible()
                assert not await page.locator('#tempRecord').is_visible()
            assert len(requests) == before
            assert await page.evaluate('Object.keys(Chart.instances).length') == charts
            results.append({'station':station,'checks':checks,'partialToFullInvalidation':True,'keyboardControls':station!=2,'missingTemperature':station==2,'extraRequests':0,'extraCharts':0})
        assert not errors,errors
        version=browser.version
        await browser.close()
    output.write_text(json.dumps({'browser':version,'results':results,'mobile':mobile,'pageErrors':errors,'requests':requests,
        'transport':'Original three configs; controlled CSV/UV, MQTT CDN blocked'},indent=2))
    print(output)

asyncio.run(main())
