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
            rows.append(f'{d:%d.%m.%Y},{d:%H:%M:%S},{85 if i==17 else 10+station},1010,60,0,{7 if i==17 else 0},,{4 if i<500 else 3.5}')
        bodies[station] = rows
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',has_touch=True)
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
                query=parse_qs(urlparse(url).query).get('tq',[''])[0]
                quick='LIMIT 400' in query
                overview=query=='SELECT * LIMIT 6'
                rows=bodies[station].copy()
                if corrected and station==0:rows[901]=rows[901].replace(',10,1010,',',99,1010,')
                body='\n'.join(rows[:7] if overview else rows[:401] if quick else rows)
                requests.append({'kind':'sheets','station':station,'quick':quick,'overview':overview,'bytes':len(body.encode())})
                await asyncio.sleep(.15)
                await r.fulfill(body=body,content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                requests.append({'kind':'uv'})
                await asyncio.sleep(.15)
                await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:await r.abort()
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===400 && !sheetsLoad && !uvLoad && !overviewLoad')
        assert sorted(r['station'] for r in requests if r.get('overview'))==[1,2]
        assert len(requests)==4
        overview_temperatures=await page.locator('#ovTemp1, #ovTemp2').all_text_contents()
        assert overview_temperatures==['11.0 °C','12.0 °C'], (overview_temperatures,errors)
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
        assert await page.evaluate('chartMonthly===null && chartYearly===null')
        agg_requests=len(requests)
        await page.set_viewport_size({'width':320,'height':568})
        await page.locator('.tab-btn[data-tab="monthly"]').click()
        assert await page.evaluate('chartMonthly?.data.labels.length>0 && chartYearly===null')
        await page.evaluate('window.monthlyChart=chartMonthly')
        await page.locator('.tab-btn[data-tab="yearly"]').click()
        assert await page.evaluate('chartYearly?.data.labels.length>0 && chartMonthly===monthlyChart')
        await page.locator('.tab-btn[data-tab="monthly"]').click()
        assert await page.evaluate('chartMonthly===monthlyChart && document.documentElement.scrollWidth<=innerWidth+1')
        assert len(requests)==agg_requests
        await page.set_viewport_size({'width':390,'height':844})
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
        assert await page.evaluate('chartRain===null && chartVoltage===null')
        before_rain=len(requests)
        await page.set_viewport_size({'width':320,'height':568})
        await page.locator('.tab-btn[data-tab="rain"]').click()
        assert await page.evaluate('''()=>{
          if (!chartRain?.data.labels.length || !chartVoltage?.data.labels.length) return false;
          window.firstRainChart=chartRain;window.firstVoltageChart=chartVoltage;
          const actual=chartVoltage.data.datasets[0].data.filter(v=>v!==null);
          return chartRain.data.datasets[0].data.includes(7) && chartRain.data.datasets[0].data.every(v=>v===0||v===7) &&
            actual.length===500 && actual.every(v=>v===4) &&
            chartVoltage.data.datasets[1].data[500]>4;
        }''')
        await page.locator('.tab-btn[data-tab="daily"]').click()
        await page.locator('.tab-btn[data-tab="rain"]').click()
        assert await page.evaluate('chartRain===firstRainChart && chartVoltage===firstVoltageChart')
        assert len(requests)==before_rain
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert await page.evaluate('chartExplorer===null')
        await page.evaluate('expRange="all";el("expMetric").value="rain"')
        await page.locator('.tab-btn[data-tab="explorer"]').click()
        assert await page.evaluate('chartExplorer?.config.type==="bar" && chartExplorer.data.labels.length>0')
        assert await page.evaluate('''()=>{
          const peaks=new Map();
          for(const row of store.rows){
            if(row.rain===null || row.ts.getTime()>Date.now()+60000) continue;
            const day=fmtDateShort(row.ts);
            peaks.set(day,Math.max(peaks.get(day)??-Infinity,row.rain));
          }
          const chart=chartExplorer, controller=chart.getDatasetMeta(0).controller;
          return chart.scales.x.type==='category' && chart.scales.yMain.type==='linear' &&
            chart.data.labels.length===peaks.size && chart.data.labels.every((day,i)=>{
              const {x,y}=controller.getParsed(i);
              return x===i && y===peaks.get(day) && controller.getLabelAndValue(i).label===day;
            });
        }''')
        await page.evaluate('window.rainSeries=chartExplorer.data.datasets[0];buildExplorer()')
        assert await page.evaluate('chartExplorer.data.datasets[0]===rainSeries')
        await page.locator('#chartExplorer').scroll_into_view_if_needed()
        point=await page.evaluate('''()=>{
          const chart=chartExplorer,index=chart.data.datasets[0].data.indexOf(7);
          const bar=chart.getDatasetMeta(0).data[index],rect=chart.canvas.getBoundingClientRect();
          return {x:rect.left+bar.x,y:rect.top+(bar.y+bar.base)/2,day:chart.data.labels[index]};
        }''')
        has_tooltip='day=>chartExplorer.tooltip.title?.[0]===day && chartExplorer.tooltip.dataPoints?.[0]?.parsed.y===7'
        await page.mouse.move(point['x'],point['y'])
        await page.wait_for_function(has_tooltip,arg=point['day'])
        assert await page.evaluate('Number.isFinite(chartExplorer._crossX)')
        await page.mouse.move(0,0)
        await page.wait_for_function('!chartExplorer.tooltip.opacity && chartExplorer._crossX===null')
        await page.touchscreen.tap(point['x'],point['y'])
        await page.wait_for_function(has_tooltip,arg=point['day'])
        await page.evaluate('window.firstExplorer=chartExplorer')
        await page.select_option('#expMetric','temp_hum')
        assert await page.evaluate('chartExplorer===firstExplorer && chartExplorer.config.type==="line" && chartExplorer.data.datasets.length===2')
        await page.evaluate('expRange="oneday";el("expDateOne").value="2000-01-01";expApplyOneDay()')
        assert await page.evaluate('chartExplorer===firstExplorer && chartExplorer.data.labels.length===0')
        assert await page.locator('#expInfo').inner_text()=='Žádná data ve vybraném rozsahu.'
        assert len(requests)==before_rain
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert not errors,errors
        results={'hidden10minRequests':0,'return10minRequests':3,'hidden24hRequests':0,'return24hRequests':4,
          'historicalCorrection':'85 → 99, all 1000 original rows retained','pageErrors':errors,
          'charts':await page.evaluate('Object.keys(Chart.instances).length'),
          'rainVoltage':'created on first open, fits older eligible measurements, reused without extra requests',
          'transport':'offline fixtures; real browser timers, synthetic document.hidden + visibilitychange',
          'requests':requests}
        await browser.close()
    Path(args.output).write_text(json.dumps(results,indent=2))
    print(args.output)

asyncio.run(main())
