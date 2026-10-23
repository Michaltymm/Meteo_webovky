const assert = require('node:assert/strict');
const {test} = require('node:test');
const {app} = require('./helpers/app');

function ready(count=12000) {
  const a=app();
  a.run(`currentPage='analytics';globalThis.clock=0;globalThis.performance={now:()=>++clock};
    globalThis.draws=[];analyticsDrawCard=id=>{if(analyticsState.visible.has(id))draws.push(id)};
    analyticsUpdateStatus=()=>{};
    el('anaCard7').attrs={};el('anaCard7').setAttribute=(k,v)=>{el('anaCard7').attrs[k]=v};
    globalThis.origin=Date.UTC(2026,9,23,12);
    store.rows=Array.from({length:${count}},(_,i)=>({ts:new Date(origin-Math.floor(i/2)*300000),
      temp:i===17?85:i%29===0?null:i%71===0?0:i%31,hum:50,pressure:1010,voltage:4}));
    store.fullLoaded=true;el('anaSync').checked=true;
    analyticsState.domain=analyticsRange(store.rows,'all');analyticsState.base=analyticsState.domain;
    globalThis.m=analyticsBuildModel(analyticsState.domain);analyticsState.model=m;analyticsState.visible=new Set([7]);
    for(const index of [1,2]){
      const c=analyticsCompact(store.rows);for(let i=0;i<c.count;i++){c.times[i]+=5000;c.temps[i]+=index;}
      analyticsStationCache.set(index,{...c,name:'Station '+index,preferences:analyticsSourceSignature(index),loadedAt:origin});
    }
    globalThis.request=()=>analyticsComparison(analyticsState.domain,m,true);
  `);
  return a;
}
function drain(a) {
  for(let i=0;i<2000&&a.run('!!analyticsState.comparisonJob');i++)a.tick(0);
  assert.equal(a.run('analyticsState.comparisonJob'),null);
}
const json=(a,s)=>JSON.parse(a.run(`JSON.stringify(${s})`));

test('one comparison job publishes only complete full-data results and leaves other cards/model untouched',()=>{
  const a=ready();
  a.run(`globalThis.expected=analyticsComparison(analyticsState.domain,m);
    delete m.comparison;delete m.comparisonSignature;globalThis.before=JSON.stringify(store.rows);
    globalThis.first=request();globalThis.job=analyticsState.comparisonJob;globalThis.second=request()`);
  assert.equal(a.run('first'),null);assert.equal(a.run('second'),null);
  assert.equal(a.run('analyticsState.comparisonJob===job'),true);assert.equal(a.timers.size,1);
  assert.equal(a.run('m.comparison'),undefined);
  assert.equal(a.run('el("anaCard7").attrs["aria-busy"]'),'true');
  assert.equal(a.run('el("anaCanvas7").style.visibility'),'hidden');
  assert.equal(a.run('el("anaExport7").disabled'),true);
  assert.notEqual(a.run('el("anaCanvas0").style.visibility'),'hidden');
  assert.equal(a.run('analyticsState.job'),null);assert.equal(a.requests.length,0);
  a.tick(0);assert.equal(a.run('m.comparison'),undefined);
  drain(a);
  assert.deepEqual(json(a,'m.comparison'),json(a,'expected'));
  assert.equal(a.run('JSON.stringify(store.rows)===before && analyticsState.model===m'),true);
  assert.equal(a.run('el("anaCard7").attrs["aria-busy"]'),'false');
  assert.equal(a.run('m.comparison.datasets.every(s=>s.data.length<=600)'),true);
  assert.equal(a.run('m.comparison.datasets[0].data.some(p=>p.y===85)'),true);
  assert.match(a.run('m.comparison.note'),/párů/);assert.deepEqual(json(a,'draws'),[7]);
  a.run('globalThis.result=request()');assert.equal(a.run('result===m.comparison'),true);
  assert.equal(a.timers.size,0);assert.equal(a.requests.length,0);
});

test('small, independent and streaming comparisons retain synchronous behavior',()=>{
  const small=ready(600);small.run('globalThis.result=request()');
  assert.equal(small.run('result.datasets.length'),3);assert.equal(small.timers.size,0);
  for(const setting of ['el("anaSync").checked=false','CFG.source="mqtt"','CFG.source="both"']){
    const a=ready();a.run(setting+';globalThis.result=request()');
    assert.equal(a.run('result.datasets.length'),3);assert.equal(a.timers.size,0);
    assert.equal(a.run('analyticsState.comparisonJob'),null);
  }
});

test('dense foreign history also triggers bounded work for a small active station',()=>{
  const a=ready(600);
  a.run(`const c=analyticsStationCache.get(1);c.count=15000;
    c.times=Float64Array.from({length:c.count},(_,i)=>origin-10000-i*1000);
    c.temps=Float64Array.from({length:c.count},(_,i)=>i%17);
    globalThis.first=request()`);
  assert.equal(a.run('first'),null);assert.notEqual(a.run('analyticsState.comparisonJob'),null);
  drain(a);assert.equal(a.run('m.comparison.datasets.length'),3);
});

test('invalidation releases the generator/timer, and an already queued old callback cannot publish',()=>{
  const a=ready();a.run('request();globalThis.old=analyticsState.comparisonJob');a.tick(0);
  a.run('analyticsInvalidate();analyticsRunComparisonJob(old)');
  assert.equal(a.run('analyticsState.comparisonJob'),null);assert.equal(a.run('m.comparison'),undefined);
  assert.equal(a.timers.size,0);assert.deepEqual(json(a,'draws'),[]);
  assert.equal(a.run('old.steps.next().done'),true);
});

