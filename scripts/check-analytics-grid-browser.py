"""Offline integration for the analytics grid using real Chromium/Chart.js.

Uses original station configs and application startup/parser with controlled CSV/UV.
Run separately from timed profiles. Keep output JSON and screenshots under /tmp.
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse
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
    configs = [json.loads(Path(name).read_text(encoding='utf-8-sig')) for name in files]
    now = datetime.fromisoformat('2026-10-22T12:00:00+02:00')
    row_count = 3000
    bodies = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(row_count):
            ts = now-timedelta(minutes=30*(i//2))  # Deliberate duplicated timestamps.
            temp = '' if i%17 == 0 else 0 if i%71 == 0 else 10+station*5+(i%101)/10
            if i == 777: temp = 85
            hum = '' if i%23 == 0 else 0 if i%53 == 0 else 40+i%50
            pressure = '' if i%29 == 0 else 1000+i/1000
            voltage = '' if station == 1 or i%31 == 0 else 0 if station == 2 else 4+i/100000
            lines.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{temp},{pressure},{hum},0.1,{(i%48)/10},,{voltage}')
        bodies.append(lines)

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width':1440, 'height':1000}, timezone_id='Europe/Prague', reduced_motion='reduce', accept_downloads=True)
        await page.clock.set_fixed_time(now)
        errors, requests, results, layouts = [], [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        remote_failure = {'station':None}
        delayed = {'enabled':False, 'gate':asyncio.Event(), 'started':asyncio.Event()}
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
                requests.append({'station':station,'quick':quick,'url':url})
                if station == remote_failure['station'] and not quick:
                    await r.fulfill(body='controlled failure',status=503);return
                if delayed['enabled'] and station != await page.evaluate('activeIdx') and not quick:
                    delayed['started'].set()
                    await delayed['gate'].wait()
                else:
                    await asyncio.sleep(.05 if quick else .15)
                try:
                    await r.fulfill(body='\n'.join(bodies[station][:401] if quick else bodies[station]), content_type='text/csv')
                except Exception:
                    if not delayed['enabled']: raise
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}), content_type='application/json')
            else:
                await r.abort()
        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===400')
        baseline = await page.evaluate('Object.keys(Chart.instances).length')
        assert baseline == 8
        assert await page.evaluate('analyticsCharts.size') == 0
        await page.evaluate('''()=>{const original=analyticsSummarize;globalThis.gridSummaryCalls=0;
          analyticsSummarize=(...args)=>{gridSummaryCalls++;return original(...args)};}''')
        assert await page.locator('#page-main').is_visible()
        assert await page.locator('.top-row').is_visible()
        assert not await page.locator('#tab-analytics').is_visible()
        await page.screenshot(path=str(output.with_name(output.stem+'-main.png')))
        # Preserve the dashboard's selected subtab across full-page navigation.
        await page.locator('.tab-btn[data-tab="daily"]').click()
        await page.wait_for_function('store.fullLoaded')
        before = len(requests)
        await page.locator('.page-link[data-page="analytics"]').click()
        await page.wait_for_function('(n)=>store.fullLoaded && store.rows.length===n', arg=row_count)
        await page.wait_for_function('analyticsState.model!==null')
        assert len(requests) == before
        assert await page.locator('#page-main').is_hidden()
        assert await page.locator('#dashboardBars').is_hidden()
        assert await page.locator('.top-row').is_hidden()
        assert await page.locator('.tabs').is_hidden()
        assert await page.locator('#tab-analytics').is_visible()
        assert await page.locator('.page-link[data-page="analytics"]').get_attribute('aria-current') == 'page'
        assert await page.evaluate('location.hash') == '#analytika'
        assert await page.locator('#tab-analytics').evaluate('e=>!document.querySelector("#stationData").contains(e)')
        await page.go_back()
        assert await page.locator('#page-main').is_visible()
        assert await page.locator('#tab-daily').is_visible()
        assert await page.locator('#tab-analytics').is_hidden()
        assert await page.evaluate('analyticsCharts.size') == 0
        await page.go_forward()
        await page.wait_for_function('analyticsState.model!==null')
        assert await page.locator('#page-main').is_hidden()
        results.append({'topLevelPages':True,'historyBackForward':True,'dashboardSubtabRetained':True,'sharedHistoryNoRefetch':True})
        assert await page.locator('#tab-analytics canvas').count() == 9
        assert await page.evaluate('analyticsCharts.size') <= 8  # A tall desktop may already expose all cards.

        async def visit_cards():
            for card in range(9):
                await page.locator('#anaCard'+str(card)).scroll_into_view_if_needed()
                await page.wait_for_timeout(100)
                if card < 8:
                    await page.wait_for_function('(id)=>analyticsCharts.has(id)', arg=card)
            assert await page.evaluate('analyticsCharts.size') == 8
            assert await page.evaluate('Object.keys(Chart.instances).length') == baseline+8
        await visit_cards()
        await page.select_option('#anaRange','all')
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_timeout(100)
        before = len(requests)
        oracle = await page.evaluate('''()=>{
          const valid=store.rows.filter(r=>Number.isFinite(r.temp));
          return {count:valid.length,min:Math.min(...valid.map(r=>r.temp)),max:Math.max(...valid.map(r=>r.temp)),
            pairs:store.rows.filter(r=>Number.isFinite(r.temp)&&Number.isFinite(r.voltage)).length};
        }''')
        assert oracle['max'] == 85
        # The plotted extrema include the isolated spike; summary statistics must
        # remain over original rows, rather than the reduced visual series.
        time_points = await page.evaluate('analyticsCharts.get(0).data.datasets.flatMap(d=>d.data).filter(p=>p&&Number.isFinite(p.y)).map(p=>p.y)')
        assert 85 in time_points
        assert await page.evaluate('analyticsCharts.get(0).options.scales.x.type') == 'linear'
        assert await page.evaluate('analyticsCharts.get(4).data.datasets.length') >= 2
        assert 'mV' in await page.locator('#anaCard5').inner_text()
        assert 'korel' in (await page.locator('#anaCard6').inner_text()).lower()
        await page.locator('#anaCard6').scroll_into_view_if_needed()
        await page.wait_for_timeout(100)
        assert await page.evaluate('''()=>{const c=analyticsCharts.get(6),xs=c.data.datasets.flatMap(d=>d.data.map(p=>p.x));return c.scales.x.min<=Math.min(...xs) && c.scales.x.max>=Math.max(...xs)}''')
        assert await page.evaluate('analyticsCharts.get(6).scales.x.max') >= 85
        assert await page.locator('#anaHeatMetric').count() == 1
        # Period switches use the already loaded original history.
        for period in ['24h','7','30','90','365','all']:
            await page.select_option('#anaRange',period)
            await page.wait_for_timeout(60)
            assert len(requests) == before
        await page.select_option('#anaRange','custom')
        await page.fill('#anaFrom','2026-10-20')
        await page.fill('#anaTo','2026-10-22')
        await page.locator('#anaApply').click()
        await page.wait_for_timeout(100)
        assert len(requests) == before
        # A valid empty period must show an empty state and clear old points.
        await page.fill('#anaFrom','2020-01-01')
        await page.fill('#anaTo','2020-01-02')
        await page.locator('#anaApply').click()
        await page.wait_for_timeout(100)
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_timeout(100)
        assert 'nejsou' in (await page.locator('#anaCard0').inner_text()).lower()
        assert await page.evaluate('analyticsCharts.get(0).data.datasets.every(d=>!d.data.length)')
        await page.select_option('#anaRange','all')
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_timeout(100)
        domain_before = await page.evaluate('(()=>{const s=analyticsCharts.get(0).scales.x;return [s.min,s.max]})()')
        await page.evaluate('analyticsZoom(0,.5)')
        await page.wait_for_timeout(100)
        zoomed = await page.evaluate('(()=>{const s=analyticsCharts.get(0).scales.x;return [s.min,s.max]})()')
        assert zoomed[1]-zoomed[0] < domain_before[1]-domain_before[0]
        await page.evaluate('analyticsPan(0,.25)')
        await page.wait_for_timeout(100)
        panned = await page.evaluate('(()=>{const s=analyticsCharts.get(0).scales.x;return [s.min,s.max]})()')
        assert panned != zoomed
        await page.locator('#anaReset').click()
        await page.wait_for_timeout(100)
        reset = await page.evaluate('(()=>{const s=analyticsCharts.get(0).scales.x;return [s.min,s.max]})()')
        assert reset == domain_before
        await page.uncheck('#anaSync')
        await page.wait_for_timeout(80)
        other_domain = await page.evaluate('(()=>{const s=analyticsCharts.get(1).scales.x;return [s.min,s.max]})()')
        await page.evaluate('analyticsZoom(0,.5)')
        await page.locator('#anaCard1').scroll_into_view_if_needed()
        await page.wait_for_timeout(100)
        assert await page.evaluate('(()=>{const s=analyticsCharts.get(1).scales.x;return [s.min,s.max]})()') == other_domain
        await page.check('#anaSync')
        await page.locator('#anaReset').click()
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_timeout(80)
        # Native Chart.js legend remains interactive.
        await page.locator('#anaCanvas0').evaluate("e=>e.scrollIntoView({block:'center'})")
        await page.wait_for_timeout(100)
        point = await page.evaluate('''()=>{const b=analyticsCharts.get(0).legend.legendHitBoxes[0];return {x:b.left+b.width/2,y:b.top+b.height/2}}''')
        visible_before = await page.evaluate('analyticsCharts.get(0).isDatasetVisible(0)')
        await page.locator('#anaCanvas0').click(position=point)
        await page.wait_for_timeout(100)  # Chart.js throttles native events to the next frame.
        assert await page.evaluate('analyticsCharts.get(0).isDatasetVisible(0)') != visible_before
        await page.locator('#anaCanvas0').click(position=point)
        async with page.expect_download() as export_info:
            await page.evaluate('analyticsExport(0)')
        export = await export_info.value
        assert export.suggested_filename.endswith('.png')
        export_path = output.with_name(output.stem+'-export.png')
        await export.save_as(export_path)
        assert export_path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        await page.evaluate('analyticsExpand(0)')
        await page.wait_for_timeout(150)
        expanded_width = await page.locator('#anaCard0').evaluate('(e)=>e.getBoundingClientRect().width')
        assert expanded_width > 1000
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(100)
        assert await page.locator('#anaCard0').evaluate('(e)=>e.getBoundingClientRect().width') < expanded_width
        results.append({'station':0,'originalTemperature':oracle,'periodSwitchesWithoutFetch':True,'zoomPanReset':True,'legend':True,'expandedEscape':True,'emptyRange':True})

        # Explicit comparison load fetches each inactive history once, then cache
        # serves repeated loads and period changes.
        await page.locator('#anaCard7').scroll_into_view_if_needed()
        await page.locator('#anaCompareLoad').click()
        await page.wait_for_function('analyticsStationCache.size>=2 && analyticsState.loading===null')
        await page.wait_for_timeout(100)
        cached_requests = len(requests)
        await page.evaluate('analyticsLoadStations()')
        await page.wait_for_timeout(150)
        assert len(requests) == cached_requests
        comparison = await page.evaluate('analyticsCharts.get(7).data.datasets.map(d=>({label:d.label,n:d.data.length}))')
        assert len(comparison) == 3 and all(d['n'] for d in comparison)
        assert all(any(config['name'] in d['label'] for d in comparison) for config in configs)
        # Heatmap control and drill-down are derived from full original rows.
        await page.locator('#anaCard8').scroll_into_view_if_needed()
        await page.select_option('#anaHeatMetric','hum')
        await page.wait_for_timeout(100)
        await page.locator('#anaCanvas8').click(position={'x':140,'y':80})
        assert await page.locator('#anaHeatDetail').inner_text()
        for width,columns in [(1440,3),(800,2),(390,1),(320,1)]:
            await page.set_viewport_size({'width':width,'height':1000})
            await page.wait_for_timeout(150)
            for theme in ['darkblue','light']:
                await page.evaluate('(t)=>setTheme(t)',theme)
                await page.wait_for_timeout(100)
                assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
                assert await page.locator('.page-link[data-page="main"]').is_visible()
                assert await page.locator('.page-link[data-page="analytics"]').is_visible()
                actual_columns = await page.locator('#anaCard0').evaluate('e=>getComputedStyle(e.parentElement).gridTemplateColumns.split(" ").length')
                assert actual_columns == columns, (width,actual_columns,columns)
                if width in [1440,390] and theme == 'darkblue':
                    await page.evaluate('window.scrollTo(0,0)')
                    await page.wait_for_timeout(100)
                    await page.screenshot(path=str(output.with_name(output.stem+'-'+str(width)+'.png')))
                layouts.append({'width':width,'theme':theme,'columns':columns,'overflow':False})
        await page.set_viewport_size({'width':1440,'height':1000})
        await page.evaluate('setTheme("darkblue")')
        await page.wait_for_timeout(150)
        await visit_cards()
        await page.locator('#tab-analytics').screenshot(path=str(output.with_suffix('.png')))
        # All three real station selections retain missing/zero voltage behavior.
        for station in [1,2,0]:
            await page.locator('#anaStation').select_option(str(station))
            await page.wait_for_function('(i)=>activeIdx===i && store.fullLoaded && store.rows.length===3000', arg=station)
            await page.wait_for_function('analyticsState.model!==null')
            await visit_cards()
            voltage_rows = await page.evaluate('store.rows.filter(r=>Number.isFinite(r.voltage)).length')
            if station == 1:
                assert voltage_rows == 0
                assert await page.evaluate('analyticsCharts.get(4).data.datasets.filter(d=>d.yAxisID!=="temp").every(d=>d.data.every(p=>p.y===null))')
            if station == 2:
                assert voltage_rows > 0
                assert await page.evaluate('store.rows.filter(r=>Number.isFinite(r.voltage)).every(r=>r.voltage===0)')
            results.append({'station':station,'stationSelection':True,'voltageSamples':voltage_rows})
        await page.locator('.page-link[data-page="main"]').focus()
        await page.keyboard.press('Enter')
        await page.wait_for_timeout(100)
        assert await page.locator('#tab-daily').is_visible()
        assert await page.evaluate('analyticsCharts.size') == 0
        assert await page.evaluate('Object.keys(Chart.instances).length') == baseline
        summary_calls = await page.evaluate('gridSummaryCalls')
        await page.evaluate('refreshUI()')
        await page.wait_for_timeout(80)
        assert await page.evaluate('gridSummaryCalls') == summary_calls
        # Repeated visits must release charts, rather than grow their count.
        for _ in range(3):
            await page.locator('.page-link[data-page="analytics"]').click()
            await page.wait_for_function('analyticsState.model!==null')
            await visit_cards()
            await page.locator('.page-link[data-page="main"]').click()
            await page.wait_for_timeout(60)
            assert await page.evaluate('Object.keys(Chart.instances).length') == baseline
        # A failed renewal keeps clearly labelled cached data. A late response
        # after leaving must never resurrect charts or replace the active rows.
        await page.locator('.page-link[data-page="analytics"]').click()
        await page.locator('#anaCard7').scroll_into_view_if_needed()
        await page.wait_for_function('analyticsStationCache.size>=2 && analyticsState.loading===null')
        remote_failure['station']=1
        await page.evaluate('analyticsLoadStations(true)')
        assert 'obnova selhala' in await page.locator('#anaNote7').inner_text()
        assert await page.evaluate('analyticsCharts.get(7).data.datasets.length') == 3
        remote_failure['station']=None
        await page.evaluate('analyticsLoadStations(true)')
        delayed['enabled']=True
        await page.evaluate('globalThis.beforeForeignExit=store.rows;void analyticsLoadStations(true)')
        await asyncio.wait_for(delayed['started'].wait(),timeout=5)
        await page.locator('.page-link[data-page="main"]').click()
        delayed['gate'].set()
        await page.wait_for_timeout(200)
        assert await page.evaluate('analyticsCharts.size===0 && store.rows===beforeForeignExit')
        delayed['enabled']=False
        # Touch-enabled mobile navigation, tooltip, lazy cards and heat selection.
        await page.close()
        page=await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',reduced_motion='reduce',has_touch=True,is_mobile=True)
        page.on('pageerror',lambda error:errors.append(str(error)))
        await page.clock.set_fixed_time(now)
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/#analytika')
        assert await page.locator('#page-main').is_hidden()
        assert await page.locator('#tab-analytics').is_visible()
        await page.wait_for_function('store.fullLoaded')
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_function('analyticsCharts.has(0)')
        assert await page.evaluate('analyticsCharts.size') < 8
        await page.locator('#anaCanvas0').evaluate("e=>e.scrollIntoView({block:'center'})")
        point=await page.evaluate("""()=>{const a=analyticsCharts.get(0).chartArea;return {x:(a.left+a.right)/2,y:(a.top+a.bottom)/2}}""")
        await page.locator('#anaCanvas0').tap(position=point)
        await page.wait_for_timeout(150)
        assert await page.evaluate('analyticsCharts.get(0).tooltip.opacity') > 0
        await page.locator('#anaCard8').scroll_into_view_if_needed()
        await page.wait_for_function('analyticsState.heat!==null')
        await page.locator('#anaCanvas8').evaluate("e=>e.scrollIntoView({block:'center'})")
        cell=await page.evaluate("""()=>{const l=analyticsState.heat.layout;return {x:l.left+l.cw*13.5,y:l.top+l.ch*.5}}""")
        await page.locator('#anaCanvas8').tap(position=cell)
        assert await page.evaluate('analyticsState.heat.hour') == 13
        await page.locator('#anaCanvas8').focus();await page.keyboard.press('ArrowRight')
        assert await page.evaluate('analyticsState.heat.hour') == 14
        results.append({'touchTooltip':True,'touchHeatCell':True,'heatKeyboard':True,'mobileLazy':True,'directAnalyticsURL':True,'failedRefreshLabel':True,'lateForeignResponseIgnored':True})
        assert not errors, errors
        version = browser.version
        await browser.close()
    output.write_text(json.dumps({'browser':version,'results':results,'layouts':layouts,'comparison':comparison,'pageErrors':errors,
        'requests':requests,'transport':'Original three configs; controlled CSV/UV; MQTT CDN blocked'},indent=2))
    print(output)


asyncio.run(main())
