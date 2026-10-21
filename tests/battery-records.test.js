const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const dayKey = value => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const fixture = (perDay=121) => Array.from({length:4*perDay},(_,i)=>{
  const day=Math.floor(i/perDay), n=i%perDay;
  return {ts:+new Date(2026,9,21-day,12,0,perDay-n),
    temp:n%13===12?null:day===0?70+n/100:12+Math.sin(n/11)*8,
    voltage:n%17===16?null:day===0?6+n/1000:4+.03*Math.sin(n/9)};
});
function install(a,rows,range='all') {
  a.run(`store.rows=${JSON.stringify(rows)}.map(r=>({...r,ts:new Date(r.ts)})).sort((a,b)=>b.ts-a.ts);
    store.fullLoaded=true;invalidateDerivedData();el('appVersion').textContent='Verze 0.7.0';
    el('batteryRange').value=${JSON.stringify(range)};buildBatteryAnalysis();`);
}
function open(a,kind='byR') {
  a.run(`el('batteryRecordsKind').value=${JSON.stringify(kind)};el('batteryRecords').open=true;toggleBatteryRecords();`);
}
const page = (a,n=0) => JSON.parse(a.run(`JSON.stringify(batteryRecordsPage(${n}))`));

test('opening a day shows every original record including excluded rows, zeros and timestamp duplicates',()=>{
  const a=app(),rows=fixture();
  rows[0].temp=0;rows[1].voltage=0;rows[2].ts=rows[1].ts;
  install(a,rows);open(a);
  const selected=a.run('batteryRecordView.day.day');
  const expected=rows.filter(r=>dayKey(r.ts)===selected).sort((a,b)=>b.ts-a.ts);
  const collected=[];
  for(let n=0;n<page(a).pages;n++) collected.push(...page(a,n).rows);
  assert.equal(collected.length,expected.length);
  collected.forEach((row,i)=>{
    assert.equal(row.index,i+1);
    assert.equal(row.temp,Number.isFinite(expected[i].temp)?String(expected[i].temp):'–');
    assert.equal(row.voltage,Number.isFinite(expected[i].voltage)?String(expected[i].voltage):'–');
    assert.equal(row.reason.startsWith('Použitý pár'),Number.isFinite(expected[i].temp)&&Number.isFinite(expected[i].voltage));
  });
  assert.equal(collected[1].time,collected[2].time);
  assert.equal(collected[0].temp,'0');assert.equal(collected[1].voltage,'0');
  assert.match(a.nodes.get('batteryRecordsInfo').textContent,/použitých párů.*vynechaných řádků/);
  assert.match(a.nodes.get('batteryRecordsFormula').textContent,/Verze 0.7.0.*Pearson r = C/);
  assert.match(a.nodes.get('batteryRecordsFormula').textContent,/nikoli pouze tuto stránku/);
  assert.equal(a.requests.length,0);
});

test('page boundaries are complete, bounded and clamped; rendering does not change source statistics',()=>{
  const a=app();install(a,fixture());open(a);
  const before=a.run('JSON.stringify([batteryAnalysis("all").r,batteryAnalysis("all").slope,store.rows.length])');
  assert.equal(page(a).rows.length,50);
  assert.equal(a.nodes.get('batteryRecordsPrev').disabled,true);
  a.run('pageBatteryRecords(1)');assert.equal(a.run('batteryRecordView.page'),1);
  assert.equal(a.nodes.get('batteryRecordsPrev').disabled,false);
  assert.equal(page(a,1).first,51);assert.equal(page(a,1).last,100);
  a.run('pageBatteryRecords(1)');assert.equal(a.nodes.get('batteryRecordsNext').disabled,true);
  assert.equal(page(a,2).rows.length,21);
  a.run('pageBatteryRecords(1)');assert.equal(a.run('batteryRecordView.page'),2);
  assert.equal(page(a,-10).first,1);assert.equal(page(a,1000).last,121);
  assert.equal((a.nodes.get('batteryRecordsBody').innerHTML.match(/<tr>/g)||[]).length,21);
  assert.equal(a.run('JSON.stringify([batteryAnalysis("all").r,batteryAnalysis("all").slope,store.rows.length])'),before);
});

