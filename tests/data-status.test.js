const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);
const csv='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n22.10.2026,12:00,0,1010,50,0,0,,4';
function fixture(){const a=app();a.run(`globalThis.NativeDate=Date;globalThis.clock=+new Date(2026,9,23,12);
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
 // Align the application's day snapshot with the fixture clock; this test
 // checks minute updates, not a rollover from the machine's current date.
 visibleDay=localDateKey();renderDataStatus()`);return a;}
async function accept(a,full=false,body=csv){const pending=a.run(`fetchSheets(${full})`);a.respond(a.requests.length-1,body);await settle();a.tick();await pending;}
async function rejectExport(a,body=null){const pending=a.run('fetchSheets(true)');for(let i=0;i<3;i++){const index=a.requests.length-1;if(body===null)a.requests[index].reject(new Error('controlled failure'));else a.respond(index,body);await settle();a.tick();await settle();}await pending;}

test('accepted CSV separates old record time from validation and records partial/full scope',async()=>{
 const a=fixture();await accept(a);
 assert.equal(a.run('dataStatus.sheets.successAt===clock'),true);
 assert.ok(a.run('dataStatus.sheets.successAt-store.rows[0].ts.getTime()')>=86400000);
 assert.match(a.nodes.get('dataRecordAge').textContent,/1 d/);
 assert.equal(a.nodes.get('dataTransferState').textContent,'Sheets: ověřeno');
 assert.equal(a.nodes.get('dataHistoryScope').textContent,'Částečná historie');
 await accept(a,true);assert.equal(a.nodes.get('dataHistoryScope').textContent,'Celý export zdroje');
});
test('both unchanged quick and unchanged full exports update validation without changing measurements',async()=>{
 for(const full of [false,true]){
  const a=fixture();await accept(a,full);const renders=a.state.renders;
  a.run('globalThis.originalRows=store.rows;globalThis.originalTime=store.rows[0].ts.getTime();clock+=60000');
  await accept(a,false);
  assert.equal(a.run('dataStatus.sheets.successAt===clock'),true);
  assert.equal(a.run('store.rows===originalRows && store.rows[0].ts.getTime()===originalTime'),true);
  assert.equal(a.state.renders,renders);assert.match(a.state.gs.at(-1).text,/beze změn/);
 }
});
test('failed refresh retains last successful validation, full history and readable failure state',async()=>{
 const a=fixture();await accept(a,true);a.run('globalThis.rowsBefore=store.rows;globalThis.successBefore=dataStatus.sheets.successAt;clock+=60000');
 await rejectExport(a);
 assert.equal(a.run('dataStatus.sheets.phase'),'error');
 assert.equal(a.run('dataStatus.sheets.successAt===successBefore && store.rows===rowsBefore && store.fullLoaded'),true);
 assert.match(a.nodes.get('dataTransferState').textContent,/chyba obnovy/);
 assert.match(a.nodes.get('dataLastSync').textContent,/Před 1 min/);
 await accept(a,true);assert.equal(a.run('dataStatus.sheets.phase'),'ok');
 assert.equal(a.run('dataStatus.sheets.successAt===clock'),true);
});
test('HTTP success with invalid exports never counts as a successful validation',async()=>{
 const a=fixture();await rejectExport(a,'<!doctype html><p>not a CSV export</p>');
 assert.equal(a.run('dataStatus.sheets.successAt'),null);assert.equal(a.run('dataStatus.sheets.phase'),'error');
 assert.equal(a.nodes.get('dataHistoryScope').textContent,'Bez načtených dat');
});
test('config and UV/overview traffic do not count as accepted data for the active station',async()=>{
 const a=fixture();const cfg=a.run('tryLoadConfigJson(0)');a.respond(0,'{"stationIdx":0,"sheetId":"fixture"}');await cfg;
 const uv=a.run('fetchUVData()');a.respond(1,'{"hourly":{"uv_index":[0]}}');await uv;
 const overview=a.run('fetchOvStation(1)');a.respond(2,csv);await overview;
 assert.equal(a.run('dataStatus.sheets.successAt'),null);assert.equal(a.run('dataStatus.mqtt.receivedAt'),null);
});
test('station switch resets evidence and late prior-generation success cannot relabel the new station',async()=>{
 const a=fixture();const pending=a.run('fetchSheets(true)');a.run('switchStation(1);globalThis.statusB=dataStatus');
 a.respond(0,csv);await pending;
 assert.equal(a.run('dataStatus===statusB && dataStatus.sheets.successAt===null && store.rows.length===0'),true);
 assert.equal(a.nodes.get('dataRecordTime').textContent,'Zatím bez dat');
});
test('MQTT connection and invalid messages do not pretend a measurement was received',()=>{
 const a=fixture();a.run('CFG.source="mqtt";CFG.mqttHost="fixture.invalid";connectMQTT()');const c=a.clients[0];
 c.options.onSuccess();assert.equal(a.run('dataStatus.mqtt.receivedAt'),null);
 for(const payload of ['null','[]','{}','not json'])c.onMessageArrived({payloadString:payload});
 assert.equal(a.run('dataStatus.mqtt.receivedAt'),null);
 c.onMessageArrived({payloadString:'{"temp":0}'});a.run('renderDataStatus()');
 assert.equal(a.run('dataStatus.mqtt.receivedAt===clock && store.rows[0].temp===0'),true);
 assert.equal(a.nodes.get('dataRecordLabel').textContent,'Poslední příjem MQTT');
 assert.equal(a.nodes.get('dataHistoryScope').textContent,'Živé zprávy této relace');
 c.onConnectionLost({});assert.equal(a.run('dataStatus.mqtt.phase'),'error');
 assert.equal(a.run('dataStatus.mqtt.receivedAt===clock'),true);
});
test('combined source keeps independent evidence and CSV replacement restores record provenance',async()=>{
 const a=fixture();a.run('CFG.source="both";CFG.mqttHost="fixture.invalid"');await accept(a,true);
 a.run('clock+=60000;connectMQTT()');a.clients[0].onMessageArrived({payloadString:'{"temp":1}'});a.run('renderDataStatus()');
 assert.equal(a.run('dataStatus.mqtt.receivedAt-dataStatus.sheets.successAt'),60000);
 assert.equal(a.nodes.get('dataHistoryScope').textContent,'Celý export zdroje + živé zprávy');
 assert.match(a.nodes.get('dataLastSync').textContent,/Kontrola Sheets:/);assert.match(a.nodes.get('dataLastSync').textContent,/Zpráva MQTT:/);
 await accept(a,true);assert.equal(a.nodes.get('dataRecordLabel').textContent,'Poslední záznam');
 assert.equal(a.nodes.get('dataHistoryScope').textContent,'Celý export zdroje');
});
test('age supports epoch zero, future clocks and invalid dates without declaring a sensor outage',()=>{
 const a=fixture();assert.equal(a.run('dataAge(0,0)'),'Před méně než minutou');
 assert.equal(a.run('dataAge(0,60000)'),'Před 1 min');
 assert.match(a.run('dataAge(clock+1,clock)'),/budoucnosti/);
 a.run('store.rows=[{ts:new Date(clock+60000)}];renderDataStatus()');
 assert.match(a.nodes.get('dataRecordAge').textContent,/budoucnosti/);assert.equal(a.nodes.get('dataRecordTime').className,'data-state-warning');
 a.run('store.rows=[{ts:new Date(NaN)}];renderDataStatus()');
 assert.equal(a.nodes.get('dataRecordTime').textContent,'Čas záznamu není dostupný');
});
test('minute updates are O(1), preserve statistics and generate no fetch or render; hidden pages pause them',async()=>{
 const a=fixture();await accept(a,true);a.run('globalThis.rowsBefore=store.rows;globalThis.cacheBefore=aggregateCache;clock+=60000');
 const requests=a.requests.length,renders=a.state.renders;
 a.visibility(true);a.run('updateVisibleDataStatus()');assert.match(a.nodes.get('dataLastSync').textContent,/méně než/);
 a.visibility(false);a.run('updateVisibleDataStatus()');assert.match(a.nodes.get('dataLastSync').textContent,/Před 1 min/);
 assert.equal(a.requests.length,requests);assert.equal(a.state.renders,renders);
 assert.equal(a.run('store.rows===rowsBefore && aggregateCache===cacheBefore'),true);
 a.run('globalThis.realRows=store.rows;store.rows=new Proxy(realRows,{get(target,key){if(key!=="0"&&key!=="length")throw new Error("history scan");return target[key]}});renderDataStatus()');
});
