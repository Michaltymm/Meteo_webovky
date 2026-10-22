const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { app } = require('./helpers/app');

const json = (a, source) => JSON.parse(a.run(`JSON.stringify(${source})`));
const close = (actual, expected, tolerance=1e-10) => assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} != ${expected}`);
function relationship(pairs) {
  const n=pairs.length, t=pairs.reduce((s,p)=>s+p[0],0)/n, v=pairs.reduce((s,p)=>s+p[1],0)/n;
  let tt=0,vv=0,tv=0;
  for(const [x,y] of pairs){tt+=(x-t)**2;vv+=(y-v)**2;tv+=(x-t)*(y-v);}
  return {count:n,r:tv/Math.sqrt(tt)/Math.sqrt(vv),slope:tv/tt};
}

test('shared pure history parser retains numeric zeros, optional sensors, multiline notes and stable duplicate order',()=>{
  const a=app();
  const csv='\uFEFFDatum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka\r\n'+
    '22.10.2026,12:00:00,0,0,0,0,0,,0,"prvni, radek\n""citace"""\r\n'+
    '22.10.2026,12:00:00,20.123456789,1010,50,0,0,,4.125V,druhy\r\n'+
    '21.10.2026,11:00:00,,1001,,0,0,,,treti\r\n'+
    '31.2.2026,12:00:00,99,1000,50,0,0,,4,neplatne';
  a.run('store.rows=[{ts:new Date(2026,9,1),temp:777}];globalThis.before=store.rows;globalThis.snapshot=dataAggregates()');
  a.run(`globalThis.parsed=parseHistoryCSV(${JSON.stringify(csv)})`);
  assert.equal(a.run('parsed.length'),3);
  assert.equal(a.run('parsed[0].temp'),0);assert.equal(a.run('parsed[0].hum'),0);
  assert.equal(a.run('parsed[0].pressure'),0);assert.equal(a.run('parsed[0].voltage'),0);
  assert.equal(a.run('parsed[0].note'),'prvni, radek\n"citace"');
  assert.equal(a.run('parsed[1].temp'),20.123456789);assert.equal(a.run('parsed[1].voltage'),4.125);
  assert.equal(a.run('parsed[2].temp'),null);assert.equal(a.run('parsed[2].hum'),null);
  assert.equal(a.run('parsed[2].voltage'),null);
  assert.equal(a.run('store.rows===before && dataAggregates()===snapshot'),true);
  assert.equal(a.requests.length,0);
});

test('shared history parser sorts descending without fabricating invalid values or timestamps',()=>{
  const a=app();
  a.run(`globalThis.parsed=parseHistoryCSV('Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n21.10.2026,10:00,Infinity,1000,50,0,0,,NaN\\n22.10.2026,10:00,0,1000,50,0,0,,4\\n22.10.2026,25:00,999,1000,50,0,0,,4')`);
  assert.equal(a.run('parsed.length'),2);assert.equal(a.run('parsed[0].temp'),0);
  assert.equal(a.run('parsed[1].temp'),null);assert.equal(a.run('parsed[1].voltage'),null);
  assert.equal(a.run('parsed[0].ts>parsed[1].ts'),true);
  assert.equal(a.run('parseHistoryCSV("<html>error</html>").length'),0);
  assert.throws(()=>a.run('parseHistoryCSV(\'Datum,Cas\\n"unclosed\')'),/CSV/);
});

test('preset analytics ranges are anchored to the newest actual measurement',()=>{
  const a=app();
  a.run(`globalThis.latest=+new Date(2026,9,22,12);globalThis.oldest=+new Date(2024,0,1);
    globalThis.rows=[{ts:new Date(latest)},{ts:new Date(oldest)}]`);
  for(const [range,days] of [['24h',1],['7',7],['30',30],['90',90],['365',365]]) {
    const actual=json(a,`analyticsRange(rows,${JSON.stringify(range)})`);
    assert.equal(actual.to,a.run('latest'));
    assert.equal(actual.from,a.run('latest')-days*86400000);
  }
  const all=json(a,'analyticsRange(rows,"all")');
  assert.equal(all.to,a.run('latest'));assert.ok(all.from<=a.run('oldest'));
});

test('custom analytics ranges include the complete local end date and reject invalid intervals',()=>{
  const a=app();
  const actual=json(a,'analyticsRange([],"custom","2026-10-20","2026-10-22")');
  assert.equal(actual.from,a.run('+new Date(2026,9,20)'));
  assert.equal(actual.to,a.run('+new Date(2026,9,23)-1'));
  for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-10-22','2026-10-20'],['','2026-10-22'],['2026-10-20','']])
    assert.equal(a.run(`analyticsRange([],'custom',${JSON.stringify(from)},${JSON.stringify(to)})`),null);
});

test('an empty analytics summary has no invented metric, relation, day or rate',()=>{
  const a=app();a.run('globalThis.result=analyticsSummarize([])');
  assert.equal(a.run('result.count'),0);
  for(const metric of ['temp','hum','pressure','voltage'])
    assert.deepEqual(json(a,`result.stats.${metric}`),{count:0,min:null,max:null,avg:null});
  assert.equal(a.run('result.pair.count'),0);assert.equal(a.run('result.pair.r'),null);assert.equal(a.run('result.pair.slope'),null);
  assert.deepEqual(json(a,'result.days'),[]);assert.deepEqual(json(a,'result.rates'),[]);
});

test('full analytics statistics keep independent sensor validity, zeros and duplicate records',()=>{
  const a=app();
  a.run(`globalThis.rows=[
    {ts:new Date(2026,9,22,0),temp:0,hum:null,pressure:0,voltage:0},
    {ts:new Date(2026,9,22,1),temp:10,hum:0,pressure:1000,voltage:null},
    {ts:new Date(2026,9,22,1),temp:null,hum:50,pressure:Infinity,voltage:4},
    {ts:new Date(2026,9,22,2),temp:20,hum:NaN,pressure:null,voltage:8},
    {ts:new Date(2026,9,22,3),temp:-5,hum:100,pressure:1005,voltage:2}
  ];globalThis.result=analyticsSummarize(rows)`);
  const stats=json(a,'result.stats');
  assert.equal(a.run('result.count'),5);
  assert.deepEqual(stats.temp,{count:4,min:-5,max:20,avg:6.25});
  assert.deepEqual(stats.hum,{count:3,min:0,max:100,avg:50});
  assert.deepEqual(stats.pressure,{count:3,min:0,max:1005,avg:2005/3});
  assert.deepEqual(stats.voltage,{count:4,min:0,max:8,avg:3.5});
  const expected=relationship([[0,0],[20,8],[-5,2]]),pair=json(a,'result.pair');
  assert.equal(pair.count,expected.count);close(pair.r,expected.r);close(pair.slope,expected.slope);
});

test('correlation uses original same-row pairs and is unavailable for insufficient or constant data',()=>{
  const a=app();
  for(const expression of [
    '[{temp:0,voltage:0},{temp:10,voltage:2}]',
    '[{temp:0,voltage:0},{temp:0,voltage:1},{temp:0,voltage:2}]',
    '[{temp:0,voltage:4},{temp:1,voltage:4},{temp:2,voltage:4}]',
    '[{temp:0,voltage:null},{temp:null,voltage:4},{temp:1,voltage:null}]'
  ]) {
    a.run(`globalThis.result=analyticsSummarize(${expression}.map((r,i)=>({...r,ts:new Date(2026,9,22,i)})))`);
    assert.equal(a.run('result.pair.r'),null);assert.equal(a.run('result.pair.slope'),null);
  }
  a.run(`globalThis.result=analyticsSummarize([0,1,2,3].map(temp=>({ts:new Date(2026,9,22,12),temp,voltage:4-temp/10})))`);
  assert.equal(a.run('result.pair.count'),4);close(a.run('result.pair.r'),-1);close(a.run('result.pair.slope'),-.1);
});

test('daily temperature and voltage extrema use full local-day rows, including a day with no valid temperature',()=>{
  const a=app();
  a.run(`globalThis.result=analyticsSummarize([
    {ts:new Date(2026,9,21,0),temp:0,voltage:4},
    {ts:new Date(2026,9,21,23,59),temp:20,voltage:0},
    {ts:new Date(2026,9,22,0),temp:null,voltage:3.5},
    {ts:new Date(2026,9,22,1),temp:NaN,voltage:null}
  ])`);
  const days=json(a,'result.days'),first=days.find(d=>d.key==='2026-10-21'),second=days.find(d=>d.key==='2026-10-22');
  assert.ok(first&&second);assert.equal(days.length,2);
  assert.equal(first.min,0);assert.equal(first.max,20);assert.equal(first.temp,10);assert.equal(first.count,2);
  assert.equal(first.voltageMin,0);assert.equal(first.voltageMax,4);
  assert.equal(second.count,0);assert.equal(second.min,null);assert.equal(second.max,null);assert.equal(second.temp,null);
  assert.equal(second.voltageMin,3.5);assert.equal(second.voltageMax,3.5);
});

test('voltage rates use elapsed real time and do not bridge duplicates, missing values or gaps over three hours',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.result=analyticsSummarize([
    [0,4],[1,4.1],[1,4.2],[2,4.3],[2.5,null],[3,4.5],[6,4.8],[9+1/3600,5],[10,Infinity],[11,5.5]
  ].map(([h,voltage])=>({ts:new Date(origin+h*3600000),voltage})))`);
  const finite=json(a,'result.rates.filter(r=>Number.isFinite(r.y))');
  assert.equal(finite.length,3);
  const expected=[[0,1],[1,2],[3,6]];
  finite.forEach((rate,i)=>{
    close(rate.y,100,1e-8);
    assert.equal(rate.from,a.run('origin')+expected[i][0]*3600000);
    assert.equal(rate.x,a.run('origin')+expected[i][1]*3600000);
  });
});

