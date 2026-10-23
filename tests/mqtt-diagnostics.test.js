const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);
function fixture(){
 const a=app();
 a.run(`globalThis.NativeDate=Date;globalThis.clock=+new Date(2026,9,23,12);
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
 CFG={...CFG,source:'both',mqttHost:'fixture.invalid'};connectMQTT()`);
 a.clients[0].options.onSuccess();
 return {a,c:a.clients[0],send:body=>a.clients[0].onMessageArrived({payloadString:body})};
}
const snapshot=a=>JSON.parse(a.run('JSON.stringify(dataStatus.mqtt.diagnostics)'));

test('classifies unreadable payload, JSON, shape and missing sensors without changing accepted zero/aliases/prefixes',()=>{
 const {a,c,send}=fixture();
 c.onMessageArrived({get payloadString(){throw new Error('private input')}});
 c.onMessageArrived({payloadString:123});send('bad');
 for(const value of ['null','[]','true'])send(value);
 for(const value of ['{}','{"temp":[12]}','{"temp":"Infinity"}'])send(value);
 send('{"t":0,"v":"4,2"}');send('{"teplota":"12suffix"}');
 const d=snapshot(a);
 assert.equal(d.received,11);assert.equal(d.accepted,2);assert.equal(d.rejected,9);
 assert.deepEqual([d.reasons.PAYLOAD_UNREADABLE,d.reasons.INVALID_JSON,d.reasons.INVALID_OBJECT,d.reasons.NO_MEASUREMENT],[2,1,3,3]);
 assert.equal(a.run('store.rows[1].temp'),0);assert.equal(a.run('store.rows[1].voltage'),4.2);
 assert.equal(a.run('store.rows[0].temp'),12);assert.equal(a.run('store.rows[0].hum'),null);
 assert.equal(d.processingErrors,0);assert.equal(d.lastReason,'NO_MEASUREMENT');
});

test('size limits count one rejection for character and UTF-8 byte bounds then ignore stopped-client callbacks',()=>{
 for(const body of ['x'.repeat(65537),'ě'.repeat(32769)]){
  const {a,c,send}=fixture();a.run('store.rows=[{temp:99}];globalThis.before=store.rows');
  send(body);send('{"temp":1}');
  const d=snapshot(a);assert.equal(d.received,1);assert.equal(d.rejected,1);assert.equal(d.reasons.SIZE_LIMIT,1);
  assert.equal(c.disconnected,1);assert.equal(a.run('mqttClient'),null);
  assert.equal(a.run('store.rows===before && store.rows[0].temp===99'),true);
 }
});

test('rate/history limits preserve existing priority and do not read payload after a rejected guard',()=>{
 const {a,c,send}=fixture();for(let i=0;i<20;i++)send('bad');
 a.run('store.rows.length=DATA_MAX_ROWS');let read=false;
 c.onMessageArrived({get payloadString(){read=true;return 'bad'}});
 let d=snapshot(a);assert.equal(read,false);assert.equal(d.received,21);assert.equal(d.reasons.RATE_LIMIT,1);assert.equal(d.reasons.HISTORY_LIMIT,0);
 assert.equal(d.reasons.INVALID_JSON,20);assert.equal(c.disconnected,1);
 const other=fixture();other.a.run('store.rows.length=DATA_MAX_ROWS');
 other.c.onMessageArrived({get payloadString(){throw new Error('must not read')}});
 d=snapshot(other.a);assert.equal(d.reasons.HISTORY_LIMIT,1);assert.equal(d.reasons.PAYLOAD_UNREADABLE,0);
});

test('accepted duplicate timestamps remain original rows and only accepted messages advance receivedAt',()=>{
 const {a,send}=fixture();send('{"temp":0}');send('{"temp":0}');
 a.run('globalThis.rowsBefore=store.rows;globalThis.cacheBefore=aggregateCache;globalThis.receivedBefore=dataStatus.mqtt.receivedAt;clock+=60000');
 const renders=a.state.renders;send('bad');
 assert.equal(a.run('store.rows===rowsBefore && aggregateCache===cacheBefore && dataStatus.mqtt.receivedAt===receivedBefore'),true);
 assert.equal(a.run('store.rows.length===2 && store.rows[0].ts.getTime()===store.rows[1].ts.getTime()'),true);
 assert.equal(a.state.renders,renders);assert.equal(snapshot(a).lastRejectedAt,a.run('clock'));
});

test('processing errors before and after committing a row never masquerade as invalid JSON or double-count rejection',()=>{
 for(const committed of [false,true]){
  const {a,send}=fixture();
  if(committed)a.run('refreshUI=()=>{throw new Error("private render details")}');
  else a.run('store.rows=new Proxy([],{get(target,key){if(key==="unshift")return()=>{throw new Error("private store details")};return target[key]}})');
  send('{"temp":0}');const d=snapshot(a);
  assert.equal(d.received,1);assert.equal(d.accepted,committed?1:0);assert.equal(d.rejected,committed?0:1);
  assert.equal(d.processingErrors,1);assert.equal(d.reasons.INVALID_JSON,0);
  assert.equal(d.reasons.PROCESSING_ERROR,committed?0:1);
  assert.equal(JSON.stringify(d).includes('private'),false);
  if(committed)assert.equal(a.run('store.rows[0].temp'),0);
 }
});

