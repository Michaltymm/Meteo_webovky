"""Offline integration of T/V, humidity and motion settings with three configs.
Uses real Chromium/Chart.js, delayed CSV and original station loading code.
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
    files = ['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    now = datetime.fromisoformat('2026-10-21T12:00:00+02:00')
    bodies = []
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        for i in range(1000):
            time = now-timedelta(minutes=5*i)
            temp = '' if i%13 == 12 else 20+station*10+i/100
            voltage = 4+i*.00001 if station == 0 else '' if station == 1 else 0
            lines.append(f'{time:%d.%m.%Y},{time:%H:%M:%S},{temp},1010,50,0,0,,{voltage}')
        bodies.append(lines)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',reduced_motion='reduce')
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
                await asyncio.sleep(.25 if quick else .5)
                await r.fulfill(body='\n'.join(bodies[station][:401] if quick else bodies[station]),content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:
                await r.abort()
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/')
        for station in range(3):
            if station:
                await page.locator('.tab-btn[data-tab="now"]').click()
                await page.evaluate('(station)=>switchStation(station)',station)
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400',arg=station)
            if station == 0:
                assert await page.locator('#curAbsHum').inner_text() == '8.62'
                assert await page.locator('#curVPD').inner_text() == '1.166'
                assert await page.evaluate('Object.keys(Chart.instances).length') == 8
            before = len(requests)
            await page.locator('.tab-btn[data-tab="battery"]').click()
            if station == 0:
                # Finish the full load in another tab: no hidden analysis charts.
                await page.locator('.tab-btn[data-tab="now"]').click()
                await page.wait_for_function('store.fullLoaded && store.rows.length===1000')
                assert await page.evaluate('chartBatteryTime===null && Object.keys(Chart.instances).length===8')
                await page.locator('.tab-btn[data-tab="battery"]').click()
            await page.wait_for_function('store.fullLoaded && store.rows.length===1000 && el("batterySummary").textContent.startsWith("Celá dostupná")')
            assert len(requests)-before == 1
            await page.select_option('#batteryRange','all')
            result = await page.evaluate('batteryAnalysis("all")')
            expected_count = 0 if station == 1 else sum(i%13 != 12 for i in range(1000))
            assert result['count'] == expected_count
            assert result['r'] is None if station else abs(result['r']-1)<1e-9
            assert await page.evaluate('Object.keys(Chart.instances).length') == 10
            if station == 1:
                assert await page.evaluate('chartBatteryXY.data.datasets[0].data.length') == 0
            if station == 2:
                assert result['minV'] == 0
            sensitivity = result['sensitivity']
            assert sensitivity['status'] == ('ok' if station == 0 else 'days' if station == 1 else 'relationship')
            if not await page.locator('#batterySensitivity').evaluate('(node)=>node.open'):
                await page.locator('#batterySensitivity summary').click()
            if station == 0:
                assert sensitivity['validDays'] == result['days']
                expected_day = sensitivity['byR']['day']
                before_day = len(requests)
                await page.locator('#batteryRDay').click()
                assert await page.locator('#expDateOne').input_value() == expected_day
                assert await page.evaluate('expRange') == 'oneday'
                assert await page.evaluate('el("expMetric").value') == 'voltage'
                assert await page.evaluate('expAllPts.length') > 0
                assert await page.evaluate('expAllPts.every(row=>localDateKey(row.ts)===el("expDateOne").value)')
                await page.select_option('#expMetric','temp')
                assert len(requests) == before_day
                assert await page.evaluate('Object.keys(Chart.instances).length') == 10
                await page.locator('.tab-btn[data-tab="battery"]').click()
            else:
                assert not await page.locator('#batteryRDay').is_visible()
            for width in [320,390]:
                await page.set_viewport_size({'width':width,'height':844})
                await page.wait_for_timeout(100)
                assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            network_before = len(requests)
            for range_value in ['7','30','all']:
                await page.select_option('#batteryRange',range_value)
            assert len(requests) == network_before
            await page.locator('#batteryMethod summary').click()
            assert 'SOC, kapacita ani energie' in await page.locator('#batteryMethod').inner_text()
            for theme in ['darkblue','light']:
                await page.evaluate('(theme)=>setTheme(theme)',theme)
                assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            if station == 0:
                await page.locator('#tab-battery').screenshot(path=str(output.with_suffix('.png')))
            await page.locator('#batteryMethod summary').click()
            await page.locator('.tab-btn[data-tab="explorer"]').click()
            for metric in ['absHum','vpd']:
                await page.select_option('#expMetric',metric)
                await page.evaluate('setExpRange("all")')
                assert '1000 měření' in await page.locator('#expInfo').inner_text()
                assert 'vypočteno' in await page.locator('#expChartTitle').inner_text()
                assert await page.evaluate('chartExplorer.data.labels.length') <= 800
            await page.select_option('#expMetric','hum')
            await page.evaluate('setExpRange("all")')
            humidity_panel = page.locator('#expHumidityChange')
            assert await humidity_panel.is_visible()
            await humidity_panel.locator('summary').click()
            initial_text = await page.locator('#expHumidityChangeValue').inner_text()
            assert 'Výsledný poměr RH: ×1.0000' in initial_text
            assert 'UTC+02:00' in initial_text
            assert 'kalibrace čidla mezi body nejsou ověřeny' in await humidity_panel.inner_text()
            before_slider = len(requests)
            await page.evaluate('el("expSliderL").value="20";el("expSliderR").value="80";expSliderUpdate()')
            assert initial_text != await page.locator('#expHumidityChangeValue').inner_text()
            assert 'Výsledný poměr RH: ×1.0000' in await page.locator('#expHumidityChangeValue').inner_text()
            assert len(requests) == before_slider
            for width in [320,390]:
                await page.set_viewport_size({'width':width,'height':844})
                await page.wait_for_timeout(100) # Allow Chart.js ResizeObserver to settle.
                for theme in ['darkblue','light']:
                    await page.evaluate('(theme)=>setTheme(theme)',theme)
                    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'), await page.evaluate('''[...document.querySelectorAll('body *')]
                      .filter(node=>node.getBoundingClientRect().right>innerWidth+1)
                      .map(node=>({id:node.id,cls:node.className,right:node.getBoundingClientRect().right})).slice(0,20)''')
            if station == 0:
                await humidity_panel.screenshot(path=str(output.with_name(output.stem+'-humidity.png')))
            await humidity_panel.locator('summary').click()
            results.append({'station':station,'pairs':result['count'],'r':result['r'],
                'fullRequestsOnOpen':len(requests)-before,'rangeAddsRequests':0,'checks':'passed'})
        assert await page.evaluate('chart24.options.animation===false && chartExplorer.options.animation===false')
        css = await page.evaluate('el("refreshBtn").classList.add("spinning");getComputedStyle(el("refreshBtn")).animationName')
        assert css == 'none'
        await page.evaluate('el("refreshBtn").classList.remove("spinning")')
        await page.emulate_media(reduced_motion='no-preference')
        await page.wait_for_function('chart24.options.animation.duration===300')
        assert await page.evaluate('chartExplorer.options.animation===false && chartBatteryXY.options.animation===false')
        await page.emulate_media(reduced_motion='reduce')
        await page.wait_for_function('chart24.options.animation===false')
        # Actual periodic/full transport can correct an older value without
        # changing the newest row. All complete rows must be reanalysed.
        cols = bodies[2][701].split(',')
        cols[8] = '0.02'
        bodies[2][701] = ','.join(cols)
        await page.evaluate('manualRefresh()')
        await page.locator('.tab-btn[data-tab="battery"]').click()
        await page.select_option('#batteryRange','all')
        assert await page.evaluate('batteryAnalysis("all").maxV') == .02
        assert await page.evaluate('store.rows.length') == 1000
        await page.locator('.tab-btn[data-tab="explorer"]').click()
        await page.evaluate('el("expMetric").value="hum"')
        for values, expected in [
            ([20,80,0,80],'překročeno nasycení'),
            ([20,0,20,50],'RH je v jednom z krajních měření 0 %'),
            ([20,50,None,50],'Chybí platná T/RH')
        ]:
            await page.evaluate('''([t1,h1,t2,h2])=>{
              store.rows=[{ts:new Date(Date.now()),temp:t2,hum:h2},{ts:new Date(Date.now()-3600000),temp:t1,hum:h1}];
              invalidateDerivedData();setExpRange('all');
            }''',values)
            assert expected in await page.locator('#expHumidityChangeValue').text_content()
        await page.evaluate('el("expMetric").value="pressure";buildExplorer()')
        assert not await page.locator('#expHumidityChange').is_visible()
        assert await page.locator('#expHumidityChangeValue').text_content() == ''
        await page.evaluate('el("expMetric").value="hum";expRange="oneday";el("expDateOne").value="1900-01-01";buildExplorer()')
        assert not await page.locator('#expHumidityChange').is_visible()
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        # An entire shifted day; then a constant remainder after omission.
        await page.evaluate('''()=>{
          store.rows=Array.from({length:80},(_,i)=>({
            ts:new Date(2026,9,21-Math.floor(i/20),12,i%20),
            temp:i<20?70+i/100:12+Math.sin(i/11)*8,
            voltage:i<20?6+i/1000:4+.03*Math.sin(i/9),hum:50
          })).sort((a,b)=>b.ts-a.ts);
          store.fullLoaded=true;invalidateDerivedData();el('batteryRange').value='all';
          document.querySelector('.tab-btn[data-tab="battery"]').click();buildBatteryAnalysis();
        }''')
        assert await page.evaluate('batteryAnalysis("all").sensitivity.byR.day') == '2026-10-21'
        assert 'vynecháno 20, zbývá 60 párů' in await page.locator('#batterySensitivityValue').inner_text()
        await page.locator('#batterySensitivity').screenshot(path=str(output.with_name(output.stem+'-sensitivity.png')))
        await page.locator('#batterySlopeDay').click()
        assert await page.locator('#expDateOne').input_value() == '2026-10-21'
        assert await page.evaluate('expAllPts.length') == 20
        await page.evaluate('''()=>{
          store.rows.forEach(row=>{if(row.ts.getDate()!==21){row.temp=20;row.voltage=4;}});
          invalidateDerivedData();document.querySelector('.tab-btn[data-tab="battery"]').click();buildBatteryAnalysis();
        }''')
        assert '1 nedostupných' in await page.locator('#batterySensitivityValue').inner_text()
        await page.locator('#batteryUndefinedDay').click()
        assert await page.locator('#expDateOne').input_value() == '2026-10-21'
        await page.evaluate('resetStationStore()')
        assert await page.locator('#batterySensitivityValue').text_content() == ''
        assert await page.locator('#batteryRDay').get_attribute('hidden') is not None
        assert not errors, errors
        await browser.close()
    output.write_text(json.dumps({'results':results,'pageErrors':errors,'requests':requests,
        'motionInitialAndLive':'passed','hiddenFullLoadNoChartConstruction':'passed','oldCsvCorrection':'passed',
        'themesMobile390':'passed','humidityChangeThreeConfigsSlider320And390':'passed',
        'humidityChangeZeroMissingSaturationClear':'passed',
        'dailySensitivityThreeConfigsMobileDrilldownInfluentialDayConstantRemainderReset':'passed',
        'transport':'delayed fixture CSV, UV mocked, MQTT CDN blocked'},indent=2))
    print(output)

asyncio.run(main())
