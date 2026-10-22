const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { app } = require('./helpers/app');

function install(a, rows, metric='temp_hum', days=['2026-10-21']) {
  a.run(`store.rows=${JSON.stringify(rows)}.map(r=>({...r,ts:new Date(r.ts)})).sort((a,b)=>b.ts-a.ts);
    store.fullLoaded=true;invalidateDerivedData();el('appVersion').textContent='Verze test';
    cmpSelectedDays=${JSON.stringify(days)};el('cmpMetric').value=${JSON.stringify(metric)};buildCompare();`);
}
function open(a, {day='2026-10-21',metric='temp',hour=12}={}) {
  a.run(`el('cmpRecordsDay').value=${JSON.stringify(day)};el('cmpRecordsMetric').value=${JSON.stringify(metric)};
    el('cmpRecordsHour').value=${JSON.stringify(String(hour))};el('cmpRecords').open=true;toggleComparisonRecords();`);
}
const page=(a,n=0)=>JSON.parse(a.run(`JSON.stringify(comparisonRecordsPage(${n}))`));
const rowsForHour=(n=121)=>Array.from({length:n},(_,i)=>({
  ts:+new Date(2026,9,21,12,59,59)-i*1000,
  temp:i%13===12?null:i/7,hum:i%17===16?null:i%101,pressure:1000+i/11
}));

test('hour provenance keeps every original row, exact values, duplicates and independent metric validity',()=>{
  const a=app(),rows=rowsForHour();
  rows[0].temp=0;rows[1].hum=0;rows[2].ts=rows[1].ts;
  rows.push({ts:+new Date(2026,9,21,13),temp:999},
    {ts:+new Date(2026,9,21,11,59,59),temp:888},
    {ts:+new Date(2026,9,20,12),temp:777});
  install(a,rows);open(a);
  const expected=rows.slice().sort((a,b)=>b.ts-a.ts).map((r,i)=>({...r,index:i+1}))
    .filter(r=>new Date(r.ts).getDate()===21 && new Date(r.ts).getHours()===12);
  const actual=[];
  for(let n=0;n<page(a).pages;n++)actual.push(...page(a,n).rows);
  assert.equal(actual.length,121);
  actual.forEach((r,i)=>{
    assert.equal(r.index,expected[i].index);
    assert.equal(r.value,Number.isFinite(expected[i].temp)?String(expected[i].temp):'–');
    assert.equal(r.reason,Number.isFinite(expected[i].temp)?'Použitá hodnota':'Vynecháno: chybí nebo není číselná hodnota');
  });
  assert.equal(actual[0].value,'0');assert.equal(actual[1].time,actual[2].time);
  open(a,{metric:'hum'});
  assert.equal(page(a).rows[1].value,'0');
  assert.equal(page(a).rows[12].reason,'Použitá hodnota');
  assert.equal(page(a).rows[16].reason,'Vynecháno: chybí nebo není číselná hodnota');
  assert.match(a.nodes.get('cmpRecordsFormula').textContent,/Verze test/);
  assert.equal(a.requests.length,0);
});

test('hour pages are complete and bounded, and neither paging nor inspection changes full aggregates',()=>{
  const a=app();install(a,rowsForHour());open(a);
  const before=a.run('JSON.stringify([hourlyDay("2026-10-21").values,chartCompare.data.datasets,store.rows.length])');
  assert.equal(page(a).rows.length,50);assert.equal(page(a).pages,3);
  assert.equal(a.nodes.get('cmpRecordsPrev').disabled,true);
  a.run('pageComparisonRecords(1)');assert.equal(a.run('comparisonRecordView.page'),1);
  assert.equal(page(a,1).first,51);assert.equal(page(a,1).last,100);
  a.run('pageComparisonRecords(1)');assert.equal(a.nodes.get('cmpRecordsNext').disabled,true);
  assert.equal(page(a,2).rows.length,21);
  a.run('pageComparisonRecords(1)');assert.equal(a.run('comparisonRecordView.page'),2);
  assert.equal(page(a,-20).first,1);assert.equal(page(a,1000).last,121);
  assert.equal((a.nodes.get('cmpRecordsBody').innerHTML.match(/<tr>/g)||[]).length,21);
  assert.equal(a.run('JSON.stringify([hourlyDay("2026-10-21").values,chartCompare.data.datasets,store.rows.length])'),before);
});

