"""Actual visible overview: CPU summaries, locale formatting, HTML insertion, Chart.update."""
import argparse,json,statistics,hashlib
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--mode',choices=['repeat','change'],default='repeat');p.add_argument('--html',default='index.html');p.add_argument('--assets',required=True);p.add_argument('--output',required=True);a=p.parse_args()
results=[]
pagination_checks=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for n in [1000,10000,100000,250000]:
  page=b.new_page(viewport={'width':390,'height':844},timezone_id='Europe/Prague',reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  # Keep the 30-day cutoff and today's row identical across separate runs.
  page.add_init_script('''{
   const NativeDate=Date,epoch=Date.parse('2026-11-17T11:00:00Z');
   globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};
  }''')
  html=Path(a.html).read_text().split('// Init: téma, stanice, config')[0]+'</script></body></html>'
  def route(r):
   if r.request.url=='http://meteo.test/':r.fulfill(body=html,content_type='text/html')
   elif 'chart.js' in r.request.url:r.fulfill(body=(Path(a.assets)/'chart.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   elif 'paho-mqtt' in r.request.url:r.fulfill(body=(Path(a.assets)/'paho.js').read_bytes(),content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
   else:raise AssertionError(r.request.url)
  page.route('**/*',route);page.goto('http://meteo.test/')
  page.evaluate('''n=>{
   const base=new Date(2026,10,17,12).getTime();
   store.rows=Array.from({length:n},(_,i)=>({ts:new Date(base-i*300000),temp:i%101?i%67/3:null,hum:i%101,pressure:1010}));store.fullLoaded=true;
   el('stationData').hidden=false;el('stationDataEmpty').hidden=true;ovDays=0;el('ovMetric').value='temp';tabDirtyState.overview=false;
  }''',n)
  page.locator('.tab-btn[data-tab="overview"]').click();page.wait_for_timeout(350)
  page.evaluate('''()=>{
   globalThis.measurement=null;
   const summary=overviewDaySummaries;overviewDaySummaries=(...args)=>{const t=performance.now();try{return summary(...args)}finally{if(measurement)measurement.summaries+=performance.now()-t;}};
   const update=chartOverview.update;chartOverview.update=function(...args){const t=performance.now();try{return update.apply(this,args)}finally{if(measurement){measurement.chart+=performance.now()-t;measurement.chartCalls++;}}};
   const number=Number.prototype.toLocaleString;Number.prototype.toLocaleString=function(...args){const t=performance.now();try{return number.apply(this,args)}finally{if(measurement){measurement.locale+=performance.now()-t;measurement.localeCalls++;}}};
   if(typeof overviewCountFormatter!=='undefined'){
    const formatter=new Intl.NumberFormat('cs-CZ');
    overviewCountFormatter={format(value){const t=performance.now();try{return formatter.format(value)}finally{if(measurement){measurement.locale+=performance.now()-t;measurement.localeCalls++;}}}};
   }
   const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
   Object.defineProperty(Element.prototype,'innerHTML',{...descriptor,set(value){const t=performance.now();try{return descriptor.set.call(this,value)}finally{if(measurement&&this.id==='ovTableBody'){measurement.html+=performance.now()-t;measurement.htmlSets++;}}}});
  }''')
  for days in [30,0]:
   data=page.evaluate('''({days,changing})=>{
    ovDays=days;const samples=[];
    for(let k=0;k<4;k++){
     if(changing)el('ovMetric').value=k%2?'hum':'temp';
     measurement={summaries:0,chart:0,chartCalls:0,locale:0,localeCalls:0,html:0,htmlSets:0};
     const t=performance.now();buildTempOverview();measurement.total=performance.now()-t;
     if(k)samples.push(measurement);measurement=null;
    }
    const body=el('ovTableBody'), visibleRows=body.rows.length;
    let table=body.innerHTML;
    // Recover the full output outside the measured work to compare every day.
    if(typeof pageOverviewTable==='function'&&!el('ovPagination').hidden){
     const count=chartOverview.data.labels.length;
     for(let i=visibleRows;i<count;i+=visibleRows){pageOverviewTable(1);table+=body.innerHTML;}
     for(let i=visibleRows;i<count;i+=visibleRows)pageOverviewTable(-1);
    }
    return {samples,chart:JSON.stringify(chartOverview.data),table,visibleRows,days:chartOverview.data.labels.length};
   }''',{'days':days,'changing':a.mode=='change'})
   data.update(n=n,range=days,sha256={key:hashlib.sha256(data.pop(key).encode()).hexdigest() for key in ['chart','table']});results.append(data)
   print(n,days,{key:round(statistics.median(s[key] for s in data['samples']),2) for key in ['total','summaries','chart','locale','html']},flush=True)
  if n==250000 and a.mode=='change' and page.locator('#ovPagination').count():
   for width in [320,390,1440]:
    page.set_viewport_size({'width':width,'height':844})
    page.locator('#ovTableNext').press('Enter')
    expect(page.locator('#ovTableRange')).to_have_text('51–100 z 869 dní')
    expect(page.locator('#ovTableBody tr')).to_have_count(50)
    expect(page.locator('#ovTablePrev')).to_be_enabled()
    assert page.evaluate('chartOverview.data.labels.length===869 && document.documentElement.scrollWidth<=innerWidth+1')
    assert page.locator('#ovTableNext').bounding_box()['height']>=44
    page.locator('#ovTablePrev').click()
    expect(page.locator('#ovTableRange')).to_have_text('1–50 z 869 dní')
    expect(page.locator('#ovTablePrev')).to_be_disabled()
    pagination_checks.append(width)
   page.locator('#ovTableNext').click()
   page.select_option('#ovMetric','pressure')
   expect(page.locator('#ovTableRange')).to_have_text('1–50 z 869 dní')
   page.locator('[data-ovdays="30"]').click()
   expect(page.locator('#ovPagination')).to_be_hidden()
   expect(page.locator('#ovTableBody tr')).to_have_count(31)
  assert not errors,errors;page.close()
 b.close()
Path(a.output).write_text(json.dumps({'source':a.html,'mode':a.mode,'scope':__doc__,'results':results,'paginationWidths':pagination_checks},indent=2))
