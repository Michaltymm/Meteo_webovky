"""Offline profile of actual Sheets commit, aggregates, DOM and Chart.js.

Real CSV fetch/parser/commit and original station configuration; no startup polling.
Function times overlap (e.g. buildCharts includes Chart.update). Not Web Vitals,
network performance, physical mobile measurements or a memory/long-task profile.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--html', default='index.html')
parser.add_argument('--chartjs', required=True)
parser.add_argument('--paho', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--counts', default='1000,10000,100000,250000')
parser.add_argument('--fixtures', default='regular,dense')
parser.add_argument('--repeats', type=int, default=5)
parser.add_argument('--cpu', type=int, default=1)
args = parser.parse_args()
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
html = Path(args.html).read_text().split('// Init: téma, stanice, config')[0] + '</script></body></html>'
chart = Path(args.chartjs).read_bytes()
paho = Path(args.paho).read_bytes()
config = json.loads(Path('config_praha_baterie.json').read_text(encoding='utf-8-sig'))
now = datetime.fromisoformat('2026-10-28T12:00:00+01:00')
results = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for fixture in args.fixtures.split(','):
        assert fixture in ['regular', 'dense']
        for count in map(int, args.counts.split(',')):
            lines = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka']
            for i in range(count):
                ts = (now.astimezone(timezone.utc) - timedelta(seconds=i * 300 if fixture == 'regular' else i)).astimezone(ZoneInfo('Europe/Prague'))
                temp = '' if i % 101 == 0 else '0' if i % 13 == 0 else str((i % 397 - 90) / 10)
                hum = '' if i % 89 == 0 else str(i % 101)
                lines.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{temp},1010,{hum},0,{i%23/10},,4.1,id{i}')
            body = '\n'.join(lines)
            quick = '\n'.join(lines[:401])
            page = browser.new_page(viewport={'width': 1280, 'height': 1000}, timezone_id='Europe/Prague', reduced_motion='reduce')
            # Freeze civil "today" only; leave performance.now/timers native.
            page.add_init_script('''{
              const NativeDate=Date, epoch='''+str(int(now.timestamp()*1000))+''';
              globalThis.Date=class extends NativeDate{
                constructor(...args){super(...(args.length?args:[epoch]))}
                static now(){return epoch}
              };
            }''')
            errors, requests, sockets = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('websocket', lambda socket: sockets.append(socket.url))

            def route(r):
                url = r.request.url
                if url == 'http://meteo.test/dev/':
                    r.fulfill(body=html, content_type='text/html')
                elif 'chart.js' in url:
                    r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
                elif 'paho-mqtt' in url:
                    r.fulfill(body=paho, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
                elif 'docs.google.com' in url:
                    requests.append('controlled CSV')
                    r.fulfill(body=body, content_type='text/csv')
                else:
                    raise AssertionError('Unexpected request: ' + url)

            page.route('**/*', route)
            page.goto('http://meteo.test/dev/')
            client = page.context.new_cdp_session(page)
            client.send('Emulation.setCPUThrottlingRate', {'rate': args.cpu})
            page.evaluate('''({config,quick})=>{
              CFG={...CFG,...config,source:'sheets'};
              globalThis.seed=parseHistoryCSV(quick);
              showAppPage('main',{scroll:false});
              globalThis.profile=null;
              for(const name of ['invalidateDerivedData','refreshUI','dataAggregates','buildCharts','renderDataStatus',
                                  'syncModernStation','updateOvBar','buildHistoryRows','syncTemperatureRecord']){
                const original=window[name];
                window[name]=function(...args){
                  if(!profile?.active)return original.apply(this,args);
                  const start=performance.now();try{return original.apply(this,args)}finally{
                    const entry=profile.functions[name]??={ms:0,calls:0};entry.ms+=performance.now()-start;entry.calls++;
                  }
                };
              }
              const update=Chart.prototype.update;
              Chart.prototype.update=function(...args){
                if(!profile?.active)return update.apply(this,args);
                const start=performance.now();try{return update.apply(this,args)}finally{
                  profile.chartUpdates++;profile.chartMs+=performance.now()-start;
                }
              };
              const work=measureSheetsWork;
              measureSheetsWork=function(timing,phase,action){
                if(phase!=='ui')return work(timing,phase,action);
                const observer=new MutationObserver(()=>{});
                observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
                profile.active=true;
                try{return work(timing,phase,action)}finally{
                  profile.active=false;
                  for(const record of observer.takeRecords())profile.mutations[record.type]++;
                  observer.disconnect();
                }
              };
            }''', {'config': config, 'quick': quick})
            samples = []
            for repeat in range(args.repeats + 1):
                page.evaluate('''()=>{
                  resetStationStore();store.rows=seed;store.fullLoaded=false;invalidateDerivedData();refreshUI();
                  globalThis.seedCharts=Object.keys(Chart.instances).length;
                  profile={active:false,functions:{},chartMs:0,chartUpdates:0,
                    mutations:{childList:0,characterData:0,attributes:0}};
                }''')
                page.wait_for_timeout(350)  # Chart.js responsive resizing is asynchronous.
                client.send('HeapProfiler.collectGarbage')
                sample = page.evaluate('''async()=>{
                  await fetchSheets(true);
                  const timing=dataStatus.sheets.timing;
                  return {...profile,ui:timing.ui,parse:timing.parse,totalMs:timing.totalMs,
                    outcome:timing.outcome,rows:store.rows.length,chartPoints:chart24.data.labels.length,
                    chartsBefore:seedCharts,chartsAfter:Object.keys(Chart.instances).length};
                }''')
                assert sample['rows'] == count and sample['outcome'] == 'ok', sample
                assert sample['chartsBefore'] == sample['chartsAfter'], sample
                assert sample['ui']['runs'] == 1, sample
                if repeat:
                    samples.append(sample)
            # Signatures are computed after all timed work, never from sampled stats.
            signature = page.evaluate('''()=>{
              const a=dataAggregates();
              const validation={...dataStatus.sheets.validation,checkedAt:0};
              const summary={days:[...a.days],months:[...a.months],years:[...a.years],
                today:a.today,temperature:a.temperature,rainMax:a.rainMax};
              const dom=Object.fromEntries(['curTemp','curHum','curDew','statTempMin','statTempMax','statRainMax',
                'dayTempMin','dayTempMax','dayTempAvg','dayHumMin','dayHumMax','dayHumAvg','dayRain','historyRows']
                .map(id=>[id,el(id).textContent]));
              return {rows:JSON.stringify(store.rows),
                stats:JSON.stringify({summary,validation,dom}),chart:JSON.stringify(chart24.data)};
            }''')
            hashes = {key: hashlib.sha256(value.encode()).hexdigest() for key, value in signature.items()}
            assert not errors and not sockets, (errors, sockets)
            assert len(requests) == args.repeats + 1, requests
            results.append({'rows': count, 'fixture': fixture, 'samples': samples, 'sha256': hashes,
                            'pageErrors': errors, 'webSockets': len(sockets), 'requests': len(requests)})
            output.write_text(json.dumps({'browser': browser.version, 'source': args.html, 'cpu': args.cpu,
                'scope': __doc__, 'results': results}, indent=2)+'\n')
            print(f'{fixture}/{count}: '+json.dumps({'uiMs': [s['ui']['ms'] for s in samples],
                'aggregatesMs': [s['functions']['dataAggregates']['ms'] for s in samples],
                'buildChartsMs': [s['functions']['buildCharts']['ms'] for s in samples],
                'chartMs': [s['chartMs'] for s in samples]}), flush=True)
            page.close()
    browser.close()
print(output)
