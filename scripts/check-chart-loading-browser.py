"""Exercise delayed and failed Chart.js requests with offline station fixtures."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs', required=True)
    parser.add_argument('--paho', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    html = Path('index.html').read_bytes()
    assets = {'chart.js': Path(args.chartjs).read_bytes(), 'paho-mqtt': Path(args.paho).read_bytes()}
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = {name: json.loads(Path(name).read_text(encoding='utf-8-sig')) for name in files}
    checks = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for scenario in ['explorer', 'analytics', 'failed']:
            page = await browser.new_page(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Prague')
            await page.clock.set_fixed_time('2026-11-24T12:00:00Z')
            gate = asyncio.Event()
            errors = []
            requests = []
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def route(request):
                url = request.request.url
                parsed = urlparse(url)
                name = parsed.path.split('/')[-1]
                if parsed.hostname == 'meteo.test' and parsed.path == '/dev/':
                    return await request.fulfill(body=html, content_type='text/html')
                for library, body in assets.items():
                    if library in url:
                        if library == 'chart.js':
                            requests.append('chart')
                            await gate.wait()
                            if scenario == 'failed':
                                return await request.abort('failed')
                        return await request.fulfill(body=body, content_type='application/javascript',
                                                     headers={'Access-Control-Allow-Origin': '*'})
                if name in configs:
                    return await request.fulfill(json=configs[name])
                if parsed.hostname == 'docs.google.com':
                    station = next(i for i, file in enumerate(files) if configs[file]['sheetId'] in parsed.path)
                    body = ('Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n'
                            f'24.11.2026,12:00,{20 + station},1010,60,0,0,,4')
                    return await request.fulfill(body=body, content_type='text/csv')
                if parsed.hostname == 'api.open-meteo.com':
                    return await request.fulfill(json={'hourly': {'uv_index': [0] * 24}})
                return await request.abort()

            await page.route('**/*', route)
            await page.goto('http://meteo.test/dev/#moderni2', wait_until='commit')
            await page.wait_for_function('typeof chartLibraryReady==="function" && el("simpleTemp").textContent==="20.0" && !chartLibraryReady()')
            status = page.locator('#chartLibraryStatus')
            assert not await status.is_visible()
            await page.select_option('#simpleStation', '1')
            await page.wait_for_function('el("simpleTemp").textContent==="21.0" && activeIdx===1')
            if scenario == 'analytics':
                await page.locator('[data-page="analytics"]').click()
                await page.locator('#anaCard0').scroll_into_view_if_needed()
                await page.wait_for_function('analyticsState.visible.has(0) && el("anaExport0").disabled')
            else:
                await page.locator('[data-page="modern"]').click()
                await page.locator('.tab-btn[data-tab="explorer"]').click()
                await page.wait_for_function('store.fullLoaded && !chartExplorer')
                await page.select_option('#expMetric', 'temp')
            assert 'Načítám' in await status.inner_text()

            gate.set()
            await page.wait_for_function('chartLibraryFinished')
            if scenario == 'analytics':
                await page.wait_for_function('analyticsCharts.get(0)?.data.datasets[0].data.some(p=>p.y===21)')
                assert not await status.is_visible()
            elif scenario == 'explorer':
                await page.wait_for_function('chartExplorer?.data.datasets[0]?.data[0]===21')
                assert not await status.is_visible()
                assert await page.evaluate('chartOverview===null && analyticsCharts.size===0')
            else:
                assert 'nepodařilo' in await status.inner_text()
                await page.locator('.tab-btn[data-tab="overview"]').click()
                await page.wait_for_function('el("ovTableBody").textContent.includes("21.0")')
                assert await page.evaluate('!chartOverview && !chartLibraryReady()')
                await page.locator('.tab-btn[data-tab="hist"]').click()
                assert not await status.is_visible()
                assert '21.0' in await page.locator('#histTableBody').inner_text()
                await page.locator('[data-page="analytics"]').click()
                await page.locator('#anaCard8').scroll_into_view_if_needed()
                await page.wait_for_function('analyticsState.heat!==null && !chartLibraryReady()')
                await page.locator('[data-page="modern2"]').click()
                assert await page.locator('#simpleTemp').inner_text() == '21.0'
            assert requests == ['chart'] and not errors, (scenario, requests, errors)
            checks.append(scenario)
            await page.close()
        await browser.close()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'checks': checks, 'pageErrors': []}, indent=2)+'\n')
    print(output)


if __name__ == '__main__':
    asyncio.run(main())
