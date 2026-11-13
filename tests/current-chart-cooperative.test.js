const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
function ready(){
 const a=app();
 a.run(`globalThis.selected={dataset:{tab:'now'}};document.querySelector=()=>selected;
 currentChartObserver={};window.innerWidth=390;window.innerHeight=844;
 el('chart24h').getClientRects=()=>[1];el('chart24h').getBoundingClientRect=()=>({top:0,bottom:300,left:0,right:390});
 CFG.source='sheets';store.rows=Array.from({length:12000},(_,i)=>({ts:new Date(1700000000000-i*1000),temp:i%101===0?null:i%31,hum:i%73===0?null:i%101}));
 invalidateDerivedData();globalThis.expected=JSON.stringify(currentChartData(selectCurrentChartRows(store.rows),800));
 // Force one generator checkpoint per task to test cancellation deterministically.
 analyticsWorkSlice=steps=>{const step=steps.next();return step.done?step:null;};`);
 return a;
}
function drain(a){for(let n=0;a.run('currentChartJob!==null');n++){assert.ok(n<1000);a.tick(0);}}
test('large visible graph is atomic, coalesces and exactly matches synchronous data',()=>{
 const a=ready();a.run(`refreshTab('now');refreshTab('now')`);
 assert.equal(a.run('chart24.updates'),0);assert.equal(a.timers.size,1);
 a.tick(0);assert.equal(a.run('chart24.updates'),0);assert.equal(a.run('tabDirtyState.now'),true);
 drain(a);assert.equal(a.run('chart24.updates'),1);assert.equal(a.run('tabDirtyState.now'),false);
 assert.equal(a.run('JSON.stringify({labels:chart24.data.labels,series:chart24.data.datasets.map(d=>d.data)})'),a.run('expected'));
 assert.equal(a.requests.length,0);
});
test('in-place invalidation cancels old work and redraws new values only',()=>{
 const a=ready();a.run(`refreshTab('now')`);a.tick(0);
 a.run(`store.rows[0].temp=999;invalidateDerivedData();refreshTab('now')`);drain(a);
 assert.equal(a.run('chart24.updates'),1);
 assert.equal(a.run('chart24.data.datasets[0].data.at(-1).y'),999);
});
test('page, tab, background, station and row replacement discard queued work',()=>{
 for(const change of ["currentPage='modern2'","currentPage='analytics'","selected.dataset.tab='daily'","document.hidden=true","switchStation(1)","store.rows=store.rows.slice()"]){
  const a=ready();a.run('refreshTab("now")');a.tick(0);a.run(change);a.tick(0);
  assert.equal(a.run('currentChartJob'),null,change);assert.equal(a.run('chart24.updates'),0,change);
  assert.equal(a.run('tabDirtyState.now'),true,change);
 }
});
test('hidden viewport cancels, return restarts; failed preparation can recover',()=>{
 const a=ready();a.run('refreshTab("now")');a.tick(0);
 a.run('window.innerHeight=0');a.tick(0);assert.equal(a.run('currentChartJob'),null);
 a.run('window.innerHeight=844;globalThis.saved=analyticsWorkSlice;analyticsWorkSlice=()=>{throw Error("test")};refreshTab("now")');a.tick(0);
 assert.equal(a.run('tabDirtyState.now'),true);assert.equal(a.run('currentChartJob'),null);
 a.run('analyticsWorkSlice=saved;refreshTab("now")');drain(a);assert.equal(a.run('chart24.updates'),1);
});
