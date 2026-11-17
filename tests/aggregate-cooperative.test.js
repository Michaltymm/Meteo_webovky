const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
function ready(){
 const a=app({realRefresh:true});
 a.run(`CFG.source='sheets';globalThis.ctx=stationContext();globalThis.timing=newSheetsTiming('full');
 globalThis.old=[{ts:new Date(1700000000000),temp:-99,hum:0}];store.rows=old;globalThis.previous=dataAggregates();
 globalThis.rows=Array.from({length:12000},(_,i)=>({ts:new Date(1700000000000-i*1000),temp:i%13===0?null:i%37,hum:0,pressure:1000,rain:0,voltage:0}));
 analyticsWorkSlice=steps=>{const step=steps.next();return step.done?step:null;};`);
 return a;
}
async function drain(a,done){for(let i=0;!done();i++){assert.ok(i<1000);a.tick(0);await Promise.resolve();}}
test('private aggregate snapshot yields and retains exact source, ties, sums and zero values',async()=>{
 const a=ready();let result;
 a.run('aggregateSnapshotAsync(rows,ctx,timing)').then(r=>result=r);
 a.tick(0);assert.equal(a.run('aggregateCache===previous && store.rows===old'),true);
 await drain(a,()=>!!result);
 assert.equal(result.length,12000);assert.equal(result.source,a.run('rows'));
 assert.equal(a.run('aggregateCache===previous'),true);
 assert.equal(result.temperature.min,0);assert.equal(result.temperature.max,36);
 const original=a.run('rows');const valid=Array.from(original).filter(r=>Number.isFinite(r.temp));
 assert.equal(result.temperature.count,valid.length);
 assert.equal(result.temperature.minRow,valid.find(r=>r.temp===0));
 assert.equal(result.temperature.minTies,valid.filter(r=>r.temp===0).length);
 assert.equal([...result.days.values()].reduce((sum,d)=>sum+d.ts,0),valid.reduce((sum,r)=>sum+r.temp,0));
 assert.equal(result.temperature.maxRow,valid.find(r=>r.temp===36));
 assert.equal(result.temperature.minIndex,original.indexOf(result.temperature.minRow));
 assert.equal(a.run('timing.aggregate.runs'),1);assert.equal(a.run('timing.aggregate.ms'),null);
});
test('abort before and between slices leaves old source/cache untouched and removes timers',async()=>{
 for(const midway of [false,true]){
 const a=ready();const p=a.run('aggregateSnapshotAsync(rows,ctx,timing)');
 if(midway)a.tick(0);
 a.run('cancelStationWork()');assert.equal(await p,null);assert.equal(a.timers.size,0);
 assert.equal(a.run('store.rows===old && aggregateCache===previous'),true);
 }
});
test('large Sheets commit publishes prepared cache and data atomically after all slices',async()=>{
 const a=ready();a.run('parseHistoryCSV=()=>rows');let done=false;
 const p=a.run('parseAndStore("controlled",ctx,"full",timing)').then(v=>{done=true;return v});
 a.tick(10);await Promise.resolve();a.tick(0);
 assert.equal(a.run('store.rows===old && aggregateCache===previous'),true);
 await drain(a,()=>done);assert.equal(await p,true);
 assert.equal(a.run('store.rows===rows && aggregateCache.source===rows && dataAggregates()===aggregateCache'),true);
 assert.equal(a.run('dataAggregates().temperature.count'),a.run('rows.filter(r=>Number.isFinite(r.temp)).length'));
});
test('switch during aggregate preparation cannot publish stale measurements or cache',async()=>{
 const a=ready();a.run('parseHistoryCSV=()=>rows');
 const p=a.run('parseAndStore("controlled",ctx,"full",timing)');a.tick(10);await Promise.resolve();a.tick(0);
 a.run('switchStation(1)');assert.equal(await p,false);
 assert.equal(a.run('store.rows.length'),0);assert.equal(a.run('aggregateCache'),null);
});
test('failure during aggregate preparation preserves old complete data and rejects cleanly',async()=>{
 const a=ready();a.run('parseHistoryCSV=()=>rows;analyticsWorkSlice=()=>{throw Error("controlled") }');
 const p=a.run('parseAndStore("controlled",ctx,"full",timing)');a.tick(10);await Promise.resolve();a.tick(0);
 await assert.rejects(p,/controlled/);assert.equal(a.run('store.rows===old && aggregateCache===previous'),true);
 assert.equal(a.timers.size,0);
});
test('local midnight rejects a prepared today snapshot, retaining the existing cache miss contract',async()=>{
 const a=ready();a.run('parseHistoryCSV=()=>rows');let done=false;
 const p=a.run('parseAndStore("controlled",ctx,"full",timing)').then(v=>{done=true;return v});
 a.tick(10);await Promise.resolve();a.tick(0);
 a.run(`globalThis.todayKey=localDateKey;localDateKey=(...args)=>args.length?todayKey(...args):'2026-11-18'`);
 await drain(a,()=>done);assert.equal(await p,true);
 assert.equal(a.run('aggregateCache.dayKey'), '2026-11-18');
});

test('small history, untimed direct parse and combined sources keep their synchronous aggregate API',async()=>{
 for(const setup of ["rows=rows.slice(0,20)","CFG.source='both';ctx=stationContext()","timing=null"]){
  const a=ready();a.run(`${setup};parseHistoryCSV=()=>rows;aggregateSnapshotAsync=()=>{throw Error('unexpected async aggregation')}`);
  const p=a.run('parseAndStore("controlled",ctx,"full",timing)');a.tick(10);
  assert.equal(await p,true);assert.equal(a.run('dataAggregates().source===store.rows'),true);
 }
});
test('aggregate timing accumulates repeated attempts and reports unavailable clocks honestly',async()=>{
 const a=ready();
 for(let i=0;i<2;i++){
  let done=false;const p=a.run('aggregateSnapshotAsync(rows,ctx,timing)').then(()=>done=true);
  await drain(a,()=>done);await p;
 }
 assert.equal(a.run('timing.aggregate.runs'),2);assert.equal(a.run('timing.aggregate.ms'),null);
});
