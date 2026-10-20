const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

function fixture(a, n = 100000) {
  a.run(`store.rows = Array.from({length:${n}}, (_,i) => ({
    ts:new Date(Date.now()-i*300000), temp: i===17 ? 85 : 10,
    hum: i===19 ? 0 : 60, pressure:1010, voltage:4, rain:0, rainInc:0, tank:null
  })); store.fullLoaded=true; expRange="all"; el("expMetric").value="temp_hum"`);
}

test('explorer preserves both metric extrema and computes statistics from all measurements', () => {
  const a = app(); fixture(a);
  a.run('buildExplorer()');
  assert.equal(a.run('expAllPts.length'), 100000);
  assert.ok(a.run('chartExplorer.data.labels.length <= 800'));
  assert.equal(a.run('chartExplorer.data.datasets[0].data.includes(85)'), true);
  assert.equal(a.run('chartExplorer.data.datasets[1].data.includes(0)'), true);
  assert.match(a.nodes.get('expStats').innerHTML, /100000&nbsp;měření/);
  assert.match(a.nodes.get('expStats').innerHTML, /85\.0/);
  assert.equal(a.run('store.rows[17].temp'), 85);
  assert.equal(a.run('store.rows[0].ts > store.rows.at(-1).ts'), true);
});

test('slider statistics and endpoints use the complete selected interval', () => {
  const a = app(); fixture(a, 10000);
  a.run('buildExplorer(); el("expSliderL").value="20"; el("expSliderR").value="80"; expSliderUpdate()');
  assert.match(a.nodes.get('expStats').innerHTML, /6000&nbsp;měření/);
  assert.ok(a.run('chartExplorer.data.labels.length <= 800'));
  assert.equal(a.run('chartExplorer.data.labels[0] === fmtDT(expAllPts[2000].ts)'), true);
  assert.equal(a.run('chartExplorer.data.labels.at(-1) === fmtDT(expAllPts[7999].ts)'), true);
  a.run('el("expSliderL").value="100"; el("expSliderR").value="100"; expSliderUpdate()');
  assert.equal(a.run('chartExplorer.data.labels.length'), 1);
  assert.match(a.nodes.get('expStats').innerHTML, /1&nbsp;měření/);
});

test('min/max sampling preserves endpoints, null gaps, order and does not mutate input', () => {
  const a = app();
  a.run(`globalThis.rows=Array.from({length:10000}, (_,i)=>({i,temp:i===23?null:i===25?100:i===26?-100:0}));
    globalThis.sample=sampleExtrema(rows,[r=>r.temp])`);
  assert.equal(a.run('sample[0] === rows[0] && sample.at(-1) === rows.at(-1)'), true);
  assert.equal(a.run('[23,25,26].every(i => sample.includes(rows[i]))'), true);
  assert.equal(a.run('sample.every((r,i) => !i || sample[i-1].i < r.i)'), true);
  assert.ok(a.run('sample.length <= 800'));
  assert.equal(a.run('rows.length'), 10000);
});

test('binary range cache handles duplicate inclusive endpoints, empty range and source invalidation', () => {
  const a = app();
  a.run('store.rows=[5,4,4,3,2,1].map(t=>({ts:new Date(t),temp:t})); globalThis.first=explorerRows(2,4)');
  assert.equal(a.run('JSON.stringify(first.map(r=>+r.ts))'), '[2,3,4,4]');
  assert.equal(a.run('explorerRows(2,4) === first'), true);
  assert.equal(a.run('explorerRows(6,7).length'), 0);
  a.run('store.rows=[{ts:new Date(3),temp:99}]');
  assert.equal(a.run('explorerRows(2,4)[0].temp'), 99);
  a.run('store.rows.unshift({ts:new Date(4),temp:100}); invalidateDerivedData()');
  assert.equal(a.run('explorerRows(2,4).length'), 2);
  a.run('resetStationStore()');
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('expAllPts.length'), 0);
});

