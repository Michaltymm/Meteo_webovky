"""Manual integration check: real UI/Chart.js, delayed fixture transports.
Requires Python Playwright and Chromium, just like benchmark-browser.py.
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()

async def main():
    html = Path('index.html').read_text()
    chart = Path(args.chartjs).read_text()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    bodies = {}
    now = datetime.now(ZoneInfo('Europe/Prague')).replace(microsecond=0)
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            d = now-timedelta(minutes=5*i)
            lines.append(f'{d:%d.%m.%Y},{d:%H:%M:%S},{10+station*10+i/100},1010,60,0,0,,4')
        bodies[station] = lines
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844}, timezone_id='Europe/Prague')
        errors, requests, results = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        async def route(r):
            url = r.request.url
            if url == 'http://meteo.test/dev/':
                await r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in url:
                await r.fulfill(body=chart, content_type='text/javascript')
            elif urlparse(url).path.split('/')[-1] in files:
                idx = files.index(urlparse(url).path.split('/')[-1])
                await r.fulfill(body=json.dumps(configs[idx]),content_type='application/json')
            elif 'docs.google.com' in url:
                idx = next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                body = '\n'.join(bodies[idx][:401] if quick else bodies[idx])
                requests.append({'station':idx,'quick':quick,'bytes':len(body.encode())})
                await asyncio.sleep(.25)
                await r.fulfill(body=body,content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:
                await r.abort()
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/')
        for station in range(3):
            if station:
                await page.evaluate('(i)=>switchStation(i)',station)
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400 && store.rows[0].temp===10+i*10',arg=station)
            # Two simultaneous full loads must be shared, despite delayed responses.
            before = len(requests)
            await page.evaluate('Promise.all([fetchSheets(true),fetchSheets(true)])')
            assert len(requests)-before == 1
            await page.locator('.tab-btn[data-tab="explorer"]').click()
            await page.evaluate('el("expMetric").value="temp";setExpRange("all")')
            box = page.locator('#expInterval')
            assert await box.is_visible()
            assert 'změna -9.99 °C' in await box.inner_text()
            await page.evaluate('el("expSliderL").value="20";el("expSliderR").value="80";expSliderUpdate()')
            assert 'změna -5.99 °C' in await box.inner_text()
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            await page.evaluate('el("expMetric").value="rain";buildExplorer()')
            assert not await box.is_visible()
            await page.evaluate('el("expMetric").value="temp";buildExplorer();expRange="oneday";el("expDateOne").value="1900-01-01";buildExplorer()')
            assert not await box.is_visible()
            await page.evaluate('setExpRange("all")')
            for theme in ['darkblue','light']:
                await page.evaluate('(t)=>setTheme(t)',theme)
                assert await box.is_visible()
            results.append({'station':station,'fullRequestsForTwoCalls':len(requests)-before,
                            'rows':await page.evaluate('store.rows.length'),'checks':'passed'})
        await page.evaluate('renderIntervalComparison([{ts:new Date("2026-10-25T02:30:00+02:00"),temp:10},{ts:new Date("2026-10-25T02:30:00+01:00"),temp:11}])')
        text = await page.locator('#expInterval').inner_text()
        assert '1 h 0 min 0 s' in text and 'UTC+02:00' in text and 'UTC+01:00' in text
        assert not errors, errors
        await page.screenshot(path='/tmp/meteo-interval-mobile.png',full_page=True)
        await browser.close()
    Path(args.output).write_text(json.dumps({'results':results,'requests':requests,'pageErrors':errors,
        'transport':'fixture CSV delayed 250ms; MQTT CDN blocked, UV mocked'},indent=2))
    print(args.output)

asyncio.run(main())
