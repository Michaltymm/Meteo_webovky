"""Offline integration of record age, transport evidence and history scope.

Uses the three original configs, real SRI libraries and controlled CSV/UV.
No live service or MQTT broker is contacted.
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
parser.add_argument('--paho', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()


async def main():
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    html = Path('index.html').read_bytes()
    chart = Path(args.chartjs).read_bytes()
    paho = Path(args.paho).read_bytes()
    now = datetime.fromisoformat('2026-10-23T12:00:00+02:00')
    failed = False
    future = False
    requests = []
    errors = []
    layouts = []
    gate = asyncio.Event()
    gate.set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, timezone_id='Europe/Prague', reduced_motion='reduce')
        await page.clock.set_fixed_time(now)
        page.on('pageerror', lambda e: errors.append(str(e)))

        async def route(r):
            url = r.request.url
            name = urlparse(url).path.split('/')[-1]
            if url == 'http://meteo.test/dev/':
                await r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in url:
                await r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            elif 'paho-mqtt' in url:
                await r.fulfill(body=paho, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            elif name in files:
                await r.fulfill(json=configs[files.index(name)])
            elif 'docs.google.com' in url:
                station = next(i for i, c in enumerate(configs) if c['sheetId'] in url)
                requests.append({'station': station})
                if station == 1:
                    await gate.wait()
                if failed:
                    await r.fulfill(body='<html>Controlled invalid export</html>', content_type='text/html')
                    return
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq', [''])[0]
                rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
                for i in range(4 if quick else 8):
                    ts = now + timedelta(days=1) if future else now - timedelta(days=1, minutes=i*10)
                    voltage = '' if station == 2 else '0' if station == 1 else '4.12'
                    rows.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{18-station},1010,60,0,0,,{voltage}')
                await r.fulfill(body='\n'.join(rows), content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(json={'hourly': {'uv_index': [0]*24}})
            else:
                await r.abort()

        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('dataStatus.sheets.phase==="ok" && store.rows.length===4')
        assert await page.locator('#dataRecordAge').inner_text() == 'Před 1 d 0 h'
        assert await page.locator('#dataHistoryScope').inner_text() == 'Částečná historie'
        assert await page.locator('#dataRecordTime').inner_text() != await page.locator('#dataLastSync').inner_text()
        await page.locator('.data-state .info-trigger').click()
        assert 'nikoli nové měření' in await page.locator('#infoBody').inner_text()
        await page.keyboard.press('Escape')
        await page.evaluate('globalThis.originalRows=store.rows;globalThis.recordTime=store.rows[0].ts.getTime()')
        await page.clock.set_fixed_time(now+timedelta(minutes=10))
        await page.evaluate('fetchSheets()')
        assert await page.evaluate('store.rows===originalRows && store.rows[0].ts.getTime()===recordTime && dataStatus.sheets.successAt===Date.now()')
        await page.locator('#partialBadge').click()
        await page.wait_for_function('store.fullLoaded && dataStatus.sheets.phase==="ok"')
        assert await page.locator('#dataHistoryScope').inner_text() == 'Celý export zdroje'
        await page.evaluate('globalThis.originalRows=store.rows;globalThis.lastSuccess=dataStatus.sheets.successAt')
        failed = True
        await page.clock.set_fixed_time(now+timedelta(minutes=20))
        await page.evaluate('fetchSheets(true)')
        assert await page.locator('#dataTransferState').inner_text() == 'Sheets: chyba obnovy'
        assert await page.evaluate('store.rows===originalRows && dataStatus.sheets.successAt===lastSuccess && store.fullLoaded')
        assert 'Před 10 min' in await page.locator('#dataLastSync').inner_text()
        assert await page.locator('#dataHistoryCount').inner_text() == 'Počet záznamů: 8'
        failed = False
        await page.evaluate('fetchSheets()')
        assert await page.locator('#dataTransferState').inner_text() == 'Sheets: ověřeno'
        before = len(requests)
        await page.clock.set_fixed_time(now+timedelta(minutes=21))
        await page.evaluate('updateVisibleDataStatus()')
        assert len(requests) == before
        assert 'Před 1 min' in await page.locator('#dataLastSync').inner_text()
        gate.clear()
        await page.evaluate('switchStation(1)')
        await page.wait_for_function('activeIdx===1 && dataStatus.sheets.phase==="loading"')
        assert await page.locator('#dataRecordTime').inner_text() == 'Zatím bez dat'
        assert await page.locator('#dataLastSync').inner_text() == 'Úspěšná kontrola: dosud žádná'
        gate.set()
        await page.wait_for_function('dataStatus.sheets.phase==="ok" && store.rows.length===4')
        assert await page.locator('#curVoltage').inner_text() == '0.00'
        await page.evaluate('switchStation(2)')
        await page.wait_for_function('activeIdx===2 && dataStatus.sheets.phase==="ok"')
        assert await page.locator('#curVoltage').inner_text() == '–'
        for view in ['main', 'modern', 'analytics']:
            await page.locator(f'[data-page="{view}"]').click()
            if view == 'analytics':
                await page.wait_for_function('analyticsState.model!==null')
            for theme in ['darkblue', 'light']:
                await page.evaluate('(theme)=>setTheme(theme)', theme)
                for width in [1440, 800, 390, 320]:
                    await page.set_viewport_size({'width': width, 'height': 1000})
                    await page.wait_for_timeout(150)  # Chart.js resize is asynchronous.
                    assert await page.locator('.data-state').is_visible()
                    overflow = await page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                    if overflow:
                        await page.screenshot(path=str(output.with_name('overflow.png')))
                        outside = await page.evaluate('''[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right})).slice(0,20)''')
                        raise AssertionError((view, theme, width, outside))
                    layouts.append({'view': view, 'theme': theme, 'width': width})
                    if view == 'modern' and width in [1440, 320]:
                        await page.screenshot(path=str(output.with_name(f'state-{theme}-{width}.png')))
        future = True
        await page.evaluate('fetchSheets(true)')
        assert 'budoucnosti' in await page.locator('#dataRecordAge').inner_text()
        assert await page.locator('#dataRecordTime').get_attribute('class') == 'data-state-warning'
        assert not errors, errors
        version = browser.version
        await browser.close()
    output.write_text(json.dumps({'browser': version, 'pageErrors': errors, 'layouts': layouts,
        'checks': ['old record vs new validation', 'unchanged quick export', 'full history',
                   'invalid HTTP200 retains last success/rows', 'recovery', 'minute update without fetch',
                   'station reset before delayed CSV', 'zero/missing voltage', 'three pages/two themes', 'future time'],
        'transport': 'Controlled CSV/UV; real Chart.js and Paho with SRI; no live MQTT'}, indent=2)+'\n')
    print(output)


asyncio.run(main())