test('raw records are clipped to the inclusive seven-day analytical window, not the whole boundary day',()=>{
  const a=app(),latest=+new Date(2026,9,21,12),cut=latest-7*86400000;
  const rows=Array.from({length:100},(_,i)=>({ts:latest-i*60000,temp:10+Math.sin(i),voltage:4+Math.cos(i)/100}));
  rows.push(...Array.from({length:60},(_,i)=>({ts:latest-86400000-i*60000,temp:10+Math.sin(i),voltage:4+Math.cos(i)/100})));
  rows.push(...Array.from({length:40},(_,i)=>({ts:cut+i*60000,temp:70+i/100,voltage:6+i/1000})));
  rows.push({ts:cut,temp:null,voltage:null},{ts:cut-1,temp:9999,voltage:9999});
  install(a,rows,'7');open(a);
  assert.equal(a.run('batteryRecordView.day.day'),dayKey(cut));
  const p=page(a);
  assert.equal(p.total,41);assert.equal(p.rows.length,41);
  assert.equal(p.rows.at(-1).reason,'Vynecháno: chybí nebo není číselná T a V');
  assert.ok(p.rows.every(r=>r.temp!=='9999'));
  assert.match(a.nodes.get('batteryRecordsInfo').textContent,/41 původních záznamů.*40 použitých párů.*1 vynechaných/);
});

test('closed records are not scanned or rendered; even a 250k history reads only bounds plus one page',()=>{
  const a=app();
  a.run(`globalThis.visits=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(+new Date(2026,9,21,12)-i*1000),temp:i===17?85:Math.sin(i/33),voltage:4+Math.cos(i/77)/100
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))visits++;return Reflect.get(target,key,receiver)}});
  store.fullLoaded=true;el('batteryRange').value='all';buildBatteryAnalysis();globalThis.start=visits;buildBatteryAnalysis();`);
  assert.equal(a.run('visits'),a.run('start'));
  assert.equal(a.run('batteryRecordView'),null);
  assert.equal(a.nodes.get('batteryRecordsBody')?.innerHTML||'','');
  open(a);
  assert.ok(a.run('visits-start')<100);
  assert.equal(page(a).rows.length,50);
  assert.ok(page(a).pages>1);
  assert.ok(page(a).total>1000);
  a.run('globalThis.start=visits;pageBatteryRecords(1)');
  assert.equal(a.run('visits-start'),50);
  assert.equal((a.nodes.get('batteryRecordsBody').innerHTML.match(/<tr>/g)||[]).length,50);
  assert.equal(a.run('Object.hasOwn(batteryRecordView,"rows")'),false);
  assert.equal(a.requests.length,0);
});

test('changing range closes the old record reference and reopening uses the current analysis',()=>{
  const a=app();install(a,fixture());open(a);
  a.run('globalThis.old=batteryRecordView;el("batteryRange").value="7";buildBatteryAnalysis()');
  assert.equal(a.run('batteryRecordView'),null);assert.equal(a.nodes.get('batteryRecords').open,false);
  assert.equal(a.nodes.get('batteryRecordsBody').innerHTML,'');
  open(a);assert.equal(a.run('batteryRecordView===old'),false);
  assert.equal(a.run('batteryRecordView.range'),'7');
});

test('a same-length source replacement cannot paginate an old snapshot even without explicit invalidation',()=>{
  const a=app();install(a,fixture());open(a);
  a.run('store.rows=store.rows.map(r=>({...r,temp:25}));pageBatteryRecords(1)');
  assert.equal(a.run('batteryRecordView'),null);assert.equal(a.nodes.get('batteryRecords').open,false);
  assert.equal(a.nodes.get('batteryRecordsBody').innerHTML,'');
});

test('correcting in place, deleting, changing station and normal collapse clear prior references',()=>{
  for(const action of ['store.rows[0].temp=1;invalidateDerivedData()', 'store.rows.pop();invalidateDerivedData()',
    'switchStation(1)', 'el("batteryRecords").open=false;toggleBatteryRecords()']) {
    const a=app();install(a,fixture());open(a);a.run(action);
    assert.equal(a.run('batteryRecordView'),null);
    assert.equal(a.nodes.get('batteryRecordsBody').innerHTML,'');
    assert.equal(a.nodes.get('batteryRecordsInfo').textContent,'');
    assert.equal(a.nodes.get('batteryRecordsContent').hidden,true);
    a.run('pageBatteryRecords(1)');assert.equal(a.run('batteryRecordView'),null);
  }
});