test('the displayed aggregate preserves stable equal-time sum order and one-decimal chart rounding',()=>{
  const a=app();
  install(a,[1e16,-1e16,1].map(temp=>({ts:+new Date(2026,9,21,12),temp,hum:0})));
  open(a);
  assert.equal(a.run('comparisonRecordView.day.values.temp[12].sum'),1);
  assert.equal(a.run('comparisonRecordView.day.values.temp[12].avg'),.3);
  assert.deepEqual(page(a).rows.map(r=>r.value),['10000000000000000','-10000000000000000','1']);
  assert.match(a.nodes.get('cmpRecordsInfo').textContent,/0[.,]3/);
  assert.equal(a.run('chartCompare.data.datasets[0].data[12]'),.3);
  open(a,{metric:'hum'});assert.equal(a.run('comparisonRecordView.day.values.hum[12].avg'),0);
});

test('empty hours and selected dates expose no invented rows; all-missing hours retain exclusion evidence',()=>{
  const a=app();install(a,[{ts:+new Date(2026,9,21,12),temp:null,hum:null}], 'temp', ['2026-10-21','2026-10-20']);
  open(a,{hour:11});
  assert.deepEqual(page(a),{page:0,pages:0,total:0,first:0,last:0,rows:[]});
  assert.equal(a.nodes.get('cmpRecordsBody').innerHTML,'');
  assert.equal(a.nodes.get('cmpRecordsContent').hidden,false);
  assert.equal(a.nodes.get('cmpRecordsNext').disabled,true);
  open(a,{day:'2026-10-20'});assert.equal(page(a).total,0);
  open(a);
  assert.equal(page(a).total,1);assert.equal(page(a).rows[0].value,'–');
  assert.match(page(a).rows[0].reason,/Vynecháno/);
  assert.equal(a.run('comparisonRecordView.day.values.temp[12].count'),0);
  assert.equal(a.run('comparisonRecordView.day.values.temp[12].avg'),null);
});

test('cached and closed detail does no raw work; a dense 250k hour reads only the requested page',()=>{
  const a=app();
  a.run(`globalThis.reads=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(+new Date(2026,9,21,12,59)-i),temp:i%201-100,hum:i%11===0?null:i%101
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver)}});
    store.fullLoaded=true;el('cmpMetric').value='temp_hum';cmpSelectedDays=['2026-10-21'];buildCompare();globalThis.start=reads;buildCompare();`);
  assert.equal(a.run('reads'),a.run('start'));assert.equal(a.run('comparisonRecordView'),null);
  assert.equal(a.nodes.get('cmpRecordsBody')?.innerHTML||'','');
  open(a);assert.ok(a.run('reads-start')<100);
  assert.equal(page(a).total,250000);assert.equal(page(a).rows.length,50);
  a.run('globalThis.start=reads;pageComparisonRecords(1)');
  assert.equal(a.run('reads-start'),50);
  assert.equal((a.nodes.get('cmpRecordsBody').innerHTML.match(/<tr>/g)||[]).length,50);
  assert.equal(a.run('Object.hasOwn(comparisonRecordView,"rows")'),false);
  assert.equal(a.run('comparisonRecordView.day.records[12].length'),1);
  assert.equal(a.requests.length,0);
});

test('hourly LRU eviction preserves the current detail without retaining a copied history',()=>{
  const a=app();install(a,rowsForHour());open(a);
  const expected=page(a,1);
  a.run('for(let i=1;i<=9;i++)hourlyDay("2026-10-"+_pad2(i))');
  assert.equal(a.run('dataAggregates().hourly.size'),8);
  assert.equal(a.run('dataAggregates().hourly.has("2026-10-21")'),false);
  a.run('pageComparisonRecords(1)');
  assert.deepEqual(page(a,1),expected);
  assert.equal(a.run('comparisonRecordView.snapshot.source===store.rows'),true);
});

test('comparison day or metric changes close stale evidence; pressure uses its own original values',()=>{
  for(const action of ['cmpSelectedDays=["2026-10-20"];buildCompare()', 'el("cmpMetric").value="pressure";buildCompare()']) {
    const a=app();install(a,rowsForHour());open(a);a.run(action);
    assert.equal(a.run('comparisonRecordView'),null);
    assert.equal(a.nodes.get('cmpRecords').open,false);
    assert.equal(a.nodes.get('cmpRecordsBody').innerHTML,'');
  }
  const a=app();install(a,rowsForHour(),'pressure');open(a,{metric:'pressure'});
  assert.equal(page(a).rows[1].value,String(1000+1/11));
  assert.equal(a.run('comparisonRecordView.metric'),'pressure');
});

