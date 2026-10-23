const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

function ready(count = 20000) {
  const a = app();
  a.run(`
    currentPage='analytics';
    globalThis.draws=0;globalThis.statusUpdates=0;
    analyticsDrawCard=()=>{draws++};analyticsUpdateStatus=()=>{statusUpdates++};
    const grid=el('anaGrid');grid.attributes={};
    grid.setAttribute=(name,value)=>{grid.attributes[name]=value};
    // A deterministic clock bounds each scheduler turn independently of CI CPU.
    globalThis.monotonic=0;globalThis.performance={now:()=>++monotonic};
    globalThis.origin=Date.UTC(2026,9,23,12);
    store.rows=Array.from({length:${count}},(_,i)=>({
      ts:new Date(origin-(i===1024?1023:i)*1000-(i>=8192?10800001:0)),
      temp:i===17?85:i%37,hum:i%9===0?null:i%101,pressure:1010+i%3,
      voltage:i===4321?7:i%11===0?null:4+i%99/100,rain:i%13,rainInc:0,tank:null
    }));
    store.fullLoaded=true;
    el('anaSync').checked=true;
    analyticsState.domain=analyticsRange(store.rows,'all');
    analyticsState.base=analyticsState.domain;
    analyticsState.visible=new Set([0,1]);
  `);
  return a;
}

function drain(a) {
  for (let turns = 0; turns < 3000 && a.run('analyticsState.job!==null'); turns++) a.tick(0);
  assert.equal(a.run('analyticsState.job'), null, 'cooperative work must finish or cancel');
}

const json = (a, expression) => JSON.parse(a.run(`JSON.stringify(${expression})`));

test('large synchronized model is shared and publishes only its complete original-data result', () => {
  const a = ready();
  a.run(`globalThis.expected=analyticsBuildModel(analyticsState.domain);
    globalThis.originalSource=store.rows;globalThis.requestCount=0;
    globalThis.first=analyticsModel(0,true);globalThis.job=analyticsState.job;
    globalThis.second=analyticsModel(1,true);`);
  assert.equal(a.run('first'), null);
  assert.equal(a.run('second'), null);
  assert.equal(a.run('analyticsState.job===job'), true);
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('el("anaGrid").attributes["aria-busy"]'), 'true');
  assert.equal(a.timers.size, 1);
  a.tick(0);
  assert.equal(a.run('analyticsState.model'), null, 'one bounded turn must not publish partial statistics');
  assert.equal(a.run('analyticsState.job===job'), true);
  drain(a);
  assert.equal(a.run('analyticsState.model.source===originalSource && store.rows===originalSource'), true);
  assert.equal(a.run('analyticsState.model.rows.every((row,i)=>row===expected.rows[i])'), true);
  assert.deepEqual(json(a, 'analyticsState.model.summary'), json(a, 'expected.summary'));
  assert.equal(a.run('analyticsState.model.samples.every((row,i)=>row===expected.samples[i] || (row.anaGap && expected.samples[i].anaGap && +row.ts===+expected.samples[i].ts))'), true);
  assert.deepEqual(json(a, 'analyticsState.model.xy'), json(a, 'expected.xy'));
  assert.equal(a.run('analyticsState.model.summary.stats.temp.count'), 20000);
  assert.equal(a.run('analyticsState.model.summary.stats.temp.max'), 85);
  assert.equal(a.run('analyticsState.model.summary.stats.temp.min'), 0);
  assert.equal(a.run('analyticsState.model.summary.gapCount'), 1);
  assert.equal(a.run('analyticsState.model.pair.count'), 20000 - (Math.floor(19999 / 11) + 1));
  assert.equal(a.run('analyticsState.model.samples.includes(store.rows[17])'), true);
  assert.equal(a.run('analyticsState.model.xy.some(point=>point.y===7 && point.ts===+store.rows[4321].ts)'), true);
  assert.equal(a.run('analyticsState.model.samples.length<=600 && analyticsState.model.xy.length<=580'), true);
  assert.equal(a.run('draws'), 2);
  assert.equal(a.requests.length, 0);
  assert.equal(a.timers.size, 0);
  assert.equal(a.run('el("anaGrid").attributes["aria-busy"]'), 'false');
  a.run('globalThis.finished=analyticsState.model;globalThis.cached=analyticsModel(0,true)');
  assert.equal(a.run('cached===finished'), true);
  assert.equal(a.timers.size, 0);
});

