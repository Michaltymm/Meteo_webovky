const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
function ready(){const a=app();a.run(`store.rows=[{ts:new Date(),temp:20,hum:0,pressure:1010}];ovDays=0;el('ovMetric').value='temp';
 globalThis.writes=0;globalThis.markup='';Object.defineProperty(el('ovTableBody'),'innerHTML',{get:()=>markup,set:v=>{writes++;markup=v}});`);return a;}
test('unchanged overview preserves existing table nodes; changed values, counts, metric and external edits replace stale markup',()=>{
 const a=ready();a.run('buildTempOverview();buildTempOverview()');assert.equal(a.run('writes'),1);
 a.run('store.rows[0].temp=21;buildTempOverview()');assert.equal(a.run('writes'),2);
 assert.match(a.run('markup'),/21\.0/);
 a.run('store.rows.push({...store.rows[0]});buildTempOverview()');assert.equal(a.run('writes'),3);
 assert.match(a.run('markup'),/>2<\/td>/);
 a.run("el('ovMetric').value='hum';buildTempOverview()");assert.equal(a.run('writes'),4);
 assert.equal(a.run('chartOverview.data.datasets[2].data[0]'),0);
 a.run("el('ovTableBody').innerHTML='stale';buildTempOverview()");assert.equal(a.run('writes'),6);
 assert.doesNotMatch(a.run('markup'),/stale/);
});
test('one lazily created Czech formatter is reused and retains native count formatting for grouped sample counts',()=>{
 const a=ready();a.run(`globalThis.created=0;globalThis.RealNumberFormat=Intl.NumberFormat;
 Intl.NumberFormat=class extends RealNumberFormat{constructor(...args){super(...args);created++}};`);
 assert.equal(a.run('created'),0);a.run('buildTempOverview()');assert.equal(a.run('created'),1);
 for(const n of [0,1,999,1000,12345,250000])assert.equal(a.run(`overviewCountFormatter.format(${n})`),n.toLocaleString('cs-CZ'));
 a.run("el('ovMetric').value='pressure';buildTempOverview();setOvDays(30);buildTempOverview()");
 assert.equal(a.run('created'),1);
});
test('missing overview values keep the empty state and zero-valued measurements remain counted',()=>{
 const a=ready();a.run('store.rows[0].temp=null;buildTempOverview();buildTempOverview()');
 assert.match(a.run('markup'),/Žádná data/);assert.equal(a.run('writes'),1);
 a.run('store.rows[0].temp=0;buildTempOverview()');assert.equal(a.run('writes'),2);
 assert.equal(a.run('chartOverview.data.datasets[2].data[0]'),0);assert.match(a.run('markup'),/>1<\/td>/);
});

test('identical plotted values keep the chart datasets while table counts still change', () => {
  const a = ready();
  a.run('buildTempOverview();globalThis.datasets=chartOverview.data.datasets;buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 1);
  a.run('store.rows.push({...store.rows[0]});buildTempOverview()');
  assert.equal(a.run('chartOverview.data.datasets===datasets && chartOverview.updates===1'), true);
  assert.match(a.run('markup'), />2<\/td>/);
  a.run('store.rows[0].temp=22;buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 2);
  assert.equal(a.run('chartOverview.data.datasets[2].data[0]'), 21);
});

test('a changed day or unit redraws the chart even when the numeric values match', () => {
  const a = ready();
  a.run(`store.rows[0].hum=20;buildTempOverview();el('ovMetric').value='hum';buildTempOverview()`);
  assert.equal(a.run('chartOverview.updates'), 2);
  assert.equal(a.run('chartOverview.options.scales.y.title.text'), '%');
  a.run('store.rows[0].ts=new Date(1700000000000);buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 3);
  a.run('setOvDays(7);buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 4);
  assert.equal(a.run('chartOverview.data.labels.length'), 0);
});

test('the same overview retries a failed Chart.js update', () => {
  const a = ready();
  a.run('globalThis.originalUpdate=chartOverview.update;chartOverview.update=()=>{throw Error("draw failed")}');
  assert.throws(() => a.run('buildTempOverview()'), /draw failed/);
  a.run('chartOverview.update=originalUpdate;buildTempOverview();buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 1);
});

test('a station reset rebuilds even a chart with the same plotted values', () => {
  const a = ready();
  a.run('buildTempOverview();globalThis.previous=store.rows;resetStationStore();store.rows=previous;buildTempOverview()');
  assert.equal(a.run('chartOverview.updates'), 2);
});
