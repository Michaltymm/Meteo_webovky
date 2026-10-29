const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { app } = require('./helpers/app');

// Reference is the complete original chart selection, independent of binary bounds.
const oracle = `globalThis.checkOriginalChart=()=>{
  const before=JSON.stringify(store.rows), source=store.rows;
  const latest=source.length?source[0].ts.getTime():Date.now();
  const expected=[...source].filter(r=>r.ts.getTime()>=latest-86400000).sort((a,b)=>a.ts-b.ts);
  buildCharts('now');
  return store.rows===source && JSON.stringify(source)===before &&
    JSON.stringify(chart24.data.labels)===JSON.stringify(expected.map(r=>r.ts.getTime())) &&
    [r=>r.temp,r=>r.hum,r=>dewPoint(r.temp,r.hum)].every((get,i)=>
      JSON.stringify(chart24.data.datasets[i].data.filter(p=>!p.gap))===JSON.stringify(expected.map(r=>({x:r.ts.getTime(),y:get(r)}))));
}`;

test('24h selection includes the exact boundary, uses latest measurement and retains equal-time order, zeros and nulls', () => {
  const a=app();a.run(oracle);
  a.run(`store.rows=Object.freeze([0,0,1,86399999,86400000,86400000,86400001,200000000].map((offset,i)=>
    Object.freeze({ts:Object.freeze(new Date(1600000000000-offset)),temp:i===0?0:i===1?null:i,hum:i===2?0:i===3?null:50})));
    globalThis.valid=checkOriginalChart()`);
  assert.equal(a.run('valid'),true);
  assert.equal(a.run('chart24.data.labels.length'),6);
  assert.equal(a.run('JSON.stringify(chart24.data.datasets[0].data.filter(p=>!p.gap).map(p=>p.y))'),'[4,5,3,2,0,null]');
  assert.equal(a.run('chart24.updates'),1);
});

test('empty, single and all equal-time charts preserve every original measurement', () => {
  const a=app();a.run(oracle);
  for(const size of [0,1,4000]){
    a.run(`store.rows=Array.from({length:${size}},(_,i)=>({ts:new Date(0),temp:i,hum:0}))`);
    assert.equal(a.run('checkOriginalChart()'),true);
    assert.equal(a.run('chart24.data.labels.length'),size);
  }
});

test('24h chart agrees with the old full scan on 100 deterministic irregular histories', () => {
  const a=app();a.run(oracle);
  assert.equal(a.run(`(()=>{
    let seed=97531;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
    for(let trial=0;trial<100;trial++){
      let time=1600000000000;
      store.rows=Array.from({length:random()%4000},(_,i)=>{
        time-=random()%3?random()%180000:0;
        return {ts:new Date(time),temp:i%7?((random()%700)-300)/10:null,hum:i%11?random()%101:null};
      });
      if(!checkOriginalChart())return false;
    }
    return true;
  })()`),true);
});

test('250k old rows are not copied or linearly visited for a 289-point current window', () => {
  const a=app();
  a.run(`globalThis.visits=0;globalThis.source=Array.from({length:250000},(_,i)=>({
    ts:new Date(1700000000000-i*300000),temp:i===17?85:0,hum:i%100}));
    store.rows=new Proxy(source,{get(target,key,receiver){
      if(/^\\d+$/.test(String(key)) && ++visits>400)throw new Error('full history traversed');
      return Reflect.get(target,key,receiver);
    }});
    buildCharts('now')`);
  assert.ok(a.run('visits')<400);
  assert.equal(a.run('chart24.data.labels.length'),289);
  assert.equal(a.run('chart24.data.datasets[0].data.map(p=>p.y).includes(85)'),true);
  assert.equal(a.run('source.length'),250000);
});

test('current chart selection does not shrink full-history statistics or evict the aggregate snapshot', () => {
  const a=app({realRefresh:true});
  a.run(`store.rows=[{ts:new Date(1700000000000),temp:0,hum:null,rain:0},
    {ts:new Date(1700000000000-86400000),temp:10,hum:0,rain:0},
    {ts:new Date(1700000000000-86400001),temp:85,hum:50,rain:0}];
    refreshUI();globalThis.snapshot=dataAggregates();buildCharts('now')`);
  assert.equal(a.run('dataAggregates()===snapshot'),true);
  assert.equal(a.run('snapshot.temperature.count'),3);
  assert.equal(a.run('snapshot.temperature.max'),85);
  assert.equal(a.run('chart24.data.datasets[0].data.map(p=>p.y).includes(85)'),false);
  assert.match(a.nodes.get('statTempMax').textContent,/85/);
  assert.equal(a.run('store.rows.length'),3);
});

test('24 elapsed hours across spring/fall DST match the previous chart in three time zones', () => {
  const code=`const{app}=require('./tests/helpers/app');const a=app();
    a.run(${JSON.stringify(oracle)});
    for(const latest of ['2026-03-30T00:00:00Z','2026-10-26T00:00:00Z','2026-11-02T00:00:00Z']){
      a.run('store.rows=Array.from({length:1000},(_,i)=>({ts:new Date('+Date.parse(latest)+'-Math.floor(i/2)*300000),temp:i,hum:i%101}))');
      if(!a.run('checkOriginalChart()')||a.run('chart24.data.labels.length')!==578)throw new Error('DST range differs');
    }`;
  for(const zone of ['UTC','Europe/Prague','America/New_York'])
    execFileSync(process.execPath,['-e',code],{cwd:process.cwd(),env:{...process.env,TZ:zone},stdio:'pipe'});
});

test('MQTT/both retain the old chart selection when received time precedes a CSV timestamp or clock moves backwards', () => {
  for(const source of ['mqtt','both']){
    const a=app();a.run(oracle);
    a.run(`CFG.source=${JSON.stringify(source)};CFG.mqttHost='fixture.invalid';
      globalThis.NativeDate=Date;globalThis.clock=1700000000000;
      globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
      store.rows=[{ts:new Date(clock+3600000),temp:77,hum:50},
        {ts:new Date(clock-86400000),temp:-10,hum:60}];
      connectMQTT()`);
    const client=a.clients[0];client.options.onSuccess();
    client.onMessageArrived({payloadString:'{"temp":0,"humidity":0}'});
    assert.equal(a.run('checkOriginalChart()'),true,source+' future CSV');
    assert.equal(a.run('chart24.data.datasets[0].data.map(p=>p.y).includes(77)'),true);
    a.run('clock-=3600000');
    client.onMessageArrived({payloadString:'{"temp":1,"humidity":50}'});
    assert.equal(a.run('checkOriginalChart()'),true,source+' clock reversal');
    assert.equal(a.run('store.rows.length'),4);
  }
});
