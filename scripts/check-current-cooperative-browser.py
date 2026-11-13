"""Offline Chromium verification/profile. Same full 24h synthetic rows, no live services."""
import argparse,json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--output',required=True);p.add_argument('--assets',required=True);a=p.parse_args()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for variant,path in [('before',a.before),('after','index.html')]:
  page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=Path(path).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
  def route(r):
   if r.request.url=='http://meteo.test/dev/':r.fulfill(body=html,content_type='text/html')
   elif 'chart.js' in r.request.url:r.fulfill(body=(Path(a.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(a.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   else:raise AssertionError(r.request.url)
  page.route('**/*',route);page.goto('http://meteo.test/dev/')
  for n in [1000,10000,100000,250000]:
   # meteo.test is not a secure context: use Python SHA over the actual output.
   code='''async ({n,variant})=>{
    const rows=Array.from({length:n},(_,i)=>({ts:new Date(1700000000000+i*100),temp:i%101===0?null:i%37,hum:i%89===0?null:i%101}));
    const runs=[];let out;
    for(let repeat=0;repeat<4;repeat++){
      let max=0,slices=0;const started=performance.now();
      if(variant==='before'||n<=10000){out=currentChartData(rows,800);max=performance.now()-started;slices=1;}
      else {const steps=currentChartDataSteps(rows,800);while(true){const t=performance.now(),r=analyticsWorkSlice(steps);max=Math.max(max,performance.now()-t);slices++;if(r){out=r.value;break;}await new Promise(r=>setTimeout(r,0));}}
      if(repeat)runs.push({elapsed:performance.now()-started,max,slices});
    }return {n,runs,out};
   }'''
   data=page.evaluate(code,{'n':n,'variant':variant})
   import hashlib
   data['hash']=hashlib.sha256(json.dumps(data.pop('out'),sort_keys=True).encode()).hexdigest();data['variant']=variant;results.append(data)
  if variant=='after':
   for cfg in ['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json']:
    page.evaluate('''config=>{
      CFG={...CFG,...config,source:'sheets'};store.rows=Array.from({length:12000},(_,i)=>({ts:new Date(1700000000000-i*1000),temp:i%30,hum:i%100}));
      el('stationData').hidden=false;el('stationDataEmpty').hidden=true;showAppPage('main',{scroll:false});
      initCurrentChartVisibility();invalidateDerivedData();el('chart24h').scrollIntoView();
    }''',json.loads(Path(cfg).read_text(encoding='utf-8-sig')))
    page.wait_for_function('!tabDirtyState.now && !currentChartJob')
    assert page.evaluate('JSON.stringify({labels:chart24.data.labels,series:chart24.data.datasets.map(d=>d.data)})===JSON.stringify(currentChartData(selectCurrentChartRows(store.rows),800))')
    page.evaluate("showAppPage('modern2',{scroll:false})")
   for width in [320,390,767,1440]:
    page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  page.close()
 b.close()
for n in [1000,10000,100000,250000]:
 pair=[r for r in results if r['n']==n];assert pair[0]['hash']==pair[1]['hash']
Path(a.output).write_text(json.dumps(results,indent=2))
for r in results:print(r['variant'],r['n'],'max slice',round(statistics.median(v['max'] for v in r['runs']),2),'elapsed',round(statistics.median(v['elapsed'] for v in r['runs']),2))
