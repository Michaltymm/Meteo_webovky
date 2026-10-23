const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');
const settle = () => new Promise(setImmediate);
const csv = 'Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n23.10.2026,12:00,0,1010,50,0,0,,4.2';
function fixture() {
  const a = app();
  a.run(`globalThis.mono=0;globalThis.wall=Date.now();Date.now=()=>wall;
    globalThis.performance={now:()=>mono};
    globalThis.rawParser=parseHistoryCSV;parseHistoryCSV=(...args)=>{try{return rawParser(...args)}finally{mono+=5}};
    globalThis.rawRefresh=refreshUI;refreshUI=()=>{mono+=11;return rawRefresh()};`);
  return a;
}
async function respond(a, body=csv, ms=20, status=200) {
  a.run(`mono+=${ms}`);a.respond(a.requests.length-1,body,status);await settle();
  if ([...a.timers.values()].some(t=>t.delay===10)) { a.run('mono+=10');a.tick(); }
  await settle();
}
async function load(a, full=false, body=csv, ms=20) {
  const p=a.run(`fetchSheets(${full})`);await respond(a,body,ms);await p;
}

test('transfer includes response body, parser and synchronous UI are separate, total includes yield', async () => {
  const a=fixture(), pending=a.run('fetchSheets()');let body;
  const text=new Promise(resolve=>{body=resolve});
  a.run('mono+=20');a.requests[0].resolve({ok:true,status:200,text:()=>text});await settle();
  assert.equal(a.run('dataStatus.sheets.timing'),null);
  a.run('mono+=30');body(csv);await settle();a.run('mono+=10');a.tick();await pending;
  assert.equal(a.run('JSON.stringify(dataStatus.sheets.timing)'),JSON.stringify({
    scope:'partial',completedAt:a.run('wall'),outcome:'ok',unchanged:false,totalMs:76,
    transfer:{runs:1,ms:50},parse:{runs:1,ms:5},ui:{runs:1,ms:11}
  }));
});

test('unchanged quick/full exports have their own transfer timings without borrowing old parser/UI costs', async () => {
  for(const full of [false,true]) {
    const a=fixture();await load(a,full);
    a.run('globalThis.rowsBefore=store.rows;globalThis.validationBefore=dataStatus.sheets.validation;wall-=86400000');
    const renders=a.state.renders;await load(a,false,csv,30);
    assert.equal(a.run('dataStatus.sheets.timing.totalMs'),30);
    assert.equal(a.run('dataStatus.sheets.timing.unchanged'),true);
    assert.equal(a.run('dataStatus.sheets.timing.parse.runs+dataStatus.sheets.timing.ui.runs'),0);
    assert.equal(a.run('store.rows===rowsBefore && dataStatus.sheets.validation===validationBefore'),true);
    assert.equal(a.state.renders,renders);
    a.run('renderCSVValidation()');assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Neproběhlo/);
  }
});

test('retry totals include failed HTTP attempts without adding requests or fake parser runs', async () => {
  const a=fixture(),pending=a.run('fetchSheets(true)');
  await respond(a,'controlled failure',13,503);await respond(a,csv,20);await pending;
  assert.equal(a.requests.length,2);
  assert.equal(a.run('dataStatus.sheets.timing.transfer.runs'),2);
  assert.equal(a.run('dataStatus.sheets.timing.transfer.ms'),33);
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs'),1);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),59);
  assert.equal(a.run('dataStatus.sheets.timing.outcome'),'ok');
});

test('quick-to-full fallback sums all attempts and rejected parser work in one completed refresh', async () => {
  const a=fixture(),pending=a.run('fetchSheets()');
  for(let i=0;i<3;i++)await respond(a,'"unterminated CSV',10);
  await respond(a,csv,10);await pending;
  assert.equal(a.run('dataStatus.sheets.timing.scope'),'full');
  assert.equal(a.run('dataStatus.sheets.timing.transfer.runs'),4);
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs'),4);
  assert.equal(a.run('dataStatus.sheets.timing.parse.ms'),20);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),111);
  assert.equal(a.run('store.fullLoaded'),true);
});

test('failed transfer preserves measurements/success evidence and recovery replaces only last-refresh timing', async () => {
  const a=fixture();await load(a,true);a.run('globalThis.rowsBefore=store.rows;globalThis.successBefore=dataStatus.sheets.successAt;globalThis.validationBefore=dataStatus.sheets.validation;wall+=60000');
  const p=a.run('fetchSheets(true)');for(const ms of [10,20,30])await respond(a,'unavailable',ms,503);await p;
  assert.equal(a.run('dataStatus.sheets.timing.outcome'),'error');
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),60);
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs+dataStatus.sheets.timing.ui.runs'),0);
  assert.equal(a.run('store.rows===rowsBefore && dataStatus.sheets.successAt===successBefore'),true);
  await load(a,false,csv,17);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),17);
  assert.equal(a.run('dataStatus.sheets.timing.outcome'),'ok');
  assert.equal(a.run('dataStatus.sheets.validation===validationBefore'),true);
});

