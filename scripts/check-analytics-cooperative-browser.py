"""Offline real-UI regression of cooperative model preparation and cancellation.

Uses the original three configs, local SRI libraries and controlled CSV/UV.
The scheduler can be paused at callback boundaries; its real computation and
guards are retained. Run separately from performance profiles.
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs', required=True)
    parser.add_argument('--paho', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    html = Path('index.html').read_bytes()
    chart, paho = Path(args.chartjs).read_bytes(), Path(args.paho).read_bytes()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(name).read_text(encoding='utf-8-sig')) for name in files]
    now = datetime.fromisoformat('2026-10-23T12:00:00+02:00')
    requests, errors, sockets, downloads, checks, layouts = [], [], [], [], [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, timezone_id='Europe/Prague', reduced_motion='reduce', accept_downloads=True)
        await page.clock.set_fixed_time(now)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('websocket', lambda socket: sockets.append(socket.url))
        page.on('download', lambda download: downloads.append(download.suggested_filename))

        async def route(r):
            url = r.request.url
            name = urlparse(url).path.split('/')[-1]
            if url == 'http://meteo.test/dev/':
                return await r.fulfill(body=html, content_type='text/html')
            if 'chart.js' in url:
                return await r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            if 'paho-mqtt' in url:
                return await r.fulfill(body=paho, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            if name in files:
                return await r.fulfill(json=configs[files.index(name)])
            if 'docs.google.com' in url:
                station = next(i for i, cfg in enumerate(configs) if cfg['sheetId'] in url)
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq', [''])[0]
                requests.append({'kind': 'csv', 'station': station, 'quick': quick})
                rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
                for i in range(8 if quick else 32):
                    ts = now-timedelta(minutes=i*10)
                    voltage = '4.12' if station == 0 else '0' if station == 1 else ''
                    rows.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{18-station},1010,60,0,0,,{voltage}')
                return await r.fulfill(body='\n'.join(rows), content_type='text/csv')
            if 'api.open-meteo.com' in url:
                requests.append({'kind': 'uv'})
                return await r.fulfill(json={'hourly': {'uv_index': [0]*24}})
            return await r.abort()

        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('dataStatus.sheets.phase==="ok" && store.rows.length===8')
        await page.wait_for_load_state('networkidle')
        baseline_charts = await page.evaluate('Object.keys(Chart.instances).length')
        assert baseline_charts == 8
        await page.evaluate('''()=>{
          globalThis.realModelRun=analyticsRunModelJob;
          globalThis.pauseModel=true;globalThis.heldModel=null;
          analyticsRunModelJob=job=>{if(pauseModel){heldModel=job;return}return realModelRun(job)};
          globalThis.seedLargeHistory=()=>{
            cancelStationWork();analyticsInvalidate();
            const end=Date.parse('2026-10-23T12:00:00+02:00');
            store.rows=Array.from({length:100000},(_,i)=>({ts:new Date(end-Math.floor(i/2)*300000),
              temp:i===17?85:i===4321?12:i%29===0?null:i%71===0?0:10+Math.sin(i/40)*8,
              hum:i%23===0?null:i%53===0?0:60+Math.sin(i/33)*20,
              pressure:i%31===0?null:1010+Math.cos(i/100),
              voltage:i===4321?7:i%37===0?null:i%79===0?0:4+Math.sin(i/80)*.1,
              rain:i%48/10,rainInc:0,tank:null}));
            store.fullLoaded=true;store._fullLoadPending=false;
            globalThis.largeOriginal=store.rows;el('anaSync').checked=true;
          };
          seedLargeHistory();
        }''')
        await page.locator('[data-page="analytics"]').click()
        await page.wait_for_function('analyticsState.model!==null')  # Default seven-day selection is small.

        async def start_paused():
            await page.select_option('#anaRange', '24h')
            await page.evaluate('pauseModel=true;heldModel=null')
            await page.select_option('#anaRange', 'all')
            await page.wait_for_function('analyticsState.job!==null && heldModel===analyticsState.job')
            await page.evaluate('globalThis.staleModel=analyticsState.job')

        await start_paused()
        count_before = len(requests)
        assert await page.locator('#anaGrid').get_attribute('aria-busy') == 'true'
        assert 'Připravuji grafy' in await page.locator('#anaStatus').inner_text()
        assert await page.locator('#anaCanvas0').evaluate('e=>getComputedStyle(e).visibility==="hidden"')
        assert await page.locator('#anaExport0').is_disabled()
        assert await page.evaluate('analyticsState.model===null')
        await page.evaluate('realModelRun(staleModel)')
        assert await page.evaluate('analyticsState.job===staleModel && analyticsState.model===null')
        await page.evaluate('analyticsExport(0)')
        await page.wait_for_timeout(50)
        assert not downloads
        assert len(requests) == count_before
        checks.append('busy status/aria, hidden stale canvas, blocked PNG and no partial model or extra request')

        # A small range immediately replaces the pending large scope.
        await page.select_option('#anaRange', '24h')
        await page.evaluate('globalThis.smallModel=analyticsState.model;realModelRun(staleModel)')
        assert await page.evaluate('analyticsState.job===null && analyticsState.model===smallModel && smallModel.rows.length<1000')
        assert await page.locator('#anaGrid').get_attribute('aria-busy') == 'false'
        checks.append('range change cancels large job; stale callback cannot overwrite small result')

        # Invalid custom dates cancel too, without retaining a partial summary.
        await start_paused()
        await page.select_option('#anaRange', 'custom')
        await page.fill('#anaFrom', '2026-10-24')
        await page.fill('#anaTo', '2026-10-23')
        await page.locator('#anaApply').click()
        await page.evaluate('realModelRun(staleModel)')
        assert await page.evaluate('analyticsState.job===null && analyticsState.model===null && analyticsState.domain===null')
        assert 'Neplatné vlastní období' in await page.locator('#anaStatus').inner_text()
        assert await page.locator('#anaGrid').get_attribute('aria-busy') == 'false'
        checks.append('invalid custom dates cancel pending computation')

        await start_paused()
        await page.locator('[data-page="main"]').click()
        await page.evaluate('realModelRun(staleModel)')
        assert await page.evaluate('analyticsState.job===null && analyticsState.model===null && analyticsCharts.size===0')
        assert await page.evaluate('Object.keys(Chart.instances).length') == baseline_charts
        checks.append('navigation cancels, destroys charts and rejects late computation')

        # Original configs and CSV loader still handle each real station index.
        await page.locator('[data-page="analytics"]').click()
        await page.wait_for_function('analyticsState.job!==null && heldModel===analyticsState.job')
        await page.evaluate('globalThis.staleModel=analyticsState.job')
        await page.select_option('#anaStation', '1')
        await page.wait_for_function('activeIdx===1 && dataStatus.sheets.phase==="ok" && store.fullLoaded')
        await page.evaluate('globalThis.stationRows=store.rows;realModelRun(staleModel)')
        assert await page.evaluate('store.rows===stationRows && store.rows!==largeOriginal && analyticsState.job===null')
        assert await page.evaluate('store.rows.every(r=>r.voltage===0)')
        await page.select_option('#anaStation', '2')
        await page.wait_for_function('activeIdx===2 && dataStatus.sheets.phase==="ok" && store.fullLoaded')
        assert await page.evaluate('store.rows.every(r=>r.voltage===null)')
        await page.select_option('#anaStation', '0')
        await page.wait_for_function('activeIdx===0 && dataStatus.sheets.phase==="ok" && store.fullLoaded')
        assert await page.evaluate('CFG.name') == configs[0]['name']
        checks.append('station switch cancels old work; original three Sheets configs retain zero/missing voltage')

        await page.locator('[data-page="main"]').click()
        await page.evaluate('seedLargeHistory();pauseModel=false')
        count_before = len(requests)
        await page.locator('[data-page="analytics"]').click()
        await page.wait_for_function('analyticsState.model!==null && analyticsState.job===null')
        assert len(requests) == count_before
        assert await page.evaluate('''analyticsState.model.source===largeOriginal &&
          analyticsState.model.rows.length===100000 && analyticsState.model.summary.stats.temp.max===85 &&
          analyticsState.model.summary.stats.temp.min===0 && analyticsState.model.summary.stats.voltage.min===0 &&
          analyticsState.model.xy.some(p=>p.ts===+largeOriginal[4321].ts&&p.y===7) &&
          analyticsState.model.rows.every((r,i)=>r===largeOriginal[largeOriginal.length-1-i])''')
        assert await page.locator('#anaGrid').get_attribute('aria-busy') == 'false'

        async def visit_cards():
            for card in range(9):
                await page.locator(f'#anaCard{card}').scroll_into_view_if_needed()
                await page.wait_for_function('(id)=>el("anaCanvas"+id).style.visibility!=="hidden" && (id===8?analyticsState.heat!==null:analyticsCharts.has(id))', arg=card)
            await page.wait_for_function('analyticsState.loading===null')

        await visit_cards()
        assert await page.evaluate('analyticsCharts.size') == 8
        assert await page.evaluate('Object.keys(Chart.instances).length') == baseline_charts+8
        assert await page.evaluate('analyticsCharts.get(0).data.datasets[0].data.some(p=>p.y===85)')
        assert await page.evaluate('analyticsState.model.summary.stats.temp.count===largeOriginal.filter(r=>Number.isFinite(r.temp)).length')
        checks.append('100k complete exact-source model, bounded samples, all eight Chart graphs plus heatmap')

        # A valid observed night must reach the real battery card and its memo.
        # Keep other model fields intact; no data fetch or transport is involved.
        await page.locator('#anaCard5').scroll_into_view_if_needed()
        night_requests = len(requests)
        await page.evaluate('''()=>{
          globalThis.savedNightRows=analyticsState.model.rows;
          const day=new Date(2026,9,23),rise=calcSunTimes(Number(CFG.lat),Number(CFG.lon),day).rise;
          const end=+rise-3600000,start=end-2*3600000;
          analyticsState.model.rows=[{ts:new Date(start),voltage:4.125},
            {ts:new Date(end),voltage:4.1},{ts:new Date(+rise+3600000),voltage:4.2}];
          delete analyticsState.model.nightText;analyticsDrawCard(5);
          globalThis.expectedNight='Pozorovaný úsek poslední dokončené noci: '+fmt(-25,2)+' mV za '+fmt(2,2)+' h; '+fmtTime(new Date(start))+'–'+fmtTime(new Date(end))+'. Nepokrývá nutně celou noc.';
        }''')
        assert await page.evaluate('analyticsState.model.nightText===expectedNight && el("anaNote5").textContent.endsWith(expectedNight)')
        await page.evaluate('analyticsDrawCard(5)')
        assert await page.evaluate('analyticsState.model.nightText===expectedNight')
        assert len(requests) == night_requests
        await page.evaluate('analyticsState.model.rows=savedNightRows;delete analyticsState.model.nightText;analyticsDrawCard(5)')
        checks.append('battery card renders exact observed night ΔV/time, partial-night explanation and memo without requests')

        await page.locator('#anaCard0').scroll_into_view_if_needed()
        options = page.locator('#anaCard0 > details:not(.ana-info)')
        await options.locator('summary').click()
        await page.get_by_role('button', name='Přiblížit graf 1', exact=True).click()
        await page.wait_for_function('analyticsState.job===null && analyticsState.model!==null')
        assert await page.evaluate('analyticsState.domain.to-analyticsState.domain.from < analyticsState.base.to-analyticsState.base.from')
        await page.locator('#anaReset').click()
        await page.wait_for_function('analyticsState.job===null && analyticsState.model?.rows.length===100000')
        await page.locator('#anaCard0').scroll_into_view_if_needed()
        await page.wait_for_function('el("anaCanvas0").style.visibility!=="hidden"')
        async with page.expect_download() as download_info:
            await page.locator('#anaExport0').click()
        download = await download_info.value
        png = output.with_name('cooperative-graph.png')
        await download.save_as(png)
        assert png.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        await options.locator('summary').click()
        checks.append('real zoom/reset controls recompute large model and PNG succeeds after completion')

        for theme in ['darkblue', 'light']:
            await page.evaluate('(theme)=>setTheme(theme)', theme)
            for width in [1440, 320]:
                await page.set_viewport_size({'width': width, 'height': 1000})
                await page.locator('#anaCard0').scroll_into_view_if_needed()
                await page.wait_for_timeout(100)
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                columns = await page.locator('#anaGrid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
                assert columns == (3 if width == 1440 else 1), (width, columns)
                await page.screenshot(path=str(output.with_name(f'cooperative-{theme}-{width}.png')))
                layouts.append({'theme': theme, 'width': width, 'columns': columns})

        # The shared model is already ready. A large comparison must keep the
        # other eight cards usable while pairing its independent cache snapshot.
        await page.locator('#anaCard7').scroll_into_view_if_needed()
        await page.wait_for_function('analyticsState.loading===null && analyticsState.comparisonJob===null')
        await page.evaluate('''()=>{
          globalThis.realComparisonRun=analyticsRunComparisonJob;
          globalThis.pauseComparison=true;globalThis.heldComparison=null;
          analyticsRunComparisonJob=job=>{if(pauseComparison){heldComparison=job;return}return realComparisonRun(job)};
          for(const index of [1,2]){
            const c=analyticsCompact(store.rows);
            for(let i=0;i<c.count;i++){c.times[i]+=5000;c.temps[i]+=index;}
            analyticsStationCache.set(index,{...c,name:'Fixture '+index,loadedAt:Date.now(),preferences:analyticsSourceSignature(index)});
          }
          globalThis.readyModel=analyticsState.model;
          delete readyModel.comparison;delete readyModel.comparisonSignature;
          analyticsDrawCard(7);
        }''')
        await page.wait_for_function('analyticsState.comparisonJob!==null && heldComparison===analyticsState.comparisonJob')
        assert await page.locator('#anaCard7').get_attribute('aria-busy') == 'true'
        assert await page.locator('#anaGrid').get_attribute('aria-busy') == 'false'
        assert await page.locator('#anaExport7').is_disabled()
        assert await page.locator('#anaExport0').is_enabled()
        assert await page.evaluate('el("anaCanvas7").style.visibility==="hidden" && el("anaCanvas0").style.visibility!=="hidden"')
        comparison_requests = len(requests)
        await page.evaluate('globalThis.staleComparison=analyticsState.comparisonJob;realComparisonRun(staleComparison);analyticsExport(7)')
        assert await page.evaluate('analyticsState.model===readyModel && !readyModel.comparison')
        assert len(downloads) == 1
        assert len(requests) == comparison_requests
        await page.screenshot(path=str(output.with_name('comparison-busy-320.png')))
        # Replacing a foreign cache entry makes the queued old work obsolete.
        await page.evaluate('''()=>{
          analyticsStationCache.set(1,{...analyticsStationCache.get(1),name:'Updated fixture'});
          realComparisonRun(staleComparison);
        }''')
        await page.wait_for_function('analyticsState.comparisonJob!==staleComparison && heldComparison===analyticsState.comparisonJob')
        assert await page.evaluate('!readyModel.comparison')
        await page.evaluate('pauseComparison=false;realComparisonRun(analyticsState.comparisonJob)')
        await page.wait_for_function('readyModel.comparison && analyticsState.comparisonJob===null && el("anaCanvas7").style.visibility!=="hidden"')
        assert await page.locator('#anaCard7').get_attribute('aria-busy') == 'false'
        assert await page.locator('#anaExport7').is_enabled()
        assert await page.evaluate('readyModel.comparison.datasets.length===3 && readyModel.comparison.datasets.every(ds=>ds.data.length<=600)')
        assert 'Updated fixture' in await page.locator('#anaNote7').text_content()
        assert await page.evaluate('analyticsState.model===readyModel && readyModel.rows.length===100000')
        async with page.expect_download() as comparison_download:
            await page.evaluate('analyticsExport(7)')
        await (await comparison_download.value).save_as(output.with_name('comparison-graph.png'))
        assert output.with_name('comparison-graph.png').read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        for theme in ['darkblue', 'light']:
            await page.evaluate('(theme)=>setTheme(theme)', theme)
            for width in [1440, 320]:
                await page.set_viewport_size({'width':width,'height':1000})
                await page.locator('#anaCard7').scroll_into_view_if_needed()
                await page.wait_for_timeout(100)
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.screenshot(path=str(output.with_name(f'comparison-{theme}-{width}.png')))
        # Leaving releases the pending computation; an already queued callback
        # must not revive its result or chart.
        await page.evaluate('''()=>{pauseComparison=true;heldComparison=null;
          delete readyModel.comparison;delete readyModel.comparisonSignature;analyticsDrawCard(7)}''')
        await page.wait_for_function('heldComparison===analyticsState.comparisonJob && heldComparison!==null')
        await page.evaluate('globalThis.exitComparison=analyticsState.comparisonJob')
        await page.locator('[data-page="main"]').click()
        await page.evaluate('realComparisonRun(exitComparison)')
        assert await page.evaluate('analyticsState.comparisonJob===null && !readyModel.comparison')
        checks.append('100k comparison: only card7 busy, other graphs usable, no partial result/request, cache replacement rejects stale work, PNG after completion, two themes/widths, navigation cancels')

        await page.locator('[data-page="main"]').click()
        assert await page.evaluate('analyticsCharts.size===0 && analyticsState.job===null && analyticsState.model===null')
        assert await page.evaluate('Object.keys(Chart.instances).length') == baseline_charts
        assert not errors, errors
        assert not sockets, sockets
        version = browser.version
        await browser.close()
    output.write_text(json.dumps({'browser': version, 'checks': checks, 'layouts': layouts,
        'pageErrors': errors, 'webSockets': len(sockets), 'downloads': downloads,
        'transport': 'Original configs, controlled CSV/UV, local real SRI libraries; no live external service',
        'scope': 'Actual UI/Chart.js and resumable scheduler; paused callback boundaries exercise cancellation; no physical Safari/iOS'}, indent=2)+'\n')
    print(output)


if __name__ == '__main__':
    asyncio.run(main())
