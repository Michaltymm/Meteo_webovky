"""Offline A → B → A profile with real configs and a delayed return response."""
import argparse
import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', required=True)
    parser.add_argument('--chartjs', required=True)
    parser.add_argument('--paho', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(file).read_text(encoding='utf-8-sig')) for file in files]
    assets = {'chart.js': Path(args.chartjs).read_bytes(), 'paho-mqtt': Path(args.paho).read_bytes()}
    now = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
    csv = []
    for i in range(3):
        rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka']
        for j in range(400):
            timestamp = now - timedelta(minutes=j)
            voltage = '4.12' if i == 0 else '0' if i == 1 else ''
            rows.append(f'{timestamp:%d.%m.%Y},{timestamp:%H:%M:%S},{18+i},1010,50,0,0,,{voltage},id{j}')
        csv.append('\n'.join(rows))
    results = {}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for variant, path in [('before', args.before), ('after', 'index.html')]:
            page = await browser.new_page(viewport={'width': 390, 'height': 844},
                                          timezone_id='Europe/Prague', reduced_motion='reduce')
            await page.clock.set_fixed_time(now)
            html = Path(path).read_bytes()
            returning = False
            return_requests = []
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def route(request):
                url = request.request.url
                parsed = urlparse(url)
                name = parsed.path.split('/')[-1]
                if parsed.hostname == 'meteo.test' and parsed.path == '/dev/':
                    return await request.fulfill(body=html, content_type='text/html')
                if name in files:
                    return await request.fulfill(json=configs[files.index(name)])
                for library, body in assets.items():
                    if library in url:
                        return await request.fulfill(body=body, content_type='application/javascript',
                                                     headers={'Access-Control-Allow-Origin': '*'})
                if parsed.hostname == 'docs.google.com':
                    query = parse_qs(parsed.query)
                    index = next(i for i, config in enumerate(configs) if config['sheetId'] in parsed.path)
                    if returning and index == 0 and 'LIMIT 400' in query.get('tq', [''])[0]:
                        return_requests.append(len(csv[index].encode()))
                        await asyncio.sleep(.3)
                    return await request.fulfill(body=csv[index], content_type='text/csv')
                if parsed.hostname == 'api.open-meteo.com':
                    return await request.fulfill(json={'hourly': {'uv_index': [0] * 24}})
                return await request.abort()

            await page.route('**/*', route)
            await page.goto('http://meteo.test/dev/#moderni2')
            for index in [0, 1, 2]:
                if index:
                    await page.select_option('#simpleStation', str(index))
                await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400 && dataStatus.sheets.phase==="ok" && !!dataStatus.sheets.timing', arg=index)
            returning = True
            await page.evaluate('''()=>{
              window.returnSample=null;
              const render=renderSimpleOverview;
              renderSimpleOverview=()=>{
                render();
                if(activeIdx===0 && store.rows.length && !returnSample){
                  returnSample={visibleMs:performance.now()-window.returnStarted,
                    cached:!!dataStatus.sheets.cached, status:el('simpleStatus').textContent,
                    value:el('simpleTemp').textContent};
                }
              };
              el('simpleStation').addEventListener('change',()=>window.returnStarted=performance.now(),true);
            }''')
            await page.select_option('#simpleStation', '0')
            await page.wait_for_function('returnSample!==null')
            visible = await page.evaluate('returnSample')
            assert visible['value'] == '18.0', visible
            assert visible['cached'] == (variant == 'after'), visible
            assert ('Uložená data' in visible['status']) == (variant == 'after'), visible
            await page.wait_for_function('dataStatus.sheets.phase==="ok" && !!dataStatus.sheets.timing')
            stats = await page.evaluate('''()=>({parseRuns:dataStatus.sheets.timing.parse.runs,
              cached:!!dataStatus.sheets.cached, full:store.fullLoaded, data:JSON.stringify(store.rows)})''')
            assert stats['parseRuns'] == (1 if variant == 'before' else 0) and not stats['cached'] and not stats['full'], stats
            assert len(return_requests) == 1 and not errors, (return_requests, errors)
            for width in [320, 390]:
                await page.set_viewport_size({'width': width, 'height': 844})
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            results[variant] = {'visibleMs': round(visible['visibleMs'], 1), 'cached': visible['cached'],
                                'parseRuns': stats['parseRuns'], 'quickRequests': 1,
                                'responseBytes': return_requests[0], 'rows': json.loads(stats['data'])}
            await page.close()
        await browser.close()
    assert results['before'].pop('rows') == results['after'].pop('rows')
    assert results['before']['responseBytes'] == results['after']['responseBytes']
    Path(args.output).write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
