const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { app } = require('./helpers/app');

// Independent baseline: the original full-history scan. Compare the complete
// user-facing result, including validity rules, units and local timestamps.
function linearNight(rows) {
  const lat=Number(CFG.lat),lon=Number(CFG.lon);
  if(!rows.length||!Number.isFinite(lat)||!Number.isFinite(lon))return 'Noční úsek není dostupný.';
  const last=rows.at(-1).ts,day=new Date(last.getFullYear(),last.getMonth(),last.getDate());
  let rise=calcSunTimes(lat,lon,day).rise;
  if(rise&&rise>last){day.setDate(day.getDate()-1);rise=calcSunTimes(lat,lon,day).rise;}
  day.setDate(day.getDate()-1);const sunset=calcSunTimes(lat,lon,day).set;
  if(!rise||!sunset||+rise>+last)return 'Poslední dokončená noc není v rozsahu doložená.';
  let first=null,end=null,previous=null,broken=false;
  for(const row of rows){
    if(row.ts<sunset||row.ts>rise)continue;
    if(!Number.isFinite(row.voltage)){broken=true;continue;}
    if(previous&&+row.ts-+previous.ts>10800000)broken=true;
    if(!first)first=row;end=row;previous=row;
  }
  if(!first||!end||+end.ts<=+first.ts||broken)return 'Pro noční změnu chybí souvislý pozorovaný úsek (mezery >3 h nebo chybějící V).';
  return `Pozorovaný úsek poslední dokončené noci: ${fmt((end.voltage-first.voltage)*1000,2)} mV za ${fmt((end.ts-first.ts)/3600000,2)} h; ${fmtTime(first.ts)}–${fmtTime(end.ts)}. Nepokrývá nutně celou noc.`;
}

function fixture() {
  const a=app();
  a.run(`globalThis.linearNight=${linearNight.toString()};
    CFG.lat=50.08;CFG.lon=14.42;
    calcSunTimes=(lat,lon,d)=>({rise:new Date(d.getFullYear(),d.getMonth(),d.getDate(),6),set:new Date(d.getFullYear(),d.getMonth(),d.getDate(),18)});
    globalThis.sunset=+new Date(2026,9,23,18);globalThis.rise=+new Date(2026,9,24,6);
    globalThis.row=(ts,voltage)=>({ts:new Date(ts),voltage});
    globalThis.regular=()=>Array.from({length:9},(_,i)=>row(sunset-6*3600000+i*3*3600000,4-i*.01));
    globalThis.rows=regular();`);
  return a;
}

function same(a) {
  const expected=a.run('linearNight(rows)'),actual=a.run('analyticsNight(rows)');
  assert.equal(actual,expected);return actual;
}

test('night analysis preserves the observed interval, sign, units and partial-night explanation',()=>{
  const a=fixture();
  const text=same(a);
  assert.match(text,/Pozorovaný úsek/);
  assert.ok(text.includes(a.run('fmt(-40,2)+" mV za "+fmt(12,2)+" h"')));
  assert.match(text,/Nepokrývá nutně celou noc/);
  a.run('rows=[row(sunset+3600000,0),row(sunset+7200000,.025),row(rise+3600000,9)]');
  assert.ok(same(a).includes(a.run('fmt(25,2)+" mV za "+fmt(1,2)+" h"')));
});

test('both solar boundaries are inclusive and equal-time records keep their original order',()=>{
  const a=fixture();
  a.run('rows=[row(sunset-1,null),row(sunset,4.2),row(sunset,4.1),row(sunset+3*3600000,4),row(sunset+6*3600000,3.9),row(rise-3*3600000,3.8),row(rise,3.7),row(rise,3.6),row(rise+1,null)]');
  assert.ok(same(a).includes(a.run('fmt(-600,2)+" mV za "+fmt(12,2)+" h"')));
  a.run('rows.splice(2,0,row(sunset,null))');
  assert.match(same(a),/chybí souvislý/);
});

test('missing or nonfinite voltage inside the night invalidates it; outside values are ignored',()=>{
  const a=fixture();
  for(const bad of ['null','undefined','NaN','Infinity','-Infinity','"4.1"']) {
    a.run(`rows=regular();rows[4].voltage=${bad}`);
    assert.match(same(a),/chybí souvislý/);
    a.run(`rows=regular();rows[0].voltage=${bad};rows[8].voltage=${bad}`);
    assert.match(same(a),/Pozorovaný úsek/);
  }
});

