"""Offline Chromium stable ordering profile; exact identity oracle, not Web Vitals."""
import argparse,json,statistics,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--before',required=True);p.add_argument('--assets',required=True);p.add_argument('--output',required=True);a=p.parse_args()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for variant,file in [('before',a.before),('after','index.html')]:
  page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=Path(file).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
  def route(r):
   if r.request.url=='http://meteo.test/':r.fulfill(body=html,content_type='text/html')
   elif 'chart.js' in r.request.url:r.fulfill(body=(Path(a.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(a.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   else:raise AssertionError(r.request.url)
  page.route('**/*',route);page.goto('http://meteo.test/')
  for shape in ['descending','equal','unordered']:
   for n in [1000,10000,100000,250000]:
    d=page.evaluate('''async ({n,shape,variant})=>{
     const original=Array.from({length:n},(_,i)=>({ts:new Date(shape==='descending'?1700000000000-i*1000:shape==='equal'?1700000000000:(i*7919%86400)*1000),temp:i}));
     const expected=original.slice().sort((a,b)=>b.ts.getTime()-a.ts.getTime());
     const runs=[];let result;
     for(let k=0;k<4;k++){
      const rows=original.slice();let max=0,slices=0;const started=performance.now();
      if(variant==='before'||n<=10000){result=rows.sort((a,b)=>b.ts.getTime()-a.ts.getTime());max=performance.now()-started;slices=1;}
      else{const steps=stableHistorySortSteps(rows);while(true){const t=performance.now(),out=analyticsWorkSlice(steps);max=Math.max(max,performance.now()-t);slices++;if(out){result=out.value;break;}await new Promise(r=>setTimeout(r,0));}}
      const elapsed=performance.now()-started;
      if(result.length!==expected.length||result.some((r,i)=>r!==expected[i]))throw Error('sort mismatch');
      if(k)runs.push({elapsed,max,slices});
     }return {runs,ids:result.map(r=>r.temp)};
    }''',{'n':n,'shape':shape,'variant':variant})
    d.update(n=n,shape=shape,variant=variant,hash=hashlib.sha256(json.dumps(d.pop('ids')).encode()).hexdigest());results.append(d)
    print(variant,shape,n,'slice',round(statistics.median(v['max'] for v in d['runs']),2),'elapsed',round(statistics.median(v['elapsed'] for v in d['runs']),2),flush=True)
  assert not errors,errors;page.close()
 b.close()
for x,y in zip(results[:12],results[12:]):assert x['hash']==y['hash']
Path(a.output).write_text(json.dumps(results,indent=2))
