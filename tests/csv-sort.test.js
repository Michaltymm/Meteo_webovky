const assert=require('node:assert/strict');
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {app}=require('./helpers/app');

// Capture actual parsed objects immediately before the native sort. Compare
// the complete result with the original comparator and retain object identity.
const capture=`globalThis.beforeSort=[];globalThis.expected=[];
  globalThis.nativeSort=Array.prototype.sort;
  Array.prototype.sort=function(comparator){
    if(this.length&&this[0]?.ts instanceof Date){
      beforeSort=this.slice();expected=nativeSort.call(this.slice(),(a,b)=>b.ts-a.ts);
      for(const row of this){Object.freeze(row);Object.freeze(row.ts);}
    }
    return nativeSort.call(this,comparator);
  };
  globalThis.header='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka';
  globalThis.line=(date,time,id)=>date+','+time+','+id+',1010,0,0,0,,0,"id'+id+'"';`;
function fixture(){const a=app();a.run(capture);return a;}
function same(a){assert.equal(a.run('result.length===expected.length && result.every((r,i)=>r===expected[i])'),true);
  assert.equal(a.run('result.every((r,i)=>i===0 || result[i-1].ts.getTime()>=r.ts.getTime())'),true);}

test('empty/single and tied records retain every original value, object and stable duplicate order',()=>{
  const a=fixture();assert.equal(a.run('parseHistoryCSV("").length'),0);
  for(const n of [1,1000]){
    a.run(`globalThis.result=parseHistoryCSV(header+'\\n'+Array.from({length:${n}},(_,i)=>line('26.10.2026','12:00',i)).join('\\n'))`);
    same(a);assert.equal(a.run('result.every((r,i)=>r.temp===i && r.note==="id"+i && r.voltage===0 && r.tank===null && r.hum===0)'),true);
  }
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,0);
});

test('ascending and descending input across distant years follows the same exact chronological order',()=>{
  const a=fixture();
  for(const reverse of [false,true]){
    a.run(`globalThis.entries=[['31.12.9999','23:59:59'],['26.10.2026','12:00'],['1.1.1970','00:00'],['31.12.1969','23:59:59'],['1.1.1900','00:00'],['1.1.1000','00:00']];
      if(${reverse})entries.reverse();globalThis.result=parseHistoryCSV(entries.map(([d,t],i)=>line(d,t,i)).join('\\n'));`);
    same(a);assert.equal(a.run('result.map(r=>r.ts.getFullYear()).join(",")'),'9999,2026,1970,1969,1900,1000');
  }
});

test('seconds and local midnight boundaries are not rounded; equivalent written times remain stable',()=>{
  const a=fixture();a.run(`globalThis.result=parseHistoryCSV([
    line('26.10.2026','00:00:01',0),line('25.10.2026','23:59:59',1),
    line('26.10.2026','00:00',2),line('26.10.2026','00:00:00',3),line('26.10.2026','00:00:02',4)
  ].join('\\n'))`);
  same(a);assert.equal(a.run('result.map(r=>r.temp).join(",")'),'4,0,2,3,1');
  assert.equal(a.run('result[0].ts-result[1].ts'),1000);
});

test('invalid timestamps are rejected before comparison without changing diagnostic counts or sensor validity',()=>{
  const a=fixture();a.run(`globalThis.report=newCSVValidation();globalThis.result=parseHistoryCSV(header+'\\n'+[
    line('31.2.2026','12:00',1),line('26.10.2026','25:00',2),line('missing','12:00',3),
    '26.10.2026,12:00,,,,,,,',line('26.10.2026','11:00',0)
  ].join('\\n'),report)`);
  same(a);assert.equal(a.run('report.accepted'),2);assert.equal(a.run('report.rejected'),3);
  assert.equal(a.run('result[0].temp'),null);assert.equal(a.run('result[1].temp'),0);
  assert.equal(a.run('report.sensors.every(s=>s.valid===1||s.empty===2)'),true);
});

test('random valid histories with time duplicates match the original comparator by row identity',()=>{
  const a=fixture();a.run('globalThis.seed=71821;globalThis.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)');
  for(let trial=0;trial<100;trial++){
    a.run(`globalThis.result=parseHistoryCSV(Array.from({length:1000},(_,i)=>{
      const d=1+Math.floor(random()*28),h=Math.floor(random()*24),m=Math.floor(random()*10)*5;
      return line(d+'.10.2026',h+':'+m,i);
    }).join('\\n'));`);same(a);
  }
});

test('local DST repetitions and timezone offsets preserve the baseline order and original rows',()=>{
  const script=`const {app}=require('./tests/helpers/app');const assert=require('node:assert/strict');const a=app();a.run(${JSON.stringify(capture)});
    for(const day of ['29.3.2026','25.10.2026','1.11.2026']){
      a.run('globalThis.result=parseHistoryCSV([line('+JSON.stringify(day)+',"03:00",0),line('+JSON.stringify(day)+',"02:30",1),line('+JSON.stringify(day)+',"01:30",2),line('+JSON.stringify(day)+',"02:30",3)].join(String.fromCharCode(10)))');
      assert.equal(a.run('result.every((r,i)=>r===expected[i])'),true);
      assert.equal(a.run('result.filter(r=>r.time==="02:30").map(r=>r.temp).join(",")'),process.env.TZ==='Europe/Prague'&&day==='29.3.2026'?'':'1,3');
    }`;
  for(const TZ of ['UTC','Europe/Prague','America/New_York'])execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ},stdio:'pipe'});
});
