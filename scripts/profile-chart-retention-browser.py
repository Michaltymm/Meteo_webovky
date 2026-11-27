"""Pilot: retained dashboard charts versus explicitly dropping their instances."""
import argparse
import json
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--chartjs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
source = Path('index.html').read_text()
# Use the real renderers and navigation, without startup I/O or the refresh timer.
html = source.split('// Init: téma, stanice, config')[0] + '</script></body></html>'
chartjs = Path(args.chartjs).read_bytes()
tabs = ['now', 'rain', 'monthly', 'yearly', 'explorer', 'compare', 'overview', 'battery']
seed = '''n=>{
  const end=Date.now();
  store.rows=Array.from({length:n},(_,i)=>({
    ts:new Date(end-i*300000),temp:i%101?14+Math.sin(i/100)*8:null,
    hum:58+Math.cos(i/83)*21,pressure:1010,voltage:4+Math.cos(i/241)*.2,
    rain:i%144/10,rainInc:0.1,tank:null
  }));
  globalThis.originalRows=store.rows;
  store.fullLoaded=true;
  el("stationData").hidden=false;
  ovDays=0;expRange="all";el("expMetric").value="temp_hum";el("cmpMetric").value="temp_hum";
  dataAggregates();markAllTabsDirty();
  showAppPage("modern2");
}'''
open_tab = '''tab=>{
  const start=performance.now();
  document.querySelector('.tab-btn[data-tab="'+tab+'"]').click();
  return performance.now()-start;
}'''
destroy = '''()=>{
  for (const chart of [chart24,chartRain,chartVoltage,chartMonthly,chartYearly,
      chartExplorer,chartCompare,chartOverview,chartBatteryTime,chartBatteryXY]) chart?.destroy();
  chart24=chartRain=chartVoltage=chartMonthly=chartYearly=chartExplorer=chartCompare=
    chartOverview=chartBatteryTime=chartBatteryXY=null;
  renderedOverviewUnit=null;explorerRainRendered=false;
  markAllTabsDirty();
}'''
fingerprint = '''()=>{
  const payload=Object.values(Chart.instances).map(c=>[c.canvas.id,c.data]).sort();
  return JSON.stringify([payload,el("expStats").innerHTML,el("cmpInfo").textContent,
    el("ovTableBody").innerHTML,el("batterySummary").textContent]);
}'''

def profile(browser, n, width, rate):
    page = browser.new_page(viewport={'width': width, 'height': 844},
                            timezone_id='Europe/Prague', reduced_motion='reduce')
    cdp = page.context.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def serve(route):
        url = route.request.url
        if url == 'http://meteo.test/dev/':
            route.fulfill(body=html, content_type='text/html')
        elif 'chart.js' in url:
            route.fulfill(body=chartjs, content_type='application/javascript',
                          headers={'Access-Control-Allow-Origin': '*'})
        else:
            route.abort()
    page.route('**/*', serve)
    page.clock.set_fixed_time('2026-11-27T11:00:00Z')

    def heap():
        page.wait_for_timeout(70)  # Let tab resize timers and observers settle.
        cdp.send('HeapProfiler.collectGarbage')
        return cdp.send('Runtime.getHeapUsage')['usedSize']

    def visit_all():
        costs = {'pageReturn': page.evaluate("""()=>{
            const start=performance.now();
            showAppPage("main");
            return performance.now()-start;
        }""")}
        costs.update({tab: page.evaluate(open_tab, tab) for tab in tabs})
        assert page.evaluate('Object.keys(Chart.instances).length') == 10
        return costs, page.evaluate(fingerprint)

    runs = []
    for i in range(5):
        page.goto('http://meteo.test/dev/', wait_until='domcontentloaded')
        page.evaluate(seed, n)
        cold = heap()
        costs, original = visit_all()
        page.evaluate('showAppPage("modern2")')
        retained = heap()
        warm, same = visit_all()
        assert original == same
        page.evaluate('showAppPage("modern2")')
        before_drop = heap()
        page.evaluate(destroy)
        assert page.evaluate('Object.keys(Chart.instances).length') == 0
        recycled = heap()
        recreate, same = visit_all()
        assert original == same, 'Recreating the charts changed visible data or statistics'
        assert page.evaluate('store.rows === originalRows')
        assert page.evaluate('store.rows.length') == n
        assert not errors, errors
        if i:
            runs.append({'cold': cold, 'retained': retained, 'beforeDrop': before_drop,
                         'afterDrop': recycled, 'first': costs, 'warm': warm,
                         'recreate': recreate})
    page.close()
    values = {'width': width, 'cpuRate': rate, 'rows': n, 'runs': runs,
              'chartDropMiB': median((x['beforeDrop']-x['afterDrop'])/1048576 for x in runs),
              'retainedExtraMiB': median((x['retained']-x['cold'])/1048576 for x in runs),
              'recreateMs': {tab: median(x['recreate'][tab] for x in runs) for tab in ['pageReturn', *tabs]},
              'warmMs': {tab: median(x['warm'][tab] for x in runs) for tab in ['pageReturn', *tabs]}}
    print(n, round(values['chartDropMiB'], 2), values['warmMs'], values['recreateMs'], flush=True)
    return values

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    data = [profile(browser, n, w, r) for n,w,r in [(1000,1440,1),(10000,390,4),
                                                    (100000,390,4),(250000,390,4)]]
    output.write_text(json.dumps({'browser': browser.version, 'results': data}, indent=2))
