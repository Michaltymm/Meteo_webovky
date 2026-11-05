"""Offline device draft UI with real Chart.js and three original configurations."""
import asyncio,json,argparse
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--chartjs',required=True);parser.add_argument('--paho',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
 files=['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json'];configs={f:json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files};errors=[];writes=[];checks=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
  page=await browser.new_page(viewport={'width':375,'height':812},has_touch=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(r):
   u=r.request.url;name=urlparse(u).path.split('/')[-1]
   if r.request.method!='GET':writes.append(u)
   if u=='http://meteo.test/dev/':return await r.fulfill(body=Path('index.html').read_bytes(),content_type='text/html')
   if 'chart.js' in u:return await r.fulfill(body=Path(args.chartjs).read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   if 'paho-mqtt' in u:return await r.fulfill(body=Path(args.paho).read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   if name in configs:return await r.fulfill(json=configs[name])
   if 'docs.google.com' in u:return await r.fulfill(body='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n05.11.2026,10:00:00,20,1010,50,0,0,,4.1',content_type='text/csv')
   if 'api.open-meteo.com' in u:return await r.fulfill(json={'hourly':{'uv_index':[0]*24}})
   return await r.abort()
  await page.route('**/*',route);await page.goto('http://meteo.test/dev/');await page.wait_for_function('store.rows.length===1')
  await page.locator('.pill[title="Nastavení"]').click();await page.get_by_role('button',name='🔧 Nastavení meteostanice',exact=True).click()
  await page.wait_for_function('el("deviceSettings").open')
  for i in range(3):
   await page.select_option('#deviceStation',str(i));await page.wait_for_function('(i)=>activeIdx===i&&store.rows.length===1',arg=i)
   before=await page.evaluate('JSON.stringify(CFG)')
   await page.fill('#deviceInterval',str(300+i));await page.get_by_role('button',name='Uložit koncept v tomto prohlížeči',exact=True).click()
   assert 'neodesláno do ESP' in await page.locator('#deviceDraftStatus').inner_text()
   assert await page.evaluate('JSON.stringify(CFG)')==before
  await page.select_option('#deviceStation','0');assert await page.input_value('#deviceInterval')=='300'
  async with page.expect_download() as info:await page.get_by_role('button',name='Stáhnout návrh JSON').click()
  download=await info.value;payload=json.loads(Path(await download.path()).read_text())
  assert payload=={'schemaVersion':1,'stationKey':'config_praha_baterie','settings':{'measurementIntervalSeconds':300}}
  assert download.suggested_filename=='device-draft-config_praha_baterie.json'
  checks.append('three station drafts separated; actual setting/config unchanged; downloaded JSON scoped without credentials/revision')
  for width in [320,375,430,767,1440]:
   await page.set_viewport_size({'width':width,'height':812})
   for theme in ['darkblue','light']:
    await page.evaluate('(theme)=>setTheme(theme)',theme);await page.wait_for_timeout(350)
    dimensions=await page.evaluate('({dialog:el("deviceSettings").scrollWidth,client:el("deviceSettings").clientWidth,page:document.documentElement.scrollWidth,viewport:innerWidth})');assert dimensions['dialog']<=dimensions['client']+1 and dimensions['page']<=dimensions['viewport']+1,(width,theme,dimensions)
  checks.append('10 viewport/theme cases without overflow; native modal keyboard escape')
  await page.keyboard.press('Escape');assert not await page.evaluate('el("deviceSettings").open')
  await page.reload();await page.wait_for_function('store.rows.length===1');await page.evaluate('openDeviceSettings()')
  assert await page.input_value('#deviceInterval')=='300'
  assert 'Nepotvrzeno zařízením' in await page.locator('#deviceSettings').inner_text()
  checks.append('draft survives reload; no invented confirmation/contact/device information')
  assert not errors,errors;assert not writes,writes
  Path(args.output).write_text(json.dumps({'browser':browser.version,'checks':checks,'pageErrors':errors,'writes':writes,'scope':'Controlled offline CSV; no live ESP/API or physical iOS'},ensure_ascii=False,indent=2)+'\n')
  await browser.close()
 print(args.output)
asyncio.run(main())