test('large-history statistics remain exact while visual rates and time series preserve extrema within their limits',()=>{
  const a=app();
  a.run(`globalThis.rows=Array.from({length:10000},(_,i)=>({ts:new Date(+new Date(2026,9,1)+i*1000),
    temp:i,voltage:i===4321?7:4+i*.00001}));
    globalThis.result=analyticsSummarize(rows);globalThis.visual=sampleExtrema(rows,[r=>r.temp,r=>r.voltage],600)`);
  assert.equal(a.run('result.stats.temp.count'),10000);assert.equal(a.run('result.stats.temp.avg'),4999.5);
  assert.equal(a.run('result.stats.temp.min'),0);assert.equal(a.run('result.stats.temp.max'),9999);
  assert.equal(a.run('result.pair.count'),10000);
  assert.ok(a.run('result.rates.length<=600'));
  assert.ok(a.run('visual.length<=600'));
  assert.equal(a.run('visual.includes(rows[4321])'),true);
  const actual=json(a,'result.rates.filter(r=>Number.isFinite(r.y)).map(r=>r.y)');
  const expected=json(a,'rows.slice(1).map((r,i)=>(r.voltage-rows[i].voltage)*3600000000/(r.ts-rows[i].ts))');
  close(Math.min(...actual),Math.min(...expected),1e-8);close(Math.max(...actual),Math.max(...expected),1e-8);
});

