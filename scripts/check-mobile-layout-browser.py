"""Offline mobile header/controls regression, plus unchanged desktop geometry."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html',default='index.html');parser.add_argument('--baseline',action='store_true')
    parser.add_argument('--chartjs',required=True);parser.add_argument('--paho',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    html=Path(args.html).read_bytes();chart=Path(args.chartjs).read_bytes();paho=Path(args.paho).read_bytes()
    files=['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']
    configs=[json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    errors=[];layouts=[];requests=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,timezone_id='Europe/Prague',reduced_motion='reduce')
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def route(r):
            url=r.request.url;name=urlparse(url).path.split('/')[-1]
            if url=='http://meteo.test/dev/':return await r.fulfill(body=html,content_type='text/html')
            if 'chart.js' in url:return await r.fulfill(body=chart,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            if 'paho-mqtt' in url:return await r.fulfill(body=paho,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
            if name in files:return await r.fulfill(json=configs[files.index(name)])
            if 'docs.google.com' in url:
                requests.append(urlparse(url).hostname)
                return await r.fulfill(body='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n28.10.2026,10:00,20,1010,60,0,0,,4.1',content_type='text/csv')
            if 'api.open-meteo.com' in url:return await r.fulfill(json={'hourly':{'uv_index':[0]*24}})
            return await r.abort()
        await page.route('**/*',route);await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('store.rows.length===1');await page.wait_for_load_state('networkidle')
        for view in ['main','modern','analytics']:
            await page.locator(f'[data-page="{view}"]').click()
            for theme in ['darkblue','light']:
                await page.evaluate('(t)=>setTheme(t)',theme)
                for width,height in [(320,740),(375,812),(390,844),(430,932),(540,900),(650,900),(767,900),(667,375),(767,430),(1024,900),(1440,900)]:
                    await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(300)
                    await page.evaluate('scrollTo(0,0)')
                    if not args.baseline and await page.evaluate('document.documentElement.scrollWidth>innerWidth+1'):
                        outside=await page.evaluate('''[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,12)''')
                        raise AssertionError((view,theme,width,height,'overflow',outside))
                    boxes=await page.evaluate('''()=>Object.fromEntries(['body>header','.page-navigation','.status-bar','#dataStatusDetails','#refreshBtn','#partialBadge','.status-bar>button:last-child','.nav-pills .pill'].map(s=>{
                      const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);
                      return[s,{x:r.x,y:r.y,width:r.width,height:r.height,display:c.display,position:c.position}];
                    }))''')
                    if not args.baseline and width<=767:
                        for selector in ['#refreshBtn','#partialBadge','.status-bar>button:last-child','.nav-pills .pill']:
                            if boxes[selector]['display']=='none':continue
                            assert boxes[selector]['height']>=44 and boxes[selector]['width']>=44,(width,selector,boxes[selector])
                        tops=[boxes[s]['y'] for s in ['#refreshBtn','#partialBadge','.status-bar>button:last-child'] if boxes[s]['display']!='none']
                        assert max(tops)-min(tops)<1,(width,'unaligned actions',tops)
                        await page.locator('.nav-pills>.dd-wrap:last-child .pill').tap()
                        box=await page.locator('#ddGear').bounding_box()
                        assert box and box['x']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(width,height,box)
                        await page.evaluate('closeAllDD()')
                        before=len(requests);await page.locator('#dataStatusDetails>summary').tap();await page.locator('#dataStatusDetails>summary').tap()
                        assert len(requests)==before
                        if height<500:assert boxes['body>header']['position']=='relative'
                    if view=='main' and theme=='darkblue' and width in [320,390,767,1440]:
                        await page.screenshot(path=str(output.with_name(f'{output.stem}-{width}-{height}.png')))
                    layouts.append({'view':view,'theme':theme,'width':width,'height':height,'boxes':boxes})
        if not args.baseline:
            await page.set_viewport_size({'width':375,'height':812})
            await page.locator('[data-page="main"]').click()
            for index in [1,2,0]:
                await page.locator('.nav-pills>.dd-wrap:first-child .pill').tap()
                await page.locator(f'#ddStation .dd-item:nth-of-type({index+2})').tap()
                await page.wait_for_function('(i)=>activeIdx===i && store.rows.length===1',arg=index)
            await page.locator('#partialBadge').tap();await page.wait_for_function('store.fullLoaded')
            await page.locator('#refreshBtn').tap();await page.wait_for_function('!el("refreshBtn").disabled')
            before=len(requests);await page.locator('#dashboardBars>summary').tap()
            assert await page.locator('#sunBar').is_visible()
            assert len(requests)==before
            for trigger,popup in [('riseWrap','risePopup'),('sunWrap','sunPopup'),('uvWrap','uvPopup'),('moonWrap','moonPopup')]:
                await page.locator('#'+trigger).tap();box=await page.locator('#'+popup).bounding_box()
                assert box and box['x']>=0 and box['x']+box['width']<=376 and box['y']>=0 and box['y']+box['height']<=813,(popup,box)
                await page.locator('#'+trigger).tap()
        assert not errors,errors
        output.write_text(json.dumps({'browser':browser.version,'layouts':layouts,'pageErrors':errors,'scope':'Controlled CSV/UV, original configs, local SRI libraries; no physical iOS'},indent=2)+'\n')
        await browser.close()
    print(output)

if __name__=='__main__':asyncio.run(main())
