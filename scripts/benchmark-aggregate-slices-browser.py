"""Offline Chromium: exact aggregate snapshot and longest CPU slice, not Web Vitals."""
import argparse,json,statistics,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--before',required=True);p.add_argument('--assets',required=True);p.add_argument('--output',required=True);a=p.parse_args()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for variant,file in [('before',a.before),('after','index.html')]:
  page=b.new_page(timezone_id='Europe/Prague');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=Path(file).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
  def route(r):
   if r.request.url=='http://meteo.test/':r.fulfill(body=html,content_type='text/html')
   elif 'chart.js' in r.request.url:r.fulfill(body=(Path(a.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(a.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   else:raise AssertionError(r.request.url)
  page.route('**/*',route);page.goto('http://meteo.test/')
  for n in [1000,10000,100000,250000]:
   d=page.evaluate('''async ({n,variant})=>{
     const rows=Array.from({length:n},(_,i)=>({ts:new Date(1700000000000-i*300000),temp:i%101===0?null:i%67/3,hum:i%89===0?null:i%101,rain:i%43/10,voltage:i%3===0?0:null,pressure:1010}));
     const runs=[];let result;
     for(let k=0;k<4;k++){
       let max=0,slices=0;const start=performance.now();
       if(variant==='before'||n<=10000){result=dataAggregates(rows);max=performance.now()-start;slices=1;}
       else {const steps=dataAggregateSteps(rows);while(true){const t=performance.now(),out=analyticsWorkSlice(steps);max=Math.max(max,performance.now()-t);slices++;if(out){result=out.value;break;}await new Promise(r=>setTimeout(r,0));}}
       if(k)runs.push({elapsed:performance.now()-start,max,slices});
     }
     const {source,days,months,years,hourly,annual,...rest}=result;
     return {runs,snapshot:JSON.stringify({...rest,days:[...days],months:[...months],years:[...years],hourly:[...hourly],annual:[...annual]})};
   }''',{'n':n,'variant':variant})
   d.update(n=n,variant=variant,hash=hashlib.sha256(d.pop('snapshot').encode()).hexdigest());results.append(d)
   print(variant,n,round(statistics.median(v['max'] for v in d['runs']),2),round(statistics.median(v['elapsed'] for v in d['runs']),2),flush=True)
  assert not errors,errors;page.close()
 b.close()
for x,y in zip(results[:4],results[4:]):assert x['hash']==y['hash'],(x,y)
Path(a.output).write_text(json.dumps(results,indent=2))