test('small ranges, independent windows and streaming sources keep the immediate model path', () => {
  const small = ready(9999);
  small.run('globalThis.result=analyticsModel(0,true)');
  assert.equal(small.run('result.summary.count'), 9999);
  assert.equal(small.run('analyticsState.job'), null);
  assert.equal(small.timers.size, 0);

  const selected = ready();
  selected.run('analyticsState.domain={from:+store.rows[10].ts,to:+store.rows[0].ts};globalThis.result=analyticsModel(0,true)');
  assert.equal(selected.run('result.summary.count'), 11);
  assert.equal(selected.run('analyticsState.job'), null);
  assert.equal(selected.timers.size, 0);

  const independent = ready();
  independent.run('el("anaSync").checked=false;globalThis.result=analyticsModel(0,true)');
  assert.equal(independent.run('result.summary.count'), 20000);
  assert.equal(independent.run('analyticsState.job'), null);
  assert.equal(independent.timers.size, 0);

  // Frequent live appends would otherwise cancel every unfinished snapshot.
  for (const source of ['mqtt', 'both']) {
    const live = ready();
    live.run(`CFG.source=${JSON.stringify(source)};globalThis.result=analyticsModel(0,true)`);
    assert.equal(live.run('result.summary.count'), 20000);
    assert.equal(live.run('analyticsState.job'), null);
    assert.equal(live.timers.size, 0);
  }
});

test('explicit synchronous callers retain the exact model API for a large range', () => {
  const a = ready();
  a.run('globalThis.result=analyticsModel(0)');
  assert.equal(a.run('result.summary.count'), 20000);
  assert.equal(a.run('result.pair.count'), 20000 - (Math.floor(19999 / 11) + 1));
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.timers.size, 0);
  assert.notEqual(a.run('el("anaGrid").attributes["aria-busy"]'), 'true');
});

test('range invalidation cancels the old continuation and only the new range can publish', () => {
  const a = ready();
  a.run('analyticsModel(0,true);globalThis.oldJob=analyticsState.job');
  a.tick(0);
  a.run(`analyticsState.domain={from:+store.rows[15000].ts,to:+store.rows[0].ts};
    analyticsInvalidate();analyticsModel(0,true);globalThis.newJob=analyticsState.job;`);
  assert.equal(a.run('newJob!==null && newJob!==oldJob'), true);
  assert.equal(a.timers.size, 1);
  // A queued callback may already have been delivered before cancellation.
  a.run('analyticsRunModelJob(oldJob)');
  assert.equal(a.run('analyticsState.job===newJob'), true);
  assert.equal(a.run('analyticsState.model'), null);
  drain(a);
  assert.equal(a.run('analyticsState.model.rows.length'), 15001);
  assert.equal(a.run('analyticsState.model.from===analyticsState.domain.from'), true);
});

test('data replacement and in-place mutation invalidate cooperative work without changing original rows', () => {
  for (const replacement of [true, false]) {
    const a = ready();
    a.run('analyticsModel(0,true);globalThis.oldJob=analyticsState.job;globalThis.oldRows=store.rows');
    a.tick(0);
    a.run(replacement ? 'store.rows=store.rows.slice();analyticsInvalidate()' : 'store.rows.unshift({ts:new Date(origin+1000),temp:0});analyticsInvalidate()');
    assert.equal(a.run('analyticsState.job'), null);
    assert.equal(a.timers.size, 0);
    a.run('analyticsRunModelJob(oldJob)');
    assert.equal(a.run('analyticsState.model'), null);
    assert.equal(a.run('draws'), 0);
    assert.equal(a.run('store.rows.length'), replacement ? 20000 : 20001);
    assert.equal(a.run(replacement ? 'store.rows[0]===oldRows[0]' : 'store.rows[0].temp===0'), true);
  }
});

test('source, length and domain guards reject stale work even before an explicit invalidation', () => {
  for (const change of [
    'store.rows=store.rows.slice()',
    'store.rows.unshift({ts:new Date(origin+1000),temp:0})',
    'analyticsState.domain={...analyticsState.domain,from:analyticsState.domain.from+1}',
    'el("anaSync").checked=false'
  ]) {
    const a = ready();
    a.run('analyticsModel(0,true)');
    a.run(change);
    drain(a);
    assert.equal(a.run('analyticsState.model'), null, change);
    assert.equal(a.run('draws'), 0, change);
    assert.equal(a.timers.size, 0, change);
  }
});

test('leaving analytics releases pending computation and late callbacks cannot recreate charts', () => {
  const a = ready();
  a.run('analyticsModel(0,true);globalThis.oldJob=analyticsState.job');
  a.tick(0);
  a.run('currentPage="main";analyticsStop()');
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.timers.size, 0);
  assert.equal(a.run('el("anaGrid").attributes["aria-busy"]'), 'false');
  a.run('analyticsRunModelJob(oldJob)');
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('draws'), 0);
  assert.equal(a.run('analyticsCharts.size'), 0);
});