test('CSV replacement and MQTT updates invalidate an open record view',async()=>{
  for(const transport of ['csv','mqtt']) {
    const a=app();install(a,fixture());open(a);
    if(transport==='csv') {
      const done=a.run('parseAndStore("Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n20.10.2026,12:00,10,1010,60,0,0,,4")');
      a.tick();await done;
    } else {
      a.run('CFG.source="both";CFG.mqttHost="test.example";connectMQTT()');
      a.clients[0].onMessageArrived({payloadString:'{"temp":30,"voltage":0}'});
    }
    assert.equal(a.run('batteryRecordView'),null);
    assert.equal(a.nodes.get('batteryRecordsBody').innerHTML,'');
    assert.equal(a.nodes.get('batteryRecords').open,false);
  }
});

test('an undefined remainder still has original day records and unavailable r/slope',()=>{
  const a=app(),rows=fixture(20).map((r,i)=>({...r,temp:i<20?20+i:20,voltage:i<20?4+i/100:4}));
  install(a,rows);open(a,'undefinedDay');
  assert.equal(page(a).total,20);
  assert.match(a.nodes.get('batteryRecordsInfo').textContent,/Bez tohoto dne: 60 párů, r = –, sklon = –/);
  assert.ok(page(a).rows.every(row=>row.reason==='Použitý pár T/V'));
});

test('missing voltage and constant voltage do not leave available or stale record actions',()=>{
  const a=app();install(a,fixture());open(a);
  for(const voltage of [null,0]) {
    install(a,fixture().map(r=>({...r,voltage})));
    assert.equal(a.nodes.get('batteryRecords').hidden,true);
    assert.equal(a.run('batteryRecordView'),null);
    assert.equal(a.nodes.get('batteryRecordsKind').innerHTML,'');
    open(a);assert.equal(a.run('batteryRecordView'),null);
  }
});

test('untrusted legacy strings cannot introduce HTML through record values, timestamps or context',()=>{
  const a=app();install(a,fixture());open(a);
  const payload='<img src=x onerror=globalThis.injected=1>';
  a.run(`store.rows[0].temp=${JSON.stringify(payload)};store.rows[0].date=${JSON.stringify(payload)};store.rows[0].note=${JSON.stringify(payload)};
    globalThis.intervalTimestamp=()=>${JSON.stringify(payload)};el('appVersion').textContent=${JSON.stringify(payload)};
    invalidateDerivedData();buildBatteryAnalysis();`);
  open(a);
  const markup=a.nodes.get('batteryRecordsBody').innerHTML;
  assert.ok(!markup.includes('<img'));assert.ok(markup.includes('&lt;img'));
  assert.match(markup,/Vynecháno/);
  assert.equal(a.run('typeof globalThis.injected'),'undefined');
});

test('a 25-hour day keeps both repeated local times with their original UTC offsets',()=>{
  const {execFileSync}=require('node:child_process');
  execFileSync(process.execPath,['-e',`
    const assert=require('node:assert/strict'),{app}=require('./tests/helpers/app');
    const a=app();
    a.run(\`store.rows=[23,24,26].flatMap(day=>Array.from({length:20},(_,i)=>({
      ts:new Date(2026,9,day,12,i),temp:10+Math.sin(i/2),voltage:4+Math.cos(i/3)/100
    }))).concat([
      {ts:new Date('2026-10-25T02:30:00+02:00'),temp:70,voltage:6},
      {ts:new Date('2026-10-25T02:30:00+01:00'),temp:71,voltage:6.1},
      {ts:new Date('2026-10-25T23:59:59+01:00'),temp:70.5,voltage:6.05},
      {ts:new Date('2026-10-25T01:00:00+02:00'),temp:null,voltage:4}
    ]).sort((a,b)=>b.ts-a.ts);
    el('batteryRange').value='all';buildBatteryAnalysis();
    el('batteryRecordsKind').value='byR';el('batteryRecords').open=true;toggleBatteryRecords();\`);
    assert.equal(a.run('batteryRecordView.day.day'),'2026-10-25');
    assert.equal(a.run('batteryRecordsPage().total'),4);
    assert.equal(a.run('batteryRecordView.day.omittedCount'),3);
    assert.equal(a.run('batteryRecordsPage().rows.some(r=>r.time.includes("02:30:00 UTC+02:00"))'),true);
    assert.equal(a.run('batteryRecordsPage().rows.some(r=>r.time.includes("02:30:00 UTC+01:00"))'),true);
  `],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:'Europe/Prague'}});
});
