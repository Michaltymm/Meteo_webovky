"""Offline history CPU/heap/DOM profile with real Chart.js; optional dev tools only.

python scripts/profile-history.py --html index.html --chartjs /tmp/chart.js --output /tmp/profile.json
Use --cpu 4 --counts 100000 for a throttled CPU scenario (not a real phone).
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--html', default='index.html')
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--cpu', type=float, default=1)
parser.add_argument('--counts', default='1000,10000,100000,250000')
parser.add_argument('--aggregates', action='store_true', help='Also measure cold refresh and shared summary consumers')
args = parser.parse_args()
html = Path(args.html).read_text().split('// Init: téma, stanice, config')[0] + '</script></body></html>'
chart = Path(args.chartjs).read_text()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for count in map(int, args.counts.split(',')):
        page = browser.new_page(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Prague')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def route(r):
            if r.request.url.endswith('/index.html'):
                r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in r.request.url:
                r.fulfill(body=chart, content_type='text/javascript')
            else:
                r.abort()
        page.route('**/*', route)
        page.goto('http://meteo.test/dev/index.html')
        cdp = page.context.new_cdp_session(page)
        cdp.send('Performance.enable')
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': args.cpu})
        def heap():
            cdp.send('HeapProfiler.collectGarbage')
            metrics = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            return {'heapBytes': int(metrics['JSHeapUsedSize']), 'nodes': int(metrics['Nodes']),
                    'charts': page.evaluate('Object.keys(Chart.instances).length')}
        empty = heap()
        page.evaluate('''count => {
          const now = Date.now();
          store.rows = Array.from({length:count},(_,i)=>{
            const ts = new Date(now-i*300000);
            return {ts,date:fmtDateShort(ts),time:fmtTime(ts),temp:i===17?85:10+Math.sin(i/40)*8,
              hum:60+Math.sin(i/33)*20,pressure:1010+Math.cos(i/100),voltage:4+Math.sin(i/80)*.1,
              rain:i%48/10,rainInc:0,tank:null,note:null};
          });
          store.fullLoaded=true;
          globalThis.showTab=tab=>{
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
            document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));
          };
          globalThis.observer=new MutationObserver(()=>{});
          observer.observe(document.body,{subtree:true,childList:true,characterData:true});
          globalThis.measure=fn=>{
            observer.takeRecords();const t=performance.now();fn();
            return {ms:+(performance.now()-t).toFixed(3),mutations:observer.takeRecords().length};
          };
        }''', count)
        loaded = heap()
        samples = []
        for _ in range(5):
            samples.append(page.evaluate('''aggregates=>{
              showTab('now');
              const extra = aggregates ? {coldRefresh:measure(()=>{invalidateDerivedData();refreshUI()})} : {};
              const history=measure(()=>buildHistoryRows());
              const refresh=measure(()=>refreshUI());
              if (aggregates) {
                extra.daily=measure(()=>buildDailyGrid());
                extra.monthly=measure(()=>buildAgg(chartMonthly,store.rows,'day',30));
                extra.yearly=measure(()=>buildAgg(chartYearly,store.rows,'month',12));
              }
              showTab('explorer');expRange='all';el('expMetric').value='temp_hum';
              const explorer=measure(()=>buildExplorer());
              return {history,refresh,explorer,...extra,points:chartExplorer.data.labels.length};
            }''', args.aggregates))
            page.wait_for_timeout(350)
        warm = heap()
        # Bounded repeated-use scenario; not a claim about a multi-day soak.
        for _ in range(30):
            page.evaluate("showTab('now');refreshUI();showTab('explorer');buildExplorer()")
            page.wait_for_timeout(30)
        page.wait_for_timeout(350)
        repeated = heap()
        results.append({'rows':count,'empty':empty,'loaded':loaded,'warm':warm,'after30Cycles':repeated,
                        'samples':samples,'pageErrors':errors,
                        'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
        print('profiled', count, flush=True)
        page.close()
    version = browser.version
    browser.close()
Path(args.output).write_text(json.dumps({'browser':version,'cpuRate':args.cpu,
    'aggregateScenario':args.aggregates,
    'network':'blocked; generated in-memory fixture, no raw CSV retained','results':results},indent=2))
if any(r['pageErrors'] or r['overflow'] for r in results):
    raise SystemExit('Browser profile failed; inspect output.')
