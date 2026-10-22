"""Offline Chromium integration for the alternate dashboard with original configs."""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--chartjs',required=True)
parser.add_argument('--paho',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()

async def main():
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    files=['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs=[json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    now=datetime.fromisoformat('2026-10-22T12:00:00+02:00')
    html=Path('index.html').read_bytes()
    chart=Path(args.chartjs).read_bytes();paho=Path(args.paho).read_bytes()
    requests=[];errors=[];layouts=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page(viewport={'width':1440,'height':1050},timezone_id='Europe/Prague',reduced_motion='reduce')
        await page.clock.set_fixed_time(now)
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def route(r):
            url=r.request.url;name=urlparse(url).path.split('/')[-1]
            if urlparse(url).netloc=='meteo.test' and urlparse(url).path=='/dev/':await r.fulfill(body=html,content_type='text/html')
            elif 'chart.js' in url:await r.fulfill(body=chart,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            elif 'paho-mqtt' in url:await r.fulfill(body=paho,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            elif name in files:await r.fulfill(body=json.dumps(configs[files.index(name)]),content_type='application/json')
            elif 'docs.google.com' in url:
                station=next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick='LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                requests.append({'station':station,'quick':quick})
                rows=['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
                for i in range(400 if quick else 2000):
                    ts=now-timedelta(minutes=i*10);voltage='' if station==2 else 0 if station==1 else 4.12
                    rows.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{18.6-station*4-i%12/10},1015.3,62,0,0,,{voltage}')
                await r.fulfill(body='\n'.join(rows),content_type='text/csv')
            elif 'api.open-meteo.com' in url:await r.fulfill(body=json.dumps({'hourly':{'uv_index':[0]*24}}),content_type='application/json')
            else:await r.abort()
        await page.route('**/*',route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===400')
        await page.locator('.tab-btn[data-tab="daily"]').click()
        await page.wait_for_function('store.fullLoaded && store.rows.length===2000')
        await page.wait_for_load_state('networkidle')
        await page.evaluate('globalThis.savedRows=store.rows;globalThis.savedChart=chart24')
        count=len(requests)
        await page.locator('[data-page="modern"]').click()
        assert await page.evaluate('currentPage==="modern" && store.rows===savedRows && chart24===savedChart')
        assert await page.locator('#modernIntro').is_visible()
        assert await page.locator('#tab-daily').is_visible()
        assert await page.locator('[data-page="modern"]').get_attribute('aria-current')=='page'
        assert await page.evaluate('location.hash')=='#moderni'
        assert await page.locator('#curTemp').count()==1
        await page.go_back();assert await page.locator('#modernIntro').is_hidden()
        await page.go_forward();assert await page.locator('#modernIntro').is_visible()
        await page.locator('.tab-btn[data-tab="now"]').click()
        assert len(requests)==count
        assert await page.evaluate('Object.keys(Chart.instances).length')==8
        for theme in ['darkblue','light']:
            await page.evaluate('(t)=>setTheme(t)',theme)
            assert await page.locator('body').get_attribute('data-view')=='modern'
            for width in [1440,800,390,320]:
                await page.set_viewport_size({'width':width,'height':1050 if width>650 else 844})
                await page.wait_for_timeout(100)
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(theme,width)
                assert await page.locator('#modernStation').is_visible()
                assert await page.locator('#curTemp').inner_text()=='18.6'
                bounds=await page.locator('.page-navigation').bounding_box()
                links=await page.locator('.page-link').evaluate_all('links=>links.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))')
                assert all(l['left']>=0 and l['right']<=width+1 for l in links),(width,links)
                layouts.append({'theme':theme,'width':width,'overflow':False})
                await page.screenshot(path=str(output.with_name(f'{output.stem}-{theme}-{width}.png')),full_page=False)
        for index in [1,2,0]:
            await page.locator('#modernStation').select_option(str(index))
            await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===400',arg=index)
            assert await page.locator('#modernStation').input_value()==str(index)
            assert await page.locator('#curTemp').inner_text()==f'{18.6-index*4:.1f}'
            if index==1:assert await page.locator('#curVoltage').inner_text()=='0.00'
            if index==2:assert await page.locator('#curVoltage').inner_text()=='–'
            assert await page.evaluate('currentPage')=='modern'
        await page.set_viewport_size({'width':1440,'height':1050})
        await page.evaluate('setTheme("darkblue")')
        await page.locator('.tab-btn[data-tab="hist"]').click()
        await page.wait_for_function('store.fullLoaded')
        assert await page.locator('#histTableBody tr').count()>0
        await page.evaluate('globalThis.savedRows=store.rows')
        count=len(requests)
        await page.locator('[data-page="analytics"]').click()
        await page.wait_for_function('analyticsState.model!==null')
        assert await page.locator('#page-main').is_hidden()
        await page.locator('[data-page="modern"]').click()
        assert await page.locator('#tab-hist').is_visible()
        assert await page.evaluate('analyticsCharts.size===0 && store.rows===savedRows')
        assert len(requests)==count
        await page.evaluate('resetStationStore()')
        assert await page.locator('#stationDataEmpty').is_visible()
        assert await page.locator('#stationData').is_hidden()
        assert await page.locator('#modernStation').is_visible()
        await page.goto('http://meteo.test/dev/#moderni')
        await page.reload()  # A fresh startup at the direct URL, not a same-document hash change.
        await page.wait_for_function('currentPage==="modern" && store.rows.length===400')
        assert await page.locator('#modernIntro').is_visible()
        assert not errors,errors
        version=browser.version
        await browser.close()
    output.write_text(json.dumps({'browser':version,'layouts':layouts,'pageErrors':errors,'checks':['shared data/charts','history Back/Forward','three station configs','zero/missing voltage','subtabs','analytics lifecycle','empty state','direct modern URL','theme switch'],'transport':'Controlled CSV/UV, real Chart.js/Paho with SRI'},indent=2)+'\n')
    print(output)
asyncio.run(main())
