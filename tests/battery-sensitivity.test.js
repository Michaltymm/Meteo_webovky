const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const key = time => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const close = (a,b,tolerance=1e-10) => assert.ok(Math.abs(a-b)<=tolerance, `${a} != ${b}`);
// Independent two-pass reference, recomputing original pairs for each omission.
function relationship(rows) {
  if (rows.length < 3) return null;
  const mt=rows.reduce((s,r)=>s+r.temp,0)/rows.length;
  const mv=rows.reduce((s,r)=>s+r.voltage,0)/rows.length;
  let tt=0,vv=0,tv=0;
  for (const r of rows) { const t=r.temp-mt,v=r.voltage-mv;tt+=t*t;vv+=v*v;tv+=t*v; }
  if (!tt || !vv) return null;
  return {r:tv/Math.sqrt(tt*vv),slope:tv/tt};
}
function install(a, rows) {
  a.run(`store.rows=${JSON.stringify(rows)}.map(r=>({...r,ts:new Date(r.ts)})).sort((a,b)=>b.ts-a.ts);invalidateDerivedData();`);
}
const fixture = (days=8) => Array.from({length:days*20},(_,i)=>({
  ts:+new Date(2026,9,21-Math.floor(i/20),12,i%20),
  temp:12+Math.sin(i/11)*8,voltage:4+.03*Math.sin(i/9)-i/20000
}));
function verifyReference(a, rows, tolerance=1e-10) {
  const pairs=rows.filter(r=>Number.isFinite(r.temp)&&Number.isFinite(r.voltage));
  const days=[...new Set(pairs.map(r=>key(r.ts)))].sort().reverse();
  const full=relationship(pairs);
  const refs=days.map(day=>({day,...relationship(pairs.filter(r=>key(r.ts)!==day))}));
  const valid=refs.filter(r=>r.r!==undefined);
  const result=JSON.parse(a.run('JSON.stringify(batteryAnalysis("all").sensitivity)'));
  assert.equal(result.status,'ok');
  assert.equal(result.totalDays,days.length);
  assert.equal(result.validDays,valid.length);
  assert.equal(result.unavailableDays,days.length-valid.length);
  if (!valid.length) return result;
  for (const [field,ref] of [['minR',Math.min(...valid.map(r=>r.r))],['maxR',Math.max(...valid.map(r=>r.r))],
    ['minSlope',Math.min(...valid.map(r=>r.slope))],['maxSlope',Math.max(...valid.map(r=>r.slope))]]) close(result[field],ref,tolerance);
  for (const [field,metric] of [['byR','r'],['bySlope','slope']]) {
    const expected=valid.reduce((best,r)=>Math.abs(r[metric]-full[metric])>Math.abs(best[metric]-full[metric])?r:best);
    // Floating point ties in an exactly linear fixture are not a robust ranking.
    close(Math.abs(result[field][metric]-full[metric]),Math.abs(expected[metric]-full[metric]),tolerance);
    const dayRef=valid.find(r=>r.day===result[field].day);
    close(result[field].r,dayRef.r,tolerance);close(result[field].slope,dayRef.slope,tolerance);
    assert.equal(result[field].count,pairs.filter(r=>key(r.ts)!==dayRef.day).length);
    assert.equal(result[field].omittedCount,pairs.filter(r=>key(r.ts)===dayRef.day).length);
  }
  return result;
}

test('daily omission agrees with repeated independent full-data calculations, not plot representatives',()=>{
  const a=app(),rows=fixture(40);
  install(a,rows);verifyReference(a,rows);
  assert.ok(a.run('batteryAnalysis("all").xy.length')<rows.length);
  assert.equal(a.run('batteryAnalysis("all").count'),rows.length);
});

test('linear positive and negative relations remain linear after each day omission',()=>{
  for (const sign of [1,-1]) {
    const a=app(),rows=fixture().map((r,i)=>({...r,temp:i/10,voltage:4+sign*i/1000}));
    install(a,rows);const s=verifyReference(a,rows);
    close(s.minR,sign);close(s.maxR,sign);close(s.minSlope,sign*.01);close(s.maxSlope,sign*.01);
  }
});

