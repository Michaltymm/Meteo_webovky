"""Offline before/after benchmark of the visible minute update and refreshUI.

Actual DOM and SRI Chart.js; startup suppressed, synthetic full rows unchanged.
Run baseline/current sequentially. Times are synchronous JS, not Web Vitals.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--html', default='index.html')
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
html = Path(args.html).read_text().split('// Init: téma, stanice, config')[0] + '</script></body></html>'
chart = Path(args.chartjs).read_bytes()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for count in [1000, 10000, 100000, 250000]:
        page = browser.new_page(viewport={'width': 1280, 'height': 1000}, timezone_id='Europe/Prague', reduced_motion='reduce')
        errors = []
        traffic = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def route(r):
            if r.request.url == 'http://meteo.test/dev/':
                r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in r.request.url:
                r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            else:
                traffic.append('blocked external request')
                r.abort()

        page.route('**/*', route)
        page.goto('http://meteo.test/dev/')
        page.evaluate('''count=>{
          const now=Date.now();
          store.rows=Array.from({length:count},(_,i)=>({ts:new Date(now-i*300000),
            date:'23.10.2026',time:'12:00',temp:i===17?85:10+8*Math.sin(i/40),
            hum:60,pressure:1010,voltage:4.1,rain:0,rainInc:0,tank:null,note:''}));
          store.fullLoaded=true;
          if(typeof dataStatus!=='undefined'){
            dataStatus.sheets.phase='ok';dataStatus.sheets.successAt=now;
            dataStatus.latestRow=store.rows[0];dataStatus.latestKind='sheets';
          }
          globalThis.savedRows=store.rows;
          globalThis.ticks=()=>{if(typeof updateVisibleDataStatus==='function')updateVisibleDataStatus();else if(!document.hidden)updateSunBar()};
          showAppPage('modern',{scroll:false});refreshUI();
          for(let i=0;i<100;i++)ticks();
        }''', count)
        page.wait_for_timeout(350)
        samples = []
        for repeat in range(7):
            samples.append(page.evaluate('''()=>{
              const charts=Object.keys(Chart.instances).length;
              const time=performance.now();for(let i=0;i<1000;i++)ticks();
              const ticksMs=performance.now()-time;
              const start=performance.now();refreshUI();const refreshMs=performance.now()-start;
              return {ticksMs,refreshMs,chartsBefore:charts,chartsAfter:Object.keys(Chart.instances).length,
                rowsUnchanged:store.rows===savedRows};
            }'''))
            page.wait_for_timeout(100)
        unchanged = page.evaluate('''()=>{
          if(!document.querySelector('.data-state'))return null;
          const observer=new MutationObserver(()=>{});
          observer.observe(document.querySelector('.data-state'),{subtree:true,childList:true,characterData:true,attributes:true});
          for(let i=0;i<100;i++)ticks();
          const count=observer.takeRecords().length;observer.disconnect();return count;
        }''')
        results.append({'rows': count, 'samples': samples, 'unchangedStatusMutations': unchanged, 'pageErrors': errors})
        assert not errors, errors
        assert all(s['rowsUnchanged'] and s['chartsBefore'] == s['chartsAfter'] for s in samples)
        assert unchanged in [None, 0], unchanged
        # The only denied startup library is Paho; suppressed startup makes no data requests.
        assert len(traffic) == 1, traffic
        page.close()
    version = browser.version
    browser.close()
Path(args.output).write_text(json.dumps({'browser': version, 'source': args.html, 'results': results}, indent=2)+'\n')
print(args.output)
