"""Offline model preparation profile; run separately before/after source changes.

Uses the real application and Chromium, with local SRI libraries. Automatic
startup, chart redraw and other-station loading are excluded deliberately.
This measures computation turns and completion, not network, paint or INP.
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
            page.evaluate('''count => {
              const end=Date.parse('2026-10-23T12:00:00+02:00');
              store.rows=Array.from({length:count},(_,i)=>({
                ts:new Date(end-Math.floor(i/2)*300000),
                temp:i===17?85:i===4321?20:i%29===0?null:i%71===0?0:10+Math.sin(i/40)*8,
                hum:i%23===0?null:i%53===0?0:60+Math.sin(i/33)*20,
                pressure:i%31===0?null:1010+Math.cos(i/100),
                voltage:i===4321?7:i%37===0?null:i%79===0?0:4+Math.sin(i/80)*.1,
                rain:i%48/10,rainInc:0,tank:null
              }));
              store.fullLoaded=true;globalThis.profileSource=store.rows;
              currentPage='analytics';el('anaSync').checked=true;
              el('page-main').hidden=true;el('dashboardBars').hidden=true;el('tab-analytics').hidden=false;
              analyticsDrawCard=()=>{};analyticsUpdateStatus=()=>{};
              analyticsState.visible.clear();analyticsState.visible.add(0);
              globalThis.profileDone=null;globalThis.profileTurns=[];
              analyticsRedraw=()=>{if(analyticsState.model)profileDone?.()};
              if(typeof analyticsRunModelJob==='function'){
                const run=analyticsRunModelJob;
                analyticsRunModelJob=(...args)=>{const start=performance.now();
                  try{return run(...args)}finally{profileTurns.push(performance.now()-start)}
                };
              }
              globalThis.profilePrepare=()=>{
                analyticsInvalidate();analyticsState.modelError=false;
                analyticsState.domain=analyticsRange(store.rows,'all');analyticsState.base=analyticsState.domain;
              };
              globalThis.profileOnce=async()=>{
                profileTurns=[];
                const done=Promise.withResolvers(),gaps=[];
                const start=performance.now();let last=start,finished=null;
                profileDone=()=>{if(finished===null){finished=performance.now();done.resolve()}};
                const heartbeat=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;
                  if(analyticsState.model&&!analyticsState.job)profileDone();},4);
                const timeout=setTimeout(()=>done.reject(new Error('Model did not complete within 30 seconds')),30000);
                let requestMs;
                try{
                  const result=analyticsModel(0,true);requestMs=performance.now()-start;
                  if(result)profileDone();
                  await done.promise;
                  // Allow a heartbeat following a synchronous baseline block.
                  await new Promise(resolve=>setTimeout(resolve,8));
                }finally{clearInterval(heartbeat);clearTimeout(timeout);profileDone=null}
                const turns=[requestMs,...profileTurns];
                return {wallMs:finished-start,requestMs,computeMs:turns.reduce((a,b)=>a+b,0),
                  longestComputeMs:Math.max(...turns),computeTurns:turns.length,
                  heartbeatMaxGapMs:gaps.length?Math.max(...gaps):null};
              };
              globalThis.profileVerify=()=>{
                const m=analyticsState.model;
                if(!m||analyticsState.job||m.source!==profileSource||store.rows!==profileSource||m.rows.length!==profileSource.length)
                  throw new Error('Model scope/commit mismatch');
                if(!m.rows.every((r,i)=>r===profileSource[profileSource.length-1-i]))throw new Error('Original reference/order changed');
                if(m.samples.length>600||m.xy.length>580||m.summary.rates.length>600)throw new Error('Unbounded visual model');
                if(!m.samples.some(r=>r===profileSource[17]))throw new Error('Temperature spike lost');
                if(profileSource.length>4321&&!m.xy.some(p=>p.ts===+profileSource[4321].ts&&p.y===7))throw new Error('Voltage spike lost');
                return {summary:m.summary,
                  samples:m.samples.map(r=>[+r.ts,!!r.anaGap,r.temp,r.hum,r.pressure,r.voltage,r.rain,r.rainInc]),xy:m.xy};
              };
            }''', count)

            def heap():
                cdp.send('HeapProfiler.collectGarbage')
                metrics = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
                return int(metrics['JSHeapUsedSize'])

            # One full warmup; then five invalidated models over identical rows.
            page.evaluate('profilePrepare()')
            page.evaluate('profileOnce()')
            page.evaluate('profileVerify()')
            samples, signatures = [], []
            for _ in range(5):
                page.evaluate('profilePrepare()')
                heap()
                sample = page.evaluate('profileOnce()')
                descriptor = page.evaluate('JSON.stringify(profileVerify())')
                signature = hashlib.sha256(descriptor.encode()).hexdigest()
                signatures.append(signature)
                sample['heapAfterGCBytes'] = heap()
                samples.append(sample)
            assert len(set(signatures)) == 1, 'Identical fixture produced different models'
            assert not errors, errors
            results.append({'rows': count, 'modelSignatureSHA256': signatures[0], 'samples': samples,
                'median': {key: median(sample[key] for sample in samples) for key in samples[0]}, 'pageErrors': errors})
            page.close()
        version = browser.version
        browser.close()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'browser': version, 'cpuRate': args.cpu,
        'scenario': 'Cold complete analytical model over identical original rows; local assets, startup and redraw excluded; five samples after one warmup',
        'limits': 'Computation callbacks and completion only; not paint, INP, actual network, physical phone or long-term heap',
        'results': results}, indent=2)+'\n')
    print(output)


if __name__ == '__main__':
    main()