test('a single influential pair and a whole shifted day are identified without deleting originals',()=>{
  for (const wholeDay of [false,true]) {
    const a=app(),rows=fixture();
    const influential=key(rows[0].ts);
    rows.forEach((r,i)=>{ if (wholeDay?key(r.ts)===influential:i===0) {r.temp=70+i/100;r.voltage=6+i/1000;} });
    install(a,rows);const s=verifyReference(a,rows);
    assert.equal(s.byR.day,influential);assert.equal(s.bySlope.day,influential);
    assert.equal(a.run('store.rows.length'),rows.length);
    assert.ok(a.run('batteryAnalysis("all").maxT')>=70);
  }
});

test('constant remainder and insufficient remaining pairs stay explicitly unavailable',()=>{
  const a=app(),rows=fixture(3).map((r,i)=>({...r,temp:i<20?i:20,voltage:i<20?4+i/100:4}));
  install(a,rows);const s=verifyReference(a,rows);
  assert.equal(s.unavailableDays,1);assert.equal(s.undefinedDay.day,key(rows[0].ts));
  const three=fixture(3).filter((_,i)=>i%20===0);
  install(a,three);const t=verifyReference(a,three);
  assert.equal(t.validDays,0);assert.equal(t.unavailableDays,3);
  a.run('el("batteryRange").value="all";buildBatteryAnalysis()');
  assert.match(a.nodes.get('batterySensitivityValue').textContent,/0 dostupných výsledků z 3; 3 nedostupných/);
  assert.equal(a.nodes.get('batteryRDay').hidden,true);
  assert.equal(a.nodes.get('batteryUndefinedDay').hidden,false);
});

test('fewer than three paired days and an unavailable full relationship cannot imply stability',()=>{
  const a=app();
  for(const days of [0,1,2]) {
    install(a,fixture(days));assert.equal(a.run('batteryAnalysis("all").sensitivity.status'),'days');
  }
  install(a,fixture(5).map(r=>({...r,voltage:0})));
  assert.equal(a.run('batteryAnalysis("all").sensitivity.status'),'relationship');
  a.run('el("batteryRange").value="all";buildBatteryAnalysis()');
  assert.match(a.nodes.get('batterySensitivityValue').textContent,/plný vztah není dostupný/);
  assert.equal(a.nodes.get('batterySlopeDay').hidden,true);
});

test('missing sensors, real zero and duplicate timestamps retain the original pairing contract',()=>{
  const a=app(),rows=fixture(8);
  rows[0].voltage=0;rows[1].temp=0;rows[2].temp=null;rows[3].voltage=null;
  rows.push({...rows[0]});rows.push({ts:+new Date(2026,8,1),temp:10,voltage:null});
  install(a,rows);const s=verifyReference(a,rows);
  assert.equal(s.totalDays,8);assert.equal(a.run('batteryAnalysis("all").count'),rows.length-3);
});

test('centred daily merges retain small variation on large offsets',()=>{
  const a=app(),rows=fixture(10).map((r,i)=>({...r,temp:1e9+i*.01,voltage:4+i*.001}));
  install(a,rows);const s=verifyReference(a,rows,1e-6);
  close(s.minR,1,1e-6);close(s.minSlope,.1,1e-6);
});

test('250k history is scanned once and cached sensitivity never retains daily histories or omission arrays',()=>{
  const a=app();
  a.run(`globalThis.visits=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(+new Date(2026,9,21,12)-i*300000),temp:Math.sin(i/33),voltage:4+Math.cos(i/77)/100
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))visits++;return Reflect.get(target,key,receiver)}});
  dataAggregates();globalThis.start=visits;globalThis.first=batteryAnalysis('all');globalThis.after=visits;`);
  assert.ok(a.run('after-start')<=250002);
  assert.equal(a.run('first.sensitivity.totalDays'),a.run('first.days'));
  assert.equal(a.run('first.sensitivity.validDays'),a.run('first.days'));
  assert.ok(a.run('JSON.stringify(first.sensitivity).length')<1500);
  assert.equal(a.run('batteryAnalysis("all")===first'),true);
  assert.equal(a.run('visits'),a.run('after'));
  a.run('store.rows[0].temp=100;invalidateDerivedData()');
  assert.equal(a.nodes.get('batterySensitivityValue').textContent,'');
  assert.equal(a.nodes.get('batteryRDay').hidden,true);
  assert.equal(a.run('batteryAnalysis("all")===first'),false);
});

