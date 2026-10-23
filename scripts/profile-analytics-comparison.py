"""Offline comparison preparation, exact/offset timestamps, before/after.

Real Chromium/application, local SRI libraries; model, transport and chart paint
excluded. Run profiles sequentially. Development tools are not app dependencies.
"""
import argparse
import hashlib
import json
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', default='index.html')
    parser.add_argument('--chartjs', required=True)
    parser.add_argument('--paho', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--counts', default='1000,10000,100000,250000')
    parser.add_argument('--cpu', type=float, default=1)
    args = parser.parse_args()
    html = Path(args.html).read_text().split('// Init: téma, stanice, config')[0] + '</script></body></html>'
    chart, paho = Path(args.chartjs).read_bytes(), Path(args.paho).read_bytes()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for count in map(int, args.counts.split(',')):
            for offset in [0, 5000]:
                page = browser.new_page(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Prague', reduced_motion='reduce')
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))

                def route(r):
                    url = r.request.url
                    if url == 'http://meteo.test/dev/index.html':
                        return r.fulfill(body=html, content_type='text/html')
                    if 'chart.js' in url:
                        return r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
                    if 'paho-mqtt' in url:
                        return r.fulfill(body=paho, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
                    return r.abort()

                page.route('**/*', route)
                page.goto('http://meteo.test/dev/index.html')
                cdp = page.context.new_cdp_session(page)
                cdp.send('Performance.enable')
                cdp.send('Emulation.setCPUThrottlingRate', {'rate': args.cpu})
                page.evaluate('''({count,offset})=>{
                  const end=Date.parse('2026-10-23T12:00:00+02:00');
                  store.rows=Array.from({length:count},(_,i)=>({ts:new Date(end-Math.floor(i/2)*300000),
                    temp:i===17?85:i%29===0?null:i%71===0?0:10+Math.sin(i/40)*8,
                    hum:60,pressure:1010,voltage:4,rain:0,rainInc:0,tank:null}));
                  store.fullLoaded=true;currentPage='analytics';el('anaSync').checked=true;
                  el('page-main').hidden=true;el('tab-analytics').hidden=false;
                  analyticsState.domain=analyticsRange(store.rows,'all');analyticsState.base=analyticsState.domain;
                  globalThis.profileSource=store.rows;globalThis.model=analyticsBuildModel(analyticsState.domain);
                  analyticsState.model=model;analyticsDrawCard=()=>{};analyticsUpdateStatus=()=>{};
                  for(const index of [1,2]){
                    const c=analyticsCompact(store.rows);
                    for(let i=0;i<c.count;i++){c.temps[i]+=index;c.times[i]+=offset;}
                    analyticsStationCache.set(index,{...c,name:'Fixture '+index,loadedAt:end,preferences:analyticsSourceSignature(index)});
                  }
                  globalThis.turns=[];globalThis.matches=[];globalThis.phase={matchMs:0,samplingMs:0};
                  if(typeof analyticsMatchSteps==='function'){
                    const original=analyticsMatchSteps;
                    analyticsMatchSteps=function*(...args){const r=yield* original(...args);matches.push(r);return r};
                  }else{
                    const original=analyticsMatch;
                    analyticsMatch=(...args)=>{const start=performance.now();const r=original(...args);phase.matchMs+=performance.now()-start;matches.push(r);return r};
                  }
                  if(typeof analyticsRunComparisonJob==='function'){
                    const original=analyticsRunComparisonJob;
                    analyticsRunComparisonJob=(job)=>{const start=performance.now();try{return original(job)}finally{turns.push(performance.now()-start)}};
                  }else{
                    const original=analyticsColumnPoints;
                    analyticsColumnPoints=(...args)=>{const start=performance.now();const r=original(...args);phase.samplingMs+=performance.now()-start;return r};
                  }
                  globalThis.prepare=()=>{
                    if(typeof analyticsCancelComparison==='function')analyticsCancelComparison();
                    delete model.comparison;delete model.comparisonSignature;delete model.comparisonFailed;
                    matches=[];turns=[];phase={matchMs:0,samplingMs:0};
                  };
                  globalThis.once=async()=>{
                    const start=performance.now(),gaps=[];let last=start;
                    const heartbeat=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now},4);
                    const result=analyticsComparison(analyticsState.domain,model,true),requestMs=performance.now()-start;
                    while(!model.comparison){
                      if(performance.now()-start>30000)throw new Error('Comparison timeout');
                      await new Promise(resolve=>setTimeout(resolve,4));
                    }
                    const wallMs=performance.now()-start;
                    await new Promise(resolve=>setTimeout(resolve,8));clearInterval(heartbeat);
                    const blocks=[requestMs,...turns];
                    return {wallMs,requestMs,computeMs:blocks.reduce((a,b)=>a+b,0),longestComputeMs:Math.max(...blocks),
                      computeTurns:blocks.length,heartbeatMaxGapMs:gaps.length?Math.max(...gaps):null,...phase};
                  };
                  globalThis.verify=()=>{
                    if(!model.comparison||store.rows!==profileSource||model.rows.some((r,i)=>r!==profileSource[profileSource.length-1-i]))throw new Error('Source changed');
                    if(matches.length!==2||model.comparison.datasets.length!==3)throw new Error('Missing comparison');
                    if(model.comparison.datasets.some(ds=>ds.data.length>600))throw new Error('Unbounded visual series');
                    if(matches.some((m,i)=>{const c=analyticsStationCache.get(i+1),b=analyticsColumnBounds(c,model.from,model.to);
                      return m.count!==Math.min(model.summary.stats.temp.count,b.end-b.start)||m.maxOffsetMs!==offset||m.deltaAvg===null}))throw new Error('Incorrect pairing');
                    return JSON.stringify({comparison:model.comparison,matches});
                  };
                }''', {'count': count, 'offset': offset})

                def heap():
                    cdp.send('HeapProfiler.collectGarbage')
                    return int(next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name'] == 'JSHeapUsedSize'))

                page.evaluate('prepare()');page.evaluate('once()');page.evaluate('verify()')
                samples, signatures = [], []
                for _ in range(5):
                    page.evaluate('prepare()');heap()
                    sample = page.evaluate('once()')
                    signatures.append(hashlib.sha256(page.evaluate('verify()').encode()).hexdigest())
                    sample['heapAfterGCBytes'] = heap();samples.append(sample)
                assert len(set(signatures)) == 1
                assert not errors, errors
                results.append({'rows': count, 'offsetMs': offset, 'signatureSHA256': signatures[0], 'samples': samples,
                    'median': {key: median(s[key] for s in samples) for key in samples[0]}, 'pageErrors': errors})
                page.close()
        version = browser.version;browser.close()
    output = Path(args.output);output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'browser': version, 'cpuRate': args.cpu,
        'scenario': 'Two cached station histories; exact and +5s duplicate timestamps; five cold comparisons after warmup; prepared model',
        'limits': 'Comparison preparation only; no chart draw, CSV, network, paint, INP or physical phone', 'results': results}, indent=2)+'\n')
    print(output)


if __name__ == '__main__':
    main()
