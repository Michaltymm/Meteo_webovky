from pathlib import Path
import json,hashlib,statistics
from playwright.sync_api import sync_playwright
import argparse
parser=argparse.ArgumentParser(description='Offline Chromium profile of stable 24h selection; exact identity oracle, no live services.')
parser.add_argument('--before',required=True);parser.add_argument('--assets',required=True);parser.add_argument('--output',required=True)
args=parser.parse_args()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for variant,file in [('before',args.before),('after','index.html')]:
  page=b.new_page()
  html=Path(file).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
  def route(r):
   if r.request.url=='http://meteo.test/':r.fulfill(body=html,content_type='text/html')
   elif 'chart.js' in r.request.url:r.fulfill(body=(Path(args.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(args.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   else:r.abort()
  page.route('**/*',route);page.goto('http://meteo.test/')
  for shape in ['regular','dense','ties']:
   for n in [1000,10000,100000,250000]:
    d=page.evaluate('''({n,shape})=>{
      CFG.source='sheets';const rows=Array.from({length:n},(_,i)=>({ts:new Date(1700000000000-(shape==='regular'?i*300000:shape==='ties'?Math.floor(i/5)*100:i*100)),temp:i,hum:0}));
      const runs=[];let out;
      for(let k=0;k<8;k++){const t=performance.now();out=selectCurrentChartRows(rows);const elapsed=performance.now()-t;if(k>1)runs.push(elapsed);}
      const expected=rows.filter(r=>+r.ts>=+rows[0].ts-86400000).sort((a,b)=>a.ts-b.ts);
      if(out.length!==expected.length||!out.every((r,i)=>r===expected[i]))throw Error('mismatch');
      return {runs,indices:out.map(r=>r.temp)};
    }''',{'n':n,'shape':shape})
    d.update(variant=variant,shape=shape,n=n,hash=hashlib.sha256(json.dumps(d.pop('indices')).encode()).hexdigest());results.append(d)
    print(variant,shape,n,round(statistics.median(d['runs']),2),flush=True)
  page.close()
 b.close()
for before,after in zip(results[:12],results[12:]):assert before['hash']==after['hash']
Path(args.output).write_text(json.dumps(results,indent=2))