test('seven-day range uses only selected original pairs and changes of station discard prior sensitivity',()=>{
  const a=app(),rows=fixture(15);
  install(a,rows);
  const count=a.run('batteryAnalysis("7").count');
  const selected=rows.filter(r=>r.ts>=Math.max(...rows.map(r=>r.ts))-7*86400000);
  assert.equal(count,selected.length);
  const b=app();install(b,selected);verifyReference(b,selected);
  close(a.run('batteryAnalysis("7").sensitivity.minR'),b.run('batteryAnalysis("all").sensitivity.minR'));
  a.run('el("batteryRange").value="all";buildBatteryAnalysis()');
  assert.equal(a.requests.length,0);
  a.run('switchStation(1)');
  const requests=a.requests.length;
  a.run('buildBatteryAnalysis()');
  assert.equal(a.run('batteryAnalysis("all").sensitivity.totalDays'),0);
  assert.equal(a.nodes.get('batteryRDay').hidden,true);
  assert.equal(a.requests.length,requests);
});

test('newest day wins exact ties and numeric overflow never appears in the panel',()=>{
  const a=app();
  const rows=fixture(3).map((r,i)=>({...r,temp:i%20,voltage:i%20}));
  install(a,rows);
  assert.equal(a.run('batteryAnalysis("all").sensitivity.byR.day'),key(rows[0].ts));
  install(a,fixture(3).map((r,i)=>({...r,temp:(i%20)*1e-154,voltage:(i%20)*1e153})));
  a.run('el("batteryRange").value="all";buildBatteryAnalysis()');
  assert.doesNotMatch(a.nodes.get('batterySensitivityValue').textContent,/NaN|Infinity/);
});

test('a repeated DST hour belongs to the same local day and day omissions agree with raw references',()=>{
  const {execFileSync}=require('node:child_process');
  execFileSync(process.execPath,['-e',`
    const assert=require('node:assert/strict'),{app}=require('./tests/helpers/app');
    const a=app();
    a.run(\`store.rows=['2026-10-26T00:15:00+01:00','2026-10-25T02:30:00+01:00',
      '2026-10-25T02:30:00+02:00','2026-10-25T00:15:00+02:00',
      '2026-10-24T23:45:00+02:00','2026-10-23T23:45:00+02:00']
      .map((ts,i)=>({ts:new Date(ts),temp:i,voltage:4+i*i/100}));
      globalThis.s=batteryAnalysis('all');\`);
    assert.equal(a.run('s.days'),4);
    assert.equal(a.run('s.sensitivity.validDays'),4);
    assert.equal(a.run(\`(()=>{
      const days=[...new Set(store.rows.map(r=>localDateKey(r.ts)))];
      const r=[];
      for(const day of days){
        const rows=store.rows.filter(row=>localDateKey(row.ts)!==day);
        const mt=rows.reduce((n,row)=>n+row.temp,0)/rows.length;
        const mv=rows.reduce((n,row)=>n+row.voltage,0)/rows.length;
        let tv=0,tt=0,vv=0;
        for(const row of rows){tv+=(row.temp-mt)*(row.voltage-mv);tt+=(row.temp-mt)**2;vv+=(row.voltage-mv)**2;}
        r.push(tv/Math.sqrt(tt*vv));
      }
      return Math.abs(s.sensitivity.minR-Math.min(...r))<1e-12 && Math.abs(s.sensitivity.maxR-Math.max(...r))<1e-12;
    })()\`),true);
  `],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:'Europe/Prague'}});
});