test('invalid date, metric or hour selection cannot expose a different computation',()=>{
  for(const selection of [{day:'2026-10-20'},{metric:'pressure'},{hour:-1},{hour:24},{hour:1.5}]) {
    const a=app();install(a,rowsForHour());open(a,selection);
    assert.equal(a.run('comparisonRecordView'),null);
    assert.equal(a.nodes.get('cmpRecordsBody').innerHTML,'');
  }
});

test('source replacement, correction, deletion, station switch, local-day invalidation and collapse clear references',()=>{
  for(const action of [
    'store.rows=store.rows.map(r=>({...r,temp:99}));pageComparisonRecords(1)',
    'store.rows[0].temp=99;invalidateDerivedData()',
    'store.rows.pop();invalidateDerivedData()',
    'switchStation(1)',
    'comparisonRecordView.snapshot.dayKey="1900-01-01";pageComparisonRecords(1)',
    'el("cmpRecords").open=false;toggleComparisonRecords()'
  ]) {
    const a=app();install(a,rowsForHour());open(a);a.run(action);
    assert.equal(a.run('comparisonRecordView'),null);
    assert.equal(a.nodes.get('cmpRecordsBody').innerHTML,'');
    assert.equal(a.nodes.get('cmpRecordsInfo').textContent,'');
    assert.equal(a.nodes.get('cmpRecordsContent').hidden,true);
    a.run('pageComparisonRecords(1)');assert.equal(a.run('comparisonRecordView'),null);
  }
});

test('CSV replacement and MQTT updates close an open hourly record detail',async()=>{
  for(const transport of ['csv','mqtt']) {
    const a=app();install(a,rowsForHour());open(a);
    if(transport==='csv') {
      const done=a.run('parseAndStore("Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n20.10.2026,12:00,10,1010,60,0,0,,4")');
      a.tick();await done;
    } else {
      a.run('CFG.source="both";CFG.mqttHost="test.example";connectMQTT()');
      a.clients[0].onMessageArrived({payloadString:'{"temp":30,"hum":0}'});
    }
    assert.equal(a.run('comparisonRecordView'),null);
    assert.equal(a.nodes.get('cmpRecordsBody').innerHTML,'');
    assert.equal(a.nodes.get('cmpRecords').open,false);
  }
});

test('legacy strings in raw records and formatted timestamps cannot create HTML',()=>{
  const a=app(),payload='<img src=x onerror=globalThis.injected=1>';
  install(a,[{ts:+new Date(2026,9,21,12),temp:payload,hum:0}]);
  a.run(`globalThis.intervalTimestamp=()=>${JSON.stringify(payload)};el('appVersion').textContent=${JSON.stringify(payload)}`);
  open(a);
  const markup=a.nodes.get('cmpRecordsBody').innerHTML;
  assert.ok(!markup.includes('<img'));assert.ok(markup.includes('&lt;img'));
  assert.equal(page(a).rows[0].value,'–');assert.match(markup,/Vynecháno/);
  assert.equal(a.run('typeof globalThis.injected'),'undefined');
});

