"""Offline large Sheets lexical loading, atomic commit and station cancellation."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright


async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs',required=True);parser.add_argument('--paho',required=True)
    parser.add_argument('--output',required=True);args=parser.parse_args()
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
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
                rows=['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka']
                for i in range(8 if quick else 12000):
                    s=43200 if quick else (i//2*7919)%86400
                    rows.append(f'25.10.2026,{s//3600:02}:{s//60%60:02}:{s%60:02},{i%7},1010,50,0,0,,{v},id{i}')
                body='\n'.join(rows)
                return await r.fulfill(body=body,content_type='text/csv')
            if 'api.open-meteo.com' in url:return await r.fulfill(json={'hourly':{'uv_index':[0]*24}})
            return await r.abort()
        await page.route('**/*',route);await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===8 && dataStatus.sheets.phase==="ok"')
        await page.wait_for_load_state('networkidle')
        # Pause only the lexical scheduler, keeping actual parsing and the UI.
        await page.evaluate('''()=>{
          globalThis.realCSVSlice=analyticsWorkSlice;globalThis.pauseCSV=true;globalThis.heldCSV=null;
          globalThis.realRowsSteps=parseHistoryRowSteps;globalThis.pauseRows=true;globalThis.heldRows=null;
          parseHistoryRowSteps=(...args)=>{const steps=realRowsSteps(...args);steps.$rows=true;globalThis.pendingReport=args[2];return steps};
          analyticsWorkSlice=steps=>{if(pauseCSV){heldCSV=steps;return null}if(pauseRows&&steps.$rows){heldRows=steps;return null}return realCSVSlice(steps)};
          globalThis.quickRows=store.rows;globalThis.quickReport=dataStatus.sheets.validation;
          globalThis.csvCallback=0;store._onFullLoad.push(()=>csvCallback++);
        }''')
        await page.locator('#partialBadge').click()
        await page.wait_for_function('heldCSV!==null')
        assert await page.evaluate('store.rows===quickRows && !store.fullLoaded && dataStatus.sheets.validation===quickReport && csvCallback===0')
        count=len(requests)
        await page.evaluate('()=>{fetchSheets(true)}');await page.wait_for_timeout(50)
        assert len(requests)==count
        # Navigation remains usable; parsing intentionally survives view changes.
        await page.locator('[data-page="modern"]').click()
        assert await page.evaluate('store.rows===quickRows && heldCSV!==null')
        await page.evaluate('pauseCSV=false')
        await page.wait_for_function('heldRows!==null')
        assert await page.evaluate('store.rows===quickRows && dataStatus.sheets.validation===quickReport && csvCallback===0')
        await page.evaluate('realCSVSlice(heldRows)')
        assert await page.evaluate('!pendingReport.complete && store.rows===quickRows && dataStatus.sheets.validation===quickReport')
        await page.evaluate('pauseRows=false')
        await page.wait_for_function('store.fullLoaded && store.rows.length===12000 && dataStatus.sheets.phase==="ok"')
        assert await page.evaluate('csvCallback===1 && dataStatus.sheets.validation.accepted===12000 && dataStatus.sheets.timing.parse.runs===1')
        checks.append('large atomic load, old data/report until completion, shared request, navigation remains usable, callback once')
        # Queue a new parse, then switch the real station while it is pending.
        await page.evaluate('()=>{pauseCSV=true;heldCSV=null;fetchSheets(true)}')
        await page.wait_for_function('heldCSV!==null')
        await page.evaluate('globalThis.oldCSV=heldCSV')
        await page.select_option('#modernStation','1')
        await page.wait_for_function('activeIdx===1 && store.rows.length===8 && dataStatus.sheets.phase==="ok"')
        await page.evaluate('globalThis.rowsB=store.rows;pauseCSV=false;realCSVSlice(oldCSV)')
        assert await page.evaluate('store.rows===rowsB && store.rows.every(r=>r.voltage===0) && dataStatus.sheets.validation.accepted===8')
        checks.append('station switch aborts pending lexical work; queued old iterator cannot commit over the new station')
        await page.evaluate('()=>{pauseRows=true;heldRows=null;fetchSheets(true)}')
        await page.wait_for_function('heldRows!==null')
        await page.evaluate('globalThis.oldRowsJob=heldRows;realCSVSlice(oldRowsJob)')
        await page.select_option('#modernStation','2')
        await page.wait_for_function('activeIdx===2 && store.rows.length===8 && dataStatus.sheets.phase==="ok"')
        await page.evaluate('globalThis.rowsC=store.rows;pauseRows=false;realCSVSlice(oldRowsJob)')
        assert await page.evaluate('store.rows===rowsC && store.rows.every(r=>r.voltage===null) && dataStatus.sheets.validation.accepted===8')
        checks.append('filter/validation pause keeps old report and data private; station change cancels even partially validated rows')
        for index in [1,2,0]:
            if index!=await page.evaluate('activeIdx'):
                await page.select_option('#modernStation',str(index))
                await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===8 && dataStatus.sheets.phase==="ok"',arg=index)
            await page.evaluate('()=>{fetchSheets(true)}')
            await page.wait_for_function('store.fullLoaded && store.rows.length===12000 && dataStatus.sheets.phase==="ok"')
            assert await page.evaluate('(i)=>store.rows.every(r=>i===0?r.voltage===4.2:i===1?r.voltage===0:r.voltage===null)',index)
            assert await page.evaluate('store.rows.every((r,i,rows)=>!i || +rows[i-1].ts>+r.ts || (+rows[i-1].ts===+r.ts && Number(rows[i-1].note.slice(2))<Number(r.note.slice(2))))')
            assert await page.evaluate('''()=>{
              const expected=[...store.rows].filter(r=>r.ts.getTime()>=store.rows[0].ts.getTime()-86400000).sort((a,b)=>a.ts-b.ts);
              return JSON.stringify(chart24.data.labels)===JSON.stringify(expected.map(r=>fmtTime(r.ts))) &&
                [r=>r.temp,r=>r.hum,r=>dewPoint(r.temp,r.hum)].every((get,i)=>
                  JSON.stringify(chart24.data.datasets[i].data)===JSON.stringify(expected.map(get)));
            }''')
        checks.append('all three original configs complete large exports and preserve finite/zero/missing voltage')
        checks.append('unordered timestamp pairs from each station sort descending with stable original note order')
        checks.append('all 24h chart labels and three original-value datasets exactly match old full scan for each station')
        for width in [320,1440]:
            await page.set_viewport_size({'width':width,'height':1000})
            await page.wait_for_timeout(300)  # Chart.js debounces responsive resizing.
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors;assert not sockets,sockets
        version=browser.version;await browser.close()
    output.write_text(json.dumps({'browser':version,'checks':checks,'pageErrors':errors,'webSockets':len(sockets),
        'scope':'Actual UI and original three configs, 12k controlled CSV, local SRI libraries; no live service or physical Safari/iOS'},indent=2)+'\n');print(output)


if __name__=='__main__':asyncio.run(main())
