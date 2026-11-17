"""Offline Chromium CPU profile of cold/warm hourly, annual and overview statistics."""
import argparse,json,statistics,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--html',default='index.html');p.add_argument('--assets',required=True);p.add_argument('--output',required=True);a=p.parse_args()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 page=b.new_page(timezone_id='Europe/Prague',reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=Path(a.html).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
 def route(r):
  if r.request.url=='http://meteo.test/':r.fulfill(body=html,content_type='text/html')
  elif 'chart.js' in r.request.url:r.fulfill(body=(Path(a.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
  elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(a.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
  else:raise AssertionError(r.request.url)
 page.route('**/*',route);page.goto('http://meteo.test/')
 for shape in ['regular','dense']:
  for n in [1000,10000,100000,250000]:
   data=page.evaluate('''({n,shape})=>{
    const base=new Date(2026,10,17,12).getTime();
    store.rows=Array.from({length:n},(_,i)=>({ts:new Date(base-(shape==='regular'?i*300000:Math.floor(i/3)*1000)),temp:i%101===0?null:i%67/3,hum:i%89===0?null:i%101,rain:i%43/10,rainInc:i%13/10,voltage:i%3===0?0:null,pressure:i%47===0?null:1010}));
    aggregateCache=null;const snapshot=dataAggregates(),key=localDateKey(store.rows[0].ts),year=store.rows[0].ts.getFullYear();
    // Exclude Chart layout from the overview CPU; preserve its generated data.
    chartOverview.update=()=>{};el('ovMetric').value='temp';ovDays=0;
    const runs={hourly:[],annual:[],overview:[],hourlyWarm:[],annualWarm:[]};let h,y;
    for(let k=0;k<4;k++){
     snapshot.hourly.clear();snapshot.annual.clear();
     let t=performance.now();h=hourlyDay(key);if(k)runs.hourly.push(performance.now()-t);
     t=performance.now();hourlyDay(key);if(k)runs.hourlyWarm.push(performance.now()-t);
     t=performance.now();y=annualStats(year,snapshot);if(k)runs.annual.push(performance.now()-t);
     t=performance.now();annualStats(year,snapshot);if(k)runs.annualWarm.push(performance.now()-t);
     t=performance.now();buildTempOverview();if(k)runs.overview.push(performance.now()-t);
    }
    return {runs,hourly:JSON.stringify(h),annual:JSON.stringify(y),overview:JSON.stringify(chartOverview.data)};
   }''',{'n':n,'shape':shape})
   signatures={key:hashlib.sha256(data.pop(key).encode()).hexdigest() for key in ['hourly','annual','overview']}
   data.update(n=n,shape=shape,sha256=signatures);results.append(data)
   print(shape,n,{key:round(statistics.median(values),2) for key,values in data['runs'].items()},flush=True)
 assert not errors,errors;b.close()
Path(a.output).write_text(json.dumps({'source':a.html,'results':results,'errors':errors,'scope':__doc__},indent=2))