test('station alignment matches nearest eligible samples one-to-one with signed deltas and reported time offsets',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.a=[
    [0,10],[10,20],[20,30],[30,null],[40,50]
  ].map(([m,temp])=>({ts:new Date(origin+m*60000),temp}));
  globalThis.b=[[1,7],[11,18],[60,9]].map(([m,temp])=>({ts:new Date(origin+m*60000),temp}));
  globalThis.result=analyticsAlign(a,b,2*60000)`);
  const result=json(a,'result');
  assert.equal(result.count,2);assert.equal(result.unmatchedA,2);assert.equal(result.unmatchedB,1);
  assert.equal(result.maxOffsetMs,60000);assert.equal(result.deltaAvg,2.5);assert.equal(result.deltaMin,2);assert.equal(result.deltaMax,3);
});

test('station matching includes the tolerance boundary, breaks equal-distance ties toward the earlier sample and never reuses a duplicate',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.result=analyticsAlign(
    [{ts:new Date(origin+60000),temp:10}],
    [{ts:new Date(origin),temp:3},{ts:new Date(origin+120000),temp:8}],60000)`);
  assert.equal(a.run('result.count'),1);assert.equal(a.run('result.deltaAvg'),7);
  assert.equal(a.run('result.unmatchedB'),1);assert.equal(a.run('result.maxOffsetMs'),60000);
  a.run(`globalThis.result=analyticsAlign(
    [{ts:new Date(origin),temp:10},{ts:new Date(origin),temp:20},{ts:new Date(origin),temp:30}],
    [{ts:new Date(origin),temp:1},{ts:new Date(origin),temp:2}],0)`);
  assert.equal(a.run('result.count'),2);assert.equal(a.run('result.unmatchedA'),1);
  assert.equal(a.run('result.unmatchedB'),0);assert.equal(a.run('result.deltaAvg'),13.5);
});

