const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);
function fixture(){const a=app();a.run(`globalThis.csv='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka\\n'+
  Array.from({length:12000},(_,i)=>'25.10.2026,12:00,'+(i%7)+',1010,50,0,0,,'+(i%3?'4 V':'')+',"poznámka, řádek '+i+'"').join('\\n');
  globalThis.mono=0;globalThis.performance={now:()=>++mono};
  globalThis.previousRows=store.rows;globalThis.previousReport=dataStatus.sheets.validation;
  globalThis.timing=newSheetsTiming('full');`);return a;}
function tickAll(a){let n=0;while([...a.timers.values()].some(t=>t.delay===0)){a.tick(0);assert.ok(++n<3000,'lexer must make bounded progress');}return n;}
async function parse(a){const p=a.run('parseAndStore(csv,stationContext(),"full",timing)');a.tick();await settle();return {p};}

test('large Sheets decoding publishes only complete original rows and validation once',async()=>{
  const a=fixture();a.run('globalThis.expectedReport=newCSVValidation("full");globalThis.expected=parseHistoryCSV(csv,expectedReport)');
  const {p}=await parse(a);
  assert.equal(a.run('store.rows===previousRows && dataStatus.sheets.validation===previousReport'),true);
  a.tick(0);assert.equal(a.run('store.rows===previousRows && dataStatus.sheets.validation===previousReport'),true);
  assert.ok(tickAll(a)>1);assert.equal(await p,true);
  assert.equal(a.run('JSON.stringify(store.rows)===JSON.stringify(expected)'),true);
  assert.equal(a.run('JSON.stringify({...dataStatus.sheets.validation,checkedAt:0})===JSON.stringify({...expectedReport,checkedAt:0})'),true);
  assert.equal(a.run('timing.parse.runs'),1);assert.equal(a.state.renders,1);assert.equal(a.requests.length,0);
});

test('small exports, direct parsing and MQTT/both preserve their synchronous post-yield path',async()=>{
  for(const mode of ['small','direct','mqtt','both']){
    const a=fixture();a.run(`CFG.source=${JSON.stringify(mode==='mqtt'||mode==='both'?mode:'sheets')}`);
    if(mode==='small')a.run('csv="25.10.2026,12:00,0,1010,50,0,0,,4"');
    const p=a.run(mode==='direct'?'parseAndStore(csv)':'parseAndStore(csv,stationContext(),"full",timing)');
    a.tick();assert.equal(await p,true);assert.equal([...a.timers.values()].some(t=>t.delay===0),false);
    assert.equal(a.run('store.rows[0].temp'),0);
  }
});

test('station abort immediately settles the work, clears its timer and rejects a queued old callback',async()=>{
  const a=fixture(),{p}=await parse(a);a.tick(0);
  const old=[...a.timers.values()].find(t=>t.delay===0).fn;
  a.run('switchStation(1);store.rows=[{temp:777}];globalThis.reportB=dataStatus.sheets.validation');
  assert.equal([...a.timers.values()].some(t=>t.delay===0),false);
  assert.equal(await p,false);old();
  assert.equal(a.run('store.rows.length===1 && store.rows[0].temp===777 && dataStatus.sheets.validation===reportB'),true);
});

test('A to B to A and a station change after decoding but before its continuation cannot commit stale data',async()=>{
  for(const late of [false,true]){
    const a=fixture(),{p}=await parse(a);
    if(late)tickAll(a);
    a.run('switchStation(1);switchStation(0);store.rows=[{temp:123}];globalThis.currentReport=dataStatus.sheets.validation');
    assert.equal(await p,false);tickAll(a);
    assert.equal(a.run('store.rows.length===1 && store.rows[0].temp===123 && dataStatus.sheets.validation===currentReport'),true);
  }
});

test('late syntax and resource-limit failures keep old data, incomplete evidence and one parse attempt',async()=>{
  for(const suffix of ['"unterminated', 'x'.repeat(16385), ','.repeat(64)]){
    const a=fixture();a.run(`csv+='\\n'+${JSON.stringify(suffix)}`);
    const {p}=await parse(a);const rejection=assert.rejects(p);tickAll(a);await rejection;
    assert.equal(a.run('store.rows===previousRows'),true);assert.equal(a.state.renders,0);
    assert.equal(a.run('dataStatus.sheets.validation.complete'),false);
    assert.equal(a.run('dataStatus.sheets.validation.total'),0);
    assert.equal(a.run('timing.parse.runs'),1);
    assert.equal(a.run('dataStatus.sheets.validation.failure'),suffix[0]==='"'?'CSV_SYNTAX':'DATA_LIMIT');
  }
});

test('lexical yields preserve escaped quotes, Unicode, CRLF and multiline notes at checkpoint boundaries',()=>{
  const a=app();
  for(const length of [8189,8190,8191,8192,8193,16370]){
    const value='ž'.repeat(length)+'"x\r\nend',text='"'+value.replaceAll('"','""')+'",0\r\nlast,""';
    a.run(`globalThis.scan={count:0,numbers:[]};globalThis.steps=parseCSVSteps(${JSON.stringify(text)},Infinity,scan)`);
    let step;do{step=a.run('steps.next()')}while(!step.done);
    assert.equal(JSON.stringify(step.value),JSON.stringify([[value,'0'],['last','']]));
    assert.equal(a.run('JSON.stringify(scan)'),'{"count":2,"numbers":[1,2]}');
  }
});

test('partial logical-record limit returns before malformed tail, including across yields',()=>{
  const a=app();a.run('globalThis.scan={count:0,numbers:[]};globalThis.result=finishSteps(parseCSVSteps("\\n\\\""+"x".repeat(10000)+"\\\",0\\r\\n\\\"unterminated",1,scan))');
  assert.equal(a.run('result.length'),1);assert.equal(a.run('result[0][0].length'),10000);
  assert.equal(a.run('JSON.stringify(scan)'),'{"count":2,"numbers":[2]}');
});

test('unavailable monotonic timing still finishes with finite slice budgets and no invented durations',async()=>{
  const a=fixture();a.run('delete globalThis.performance');
  const {p}=await parse(a);assert.ok(tickAll(a)>1);assert.equal(await p,true);
  assert.equal(a.run('timing.parse.ms'),null);assert.equal(a.run('timing.parse.runs'),1);
});

test('lexical timing excludes scheduler waits and counts the export rather than slices',async()=>{
  const a=fixture();a.run('performance.now=()=>mono+=10');
  const {p}=await parse(a);let turns=0;
  while([...a.timers.values()].some(t=>t.delay===0)){a.run('mono+=10000');a.tick(0);assert.ok(++turns<3000);}
  assert.equal(await p,true);assert.ok(turns>1);
  assert.equal(a.run('timing.parse.runs'),1);assert.ok(a.run('timing.parse.ms<mono/10'));
});

test('shared full load starts one request and callbacks run only after complete validation/commit',async()=>{
  const a=fixture();a.run('globalThis.calls=0;ensureFullData(()=>{if(store.rows.length===12000)calls++})');
  const other=a.run('fetchSheets(true)');a.respond(0,a.run('csv'));await settle();a.tick();await settle();
  assert.equal(a.run('calls'),0);assert.equal(a.run('store.fullLoaded'),false);
  tickAll(a);await other;
  assert.equal(a.requests.length,1);assert.equal(a.run('calls'),1);
  assert.equal(a.run('store.fullLoaded'),true);assert.equal(a.run('dataStatus.sheets.timing.parse.runs'),1);
});
