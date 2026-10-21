"""Manual integration check: real UI/Chart.js, delayed fixture transports.
Requires Python Playwright and Chromium, just like benchmark-browser.py.
"""
import argparse
import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--at', help='Optional ISO timestamp with UTC offset to fix the browser clock')
args = parser.parse_args()

async def main():
    html = Path('index.html').read_text()
    chart = Path(args.chartjs).read_text()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    bodies, current_hour_values = {}, {}
    now = (datetime.fromisoformat(args.at).astimezone(ZoneInfo('Europe/Prague'))
           if args.at else datetime.now(ZoneInfo('Europe/Prague'))).replace(microsecond=0)
    for station in range(3):
        lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
        current_hour_values[station] = []
        for i in range(1000):
            # Generate real elapsed instants; wall-clock arithmetic creates
            # nonexistent spring hours before formatting the legacy CSV.
            d = (now.astimezone(timezone.utc)-timedelta(minutes=5*i)).astimezone(ZoneInfo('Europe/Prague'))
            lines.append(f'{d:%d.%m.%Y},{d:%H:%M:%S},{10+station*10+i/100},1010,60,0,0,,4')
            if d.date() == now.date() and d.hour == now.hour:
                current_hour_values[station].append(10+station*10+i/100)
        bodies[station] = lines
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844}, timezone_id='Europe/Prague')
        if args.at:
            await page.clock.set_fixed_time(now)
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
        today = now.date().isoformat()
        for field in ['expDateFrom','expDateTo','expDateOne','cmpAddDate']:
            assert await page.locator('#'+field).input_value() == today
        expected_dates = [(now.date()-timedelta(days=i)).isoformat() for i in range(8)]
        assert await page.locator('#cmpDayBtns button').evaluate_all('(buttons)=>buttons.map(b=>b.title)') == expected_dates
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
            await page.locator('.tab-btn[data-tab="compare"]').click()
            await page.evaluate('el("cmpMetric").value="temp";buildCompare()')
            value = await page.evaluate('(hour)=>chartCompare.data.datasets[0].data[hour]',now.hour)
            expected = sum(current_hour_values[station])/len(current_hour_values[station])
            assert value is not None and abs(value-expected) <= .051
            count = await page.evaluate('(hour)=>chartCompare.data.datasets[0].sampleCounts[hour]',now.hour)
            assert count == len(current_hour_values[station])
            await page.locator('.comparison-data summary').click()
            assert await page.locator('#cmpDataQuality').is_visible()
            assert 'celá dostupná historie' in await page.locator('#cmpDataQuality').inner_text()
            assert 'nejsou dostupnost senzoru' in await page.locator('#cmpDataQuality').inner_text()
            tooltip = await page.evaluate('(hour)=>compareTooltip({dataset:chartCompare.data.datasets[0],dataIndex:hour})',now.hour)
            assert f'Číselné hodnoty: {count}' in tooltip
            assert 'Europe/Prague' in await page.locator('#cmpInfo').inner_text()
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            await page.locator('.comparison-data summary').click()
            await page.locator('.tab-btn[data-tab="explorer"]').click()
            results.append({'station':station,'fullRequestsForTwoCalls':len(requests)-before,
                            'rows':await page.evaluate('store.rows.length'),'checks':'passed'})
        calendar_results = []
        for month, day, hours in [(3,29,23),(10,25,25)]:
            key = f'2026-{month:02}-{day:02}'
            await page.evaluate('''([month,day])=>{
              const start=new Date(2026,month-1,day).getTime();
              const next=new Date(2026,month-1,day+1).getTime();
              store.rows=[next,next-1,start,start-1].map((t,i)=>({ts:new Date(t),temp:i,hum:60}));
              store.fullLoaded=true;invalidateDerivedData();el('expMetric').value='temp';
            }''',[month,day])
            for mode, field in [('oneday','expDateOne'),('custom','expDateFrom')]:
                await page.evaluate('(mode)=>setExpRange(mode)',mode)
                if mode == 'custom':
                    await page.locator('#expDateTo').fill('')
                await page.locator('#'+field).fill(key)
                await page.locator('#'+field).dispatch_event('change')
                assert await page.evaluate('expAllPts.length') == 2
                assert await page.evaluate('(expAllPts.at(-1).ts-expAllPts[0].ts+1)/3600000') == hours
            calendar_results.append({'date':key,'hours':hours,'oneDayAndBlankEnd':'passed'})
        await page.evaluate('renderIntervalComparison([{ts:new Date("2026-10-25T02:30:00+02:00"),temp:10},{ts:new Date("2026-10-25T02:30:00+01:00"),temp:11}])')
        text = await page.locator('#expInterval').inner_text()
        assert '1 h 0 min 0 s' in text and 'UTC+02:00' in text and 'UTC+01:00' in text
        hourly_results = []
        for key, stamps, hour, slots in [
            ('2026-10-25',['2026-10-25T02:30:00+01:00','2026-10-25T02:30:00+02:00'],2,25),
            ('2026-03-29',['2026-03-29T03:30:00+02:00','2026-03-29T01:30:00+01:00'],3,23)
        ]:
            await page.evaluate('''([key,stamps])=>{
              store.rows=stamps.map((stamp,i)=>({ts:new Date(stamp),temp:10+i*10,hum:60,pressure:1010}));
              store.fullLoaded=true;invalidateDerivedData();markAllTabsDirty();
              cmpSelectedDays=[key];el('cmpMetric').value='temp';
            }''',[key,stamps])
            await page.locator('.tab-btn[data-tab="compare"]').click()
            await page.evaluate('buildCompare()')
            await page.locator('.comparison-data').evaluate('(d)=>d.open=true')
            quality = await page.locator('#cmpDataQuality').inner_text()
            assert f'2/{slots}' in quality
            assert await page.evaluate('chartCompare.data.datasets[0].spanGaps') is False
            assert await page.evaluate('(key)=>hourlyDay(key).maxGapMs',key) == 3600000
            if slots == 25:
                assert await page.evaluate('(hour)=>chartCompare.data.datasets[0].data[hour]',hour) == 15
            else:
                assert await page.evaluate('chartCompare.data.datasets[0].data[2]') is None
            for theme in ['darkblue','light']:
                await page.evaluate('(theme)=>setTheme(theme)',theme)
                assert await page.locator('#cmpDataQuality').is_visible()
                assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            hourly_results.append({'date':key,'observedGroups':2,'possibleGroups':slots,'gapMs':3600000,'checks':'passed'})
        assert not errors, errors
        await page.screenshot(path='/tmp/meteo-interval-mobile.png',full_page=True)
        await browser.close()
    Path(args.output).write_text(json.dumps({'results':results,'requests':requests,'pageErrors':errors,
        'clock':now.isoformat() if args.at else 'system','calendar':calendar_results,
        'hourly':hourly_results,
        'transport':'fixture CSV delayed 250ms; MQTT CDN blocked, UV mocked'},indent=2))
    print(args.output)

asyncio.run(main())
