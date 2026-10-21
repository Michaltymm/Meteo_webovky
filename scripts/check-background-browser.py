"""Real UI/timers with controlled visibility events and offline CSV/UV fixtures.
Requires Python Playwright, /usr/bin/chromium and a local Chart.js 4.4.0 file.
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
    html, chart = Path('index.html').read_text(), Path(args.chartjs).read_text()
    files = ['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    now = datetime(2026,10,21,12,tzinfo=ZoneInfo('Europe/Prague'))
    bodies = {}
    corrected = False
    for station in range(3):
        rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            d = now-timedelta(minutes=5*i)
            rows.append(f'{d:%d.%m.%Y},{d:%H:%M:%S},{85 if i==17 else 10+station},1010,60,0,0,,4')
        bodies[station] = rows
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague')
        await page.clock.install(time=now)
        await page.add_init_script('''window.syntheticHidden=false;
          Object.defineProperty(document,'hidden',{configurable:true,get:()=>syntheticHidden});
          window.visibility=hidden=>{syntheticHidden=hidden;document.dispatchEvent(new Event('visibilitychange'))};''')
        requests, errors = [], []
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def route(r):
            url=r.request.url
            name=urlparse(url).path.split('/')[-1]
            if url=='http://meteo.test/dev/':await r.fulfill(body=html,content_type='text/html')
            elif 'chart.js' in url:await r.fulfill(body=chart,content_type='text/javascript')
            elif name in files:await r.fulfill(body=json.dumps(configs[files.index(name)]),content_type='application/json')
            elif 'docs.google.com' in url:
                station=next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick='LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                rows=bodies[station].copy()
                if corrected and station==0:rows[901]=rows[901].replace(',10,1010,',',99,1010,')
                requests.append({'kind':'sheets','station':station,'quick':quick})
                await asyncio.sleep(.15)
                await r.fulfill(body='\n'.join(rows[:401] if quick else rows),content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                requests.append({'kind':'uv'})
                await asyncio.sleep(.15)
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:await r.abort()
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===400 && !sheetsLoad && !uvLoad && !overviewLoad')
        await page.evaluate('fetchSheets(true)')
        assert await page.evaluate('store.rows.length')==1000
        assert '85.0' in await page.locator('#statTempMax').inner_text()
        await page.evaluate('window.beforeSnapshot=dataAggregates();visibility(true)')
        before=len(requests)
        await page.clock.fast_forward(600000)
        await page.wait_for_timeout(50)
        assert len(requests)==before
        await page.evaluate('visibility(false);for(let i=0;i<10;i++){visibility(true);visibility(false)}')
        await page.wait_for_function('!sheetsLoad && !overviewLoad && !uvLoad')
        assert len(requests)-before==3
        assert await page.evaluate('aggregateCache===beforeSnapshot')
        for _ in range(5):await page.evaluate('visibility(true);visibility(false)')
        assert len(requests)-before==3
        corrected=True
        await page.evaluate('fetchSheets(true)')
        assert '99.0' in await page.locator('#statTempMax').inner_text()
        assert await page.evaluate('aggregateCache!==beforeSnapshot && store.rows.length===1000')
        await page.locator('.tab-btn[data-tab="monthly"]').click()
        assert await page.evaluate('chartMonthly.data.datasets[0].data.length')>0
        await page.locator('.tab-btn[data-tab="daily"]').click()
        await page.evaluate('visibility(true)')
        midnight_before=len(requests)
        await page.clock.fast_forward(86400000)
        assert len(requests)==midnight_before
        await page.evaluate('visibility(false)')
        await page.wait_for_function('!sheetsLoad && !overviewLoad && !uvLoad')
        assert len(requests)-midnight_before==4
        assert await page.locator('#dayTempMax').inner_text()=='–'
        assert 'Žádná data' in await page.locator('#dailyGrid').inner_text()
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert not errors,errors
        results={'hidden10minRequests':0,'return10minRequests':3,'hidden24hRequests':0,'return24hRequests':4,
          'historicalCorrection':'85 → 99, all 1000 original rows retained','pageErrors':errors,
          'charts':await page.evaluate('Object.keys(Chart.instances).length'),
          'transport':'offline fixtures; real browser timers, synthetic document.hidden + visibilitychange',
          'requests':requests}
        await browser.close()
    Path(args.output).write_text(json.dumps(results,indent=2))
    print(args.output)

asyncio.run(main())