test('nearest station matching looks past earlier duplicate timestamps without consuming the wrong original row',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.result=analyticsAlign(
    [{ts:new Date(origin+10),temp:10}],
    [{ts:new Date(origin),temp:1},{ts:new Date(origin),temp:2},{ts:new Date(origin+9),temp:7},{ts:new Date(origin+9),temp:8}],10)`);
  assert.equal(a.run('result.count'),1);assert.equal(a.run('result.deltaAvg'),3);
  assert.equal(a.run('result.maxOffsetMs'),1);assert.equal(a.run('result.unmatchedB'),3);
});

test('bad timestamps break voltage-rate continuity and are excluded from summaries and station matching',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.rows=[
    {ts:new Date(origin),temp:10,voltage:4},
    {ts:new Date(NaN),temp:999,voltage:999},
    {ts:new Date(origin+3600000),temp:20,voltage:5}
  ];globalThis.result=analyticsSummarize(rows)`);
  assert.equal(a.run('result.count'),2);assert.equal(a.run('result.stats.temp.count'),2);
  assert.equal(a.run('result.stats.temp.avg'),15);assert.equal(a.run('result.pair.count'),2);
  assert.equal(a.run('result.rates.filter(r=>Number.isFinite(r.y)).length'),0);
  a.run('globalThis.aligned=analyticsAlign(rows,[{ts:new Date(origin),temp:0},{ts:new Date(NaN),temp:111}],0)');
  assert.equal(a.run('aligned.count'),1);assert.equal(a.run('aligned.unmatchedA'),1);
  assert.equal(a.run('aligned.unmatchedB'),0);assert.equal(a.run('aligned.deltaAvg'),10);
});

test('pure analytics transformations do not mutate source rows or replace the active station snapshot',()=>{
  const a=app();
  a.run(`store.rows=[{ts:new Date(2026,9,20),temp:55}];globalThis.activeRows=store.rows;globalThis.snapshot=dataAggregates();
    globalThis.rows=Object.freeze([0,1,2].map(i=>Object.freeze({ts:new Date(2026,9,22,i),temp:i,voltage:4+i/10})));
    globalThis.before=JSON.stringify(rows);
    analyticsSummarize(rows);analyticsCompact(rows);analyticsAlign(rows,rows,0);analyticsRange(rows,'24h')`);
  assert.equal(a.run('JSON.stringify(rows)===before'),true);
  assert.equal(a.run('store.rows===activeRows && dataAggregates()===snapshot'),true);
  assert.equal(a.requests.length,0);
});