test('three-hour gaps are allowed, larger gaps are rejected without interpolation',()=>{
  const a=fixture();
  assert.match(same(a),/Pozorovaný úsek/);
  a.run('rows=regular();rows[3].ts=new Date(+rows[3].ts+1)');
  assert.match(same(a),/chybí souvislý/);
});

test('empty, single, equal-time and out-of-window observations never invent a night result',()=>{
  const a=fixture();
  a.run('rows=[]');assert.equal(same(a),'Noční úsek není dostupný.');
  for(const expression of [
    '[row(rise+1,4)]',
    '[row(sunset,4),row(rise+1,4)]',
    '[row(sunset,4),row(sunset,3),row(rise+1,4)]',
    '[row(sunset-1,4),row(rise+1,4)]'
  ]) {
    a.run(`rows=${expression}`);assert.match(same(a),/chybí souvislý/);
  }
});

test('missing location/events and the pre-sunrise fallback retain existing messages and selection',()=>{
  const a=fixture();
  for(const expression of ['CFG.lat=NaN','CFG.lon=Infinity']) {
    a.run(`CFG.lat=50.08;CFG.lon=14.42;${expression}`);
    assert.equal(same(a),'Noční úsek není dostupný.');
  }
  a.run('CFG.lat=50.08;CFG.lon=14.42;rows=regular().map(r=>row(+r.ts-86400000,r.voltage));rows.push(row(rise-1,9))');
  assert.match(same(a),/Pozorovaný úsek/);
  a.run('calcSunTimes=()=>({rise:null,set:null})');
  assert.equal(same(a),'Poslední dokončená noc není v rozsahu doložená.');
});

test('bounded search reads only the selected night and logarithmic boundaries in 250k history',()=>{
  const a=fixture();
  a.run(`rows=Array.from({length:250000},(_,i)=>row(rise+6*3600000-(249999-i)*300000,4-i*1e-7));
    globalThis.original=rows;globalThis.expected=linearNight(rows);
    globalThis.inNight=rows.filter(r=>+r.ts>=sunset&&+r.ts<=rise).length;
    globalThis.reads=0;rows=new Proxy(rows,{get(target,key,receiver){if(typeof key==='string'&&/^\\d+$/.test(key))reads++;return Reflect.get(target,key,receiver)}});
    globalThis.actual=analyticsNight(rows);`);
  assert.equal(a.run('actual'),a.run('expected'));
  assert.ok(a.run('reads<=inNight+2*Math.ceil(Math.log2(original.length))+1'));
  assert.ok(a.run('reads<200'));
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,0);
});

test('dense overnight histories retain every original observation and do not mutate data or configuration',()=>{
  const a=fixture();
  a.run(`rows=Array.from({length:20000},(_,i)=>Object.freeze(row(rise-2000000+i*100,4+i*1e-7)));
    rows.push(Object.freeze(row(rise+1,4)));Object.freeze(rows);
    globalThis.before=JSON.stringify({rows,lat:CFG.lat,lon:CFG.lon});`);
  assert.match(same(a),/Pozorovaný úsek/);
  assert.equal(a.run('JSON.stringify({rows,lat:CFG.lat,lon:CFG.lon})===before'),true);
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,0);
});

test('sorted irregular histories with duplicates and missing values agree with the linear reference',()=>{
  const a=fixture();
  a.run(`globalThis.seed=53779;globalThis.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
  for(let i=0;i<100;i++) {
    a.run(`rows=Array.from({length:500},()=>row(sunset+Math.floor(random()*144)*15*60000-6*3600000,random()<.01?null:random()*4));
      rows.sort((a,b)=>a.ts-b.ts);rows.push(row(rise+6*3600000,4));`);
    same(a);
  }
});

test('actual astronomy and elapsed time remain identical across Prague DST and other browser zones',()=>{
  const script=`const {app}=require('./tests/helpers/app');const a=app();
    a.run('globalThis.linearNight='+${JSON.stringify(linearNight.toString())});
    a.run('CFG.lat=50.08;CFG.lon=14.42');
    for(const date of ['2026-03-29T12:00:00+02:00','2026-10-25T12:00:00+01:00']){
      a.run('globalThis.last=Date.parse('+JSON.stringify(date)+');globalThis.rows=Array.from({length:201},(_,i)=>({ts:new Date(last-(200-i)*15*60000),voltage:4-i*.0001}))');
      require('node:assert/strict').equal(a.run('analyticsNight(rows)'),a.run('linearNight(rows)'));
      require('node:assert/strict').match(a.run('analyticsNight(rows)'),/Pozorovaný úsek/);
    }`;
  for(const TZ of ['Europe/Prague','UTC','America/New_York'])
    execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ},stdio:'pipe'});
});