test('failed syntax and zero accepted rows measure parser attempts but no data/UI preparation', async () => {
  for(const body of ['"unterminated CSV','Datum,Cas,Teplota\n31.02.2026,12:00,999']) {
    const a=fixture(),p=a.run('fetchSheets(true)');
    for(let i=0;i<3;i++)await respond(a,body,10);await p;
    assert.equal(a.run('dataStatus.sheets.timing.totalMs'),75);
    assert.equal(a.run('dataStatus.sheets.timing.parse.ms'),15);
    assert.equal(a.run('dataStatus.sheets.timing.ui.runs'),0);
    assert.equal(a.run('dataStatus.sheets.timing.outcome'),'error');
    a.run('renderCSVValidation()');assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Obnova selhala/);
  }
});

test('full-history synchronous callbacks count as UI work without changing their order or execution', async () => {
  const a=fixture();a.run('globalThis.callbacks=[];store._onFullLoad.push(()=>{mono+=4;callbacks.push(1)},()=>{mono+=5;callbacks.push(2)})');
  await load(a,true);
  assert.equal(a.run('dataStatus.sheets.timing.ui.ms'),20);
  assert.equal(a.run('dataStatus.sheets.timing.ui.runs'),2);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),55);
  assert.equal(a.run('JSON.stringify(callbacks)'),'[1,2]');
});

test('shared requests are measured once and a full upgrade starts a separate measurement after quick completion', async () => {
  const a=fixture(),quick=a.run('fetchSheets()'),full=a.run('fetchSheets(true)');
  assert.equal(a.requests.length,1);await respond(a,csv,20);await quick;
  assert.equal(a.run('dataStatus.sheets.timing.scope'),'partial');
  assert.equal(a.requests.length,2);await respond(a,csv+'\n22.10.2026,11:00,1',30);await full;
  assert.equal(a.run('dataStatus.sheets.timing.scope'),'full');
  assert.equal(a.run('dataStatus.sheets.timing.transfer.runs'),1);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),56);
});

test('station reset and late aborted results cannot overwrite the next station measurement', async () => {
  const a=fixture(),old=a.run('fetchSheets()');a.run('mono+=20;switchStation(1)');
  assert.equal(a.run('dataStatus.sheets.timing'),null);
  await load(a,true,csv,30);a.run('globalThis.currentTiming=dataStatus.sheets.timing');
  a.respond(0,csv);await old;
  assert.equal(a.run('dataStatus.sheets.timing===currentTiming'),true);
  assert.equal(a.run('dataStatus.sheets.timing.totalMs'),56);
});

test('unavailable or invalid monotonic clocks never break loading or invent negative durations', async () => {
  for(const clock of ['delete globalThis.performance','performance={now(){throw new Error("clock unavailable")}}']) {
    const a=fixture();a.run(clock);await load(a,true);
    assert.equal(a.run('dataStatus.sheets.timing.totalMs'),null);
    assert.equal(a.run('dataStatus.sheets.timing.parse.ms'),null);
    assert.equal(a.run('store.rows[0].temp'),0);
    a.run('renderCSVValidation()');assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Měření nedostupné/);
  }
  const a=fixture();assert.equal(a.run('mono=5;sheetsElapsed(10)'),null);
});

test('other sources and pure CSV parsing leave last completed load timing intact', async () => {
  const a=fixture();await load(a,true);a.run('globalThis.previousTiming=dataStatus.sheets.timing');
  a.run(`parseHistoryCSV(${JSON.stringify(csv)})`);
  const ov=a.run('fetchOvStation(1)');a.respond(a.requests.length-1,csv);await ov;
  const uv=a.run('fetchUVData()');a.respond(a.requests.length-1,'{"hourly":{"uv_index":[0]}}');await uv;
  a.run('CFG.source="both";CFG.mqttHost="fixture.invalid";connectMQTT()');
  a.clients[0].onMessageArrived({payloadString:'{"temp":0}'});
  assert.equal(a.run('dataStatus.sheets.timing===previousTiming'),true);
});

test('timing report contains only bounded metadata and the renderer rejects untrusted non-numeric counters', async () => {
  const a=fixture();await load(a,true);
  assert.deepEqual(Object.keys(JSON.parse(a.run('JSON.stringify(dataStatus.sheets.timing)'))).sort(),
    ['completedAt','outcome','parse','scope','totalMs','transfer','ui','unchanged']);
  assert.ok(a.run('JSON.stringify(dataStatus.sheets.timing).length')<400);
  const unsafe='<img src=x onerror=alert(1)>';
  a.run(`Object.assign(dataStatus.sheets.timing,{completedAt:${JSON.stringify(unsafe)},scope:${JSON.stringify(unsafe)},totalMs:${JSON.stringify(unsafe)}});dataStatus.sheets.timing.transfer.ms=${JSON.stringify(unsafe)};renderCSVValidation()`);
  assert.equal(a.nodes.get('dataValidationPanel').innerHTML.includes(unsafe),false);
});
