const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

test('shared daily/monthly values match independent full scans with nulls, zeros and several years', () => {
  const a = app();
  assert.equal(a.run(`(() => {
    store.rows=Array.from({length:5000},(_,i)=>({
      ts:new Date(Date.now()-Math.floor(i/2)*21600000),
      temp:i%11===0?null:i%41===0?Infinity:(i%73-20)/3,
      hum:i%7===0?null:i%19===0?NaN:i%100, rain:i%13===0?null:i%17/10,
      pressure:1000+i%20,voltage:i%3===0?null:0
    }));
    const result=dataAggregates();
    for(const [unit,groups] of [['day',result.days],['month',result.months]]) {
      for(const [key,group] of groups) {
        const rows=store.rows.filter(r=>(unit==='day'?fmtDateShort(r.ts):(r.ts.getMonth()+1)+'/'+r.ts.getFullYear())===key);
        const ts=numericSummary(rows.map(r=>r.temp)),hs=numericSummary(rows.map(r=>r.hum));
        if(group.tn!==ts.count || group.hn!==hs.count) return false;
        if((group.tn?group.ts/group.tn:null)!==ts.avg || (group.hn?group.hs/group.hn:null)!==hs.avg) return false;
        if(unit==='day' && group.rain!==numericSummary(rows.map(r=>r.rain)).max) return false;
      }
    }
    const today=store.rows.filter(r=>r.ts>=result.from && r.ts<=result.to);
    for(const key of ['temp','hum','pressure','rain']) {
      const expected=numericSummary(today.map(r=>r[key])),actual=result.today[key];
      if(['min','max','avg','count'].some(k=>actual[k]!==expected[k])) return false;
    }
    return result.temperature.max===numericSummary(store.rows.map(r=>r.temp)).max && result.today.voltage===0;
  })()`),true);
});

test('all consumers reuse a snapshot without scanning 250k raw rows again', () => {
  const a=app();
  a.run(`globalThis.visits=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(Date.now()-i*300000),temp:i===17?85:0,hum:60,pressure:1010,rain:0,voltage:0
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key))) visits++;return Reflect.get(target,key,receiver)}});
    globalThis.first=dataAggregates();globalThis.initialVisits=visits;
    buildDailyGrid();buildAgg(chartMonthly,store.rows,'day',30);buildAgg(chartYearly,store.rows,'month',12)`);
  assert.equal(a.run('dataAggregates()===first'),true);
  assert.equal(a.run('visits===initialVisits'),true);
  assert.equal(a.run('first.temperature.max'),85);
  assert.equal(a.run('store.rows[17].temp'),85);
});

test('temperature ties preserve the first original row; absent statistics clear old text', () => {
  const a=app({realRefresh:true});
  a.run(`store.rows=[0,1,2].map(i=>({ts:new Date(Date.now()-i*60000),temp:i<2?20:0,hum:null,rain:0}));refreshUI()`);
  assert.equal(a.run('dataAggregates().temperature.maxRow===store.rows[0]'),true);
  a.run('store.rows=[{ts:new Date(),temp:null,hum:null,rain:null}];refreshUI()');
  for(const key of ['statTempMax','statTempMin','statRainMax']) assert.equal(a.nodes.get(key).textContent,'–');
});

test('in-place corrections, append/delete and source replacement invalidate shared results', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(),temp:10,rain:1}];globalThis.first=dataAggregates();store.rows[0].temp=0;invalidateDerivedData()');
  assert.equal(a.run('aggregateCache'),null);
  assert.equal(a.run('dataAggregates().temperature.max'),0);
  a.run('store.rows.unshift({ts:new Date(),temp:25,rain:2});invalidateDerivedData()');
  assert.equal(a.run('dataAggregates().temperature.max'),25);
  a.run('store.rows.shift();invalidateDerivedData()');
  assert.equal(a.run('dataAggregates().temperature.max'),0);
  a.run('store.rows=[{ts:new Date(),temp:-5,rain:0}]');
  assert.equal(a.run('dataAggregates().temperature.max'),-5);
  a.run('switchStation(1)');
  assert.equal(a.run('aggregateCache'),null);
});

test('a local day rollover invalidates today even when the raw array is unchanged', () => {
  const a=app();
  a.run(`globalThis.NativeDate=Date;globalThis.clock=+new Date(2026,9,21,23,59);
    globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
    store.rows=[{ts:new Date(2026,9,22,0),temp:25,rain:2},{ts:new Date(2026,9,21,23),temp:10,rain:1}];
    globalThis.previous=dataAggregates();clock=+new Date(2026,9,22,0,1)`);
  assert.equal(a.run('dataAggregates()===previous'),false);
  assert.equal(a.run('dataAggregates().today.temp.avg'),25);
  assert.equal(a.run('dataAggregates().temperature.max'),25);
});

test('CSV replacement and an MQTT overlay both invalidate the actual cache lifecycle', async () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(),temp:99}];dataAggregates()');
  const done=a.run('parseAndStore("Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n20.10.2026,12:00,10,1010,60,0,0,,4")');
  a.tick();await done;
  assert.equal(a.run('aggregateCache'),null);
  assert.equal(a.run('dataAggregates().temperature.max'),10);
  a.run('CFG.source="both";CFG.mqttHost="test.example";connectMQTT()');
  a.clients[0].onMessageArrived({payloadString:'{"temp":30,"hum":0,"rain":0,"voltage":0}'});
  assert.equal(a.run('aggregateCache'),null);
  assert.equal(a.run('dataAggregates().temperature.max'),30);
  assert.equal(a.run('dataAggregates().today.voltage'),0);
});

test('external aggregate input does not evict the current station snapshot', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(),temp:10,hum:50}];globalThis.current=dataAggregates();buildAgg(chartMonthly,[{ts:new Date(),temp:0,hum:null}],"day",30)');
  assert.equal(a.run('dataAggregates()===current'),true);
  assert.equal(a.run('chartMonthly.data.datasets[0].data[0]'),0);
  assert.equal(a.run('chartMonthly.data.datasets[1].data[0]'),null);
});
