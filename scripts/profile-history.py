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
parser.add_argument('--comparison', action='store_true', help='Also measure first and repeated hourly comparison')
parser.add_argument('--annual', action='store_true', help='Also measure first and repeated annual statistics')
parser.add_argument('--analysis', action='store_true', help='Measure the new battery module and humidity explorer, when available')
parser.add_argument('--records', action='store_true', help='After core measurements, profile the original battery record viewer when available')
parser.add_argument('--hour-records', action='store_true', help='After core measurements, profile hourly original records with a dense single-hour fixture')
parser.add_argument('--temperature-record', action='store_true', help='After core measurements, profile original global temperature extremes')
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
            samples.append(page.evaluate('''flags=>{
              showTab('now');
              const extra = flags.aggregates ? {coldRefresh:measure(()=>{invalidateDerivedData();refreshUI()})} : {};
              const history=measure(()=>buildHistoryRows());
              const refresh=measure(()=>refreshUI());
              if (flags.aggregates) {
                extra.daily=measure(()=>buildDailyGrid());
                extra.monthly=measure(()=>buildAgg(chartMonthly,store.rows,'day',30));
                extra.yearly=measure(()=>buildAgg(chartYearly,store.rows,'month',12));
              }
              if (flags.comparison) {
                showTab('compare');el('cmpMetric').value='temp_hum';
                cmpSelectedDays=[localDateKey(),localDateKey(localCalendarDay(-1))];
                extra.coldCompare=measure(()=>{invalidateDerivedData();buildCompare()});
                extra.compare=measure(()=>buildCompare());
              }
              if (flags.annual) {
                showTab('yearstats');el('yearStatsFilter').value='0';
                extra.coldAnnual=measure(()=>{invalidateDerivedData();buildYearlyStats()});
                extra.annual=measure(()=>buildYearlyStats());
              }
              if (flags.analysis && typeof buildBatteryAnalysis==='function') {
                showTab('battery');el('batteryRange').value='all';
                extra.coldBattery=measure(()=>{invalidateDerivedData();buildBatteryAnalysis()});
                extra.battery=measure(()=>buildBatteryAnalysis());
                extra.batteryCounts={pairs:batteryAnalysis('all').count,xy:batteryAnalysis('all').xy.length,
                  time:batteryAnalysis('all').timeTemp.length};
                showTab('explorer');expRange='all';el('expMetric').value='vpd';
                extra.vpd=measure(()=>buildExplorer());
              }
              showTab('explorer');expRange='all';el('expMetric').value='temp_hum';
              const explorer=measure(()=>buildExplorer());
              return {history,refresh,explorer,...extra,points:chartExplorer.data.labels.length};
            }''', {'aggregates':args.aggregates,'comparison':args.comparison,'annual':args.annual,'analysis':args.analysis}))
            page.wait_for_timeout(350)
        warm = heap()
        # Bounded repeated-use scenario; not a claim about a multi-day soak.
        for _ in range(30):
            page.evaluate("showTab('now');refreshUI();showTab('explorer');buildExplorer()")
            if args.comparison:
                page.evaluate("showTab('compare');buildCompare()")
            if args.annual:
                page.evaluate("showTab('yearstats');buildYearlyStats()")
            if args.analysis:
                page.evaluate("if(typeof buildBatteryAnalysis==='function'){showTab('battery');buildBatteryAnalysis()}")
            page.wait_for_timeout(30)
        page.wait_for_timeout(350)
        repeated = heap()
        records = None
        if args.records and page.evaluate("typeof openBatteryRecords==='function'"):
            page.evaluate("showTab('battery');el('batteryRange').value='all';buildBatteryAnalysis();el('batterySensitivity').open=true;el('batteryRecords').open=true")
            page.wait_for_timeout(100) # Native toggle opens the first page outside the timed samples.
            assert page.locator('.battery-record-table').is_visible()
            record_samples = []
            for _ in range(5):
                record_samples.append(page.evaluate('''()=>{
                  const open=measure(()=>openBatteryRecords());
                  const next=measure(()=>pageBatteryRecords(1));
                  return {open,next,rows:el('batteryRecordsBody').children.length,
                    total:batteryRecordView.end-batteryRecordView.start};
                }'''))
                page.wait_for_timeout(350)
            opened = heap()
            page.evaluate("el('batteryRecords').open=false;toggleBatteryRecords()")
            page.wait_for_timeout(100)
            records = {'samples':record_samples,'opened':opened,'closed':heap()}
            page.evaluate('''()=>{
              for(let i=0;i<20;i++){
                el('batteryRecords').open=true;openBatteryRecords();pageBatteryRecords(1);
                el('batteryRecords').open=false;toggleBatteryRecords();observer.takeRecords();
              }
            }''')
            page.wait_for_timeout(100)
            records['after20OpenClose'] = heap()
            records['closedRows'] = page.locator('#batteryRecordsBody tr').count()
            assert records['closedRows'] == 0 and page.evaluate('batteryRecordView===null')
        hour_records = None
        if args.hour_records:
            # Separate distribution: all rows in one hour, so paging is exercised
            # even at 1k. This happens only after the unchanged core profile.
            page.evaluate('''count=>{
              const end=+new Date(2026,9,21,12,59,59);
              store.rows=Array.from({length:count},(_,i)=>({ts:new Date(end-i*10),temp:i%13===0?null:i/7,hum:i%101,pressure:1010}));
              invalidateDerivedData();showTab('compare');cmpSelectedDays=['2026-10-21'];el('cmpMetric').value='temp_hum';buildCompare();
              el('cmpEvidence').open=true;el('cmpRecordsHour').value='12';el('cmpRecords').open=true;
            }''', count)
            page.wait_for_timeout(100)
            assert page.locator('#cmpRecords table').is_visible()
            hourly_samples = []
            for _ in range(5):
                hourly_samples.append(page.evaluate('''()=>{
                  const open=measure(()=>openComparisonRecords());
                  const next=measure(()=>pageComparisonRecords(1));
                  return {open,next,rows:el('cmpRecordsBody').children.length,total:comparisonRecordsPage().total,
                    spans:comparisonRecordView.day.records[12].length};
                }'''))
                page.wait_for_timeout(350)
            opened = heap()
            page.evaluate("el('cmpRecords').open=false;toggleComparisonRecords()")
            page.wait_for_timeout(100)
            hour_records = {'distribution':'all rows in one local hour, 10ms spacing; core fixture unchanged',
                            'samples':hourly_samples,'opened':opened,'closed':heap()}
            page.evaluate('''()=>{
              for(let i=0;i<20;i++){
                el('cmpRecords').open=true;openComparisonRecords();pageComparisonRecords(1);
                el('cmpRecords').open=false;toggleComparisonRecords();observer.takeRecords();
              }
            }''')
            page.wait_for_timeout(100)
            hour_records['after20OpenClose'] = heap()
            hour_records['closedRows'] = page.locator('#cmpRecordsBody tr').count()
            assert hour_records['closedRows'] == 0 and page.evaluate('comparisonRecordView===null')
        temperature_record = None
        if args.temperature_record:
            page.evaluate("showTab('now');refreshUI();openTemperatureRecord('max')")
            page.wait_for_timeout(100)
            assert page.locator('#tempRecord table').is_visible()
            temperature_samples = []
            for _ in range(5):
                temperature_samples.append(page.evaluate('''()=>({
                  max:measure(()=>openTemperatureRecord('max')),
                  min:measure(()=>openTemperatureRecord('min')),
                  rows:el('tempRecordBody').children.length,count:temperatureRecordData().count
                })'''))
                page.wait_for_timeout(350)
            opened = heap()
            page.evaluate("el('tempRecord').open=false;toggleTemperatureRecord()")
            page.wait_for_timeout(100)
            temperature_record = {'samples':temperature_samples,'opened':opened,'closed':heap()}
            page.evaluate('''()=>{
              for(let i=0;i<20;i++){
                openTemperatureRecord('max');openTemperatureRecord('min');
                el('tempRecord').open=false;toggleTemperatureRecord();observer.takeRecords();
              }
            }''')
            page.wait_for_timeout(100)
            temperature_record['after20OpenClose'] = heap()
            temperature_record['closedRows'] = page.locator('#tempRecordBody tr').count()
            assert temperature_record['closedRows'] == 0 and page.evaluate('temperatureRecordView===null')
        results.append({'rows':count,'empty':empty,'loaded':loaded,'warm':warm,'after30Cycles':repeated,
                        'samples':samples,'records':records,'hourRecords':hour_records,'temperatureRecord':temperature_record,'pageErrors':errors,
                        'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
        print('profiled', count, flush=True)
        page.close()
    version = browser.version
    browser.close()
Path(args.output).write_text(json.dumps({'browser':version,'cpuRate':args.cpu,
    'aggregateScenario':args.aggregates,
    'comparisonScenario':args.comparison,
    'annualScenario':args.annual,
    'analysisScenario':args.analysis,
    'recordsScenario':args.records,
    'hourRecordsScenario':args.hour_records,
    'temperatureRecordScenario':args.temperature_record,
    'network':'blocked; generated in-memory fixture, no raw CSV retained','results':results},indent=2))
if any(r['pageErrors'] or r['overflow'] for r in results):
    raise SystemExit('Browser profile failed; inspect output.')