test('replacement, append, new domain and changed model reject stale results even before explicit invalidation',()=>{
  for(const change of ['store.rows=store.rows.slice()','store.rows.unshift({ts:new Date(origin+1),temp:0})',
    'analyticsState.domain={...analyticsState.domain,from:m.from+1}','analyticsState.model={...m}',
    'el("anaSync").checked=false','CFG.source="both"']){
    const a=ready();a.run('request();globalThis.old=analyticsState.comparisonJob');a.tick(0);a.run(change);
    a.run('analyticsRunComparisonJob(old)');
    assert.equal(a.run('analyticsState.comparisonJob'),null,change);
    assert.equal(a.run('m.comparison'),undefined,change);assert.equal(a.timers.size,0,change);
  }
});

test('foreign cache, preferences, error/loading changes invalidate only their old comparison signature',()=>{
  for(const change of ['analyticsStationCache.set(1,{...analyticsStationCache.get(1),name:"Updated"})',
    'analyticsStationCache.delete(1)','stations[1].sheetId="new-source"',
    'analyticsState.errors.set(1,"controlled failure")','analyticsState.loading=Promise.resolve()']){
    const a=ready();a.run('request();globalThis.old=analyticsState.comparisonJob');a.tick(0);a.run(change);
    a.run('analyticsRunComparisonJob(old)');
    assert.equal(a.run('m.comparison'),undefined,change);assert.equal(a.run('analyticsState.comparisonJob'),null);
    a.run('request()');drain(a);
    assert.equal(a.run('m.comparison.datasets.length'),change.includes('delete(')||change.includes('sheetId')?2:3);
    assert.equal(a.run('analyticsSameComparison(m.comparisonSignature,analyticsComparisonContext().signature)'),true);
  }
});

test('failed renewal keeps cached values explicitly labelled with their old load time',()=>{
  const a=ready();a.run('analyticsState.errors.set(1,"controlled failure");globalThis.cached=analyticsStationCache.get(1);request()');
  drain(a);
  assert.match(a.run('m.comparison.note'),/obnova selhala.*předchozí cache/);
  assert.equal(a.run('analyticsStationCache.get(1)===cached'),true);
  assert.equal(a.run('cached.loadedAt'),a.run('origin'));
});

test('leaving, A to B to A, or hiding cancels work; late callbacks do not revive charts',()=>{
  for(const action of ['currentPage="main";analyticsStop()','switchStation(1);switchStation(0)','document.hidden=true']){
    const a=ready();a.run('request();globalThis.old=analyticsState.comparisonJob');
    if(action==='document.hidden=true')a.visibility(true);else a.run(action);
    a.run('analyticsRunComparisonJob(old)');
    assert.equal(a.run('analyticsState.comparisonJob'),null);assert.equal(a.timers.size,0);
    assert.equal(a.run('m.comparison'),undefined);assert.deepEqual(json(a,'draws'),[]);
  }
  const a=ready();a.run('request()');a.visibility(true);
  a.run('analyticsRedraw=()=>request()');a.visibility(false);drain(a);
  assert.equal(a.run('m.comparison.datasets.length'),3);
});

test('comparison cancellation never aborts the foreign network loader or discards the shared model/cache',()=>{
  const a=ready();a.run(`analyticsState.abort=new AbortController();globalThis.network=analyticsState.abort;
    request();analyticsCancelComparison()`);
  assert.equal(a.run('network.signal.aborted'),false);
  assert.equal(a.run('analyticsState.model===m && analyticsStationCache.size===2'),true);
  assert.equal(a.timers.size,0);
});

test('computation errors keep other cards usable and do not loop or expose error text',()=>{
  const a=ready();
  a.run(`globalThis.real=analyticsComparisonSteps;analyticsComparisonSteps=function*(){yield;throw new Error('private-fixture')};request()`);
  drain(a);assert.equal(a.run('m.comparison'),undefined);
  assert.equal(a.run('analyticsSameComparison(m.comparisonFailed,analyticsComparisonContext().signature)'),true);
  assert.equal(a.run('request()'),null);assert.equal(a.timers.size,0);
  assert.equal(a.run('el("anaCard7").attrs["aria-busy"]'),'false');
  assert.notEqual(a.run('el("anaCanvas0").style.visibility'),'hidden');
  assert.equal(a.run('el("anaEmpty7").textContent.includes("private-fixture")'),false);
  a.run('analyticsComparisonSteps=real;analyticsStationCache.set(1,{...analyticsStationCache.get(1)});request()');
  drain(a);assert.equal(a.run('m.comparison.datasets.length'),3);assert.equal(a.run('m.comparisonFailed'),undefined);
});

test('absent timing makes finite progress; stale or pending comparison cannot export old pixels',()=>{
  const a=ready();a.run('performance.now=()=>NaN;globalThis.exports=0;document.createElement=()=>{exports++;throw Error("unexpected")};request();analyticsExport(7)');
  assert.equal(a.run('exports'),0);a.tick(0);assert.equal(a.run('m.comparison'),undefined);
  drain(a);a.run('analyticsExport(7)');assert.equal(a.run('exports'),0);
  assert.equal(a.timers.size,0);
});