test('reconnects preserve station counters and stale client callbacks cannot change them',()=>{
 const {a,c,send}=fixture();send('bad');a.run('globalThis.report=dataStatus.mqtt.diagnostics');
 c.onConnectionLost({});a.tick(5000);const current=a.clients[1];current.options.onSuccess();
 c.onMessageArrived({payloadString:'{"temp":99}'});current.onMessageArrived({payloadString:'{"temp":0}'});
 assert.equal(a.run('dataStatus.mqtt.diagnostics===report'),true);assert.equal(snapshot(a).received,2);
 a.run('stopMQTT()');current.onMessageArrived({payloadString:'bad'});assert.equal(snapshot(a).received,2);
});

test('A to B to A resets counters and old generation packets or transport errors do not become messages',()=>{
 const {a,c,send}=fixture();c.options.onFailure({errorMessage:'private host'});assert.equal(snapshot(a).received,0);
 send('bad');a.run('switchStation(1);switchStation(0)');
 c.onMessageArrived({payloadString:'bad'});assert.equal(snapshot(a).received,0);
 assert.equal(snapshot(a).lastReason,null);assert.equal(snapshot(a).processingErrors,0);
});

test('Sheets replacement and UV/overview do not change live reception counters',async()=>{
 const {a,send}=fixture();send('{"temp":0}');a.run('globalThis.report=dataStatus.mqtt.diagnostics');
 const csv='23.10.2026,12:00,10,1010,50,0,0,,4';
 const load=a.run('fetchSheets(true)');a.respond(0,csv);await settle();a.tick();await load;
 const uv=a.run('fetchUVData()');a.respond(1,'{"hourly":{"uv_index":[0]}}');await uv;
 const ov=a.run('fetchOvStation(1)');a.respond(2,csv);await ov;
 assert.equal(a.run('dataStatus.mqtt.diagnostics===report'),true);assert.equal(snapshot(a).accepted,1);
});

test('closed diagnostics do not scan history, touch DOM, render or add timers/requests for invalid messages',()=>{
 const {a,send}=fixture();a.run('store.rows=new Proxy([],{get(target,key){if(key!=="length")throw new Error("history scan");return target[key]}})');
 const nodes=a.nodes.size,requests=a.requests.length,timers=a.timers.size;
 for(let i=0;i<10;i++)send('bad');
 assert.equal(snapshot(a).rejected,10);assert.equal(a.nodes.size,nodes);assert.equal(a.state.renders,0);
 assert.equal(a.requests.length,requests);assert.equal(a.timers.size,timers);
});

test('live diagnostics update only counters and pause DOM updates while collapsed/hidden',()=>{
 const {a,send}=fixture();
 a.run('activeInfo={trigger:el("dataValidationTrigger")};el("mqttDiagnostics").open=true;el("dataValidationPanel").innerHTML="stable"');
 send('bad');assert.equal(a.nodes.get('mqttDiagRejected').textContent,'1');
 a.run('el("mqttDiagnostics").open=false');send('bad');assert.equal(a.nodes.get('mqttDiagRejected').textContent,'1');
 a.run('el("mqttDiagnostics").open=true;document.hidden=true');send('bad');assert.equal(a.nodes.get('mqttDiagRejected').textContent,'1');
 a.run('document.hidden=false;refreshMQTTDiagnostics()');assert.equal(a.nodes.get('mqttDiagRejected').textContent,'3');
 assert.equal(a.nodes.get('dataValidationPanel').innerHTML,'stable');
});

test('only the metadata diagnostic popup can survive MQTT invalidation, default invalidation closes it',()=>{
 const a=app();a.run('globalThis.closed=0;closeInfoPopover=()=>{closed++};activeInfo={trigger:el("dataValidationTrigger")};invalidateDerivedData({keepDataDiagnostics:true})');
 assert.equal(a.run('closed'),0);a.run('activeInfo.trigger=el("otherInfo");invalidateDerivedData({keepDataDiagnostics:true})');
 assert.equal(a.run('closed'),1);a.run('activeInfo.trigger=el("dataValidationTrigger");invalidateDerivedData()');assert.equal(a.run('closed'),2);
});

test('diagnostic metadata is bounded and never stores payload, topic, broker or raw error text',()=>{
 const {a,c,send}=fixture();
 c.onMessageArrived({get payloadString(){throw new Error('private-token')}});send('{"private-token":"<img src=x onerror=alert(1)>"}');
 const d=snapshot(a);assert.deepEqual(Object.keys(d).sort(),['accepted','lastReason','lastRejectedAt','processingErrors','reasons','received','rejected','since']);
 assert.ok(JSON.stringify(d).length<600);assert.equal(JSON.stringify(d).includes('private'),false);
 const payload='<img src=x onerror=alert(1)>';
 a.run(`Object.assign(dataStatus.mqtt.diagnostics,{received:${JSON.stringify(payload)},since:${JSON.stringify(payload)},lastReason:${JSON.stringify(payload)},lastRejectedAt:${JSON.stringify(payload)}});dataStatus.mqtt.diagnostics.reasons.INVALID_JSON=${JSON.stringify(payload)};renderCSVValidation()`);
 assert.equal(a.nodes.get('dataValidationPanel').innerHTML.includes(payload),false);
 assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Neznámý důvod/);
});