test('empty or disjoint station data cannot fabricate a difference',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.result=analyticsAlign(
    [{ts:new Date(origin),temp:0},{ts:new Date(origin),temp:null}],
    [{ts:new Date(origin+3600000),temp:0}],1000)`);
  assert.equal(a.run('result.count'),0);assert.equal(a.run('result.unmatchedA'),1);assert.equal(a.run('result.unmatchedB'),1);
  for(const key of ['deltaAvg','deltaMin','deltaMax'])assert.equal(a.run(`result.${key}`),null);
  a.run('globalThis.result=analyticsAlign([],[],600000)');assert.equal(a.run('result.count'),0);
});

test('station matching agrees with an independent monotone nearest-candidate oracle across duplicate-heavy histories',()=>{
  const a=app();
  assert.equal(a.run(`(()=>{
    let seed=73817;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const origin=+new Date(2026,9,22);
    for(let trial=0;trial<400;trial++){
      const rows=()=>Array.from({length:Math.floor(random()*25)},()=>({ts:new Date(origin+Math.floor(random()*12)*1000),temp:Math.floor(random()*80)-20})).sort((a,b)=>a.ts-b.ts);
      const aa=rows(),bb=rows(),tolerance=Math.floor(random()*5)*1000;
      let cursor=0;const pairs=[];
      for(const row of aa){
        let winner=-1,distance=Infinity;
        for(let i=cursor;i<bb.length;i++){
          const delta=Math.abs(bb[i].ts-row.ts);
          if(delta<=tolerance&&delta<distance){winner=i;distance=delta;}
        }
        if(winner>=0){pairs.push({delta:row.temp-bb[winner].temp,offset:distance});cursor=winner+1;}
      }
      const expected={count:pairs.length,unmatchedA:aa.length-pairs.length,unmatchedB:bb.length-pairs.length,
        maxOffsetMs:pairs.length?Math.max(...pairs.map(p=>p.offset)):0,
        deltaAvg:pairs.length?pairs.reduce((s,p)=>s+p.delta,0)/pairs.length:null,
        deltaMin:pairs.length?Math.min(...pairs.map(p=>p.delta)):null,
        deltaMax:pairs.length?Math.max(...pairs.map(p=>p.delta)):null};
      const actual=analyticsAlign(aa,bb,tolerance);
      if(Object.keys(expected).some(key=>actual[key]!==expected[key]))return false;
    }
    return true;
  })()`),true);
});

test('compact comparison storage retains exact finite temperature/timestamp pairs without mutating input or retaining raw rows',()=>{
  const a=app();
  a.run(`globalThis.origin=+new Date(2026,9,22);globalThis.rows=[
    {ts:new Date(origin+1000),temp:0,hum:90,note:'unneeded'},
    {ts:new Date(origin),temp:12.123456789},
    {ts:new Date(origin),temp:13.987654321},
    {ts:new Date(origin-1000),temp:null},
    {ts:new Date(NaN),temp:50},
    {ts:new Date(origin-2000),temp:Infinity}
  ];globalThis.before=JSON.stringify(rows);globalThis.result=analyticsCompact(rows)`);
  assert.equal(a.run('result.count'),3);assert.equal(a.run('result.bytes'),48);
  assert.equal(a.run('result.times instanceof Float64Array && result.temps instanceof Float64Array'),true);
  assert.deepEqual(json(a,'Array.from(result.times)'),[a.run('origin')+1000,a.run('origin'),a.run('origin')]);
  assert.deepEqual(json(a,'Array.from(result.temps)'),[0,12.123456789,13.987654321]);
  assert.equal(a.run('JSON.stringify(rows)===before'),true);
  assert.equal(a.run('Object.hasOwn(result,"rows")'),false);
  a.run('rows[0].temp=999');assert.equal(a.run('result.temps[0]'),0);
  a.run('globalThis.empty=analyticsCompact([])');assert.equal(a.run('empty.count'),0);assert.equal(a.run('empty.bytes'),0);
});

for(const [zone,day,duration] of [
  ['Europe/Prague','2026-03-29',23],['Europe/Prague','2026-10-25',25],
  ['Australia/Lord_Howe','2026-04-05',24.5],['Australia/Lord_Howe','2026-10-04',23.5]
]) {
  test(`custom analytics date range follows ${duration} actual hours in ${zone} on ${day}`,()=>{
    execFileSync(process.execPath,['-e',`
      const assert=require('node:assert/strict'),{app}=require('./tests/helpers/app');const a=app();
      const range=JSON.parse(a.run('JSON.stringify(analyticsRange([],"custom",'+JSON.stringify(${JSON.stringify(day)})+','+JSON.stringify(${JSON.stringify(day)})+'))'));
      assert.equal((range.to+1-range.from)/3600000,${duration});
    `],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:zone},stdio:'pipe'});
  });
}
