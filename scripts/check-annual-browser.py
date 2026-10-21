"""Offline annual-statistics integration: actual startup, three configs, real DOM.

Optional --baseline compares every T/RH table and all numeric rain outputs with
the pre-change HTML. Requires the same local Playwright/Chromium as the profiler.
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
parser.add_argument('--baseline')
args = parser.parse_args()

VIEW = """() => [...document.querySelectorAll('#yearStatsContent .ys-year')].map(year=>({
  year:year.querySelector('.ys-year-title').textContent,
  summary:year.querySelector('.ys-year-summary').textContent,
  tables:[...year.querySelectorAll('table')].map(table=>table.innerText),
  rain:[...year.children[1].children].map(span=>{
    const copy=span.cloneNode(true);
    copy.querySelectorAll('b,.ys-tip-icon,.ys-tip-box').forEach(node=>node.remove());
    return copy.textContent.trim();
  })
}))"""

async def main():
    screenshot = Path(args.output).with_suffix('.png')
    screenshot.parent.mkdir(parents=True,exist_ok=True)
    html = Path('index.html').read_text()
    chart = Path(args.chartjs).read_text()
    files = ['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs = [json.loads(Path(file).read_text(encoding='utf-8-sig')) for file in files]
    now = datetime.fromisoformat('2026-10-21T12:00:00+02:00')
    bodies = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            date = now - timedelta(days=i)
            temp = '' if i % 11 == 0 else (85 if i == 700 else 10+station*10+i/100)
            hum = '' if i % 7 == 0 else i % 101
            lines.append(f'{date:%d.%m.%Y},12:00,{temp},1010,{hum},{i%17/10},{i%24/10},,4')
        bodies.append(lines)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        context = await browser.new_context(viewport={'width':390,'height':844},timezone_id='Europe/Prague')
        page = await context.new_page()
        await page.clock.set_fixed_time(now)
        errors, requests, results = [], [], []
        page.on('pageerror',lambda error:errors.append(str(error)))
        async def route(r):
            url = r.request.url
            filename = urlparse(url).path.split('/')[-1]
            if url == 'http://meteo.test/dev/':
                await r.fulfill(body=html,content_type='text/html')
            elif 'chart.js' in url:
                await r.fulfill(body=chart,content_type='text/javascript')
            elif filename in files:
                await r.fulfill(body=json.dumps(configs[files.index(filename)]),content_type='application/json')
            elif 'docs.google.com' in url:
                station = next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                requests.append({'station':station,'quick':quick})
                await r.fulfill(body='\n'.join(bodies[station][:401] if quick else bodies[station]),content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:
                await r.abort()
        await page.route('**/*',route)
        baseline = None
        if args.baseline:
            baseline = await context.new_page()
            source = Path(args.baseline).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
            async def old_route(r):
                if r.request.url == 'http://baseline.test/dev/':
                    await r.fulfill(body=source,content_type='text/html')
                elif 'chart.js' in r.request.url:
                    await r.fulfill(body=chart,content_type='text/javascript')
                else:
                    await r.abort()
            await baseline.route('**/*',old_route)
            baseline.on('pageerror',lambda error:errors.append('baseline: '+str(error)))
            await baseline.goto('http://baseline.test/dev/')

        async def compare_baseline():
            if baseline:
                data = await page.evaluate('JSON.parse(JSON.stringify(store.rows))')
                await baseline.evaluate('''data=>{
                  store.rows=data.map(row=>({...row,ts:new Date(row.ts)}));
                  document.querySelectorAll('.tab-pane').forEach(pane=>pane.classList.toggle('active',pane.id==='tab-yearstats'));
                  invalidateDerivedData();store.fullLoaded=true;el('yearStatsFilter').value='0';buildYearlyStats();
                }''',data)
                actual, expected = await page.evaluate(VIEW), await baseline.evaluate(VIEW)
                assert actual == expected, json.dumps({'actual':actual,'expected':expected},ensure_ascii=False)

        await page.goto('http://meteo.test/dev/')
        for station in range(3):
            if station:
                await page.locator('.tab-btn[data-tab="now"]').click()
                await page.evaluate('(station)=>switchStation(station)',station)
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400',arg=station)
            await page.locator('.tab-btn[data-tab="yearstats"]').click()
            await page.wait_for_function('store.fullLoaded && store.rows.length===1000 && document.querySelectorAll(".ys-year").length===3')
            await page.select_option('#yearStatsFilter','0')
            await compare_baseline()
            network_before = len(requests)
            await page.select_option('#yearStatsFilter','2025')
            assert await page.locator('.ys-year-title').all_text_contents() == ['2025']
            await page.evaluate('buildYearlyStats()')
            assert await page.locator('#yearStatsFilter').input_value() == '2025'
            await page.select_option('#yearStatsFilter','2024')
            await page.evaluate('''store.rows.find(row=>row.ts.getFullYear()===2024).temp=99;
              invalidateDerivedData();buildYearlyStats();''')
            assert '99.0 °C' in await page.locator('.ys-year-summary').inner_text()
            await page.select_option('#yearStatsFilter','0')
            await compare_baseline()
            assert len(requests) == network_before
            for theme in ['darkblue','light']:
                await page.evaluate('(theme)=>setTheme(theme)',theme)
                assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            results.append({'station':station,'rows':1000,'years':[2026,2025,2024],
                'baselineValuesMatch':bool(baseline),'filterAddsRequests':len(requests)-network_before,
                'oldYearCorrection':99,'checks':'passed'})
        await page.select_option('#yearStatsFilter','2026')
        await page.screenshot(path=str(screenshot),full_page=True)
        await page.set_viewport_size({'width':1280,'height':900})
        await page.locator('.ys-tip').nth(1).hover()
        assert await page.locator('.ys-tip-box').nth(1).is_visible()
        assert 'nelze označit za hodinový úhrn' in await page.locator('.ys-tip-box').nth(1).inner_text()
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        await page.evaluate('''store.rows=[{ts:new Date(2027,0,1),temp:null,hum:0,rain:0,rainInc:0}];
          buildYearlyStats();''')
        assert await page.locator('#yearStatsFilter').input_value() == '0'
        assert await page.locator('.ys-year-title').all_text_contents() == ['2027']
        assert 'NaN' not in await page.locator('#yearStatsContent').inner_text()
        await page.evaluate('store.rows=[];buildYearlyStats()')
        assert await page.locator('#yearStatsFilter option').count() == 1
        assert 'Žádná data' in await page.locator('#yearStatsContent').inner_text()
        assert not errors, errors
        await browser.close()
    Path(args.output).write_text(json.dumps({'results':results,'pageErrors':errors,'requests':requests,
        'emptyAndRemovedYear':'passed','mobile390AndDesktop1280':'passed',
        'transport':'fixture CSV/UV, MQTT CDN blocked; baseline startup disabled'},indent=2))
    print(args.output)

asyncio.run(main())