test('clicking a comparison point opens its exact day, metric and hour without changing the chart',()=>{
  const a=app();
  install(a,[
    {ts:+new Date(2026,9,21,13),temp:42,hum:1.23456789},
    {ts:+new Date(2026,9,20,7,40),temp:10,hum:33.333333333},
    {ts:+new Date(2026,9,20,7,20),temp:20,hum:66.666666667},
    {ts:+new Date(2026,9,20,7,10),temp:30,hum:null}
  ],'temp_hum',['2026-10-21','2026-10-20']);
  const chart=a.run('JSON.stringify(chartCompare.data)'),updates=a.run('chartCompare.updates');
  a.run('chartCompare.options.onClick({},[{datasetIndex:3,index:7}])');
  assert.equal(a.nodes.get('cmpEvidence').open,true);
  assert.equal(a.nodes.get('cmpRecords').open,true);
  assert.equal(a.nodes.get('cmpRecordsDay').value,'2026-10-20');
  assert.equal(a.nodes.get('cmpRecordsMetric').value,'hum');
  assert.equal(a.nodes.get('cmpRecordsHour').value,'7');
  assert.deepEqual(page(a).rows.map(r=>r.value),['33.333333333','66.666666667','–']);
  assert.equal(a.run('comparisonRecordView.day.values.hum[7].count'),2);
  assert.equal(a.run('comparisonRecordView.day.values.hum[7].avg'),50);
  a.run('openComparisonPoint([{datasetIndex:0,index:13}])');
  assert.equal(a.run('comparisonRecordView.key'),'2026-10-21');
  assert.equal(a.run('comparisonRecordView.metric'),'temp');
  assert.equal(a.run('comparisonRecordView.hour'),13);
  assert.equal(page(a).rows[0].value,'42');
  for(const elements of ['null','undefined','[]','[null]',
    '[{datasetIndex:99,index:7}]','[{datasetIndex:0,index:-1}]',
    '[{datasetIndex:0,index:24}]','[{datasetIndex:0,index:1.5}]',
    '[{datasetIndex:0,index:11}]']) {
    a.run('el("cmpRecords").open=false;toggleComparisonRecords();el("cmpEvidence").open=false;'+
      'chartCompare.options.onClick({},'+elements+')');
    assert.equal(a.run('comparisonRecordView'),null);
    assert.equal(a.nodes.get('cmpRecords').open,false);
    assert.equal(a.nodes.get('cmpEvidence').open,false);
  }
  assert.equal(a.run('JSON.stringify(chartCompare.data)'),chart);
  assert.equal(a.run('chartCompare.updates'),updates);
  assert.equal(a.requests.length,0);
});

for(const [zone,cases] of [
  ['Europe/Prague',[
    ['2026-10-25',2,['2026-10-25T02:30:00+01:00','2026-10-25T02:30:00+02:00'],['UTC+01:00','UTC+02:00']],
    ['2026-03-29',2,[],[]]
  ]],
  ['Australia/Lord_Howe',[
    ['2026-04-05',1,['2026-04-05T01:45:00+10:30','2026-04-05T01:45:00+11:00'],['UTC+10:30','UTC+11:00']],
    ['2026-10-04',2,['2026-10-04T02:45:00+11:00'],['UTC+11:00']]
  ]],
  ['Antarctica/Troll',[
    // A two-hour rollback interleaves civil hours 01 and 02. The other hour
    // separates two numeric source spans belonging to the selected hour.
    ['2026-10-25',1,['2026-10-25T01:30:00+00:00','2026-10-25T01:30:00+02:00'],
      ['UTC+00:00','UTC+02:00'],['2026-10-25T02:30:00+02:00']]
  ]]
]) {
  test(`hour provenance uses original civil-hour groups through DST: ${zone}`,()=>{
    execFileSync(process.execPath,['-e',`
      const assert=require('node:assert/strict'),{app}=require('./tests/helpers/app');
      for(const [key,hour,stamps,offsets,intervening=[]] of ${JSON.stringify(cases)}) {
        const a=app();
        a.run('store.rows='+JSON.stringify(stamps)+'.map((ts,i)=>({ts:new Date(ts),temp:i*10,hum:null}));'+
          'store.rows.push(...'+JSON.stringify(intervening)+'.map(ts=>({ts:new Date(ts),temp:888})));'+
          'store.rows.push({ts:new Date('+JSON.stringify(key+'T12:00:00')+'),temp:999});'+
          'store.rows.sort((a,b)=>b.ts-a.ts);cmpSelectedDays=['+JSON.stringify(key)+'];el("cmpMetric").value="temp";buildCompare();'+
          'el("cmpRecordsDay").value='+JSON.stringify(key)+';el("cmpRecordsMetric").value="temp";el("cmpRecordsHour").value='+JSON.stringify(String(hour))+';'+
          'el("cmpRecords").open=true;toggleComparisonRecords()');
        const rows=JSON.parse(a.run('JSON.stringify(comparisonRecordsPage().rows)'));
        assert.equal(rows.length,stamps.length);
        rows.forEach((row,i)=>assert.ok(row.time.includes(offsets[i])));
        assert.equal(a.run('comparisonRecordView.day.values.temp['+hour+'].count'),stamps.length);
        assert.equal(a.run('comparisonRecordView.day.values.temp['+hour+'].avg'),stamps.length?(stamps.length-1)*5:null);
        if(intervening.length) {
          assert.equal(a.run('comparisonRecordView.day.records['+hour+'].length'),2);
          assert.deepEqual(rows.map(r=>r.value),['0','10']);
          assert.equal(rows[1].index-rows[0].index,2);
        }
      }
    `],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:zone},stdio:'pipe'});
  });
}
