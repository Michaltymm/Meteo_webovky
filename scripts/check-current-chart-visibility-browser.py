"""Real offline IO/Chart.js lifecycle with original three station configs."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright

async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs',required=True);parser.add_argument('--paho',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    html=Path('index.html').read_bytes();chart=Path(args.chartjs).read_bytes();paho=Path(args.paho).read_bytes()
    files=['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs=[json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    errors=[];requests=[];sockets=[];checks=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',reduced_motion='reduce')
        page.on('pageerror',lambda e:errors.append(str(e)));page.on('websocket',lambda s:sockets.append(s.url))
        async def route(r):
            url=r.request.url;name=urlparse(url).path.split('/')[-1]
            if url=='http://meteo.test/dev/':return await r.fulfill(body=html,content_type='text/html')
            if 'chart.js' in url:return await r.fulfill(body=chart,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            if 'paho-mqtt' in url:return await r.fulfill(body=paho,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            if name in files:return await r.fulfill(json=configs[files.index(name)])
            if 'docs.google.com' in url:
                index=next(i for i,c in enumerate(configs) if c['sheetId'] in url)
                quick='LIMIT 400' in parse_qs(urlparse(url).query).get('tq',[''])[0]
                requests.append({'station':index,'quick':quick})
                v='4.2' if index==0 else '0' if index==1 else ''
                lines=['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
                for i in range(400 if quick else 12000):
                    sec=i*5
                    temp='' if i%101==0 else str(index*10+i%7)
                    lines.append(f'28.10.2026,{sec//3600:02}:{sec//60%60:02}:{sec%60:02},{temp},1010,50,0,0,,{v}')
                return await r.fulfill(body='\n'.join(lines),content_type='text/csv')
            if 'api.open-meteo.com' in url:return await r.fulfill(json={'hourly':{'uv_index':[0]*24}})
            return await r.abort()
        await page.route('**/*',route);await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===400 && dataStatus.sheets.phase==="ok"')
        await page.wait_for_load_state('networkidle')
        assert await page.evaluate('currentChartObserver!==null && tabDirtyState.now && chart24.data.labels.length===0')
        await page.evaluate('''()=>{
          globalThis.draws=[];globalThis.originalBuild=buildCharts;
          buildCharts=function(tab){if(!tab||tab==='now')draws.push({station:activeIdx,count:store.rows.length});return originalBuild(tab)};
        }''')
        async def exact_chart():
            assert await page.evaluate('''()=>{
              const rows=store.rows.filter(r=>r.ts>=store.rows[0].ts.getTime()-86400000).sort((a,b)=>a.ts-b.ts);
              return JSON.stringify(chart24.data.labels)===JSON.stringify(rows.map(r=>fmtTime(r.ts)))&&
                [r=>r.temp,r=>r.hum,r=>dewPoint(r.temp,r.hum)].every((get,i)=>JSON.stringify(chart24.data.datasets[i].data)===JSON.stringify(rows.map(get)));
            }''')
        for index in [0,1,2]:
            if index:
                await page.evaluate('(i)=>switchStation(i)',index)
                await page.wait_for_function('(i)=>activeIdx===i&&store.rows.length===400&&dataStatus.sheets.phase==="ok"',arg=index)
            await page.evaluate('scrollTo(0,0)');await page.wait_for_timeout(150)
            before=await page.evaluate('draws.length')
            await page.evaluate('fetchSheets(true)')
            await page.wait_for_function('store.fullLoaded&&store.rows.length===12000&&dataStatus.sheets.phase==="ok"')
            await page.evaluate('fetchSheets(true)')  # Same export, another real commit.
            assert await page.evaluate('(n)=>draws.length===n && tabDirtyState.now && el("chart24h").style.visibility==="hidden"',before)
            assert await page.locator('#statCount').inner_text() == '12\u00a0000'
            traffic=len(requests);await page.locator('#chart24h').scroll_into_view_if_needed()
            await page.wait_for_function('!tabDirtyState.now && el("chart24h").style.visibility!=="hidden"')
            assert await page.evaluate('(n)=>draws.length===n+1',before)
            assert len(requests)==traffic
            await exact_chart()
            assert await page.evaluate('(i)=>store.rows.every(r=>i===0?r.voltage===4.2:i===1?r.voltage===0:r.voltage===null)',index)
            await page.evaluate('scrollTo(0,0)');await page.wait_for_timeout(150)
        checks.append('three configs: two offscreen full commits coalesce, stats stay current, one reveal from latest data, exact original chart, V/0/null')
        await page.evaluate('fetchSheets(true)')
        before=await page.evaluate('draws.length')
        await page.locator('[data-page="analytics"]').click()
        await page.evaluate('refreshTab("now")')
        assert await page.evaluate('(n)=>draws.length===n && tabDirtyState.now',before)
        await page.locator('[data-page="modern"]').click()
        await page.evaluate('scrollTo(0,0)');await page.wait_for_timeout(150)
        assert await page.evaluate('(n)=>draws.length===n && tabDirtyState.now',before)
        await page.locator('#chart24h').scroll_into_view_if_needed();await page.wait_for_function('!tabDirtyState.now')
        await exact_chart()
        checks.append('analytics/modern navigation retains dirty current graph until visible; no old station chart shown')
        await page.evaluate('''()=>{
          globalThis.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>testHidden});
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
        before=await page.evaluate('draws.length');await page.evaluate('fetchSheets(true)')
        assert await page.evaluate('(n)=>draws.length===n && tabDirtyState.now',before)
        await page.evaluate('testHidden=false;document.dispatchEvent(new Event("visibilitychange"))')
        await page.wait_for_function('!tabDirtyState.now')
        assert await page.evaluate('(n)=>draws.length===n+1',before)
        await exact_chart()
        checks.append('visibilitychange resumes a dirty visible chart without a new intersection entry')
        for width in [320,767,1440]:
            for theme in ['darkblue','light']:
                await page.set_viewport_size({'width':width,'height':900})
                await page.evaluate('(t)=>setTheme(t)',theme)
                await page.wait_for_timeout(300)
                await page.locator('#chart24h').scroll_into_view_if_needed()
                await page.wait_for_function('!tabDirtyState.now')
                await exact_chart()
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        checks.append('320/767/1440px and both themes preserve all plotted values without horizontal overflow')
        await page.close()
        fallback=await browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
        await fallback.add_init_script('globalThis.IntersectionObserver=undefined')
        fallback.on('pageerror',lambda e:errors.append(str(e)))
        await fallback.route('**/*',route);await fallback.goto('http://meteo.test/dev/')
        await fallback.wait_for_function('store.rows.length===400 && !tabDirtyState.now')
        assert await fallback.evaluate('currentChartObserver===null && chart24.data.labels.length===400')
        checks.append('unsupported IntersectionObserver renders synchronously even below fold')
        assert not errors,errors;assert not sockets,sockets
        output.write_text(json.dumps({'browser':browser.version,'checks':checks,'pageErrors':errors,'webSockets':len(sockets),
            'scope':'Real IO/Chart.js; controlled CSV/UV, synthetic visibilitychange, original configs, no live services or physical Safari/iOS'},indent=2)+'\n')
        await browser.close()
    print(output)

if __name__=='__main__':asyncio.run(main())