test('A to B to A station changes prevent an old cooperative model from publishing', () => {
  const a = ready();
  a.run('analyticsModel(0,true);globalThis.oldJob=analyticsState.job;switchStation(1);switchStation(0)');
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.timers.size, 0);
  a.run('analyticsRunModelJob(oldJob)');
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('draws'), 0);
});

test('hiding the document cancels work and returning resumes only the current analytic view', () => {
  const a = ready();
  a.run('analyticsModel(0,true);globalThis.oldJob=analyticsState.job');
  a.visibility(true);
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.timers.size, 0);
  a.run('analyticsRunModelJob(oldJob)');
  assert.equal(a.run('analyticsState.model'), null);
  // Keep this test isolated from data polling and actual Chart DOM rendering.
  a.run('globalThis.rebuilt=0;analyticsRedraw=()=>{rebuilt++;analyticsModel(0,true)}');
  a.visibility(false);
  assert.equal(a.run('rebuilt'), 1);
  drain(a);
  assert.equal(a.run('analyticsState.model.summary.count'), 20000);
  assert.equal(a.run('rebuilt'), 2, 'the completed model redraws current visible cards');
  a.run('analyticsInvalidate();currentPage="main"');
  a.visibility(true);
  a.visibility(false);
  assert.equal(a.run('rebuilt'), 2);
  assert.equal(a.run('analyticsState.job'), null);
});

test('unexpected computation failure clears work and does not retry until invalidation', () => {
  const a = ready();
  a.run(`globalThis.steps=analyticsModelSteps;
    analyticsModelSteps=function*(){yield;throw new Error('controlled calculation failure')};
    analyticsModel(0,true);`);
  drain(a);
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('analyticsState.modelError'), true);
  assert.equal(a.timers.size, 0);
  assert.equal(a.run('el("anaGrid").attributes["aria-busy"]'), 'false');
  a.run('globalThis.failed=analyticsModel(0,true)');
  assert.equal(a.run('failed'), null);
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.timers.size, 0);
  a.run('analyticsModelSteps=steps;analyticsInvalidate();analyticsModel(0,true)');
  assert.equal(a.run('analyticsState.modelError'), false);
  drain(a);
  assert.equal(a.run('analyticsState.model.summary.count'), 20000);
});

test('an invalid custom date cancels a pending model instead of publishing the old period', () => {
  const a = ready();
  a.run(`analyticsModel(0,true);globalThis.oldJob=analyticsState.job;
    el('anaRange').value='custom';el('anaFrom').value='2026-02-30';el('anaTo').value='2026-03-01';
    buildAnalytics();`);
  assert.equal(a.run('analyticsState.job'), null);
  assert.equal(a.run('analyticsState.domain'), null);
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('el("anaGrid").attributes["aria-busy"]'), 'false');
  assert.equal(a.timers.size, 0);
  a.run('analyticsRunModelJob(oldJob)');
  assert.equal(a.run('analyticsState.model'), null);
  assert.equal(a.run('draws'), 0);
});

test('unavailable timing still makes progress with a finite per-turn step budget', () => {
  const a = ready();
  a.run('globalThis.performance={now:()=>NaN};analyticsModel(0,true)');
  a.tick(0);
  assert.equal(a.run('analyticsState.model'), null);
  assert.notEqual(a.run('analyticsState.job'), null);
  drain(a);
  assert.equal(a.run('analyticsState.model.summary.count'), 20000);
  assert.equal(a.timers.size, 0);
});

test('pending, failed and not-yet-redrawn canvases cannot export an old-period image', () => {
  const a = ready();
  a.run(`globalThis.exportsAttempted=0;
    document.createElement=()=>{exportsAttempted++;throw new Error('unexpected export')};
    analyticsModel(0,true);analyticsExport(0);`);
  assert.equal(a.run('el("anaExport0").disabled'), true);
  assert.equal(a.run('el("anaCanvas0").style.visibility'), 'hidden');
  assert.equal(a.run('exportsAttempted'), 0);
  a.run(`analyticsCharts.set(6,{scales:{x:{min:1,max:2},y:{min:3,max:4}}});
    analyticsZoom(6,.5);analyticsPan(6,.25)`);
  assert.equal(a.run('analyticsState.xy'), null, 'pending scatter cannot use old-period axes');
  drain(a);
  // The draw stub leaves the hidden canvas untouched, just like an offscreen
  // card that still awaits its IntersectionObserver delivery.
  a.run('analyticsExport(0)');
  assert.equal(a.run('exportsAttempted'), 0);
  a.run('el("anaCanvas0").style.visibility="";analyticsState.modelError=true;analyticsExport(0)');
  assert.equal(a.run('exportsAttempted'), 0);
});
