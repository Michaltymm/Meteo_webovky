"""Offline integration and screenshots of Moderni prehled 2; original configs and SRI assets."""
import argparse,asyncio,json
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--chartjs',required=True);parser.add_argument('--paho',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
 output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
 files=['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json'];configs=[json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
 errors=[];requests=[];sockets=[];checks=[];gate=asyncio.Event();gate.set();pause_station=None
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
  page=await browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',has_touch=True,reduced_motion='reduce')
  await page.clock.set_fixed_time(datetime(2026,11,13,12,tzinfo=timezone.utc))
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('websocket',lambda ws:sockets.append(ws.url))
  async def route(r):
   u=r.request.url;name=urlparse(u).path.split('/')[-1]
   if u=='http://meteo.test/dev/':return await r.fulfill(body=Path('index.html').read_bytes(),content_type='text/html')
   if 'chart.js' in u:return await r.fulfill(body=Path(args.chartjs).read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   if 'paho-mqtt' in u:return await r.fulfill(body=Path(args.paho).read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   if name in files:return await r.fulfill(json=configs[files.index(name)])
   if 'docs.google.com' in u:
    i=next(i for i,c in enumerate(configs) if c['sheetId'] in u);requests.append(i)
    if i==pause_station:await gate.wait()
    voltage='4.12' if i==0 else '0' if i==1 else ''
    return await r.fulfill(body=f'Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n13.11.2026,13:00:00,{21.7+i},1013.2,45.6,0,0,,{voltage}',content_type='text/csv')
   if 'api.open-meteo.com' in u:return await r.fulfill(json={'hourly':{'uv_index':[0]*24}})
   return await r.abort()
  await page.route('**/*',route);await page.goto('http://meteo.test/dev/#moderni2')
  await page.wait_for_function('currentPage==="modern2"&&store.rows.length===1&&dataStatus.sheets.phase==="ok"')
  assert await page.locator('#simpleTemp').inner_text()=='21.7'
  assert not await page.locator('#page-main').is_visible();assert not await page.locator('#dashboardBars').is_visible()
  assert not await page.locator('.status-bar').is_visible();assert not await page.locator('#dataStatusDetails').is_visible()
  assert not await page.locator('#headerStationPicker').is_visible()
  assert await page.locator('.page-link[aria-current="page"]').get_attribute('data-page')=='modern2'
  assert await page.evaluate('Object.keys(Chart.instances).length===8&&chart24.data.labels.length===0')
  checks.append('direct hash opens isolated simple view; header station picker/bars/dashboard hidden; eight original charts, zero new charts')
  pause_station=1;gate.clear();await page.select_option('#simpleStation','1')
  await page.wait_for_function('activeIdx===1&&store.rows.length===0')
  assert await page.locator('#simpleTemp').inner_text()=='–'
  assert await page.locator('#simpleTime').get_attribute('datetime') is None
  gate.set();pause_station=None;await page.wait_for_function('activeIdx===1&&store.rows.length===1&&dataStatus.sheets.phase==="ok"')
  assert await page.locator('#simpleVoltage').inner_text()=='0.00'
  await page.select_option('#simpleStation','2');await page.wait_for_function('activeIdx===2&&store.rows.length===1&&dataStatus.sheets.phase==="ok"')
  assert await page.locator('#simpleVoltage').inner_text()=='–'
  assert await page.locator('#simpleTemp').inner_text()=='23.7'
  checks.append('native station select uses all original configs; pending station fetch clears old values/date; zero and absent voltage remain distinct')
  await page.wait_for_load_state('networkidle');before=len(requests)
  await page.evaluate('globalThis.sameRows=store.rows;globalThis.sameCfg=CFG')
  await page.locator('.simple-more').click();await page.wait_for_function('currentPage==="modern"')
  assert await page.locator('#curTemp').inner_text()=='23.7'
  await page.locator('[data-page="modern2"]').click();await page.wait_for_function('currentPage==="modern2"')
  await page.go_back();await page.wait_for_function('currentPage==="modern"')
  await page.go_forward();await page.wait_for_function('currentPage==="modern2"')
  assert len(requests)==before;assert await page.evaluate('store.rows===sameRows&&CFG===sameCfg')
  checks.append('details/top navigation/browser Back and Forward share the same rows/config without additional CSV requests')
  layouts=[]
  for width,height in [(320,568),(375,812),(390,844),(430,932),(650,900),(767,900),(844,390),(1024,768),(1440,1000)]:
   await page.set_viewport_size({'width':width,'height':height})
   for theme in ['darkblue','dark','light']:
    await page.evaluate('(t)=>setTheme(t)',theme);await page.wait_for_timeout(100)
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,height,theme)
    boxes=await page.locator('.page-link').evaluate_all('(links)=>links.map(a=>{const r=a.getBoundingClientRect();return {width:r.width,height:r.height}})')
    assert all(b['width']>=44 and b['height']>=44 for b in boxes),(width,boxes)
    assert await page.locator('#simpleStation').evaluate('(s)=>s.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(s).fontSize)>=16')
    layouts.append([width,height,theme])
  checks.append('27 portrait/landscape viewport/theme combinations: no page overflow, 44px navigation/select, 16px input font')
  await page.select_option('#simpleStation','0');await page.wait_for_function('activeIdx===0&&store.rows.length===1&&dataStatus.sheets.phase==="ok"')
  await page.set_viewport_size({'width':390,'height':844});await page.evaluate('setTheme("darkblue")');await page.screenshot(path=str(output.with_name('mobile-dark.png')),full_page=True)
  await page.evaluate('setTheme("light")');await page.screenshot(path=str(output.with_name('mobile-light.png')),full_page=True)
  await page.set_viewport_size({'width':1440,'height':1000});await page.screenshot(path=str(output.with_name('desktop-light.png')),full_page=True)
  await page.evaluate('dataStatus.sheets.phase="error";renderDataStatus()')
  assert 'Chyba přenosu' in await page.locator('#simpleStatus').inner_text()
  assert await page.evaluate('getComputedStyle(el("simpleStatus")).color===getComputedStyle(el("dataStatusSummary")).color')
  await page.evaluate('dataStatus.sheets.phase="ok";store.rows[0].ts=new Date(Date.now()+3600000);renderDataStatus()')
  assert 'budoucnosti' in await page.locator('#simpleStatus').inner_text()
  assert await page.evaluate('getComputedStyle(el("simpleStatus")).color===getComputedStyle(el("dataStatusSummary")).color')
  await page.evaluate('resetStationStore()')
  assert await page.locator('#simpleTemp').inner_text()=='–'
  assert await page.locator('#simpleTime').get_attribute('datetime') is None
  checks.append('transfer errors and future timestamps remain visible; empty/reset state cannot expose previous station readings')
  await page.reload();await page.wait_for_function('currentPage==="modern2"&&store.rows.length===1')
  assert await page.locator('#simpleTemp').inner_text()=='21.7'
  assert not errors,errors;assert not sockets,sockets
  output.write_text(json.dumps({'browser':browser.version,'checks':checks,'layouts':layouts,'pageErrors':errors,'webSockets':len(sockets),'scope':'Real offline Chromium/Chart.js, original configs, controlled CSV/UV; no live services or physical iOS'},ensure_ascii=False,indent=2)+'\n')
  await browser.close()
 print(output)
asyncio.run(main())
