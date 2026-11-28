"""Exercise all Design Lab views with original station configs and fixture data."""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright

async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    html = Path('index.html').read_bytes()
    chart = args.chartjs.read_bytes()
    config_names = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = {name: json.loads(Path(name).read_text(encoding='utf-8-sig')) for name in config_names}
    sheets = {config['sheetId']: index for index, config in enumerate(configs.values())}
    now = datetime.fromisoformat('2026-11-28T12:00:00+01:00')
    requests, errors = [], []
    csv = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(672):
            dt = now - timedelta(minutes=30*i)
            temp = 19.4 + station * 3 - (i % 48) / 8
            hum = 63 + i % 19
            voltage = '4.12' if station == 0 else '0' if station == 1 else ''
            lines.append(f'{dt:%d.%m.%Y},{dt:%H:%M:%S},{temp:.2f},1015.3,{hum},0,0,,{voltage}')
        csv.append(lines)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium')
        page = await browser.new_page(viewport={'width':1440,'height':1000}, timezone_id='Europe/Prague', has_touch=True)
        await page.clock.set_fixed_time(now)
        page.on('pageerror', lambda e: errors.append(str(e)))

        async def serve(route):
            url = urlparse(route.request.url)
            if url.hostname == 'meteo.test' and url.path == '/dev/':
                return await route.fulfill(body=html, content_type='text/html')
            if 'chart.js' in url.path:
                return await route.fulfill(body=chart, content_type='application/javascript',
                                           headers={'Access-Control-Allow-Origin':'*'})
            name = url.path.rsplit('/',1)[-1]
            if name in configs:
                return await route.fulfill(json=configs[name])
            if url.hostname == 'docs.google.com':
                station = next(index for sheet,index in sheets.items() if sheet in url.path)
                query = parse_qs(url.query).get('tq',[''])[0].upper()
                size = 400 if 'LIMIT 400' in query else 6 if 'LIMIT 6' in query else 672
                requests.append([station,size])
                return await route.fulfill(body='\n'.join(csv[station][:size+1]),content_type='text/csv')
            if url.hostname == 'api.open-meteo.com':
                return await route.fulfill(json={'hourly':{'uv_index':[0]*24}})
            await route.abort()

        await page.route('**/*',serve)
        await page.goto('https://meteo.test/dev/#design-lab')
        await page.wait_for_function('store.rows.length===400 && currentPage==="lab"')
        await page.wait_for_load_state('networkidle')
        lab = page.locator('#page-lab')
        assert await lab.is_visible() and await page.locator('#page-main').is_hidden()
        assert await page.locator('#labHeroTemp').inner_text() == '19,4'
        assert await page.locator('#labWeatherMetrics dd').count() == 10
        before = len(requests)
        await page.locator('[data-lab-choice="c"]').click()
        assert await page.locator('#labBentoTemp').inner_text() == '19,4'
        assert await page.locator('#labStationCards button').count() == 3
        await page.locator('[data-lab-choice="b"]').click()
        await page.locator('#labPlot').wait_for(state='visible')
        assert '49 platných' in await page.locator('#labSeriesStatus').inner_text()
        assert '19,4 °C' in await page.locator('#labSeriesMax').inner_text()
        assert len(requests) == before
        await page.locator('[data-lab-days="30"]').click()
        await page.wait_for_function('store.fullLoaded && el("labSeriesStatus").textContent.includes("672 platných")')
        assert requests[before:] == [[0,672]], requests[before:]
        await page.locator('#labMetric').select_option('voltage')
        assert await page.locator('#labSeriesMax').inner_text() == '4,12 V'

        await page.locator('[data-lab-choice="c"]').click()
        for station, expected in [(1,'22,4'),(2,'25,4'),(0,'19,4')]:
            await page.locator('#labStationCards button').nth(station).tap()
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400', arg=station)
            assert await page.locator('#labBentoTemp').inner_text() == expected
            voltage_tile = page.locator('#labBentoMetrics > div').filter(has_text='Napětí baterie')
            assert (await voltage_tile.locator('dd').inner_text()).startswith(['4,12','0,00','–'][station])
        await page.locator('[data-lab-choice="b"]').click()
        await page.locator('#labMetric').select_option('temp')
        await page.locator('[data-lab-days="7"]').click()
        await page.wait_for_function('!el("labPlot").hidden && el("labSeriesStatus").textContent.includes("337 platných")')

        shots = []
        for width,height,theme in [(1440,1000,'dark'), (390,840,'light')]:
            await page.set_viewport_size({'width':width,'height':height})
            if await lab.get_attribute('data-theme') != theme:
                await page.locator('#labTheme').click()
            for variant in 'abc':
                await page.locator(f'[data-lab-choice="{variant}"]').click()
                assert await lab.get_attribute('data-variant') == variant
                for other in 'abc':
                    assert (await page.locator('#labVariant'+other.upper()).is_visible()) == (variant == other)
                await page.wait_for_timeout(180)
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (variant,width)
                await page.evaluate('scrollTo(0,0)')
                shot = f'design-lab-{variant}-{width}-{theme}.png'
                await page.screenshot(path=str(args.output / shot), full_page=True, animations='disabled')
                shots.append(shot)

        for width in (320,768):
            await page.set_viewport_size({'width':width,'height':844})
            for variant in 'abc':
                await page.locator(f'[data-lab-choice="{variant}"]').click()
                await page.wait_for_timeout(180)
                outside = await page.evaluate('''()=>[...document.querySelectorAll("#page-lab *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className).slice(0,10)''')
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), (variant,width,outside)
        await page.locator('[data-lab-choice="b"]').click()
        assert await page.evaluate('!!Chart.getChart(el("labCanvas"))')
        await page.locator('[data-page="modern2"]').click()
        assert await page.locator('#page-modern2').is_visible()
        assert await page.evaluate('!Chart.getChart(el("labCanvas"))')
        await page.go_back()
        assert await lab.is_visible()
        assert not errors, errors
        (args.output / 'browser.json').write_text(json.dumps({'screenshots':shots,'requests':requests,'pageErrors':errors},indent=2)+'\n')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