test('range lookup agrees with a full scan across many bounds', () => {
  const a = app();
  a.run('store.rows=Array.from({length:1001},(_,i)=>({ts:new Date(Math.floor((1000-i)/3))}))');
  assert.equal(a.run(`Array.from({length:100},(_,i)=>i).every(i=>{
    const lo=i*4-10,hi=lo+i%13;
    return JSON.stringify(explorerRows(lo,hi).map(r=>+r.ts)) ===
      JSON.stringify(store.rows.filter(r=>+r.ts>=lo && +r.ts<=hi).reverse().map(r=>+r.ts));
  })`), true);
});

test('visible tab updates only its charts; untouched tabs retain dirty state', () => {
  const a = app(); fixture(a, 1000);
  a.run('tabDirtyState.now=true; tabDirtyState.monthly=true; refreshTab("now")');
  assert.equal(a.run('chart24.updates'), 1);
  for (const chart of ['chartRain', 'chartVoltage', 'chartMonthly', 'chartYearly', 'chartOverview'])
    assert.equal(a.run(chart + '.updates'), 0, chart);
  assert.equal(a.run('tabDirtyState.monthly'), true);
  a.run('refreshTab("monthly"); refreshTab("monthly")');
  assert.equal(a.run('chartMonthly.updates'), 1);
  a.run('tabDirtyState.rain=true; refreshTab("rain")');
  assert.equal(a.run('chartRain.updates'), 1);
  assert.equal(a.run('chartVoltage.updates'), 1);
});

test('large histories and statistics do not exceed the function argument limit', () => {
  const a = app({ realRefresh: true }); fixture(a, 250000);
  a.run('refreshUI(); buildExplorer()');
  assert.match(a.nodes.get('statTempMax').textContent, /85/);
  assert.match(a.nodes.get('expStats').innerHTML, /250000&nbsp;měření/);
  assert.equal(a.run('JSON.stringify(numericSummary([null,NaN,Infinity,0,-2,5]))'),
    '{"min":-2,"max":5,"avg":1,"count":3}');
});

test('voltage regression uses all recent samples, independently of display sampling', () => {
  const a = app();
  a.run(`globalThis.rows=Array.from({length:2000},(_,i)=>({
    ts:new Date(Date.now()-(1999-i)*60000), voltage: i===1998 ? 3 : 4-i/10000
  }));
  globalThis.full=voltageSeries(rows);
  globalThis.reduced=voltageSeries(sampleExtrema(rows,[r=>r.voltage]),Infinity,rows);`);
  // Forecast starts after the common last observed sample, with the same slope.
  assert.equal(a.run('full.predicted[2000]'), a.run('reduced.predicted[reduced.actual.findIndex(v=>v===null)]'));
});

test('unchanged quick response skips parsing, while corrected data still commits', async () => {
  const a = app();
  const csv = value => 'Datum,Cas,Teplota,Tlak,Vlhkost\n20.10.2026,12:00,' + value + ',1010,60';
  async function load(value) {
    const done = a.run('fetchSheets()');
    a.respond(a.requests.length - 1, csv(value));
    await new Promise(resolve => setImmediate(resolve));
    a.tick();
    await done;
  }
  await load(10); await load(10);
  assert.equal(a.state.renders, 1);
  await load(11);
  assert.equal(a.state.renders, 2);
  assert.equal(a.run('store.rows[0].temp'), 11);
  a.run('resetStationStore()');
  assert.equal(a.run('store._lastQuickCsv'), null);
});

test('CSV commits and live MQTT messages invalidate cached views and CSV fingerprints', async () => {
  const a = app(); fixture(a, 1000);
  a.run('buildExplorer()');
  const parsed = a.run('parseAndStore("20.10.2026,12:00,27,1010,60,0,0,0,4.2")');
  a.tick(); await parsed;
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('expAllPts.length'), 0);
  a.run(`buildExplorer(); store._lastQuickCsv="old"; store._lastFullCsv="old";
    CFG.source="both"; CFG.mqttHost="test.invalid"; connectMQTT()`);
  a.clients[0].onMessageArrived({ payloadString: '{"temp":12,"hum":60,"voltage":4}' });
  assert.equal(a.run('store.rows[0].temp'), 12);
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('store._lastQuickCsv'), null);
  assert.equal(a.run('store._lastFullCsv'), null);
});
