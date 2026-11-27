const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);

test('cooperative merge matches native stable numeric sort on 100 irregular histories and retains exact row identities',()=>{
 const a=app();assert.equal(a.run(`(()=>{
 let seed=82173;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 for(let trial=0;trial<100;trial++){
  const rows=Array.from({length:random()%3000},(_,i)=>Object.freeze({ts:Object.freeze(new Date((random()%31-15)*1000)),temp:i%5?i:null,note:String(i)}));
  const expected=rows.slice().sort((a,b)=>b.ts.getTime()-a.ts.getTime());
  const result=finishSteps(stableHistorySortSteps(rows));
  if(result.length!==expected.length||result.some((r,i)=>r!==expected[i]))return false;
 }return true;})()`),true);
});
test('already descending and all-equal exports keep their original array without a merge buffer',()=>{
 const a=app();for(const shape of ['0','i*1000']){
 a.run(`globalThis.rows=Array.from({length:100000},(_,i)=>({ts:new Date(1700000000000-${shape})}));
 globalThis.steps=stableHistorySortSteps(rows);globalThis.yields=0;globalThis.out;
 while(true){const step=steps.next();if(step.done){out=step.value;break;}yields++;}`);
 assert.equal(a.run('out===rows'),true);assert.ok(a.run('yields')>90);
 }
});
test('natural runs merge stably with odd counts and on both sides of the run limit', () => {
 const a = app();
 assert.equal(a.run(`[2, 3, 5, 31, 32, 33].every(count => {
   const rows = Array.from({length: count}, (_, run) =>
     Array.from({length: 269 + (run % 3)}, (_, i) =>
       Object.freeze({ts: new Date((400 - Math.floor(i / 3)) * 1000), run, i}))).flat();
   const expected = rows.slice().sort((a, b) => b.ts.getTime() - a.ts.getTime());
   const sorted = finishSteps(stableHistorySortSteps(rows));
   return sorted.length === expected.length && sorted.every((row, i) => row === expected[i]);
 })`), true);
});
test('a nearly sorted large export keeps ties and skips unnecessary merge passes', () => {
 const a = app();
 assert.equal(a.run(`(() => {
   const rows = Array.from({length: 100000}, (_, i) => ({
     ts: new Date(1700000000000 - Math.floor(i / 3) * 1000), note: String(i)
   }));
   [rows[99893], rows[99961]] = [rows[99961], rows[99893]];
   const expected = rows.slice().sort((a, b) => b.ts.getTime() - a.ts.getTime());
   const steps = stableHistorySortSteps(rows);
   let yields = 0, result;
   do { result = steps.next(); if (!result.done) yields++; } while (!result.done);
   return yields > 90 && yields < 400 && result.value.length === expected.length &&
     result.value.every((row, i) => row === expected[i]);
 })()`), true);
});
test('250k shuffled timestamps preserve every duplicate and yield during all merge passes',()=>{
 const a=app();assert.equal(a.run(`(()=>{
 const rows=Array.from({length:250000},(_,i)=>({ts:new Date((i*7919%86400)*1000),temp:i}));
 const expected=rows.slice().sort((a,b)=>b.ts.getTime()-a.ts.getTime());
 const steps=stableHistorySortSteps(rows);let yields=0,step;
 do{step=steps.next();if(!step.done)yields++;}while(!step.done);
 return yields>1000&&step.value.every((r,i)=>r===expected[i]);})()`),true);
});
test('empty, single and repeated object references are ordered exactly without dropping rows',()=>{
 const a=app();assert.equal(a.run(`(()=>{
 const r={ts:new Date(0)},s={ts:new Date(-1000)};
 for(const rows of [[],[r],[s,r,s,r,r]]){
 const expected=rows.slice().sort((a,b)=>b.ts.getTime()-a.ts.getTime());
 const result=finishSteps(stableHistorySortSteps(rows));if(result.length!==expected.length||result.some((r,i)=>r!==expected[i]))return false;
 }return true;})()`),true);
});
async function sorting(){
 const a=app();a.run(`globalThis.performance={now:()=>0};
 globalThis.csv=Array.from({length:12000},(_,i)=>'25.10.2026,'+(i%2?'11:00':'12:00')+','+i+',1010,50,0,0,,4').join('\\n');
 globalThis.old=store.rows;globalThis.oldReport=dataStatus.sheets.validation;
 globalThis.sortStarted=false;globalThis.nativeSteps=stableHistorySortSteps;
 stableHistorySortSteps=function*(rows){sortStarted=true;yield;return yield* nativeSteps(rows)};`);
 const p=a.run('parseAndStore(csv,stationContext(),"full",newSheetsTiming("full"))');a.tick(10);
 for(let i=0;!a.run('sortStarted');i++){assert.ok(i<1000);await settle();a.tick(0);}
 return {a,p};
}
test('cancellation during sorting clears the job and cannot publish a partial order or validation report',async()=>{
 const {a,p}=await sorting();const stale=[...a.timers.values()].find(t=>t.delay===0)?.fn;
 a.run('switchStation(1);store.rows=[{temp:999}]');assert.equal(await p,false);
 stale?.();assert.equal(a.run('store.rows.length===1 && store.rows[0].temp===999'),true);
 assert.equal(a.run('dataStatus.sheets.validation'),null);
 assert.equal([...a.timers.values()].some(t=>t.delay===0),false);
});
test('sort failure retains the last complete measurements and marks the attempt incomplete',async()=>{
 const a=app();a.run(`globalThis.performance={now:()=>0};
 globalThis.csv='25.10.2026,12:00,0,1010,50,0,0,,4\\n'.repeat(12000);
 globalThis.old=store.rows;stableHistorySortSteps=function*(){yield;throw Error('controlled sort')};`);
 let done=false;const p=a.run('parseAndStore(csv,stationContext(),"full",newSheetsTiming("full"))');
 const rejection=assert.rejects(p,/controlled sort/);p.catch(()=>{done=true});a.tick(10);
 for(let i=0;!done;i++){assert.ok(i<1000);await settle();a.tick(0);}await rejection;
 assert.equal(a.run('store.rows===old'),true);assert.equal(a.run('dataStatus.sheets.validation.complete'),false);
});
