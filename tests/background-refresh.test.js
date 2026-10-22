const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');
const settle=()=>new Promise(setImmediate);
const csv='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n21.10.2026,12:00,10,1010,60,0,0,,4';

async function started(source='sheets') {
  const a=app({realStart:true});
  a.run(`globalThis.NativeDate=Date;globalThis.clock=+new Date(2026,9,21,12);
    globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
    // The script was evaluated before installing the fixture clock. Match its
    // initial day snapshot to that clock, independent of the machine's date.
    visibleDay=localDateKey();
    CFG.source='${source}';CFG.interval=60;CFG.mqttHost='test.example';startAll()`);
  // Sheets + UV + two overview sources; MQTT creates no fake HTTP requests.
  const offset=source==='mqtt'?0:1;
  assert.equal(a.requests.length,offset+3);
  if(offset)a.respond(0,csv);
  a.respond(offset,JSON.stringify({hourly:{uv_index:[1,2]}}));a.respond(offset+1,csv);a.respond(offset+2,csv);
  await settle();a.tick();await settle();
  return a;
}

test('hidden periodic callbacks send no requests; a fresh short return sends none', async () => {
  const a=await started();
  a.visibility(true);a.run('clock+=10000');
  for(const t of a.intervals.values()) t.fn();
  a.run('periodicRefresh("overview",300000,fetchAllOv)');
  assert.equal(a.requests.length,4);
  a.visibility(false);
  assert.equal(a.requests.length,4);
});

test('stale return refreshes each source once and does not recreate MQTT', async () => {
  const a=await started('both');
  assert.equal(a.clients.length,1);
  a.visibility(true);a.run('clock+=86400000');
  for(const t of a.intervals.values()) t.fn();
  a.run('periodicRefresh("overview",300000,fetchAllOv)');
  assert.equal(a.requests.length,4);
  a.visibility(false);
  assert.equal(a.requests.length,8);
  for(let i=0;i<20;i++){a.visibility(true);a.visibility(false);}
  for(const t of a.intervals.values())t.fn();
  a.run('periodicRefresh("overview",300000,fetchAllOv)');
  assert.equal(a.requests.length,8);
  assert.equal(a.clients.length,1);
  assert.equal(a.clients[0].disconnected,0);
});

test('the scheduled tick after resuming honors the last attempt instead of fetching again', async () => {
  const a=await started();
  a.visibility(true);a.run('clock+=61000');a.visibility(false);
  assert.equal(a.requests.length,5);
  a.run('clock+=1000');
  for(const t of a.intervals.values())t.fn();
  assert.equal(a.requests.length,5);
});

test('an in-flight full history remains shared across hide/show and overview requests deduplicate', async () => {
  const a=await started();
  const full=a.run('fetchSheets(true)');
  assert.equal(a.requests.length,5);
  a.visibility(true);a.run('clock+=600000');a.visibility(false);
  assert.equal(a.requests.length,7); // only the two stale overview sources
  const overview=a.run('Promise.all([fetchAllOv(),fetchAllOv()])');
  assert.equal(a.requests.length,7);
  a.respond(4,csv);a.respond(5,csv);a.respond(6,csv);
  await settle();a.tick();await Promise.all([full,overview]);
  assert.equal(a.run('store.fullLoaded'),true);
});

test('a manual refresh resets periodic age; changing station invalidates old timers', async () => {
  const a=await started();
  a.run('clock+=59000');const manual=a.run('manualRefresh()');
  a.respond(4,csv);await settle();a.tick();await manual;
  a.run('clock+=2000');for(const t of a.intervals.values())t.fn();
  assert.equal(a.requests.length,5);
  const old=[...a.intervals.values()];a.run('switchStation(1)');
  assert.equal(a.intervals.size,0);
  const count=a.requests.length;
  a.run('clock+=86400000');for(const t of old)t.fn();a.visibility(false);
  assert.equal(a.requests.length,count); // wait for the new configuration first
});

test('UV requests are shared, and failed attempts do not become a successful cache', async () => {
  const a=await started();
  a.run('uvStore.hourly=null');
  const uv=a.run('Promise.all([fetchUVData(),fetchUVData()])');
  assert.equal(a.requests.length,5);
  a.requests[4].reject(new Error('controlled failure'));await uv;
  assert.equal(a.run('uvStore.hourly'),null);
  const count=a.requests.length;
  a.run('periodicRefresh("uv",3600000,fetchUVData)');
  assert.equal(a.requests.length,count);
  a.visibility(true);a.visibility(false);
  assert.equal(a.requests.length,count);
});

test('a failed new-day UV request is not retried on every visibility event', async () => {
  const a=await started();
  a.visibility(true);a.run('clock+=86400000');a.visibility(false);
  a.requests[5].reject(new Error('new-day UV failure'));
  await settle();
  const count=a.requests.length;
  for(let i=0;i<10;i++){a.visibility(true);a.visibility(false);}
  assert.equal(a.requests.length,count);
  assert.equal(a.run('uvStore.hourly'),null);
});

test('MQTT-only station resumes UV and overview without a Sheets request or another client', async () => {
  const a=await started('mqtt');
  a.visibility(true);a.run('clock+=86400000');a.visibility(false);
  assert.equal(a.requests.length,6);
  const activeId=a.run('CFG.sheetId');
  assert.equal(a.requests.some(r=>r.url.includes(activeId)),false);
  assert.equal(a.clients.length,1);
});

test('return across midnight refreshes day-dependent UI once even while network is pending', async () => {
  const a=await started();const renders=a.state.renders;
  a.visibility(true);a.run('clock+=86400000');a.visibility(false);
  assert.equal(a.state.renders,renders+1);
  a.visibility(false);
  assert.equal(a.state.renders,renders+1);
});
