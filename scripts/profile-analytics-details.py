"""Local profile of remaining heatmap, smoothing and night work.

Prepared model; real Chromium/canvas, routed SRI libraries, no live services.
Five samples after warmup, separate regular and dense distributions.
"""
import argparse
import hashlib
import json
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html',default='index.html')
    parser.add_argument('--chartjs',required=True)
    parser.add_argument('--paho',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--counts',default='1000,10000,100000,250000')
    parser.add_argument('--cpu',type=float,default=1)
    parser.add_argument('--distributions',default='regular,dense')
    args=parser.parse_args()
    html=Path(args.html).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
    chart,paho=Path(args.chartjs).read_bytes(),Path(args.paho).read_bytes()
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        for count in map(int,args.counts.split(',')):
            for distribution in args.distributions.split(','):
                if distribution not in ['regular','dense','night']:raise ValueError('Unknown distribution')
                step=300000 if distribution=='regular' else 100
                page=browser.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',reduced_motion='reduce')
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                def route(r):
                    url=r.request.url
                    if url=='http://meteo.test/dev/index.html':return r.fulfill(body=html,content_type='text/html')
                    if 'chart.js' in url:return r.fulfill(body=chart,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
                    if 'paho-mqtt' in url:return r.fulfill(body=paho,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
                    return r.abort()
                page.route('**/*',route);page.goto('http://meteo.test/dev/index.html')
                cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
                cdp.send('Emulation.setCPUThrottlingRate',{'rate':args.cpu})
                page.evaluate('''({count,step,distribution})=>{
                  let end=Date.parse('2026-10-24T12:00:00+02:00');
                  if(distribution==='night')end=+calcSunTimes(50.08,14.42,new Date(end)).rise+1000;
                  store.rows=Array.from({length:count},(_,i)=>({ts:new Date(end-i*step),
                    temp:i===17?85:i%29===0?null:i%71===0?0:10+Math.sin(i/40)*8,
                    hum:i%23===0?null:i%53===0?0:60+Math.sin(i/33)*20,
                    pressure:1010,voltage:4+Math.sin(i/80)*.1,rain:0,rainInc:0,tank:null}));
                  store.fullLoaded=true;currentPage='analytics';el('anaSync').checked=true;
                  CFG.lat=50.08;CFG.lon=14.42;
                  el('page-main').hidden=true;el('tab-analytics').hidden=false;
                  analyticsState.domain=analyticsRange(store.rows,'all');analyticsState.base=analyticsState.domain;
                  globalThis.m=analyticsBuildModel(analyticsState.domain);analyticsState.model=m;
                  analyticsState.visible=new Set([8]);el('anaHeatMetric').value='temp';
                  globalThis.measure=()=>{
                    const time=fn=>{const start=performance.now(),value=fn();return {ms:performance.now()-start,value}};
                    analyticsState.heat=null;const heat=time(()=>analyticsHeatmap());
                    const cells=JSON.stringify({keys:analyticsState.heat.keys,cells:analyticsState.heat.cells});
                    const warm=time(()=>analyticsHeatmap());
                    const moving=time(()=>analyticsMoving(m.rows,'temp'));
                    const night=time(()=>analyticsNight(m.rows));
                    if(!m.rows.every((r,i)=>r===store.rows[store.rows.length-1-i]))throw Error('Source changed');
                    return {timings:{heatColdMs:heat.ms,heatWarmMs:warm.ms,movingMs:moving.ms,nightMs:night.ms},
                      results:{heat:cells,moving:moving.value,night:night.value}};
                  };
                }''',{'count':count,'step':step,'distribution':distribution})
                page.evaluate('measure()')
                samples=[];signatures=[]
                for _ in range(5):
                    cdp.send('HeapProfiler.collectGarbage')
                    result=page.evaluate('measure()');samples.append(result['timings'])
                    signatures.append(hashlib.sha256(json.dumps(result['results'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest())
                assert len(set(signatures))==1
                assert not errors,errors
                results.append({'rows':count,'distribution':distribution,'stepMs':step,'signatureSHA256':signatures[0],
                    'samples':samples,'median':{key:median(s[key] for s in samples) for key in samples[0]},'pageErrors':errors})
                page.close()
        version=browser.version;browser.close()
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({'browser':version,'cpuRate':args.cpu,
        'scenario':'Prepared full model; cold/warm heatmap, moving mean and last completed night; regular5min, dense100ms, optional100ms ending sunrise+1s',
        'limits':'Synchronous JS/canvas calls only, no CSV/network, whole-page paint, INP, physical phone or long-term memory',
        'results':results},indent=2)+'\n');print(out)


if __name__=='__main__':main()
