const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');

test('stream limit counts actual bytes even without or with misleading Content-Length',async()=>{
  for(const headers of [{},{'Content-Length':'1'}]) {
    const a=app();let cancelled=false;
    const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(12));},cancel(){cancelled=true;}}),{headers});
    const pending=a.run('stationText("fixture",stationContext(),1000,null,8)');a.requests[0].resolve(response);
    await assert.rejects(pending,{code:'DATA_LIMIT'});assert.equal(cancelled,true);assert.equal(response.body.locked,false);
  }
});
test('oversize declaration cancels before reading, UTF-8 crossing chunks is preserved',async()=>{
  let cancelled=false;
  const a=app(),large=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'Content-Length':'9'}});
  await assert.rejects(a.run('readLimitedText')(large,8),{code:'DATA_LIMIT'});assert.equal(cancelled,true);
  const bytes=new TextEncoder().encode('Žluťoučký');
  const response=new Response(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}}));
  assert.equal(await a.run('readLimitedText')(response,bytes.length),'Žluťoučký');
});
test('fallback reader enforces bytes for multibyte text too',async()=>{
  const a=app();await assert.rejects(a.run('readLimitedText')({text:async()=> 'ěěěě'},6),{code:'DATA_LIMIT'});
});
test('bad and oversized CSV fails before replacing a valid store',async()=>{
  const a=app();a.run('store.rows=[{temp:12}]');
  for(const fixture of ['"unclosed','x'.repeat(16385),','.repeat(64),'\n'.repeat(3000001)]){
    const pending=a.run(`parseAndStore(${JSON.stringify(fixture)})`);a.tick();await assert.rejects(pending);
    assert.equal(a.run('store.rows[0].temp'),12);
  }
});
test('CSV row limit rejects rather than silently truncating accepted measurements',()=>{
  const a=app();a.run('globalThis.fixture="a\\n".repeat(DATA_MAX_ROWS+1)');
  assert.throws(()=>a.run('parseCSV(fixture)'),{code:'DATA_LIMIT'});
});
test('JSON API failure and oversized remote config leave the current source and data intact',async()=>{
  const a=app();a.run('store.rows=[{temp:12}];globalThis.original=CFG.sheetId');
  const pending=a.run('tryLoadConfigJson(0)');a.respond(0,' '.repeat(65537));assert.equal(await pending,false);
  assert.equal(a.run('CFG.sheetId===original && store.rows[0].temp===12'),true);
  const uv=a.run('fetchUVData()');a.respond(1,'{"unexpected":true}');await uv;assert.equal(a.run('uvStore.hourly'),null);
});
function mqtt(){const a=app();a.run('CFG={...CFG,source:"mqtt",mqttHost:"fixture.invalid"};connectMQTT()');return {a,c:a.clients[0]};}
test('MQTT accepts measurements and valid zero but rejects JSON primitives and nested sensor values',()=>{
  const {a,c}=mqtt();
  for(const payload of ['bad','null','[]','{}','true','0','{"temp":[22]}','{"temp":"NaN"}','{"temp":"Infinity"}'])c.onMessageArrived({payloadString:payload});
  assert.doesNotThrow(()=>c.onMessageArrived({get payloadString(){throw new Error('invalid UTF-8');}}));
  assert.equal(a.run('store.rows.length'),0);
  c.onMessageArrived({payloadString:'{"temp":0,"voltage":"4,2"}'});
  assert.equal(a.run('store.rows[0].temp'),0);assert.equal(a.run('store.rows[0].voltage'),4.2);
  assert.equal(c.options.useSSL,true);
});
test('MQTT oversize, flood and full-store limits disconnect without trimming original history',()=>{
  for(const mode of ['size','rate','history']){
    const {a,c}=mqtt();a.run('store.rows=[{temp:12}]');
    if(mode==='size')c.onMessageArrived({payloadString:'x'.repeat(65537)});
    if(mode==='rate')for(let i=0;i<21;i++)c.onMessageArrived({payloadString:'{}'});
    if(mode==='history'){a.run('store.rows=Array.from({length:DATA_MAX_ROWS},()=>({temp:12}))');c.onMessageArrived({payloadString:'{"temp":15}'});}
    assert.equal(c.disconnected,1,mode);assert.equal(a.run('mqttClient'),null);
    assert.equal(a.run('store.rows[0].temp'),12);
    assert.equal(a.run('store.rows.length'),mode==='history'?300000:1);
    assert.match(a.state.mqtt.at(-1).text,/příjem zastaven/);
  }
});
