const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { app } = require('./helpers/app');

const plain = value => JSON.parse(JSON.stringify(value));

// Independent full-array reference for the old calculation. Deliberately uses
// filters/sorts rather than shared buckets, index ranges or the new cache.
function reference(source, year) {
  const rows = source.filter(row => row.ts.getFullYear() === year);
  const stat = metric => {
    const valid = rows.filter(row => Number.isFinite(row[metric]));
    const values = valid.map(row => row[metric]);
    const sum = values.reduce((a, b) => a + b, 0);
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    return { min, max, avg: values.length ? sum / values.length : null, sum, count: values.length,
      minRow: valid.find(row => row[metric] === min) ?? null, maxRow: valid.find(row => row[metric] === max) ?? null };
  };
  const names = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
  const groups = names.map((_, month) => rows.filter(row => row.ts.getMonth() === month));
  const extremes = (metric, descending) => groups.flatMap((group, m) => {
    const valid = group.filter(row => Number.isFinite(row[metric]));
    if (!valid.length) return [];
    const val = (descending ? Math.max : Math.min)(...valid.map(row => row[metric]));
    return [{ val, ts: valid.find(row => row[metric] === val).ts, name: names[m] }];
  }).sort((a, b) => descending ? b.val - a.val : a.val - b.val).slice(0, 6);
  const means = (metric, descending) => groups.flatMap((group, m) => {
    const values = group.filter(row => Number.isFinite(row[metric])).map(row => row[metric]);
    return values.length ? [{ m, name: names[m], avg: values.reduce((a, b) => a + b, 0) / values.length }] : [];
  }).sort((a, b) => descending ? b.avg - a.avg : a.avg - b.avg).slice(0, 6);
  const rains = rows.filter(row => Number.isFinite(row.rain));
  const rainByDay = new Map();
  for (const row of rains) {
    const key = row.ts.toDateString();
    rainByDay.set(key, Math.max(rainByDay.get(key) ?? -Infinity, row.rain));
  }
  const rainCounterMax = rains.length ? Math.max(...rainByDay.values()) : 0;
  const incs = rows.filter(row => Number.isFinite(row.rainInc) && row.rainInc > 0);
  const maxRainInc = incs.length ? Math.max(...incs.map(row => row.rainInc)) : 0;
  const maxRainIncRow = incs.find(row => row.rainInc === maxRainInc) ?? null;
  const sorted = [...rains].sort((a, b) => a.ts - b.ts);
  let start = 0, maxCounterDelta24h = 0, maxCounterDeltaDate = null;
  for (let end = 1; end < sorted.length; end++) {
    while (sorted[end].ts - sorted[start].ts > 86400000) start++;
    const diff = sorted[end].rain - sorted[start].rain;
    if (diff > maxCounterDelta24h) { maxCounterDelta24h = diff; maxCounterDeltaDate = sorted[end].ts; }
  }
  return { temperature: stat('temp'), humidity: stat('hum'), rainCounterMax, maxRainInc, maxRainIncRow,
    maxCounterDelta24h, maxCounterDeltaDate,
    topHotMonths: extremes('temp', true), topColdMonths: extremes('temp', false),
    topWetMonths: extremes('hum', true), topDryMonths: extremes('hum', false),
    hottestMonths: means('temp', true), coldestMonths: means('temp', false),
    wettestMonths: means('hum', true), driestMonths: means('hum', false) };
}

test('annual values and all eight rankings exactly match independent full scans over several years', () => {
  const a = app();
  a.run(`store.rows=Array.from({length:12000},(_,i)=>({ts:new Date(2026,9,21,12-Math.floor(i/2)*12),
    temp:i%11===0?null:(i%73-20)/3,hum:i%7===0?null:i%101,
    rain:i%13===0?null:i%97/10,rainInc:i%17===0?null:i%23/10}));`);
  const rows = JSON.parse(a.run('JSON.stringify(store.rows)')).map(row => ({ ...row, ts: new Date(row.ts) }));
  for (const year of new Set(rows.map(row => row.ts.getFullYear()))) {
    assert.deepEqual(JSON.parse(a.run(`JSON.stringify(annualStats(${year}))`)), plain(reference(rows, year)));
  }
  assert.equal(a.run('store.rows.length'), 12000);
});

test('year sums retain source order and ranking ties use calendar months and newest records', () => {
  const a = app();
  a.run(`store.rows=[3,2,1].map((m,i)=>({ts:new Date(2026,m-1,15),temp:[1,-1e16,1e16][i],hum:0,rain:0,rainInc:0}));`);
  assert.equal(a.run('annualStats(2026).temperature.avg'), 0);
  assert.equal(a.run('annualStats(2026).humidity.avg'), 0);
  a.run(`store.rows=[new Date(2026,11,31),new Date(2026,11,1),new Date(2026,0,1)].map(ts=>({ts,temp:20,hum:60,rain:0,rainInc:1}));`);
  assert.equal(a.run('annualStats(2026).temperature.maxRow===store.rows[0]'), true);
  assert.equal(a.run('annualStats(2026).maxRainIncRow===store.rows[0]'), true);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(annualStats(2026).topHotMonths.map(m=>m.name))')), ['leden','prosinec']);
  assert.equal(a.run('annualStats(2026).topHotMonths[1].ts===store.rows[0].ts'), true);
});

test('zero remains valid while null, missing and nonfinite sensors never contaminate annual means', () => {
  const a = app();
  a.run(`store.rows=[0,null,Infinity,NaN,undefined].map((temp,i)=>({ts:new Date(2026,9,21,12,i),temp,hum:temp,rain:temp,rainInc:temp})).reverse();`);
  for (const metric of ['temperature','humidity']) {
    assert.equal(a.run(`annualStats(2026).${metric}.count`), 1);
    assert.equal(a.run(`annualStats(2026).${metric}.avg`), 0);
  }
  assert.equal(a.run('annualStats(2026).rainCounterMax'), 0);
  assert.equal(a.run('annualStats(2026).maxRainIncRow'), null);
  assert.equal(a.run('annualStats(2026).hottestMonths[0].avg'), 0);
  a.run('store.rows=[{ts:new Date(2026,9,21),temp:null,hum:null,rain:null,rainInc:null}];buildYearlyStats()');
  assert.equal(a.run('annualStats(2026).temperature.avg'), null);
  assert.equal(a.run('annualStats(2026).topHotMonths.length'), 0);
  assert.doesNotMatch(a.nodes.get('yearStatsContent').innerHTML, /NaN|Infinity/);
});

test('annual cache is lazy, scans only the selected year and never rescans 250k rows on repeated render', () => {
  const a = app();
  a.run(`globalThis.visits=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(+new Date(2026,9,21)-i*300000),temp:i===17?85:10,hum:60,rain:0,rainInc:0
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key))) visits++;return Reflect.get(target,key,receiver)}});
    globalThis.snapshot=dataAggregates();globalThis.before=visits;`);
  assert.equal(a.run('snapshot.annual.size'), 0);
  a.run('el("yearStatsFilter").value="2026";buildYearlyStats()');
  assert.equal(a.run('visits-before'), a.run('snapshot.years.get(2026).end-snapshot.years.get(2026).start'));
  assert.equal(a.run('snapshot.annual.size'), 1);
  assert.equal(a.run('annualStats(2026).temperature.max'), 85);
  assert.equal(a.run('annualStats(2026).temperature.count'), a.run('snapshot.years.get(2026).end'));
  a.run('globalThis.cached=annualStats(2026);before=visits;buildYearlyStats();buildYearlyStats()');
  assert.equal(a.run('visits'), a.run('before'));
  assert.equal(a.run('annualStats(2026)===cached'), true);
  a.run('el("yearStatsFilter").value="0";buildYearlyStats();before=visits;buildYearlyStats()');
  assert.equal(a.run('visits'), a.run('before'));
  assert.equal(a.run('snapshot.annual.size===snapshot.years.size'), true);
});

test('year filter persists, falls back after removed years and clears its options with empty data', () => {
  const a = app();
  a.run('store.rows=[2026,2025].map(y=>({ts:new Date(y,1,1),temp:y,hum:null}));el("yearStatsFilter").value="2025";buildYearlyStats()');
  assert.equal(a.nodes.get('yearStatsFilter').value, '2025');
  assert.doesNotMatch(a.nodes.get('yearStatsContent').innerHTML, /ys-year-title">2026/);
  a.run('store.rows=[{ts:new Date(2026,1,1),temp:0,hum:null}];buildYearlyStats()');
  assert.equal(a.nodes.get('yearStatsFilter').value, '0');
  assert.match(a.nodes.get('yearStatsContent').innerHTML, /ys-year-title">2026/);
  a.run('store.rows=[];buildYearlyStats()');
  assert.equal(a.nodes.get('yearStatsFilter').innerHTML, '<option value="0">Všechny roky</option>');
  assert.match(a.nodes.get('yearStatsContent').innerHTML, /Žádná data/);
  assert.equal(a.run('annualStats(2025)'), null);
  assert.equal(a.run('dataAggregates().annual.size'), 0);
});

test('old-year corrections, deletions, array replacement and station reset discard annual summaries', () => {
  const a = app();
  a.run('store.rows=[2026,2025].map(y=>({ts:new Date(y,1,1),temp:10,hum:60}));globalThis.old=annualStats(2025);store.rows[1].temp=99;invalidateDerivedData()');
  assert.equal(a.run('annualStats(2025)===old'), false);
  assert.equal(a.run('annualStats(2025).temperature.max'), 99);
  a.run('store.rows.pop();invalidateDerivedData()');
  assert.equal(a.run('annualStats(2025)'), null);
  a.run('store.rows=[{ts:new Date(2025,1,1),temp:0,hum:0}]');
  assert.equal(a.run('annualStats(2025).temperature.avg'), 0);
  a.run('switchStation(1)');
  assert.equal(a.run('aggregateCache'), null);
  assert.equal(a.run('annualStats(2025)'), null);
});

test('actual CSV replacement and MQTT insertion invalidate annual statistics', async () => {
  const a = app();
  a.run('store.rows=[{ts:new Date(2026,9,20),temp:99}];annualStats(2026)');
  const done = a.run('parseAndStore("Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n20.10.2026,12:00,10,1010,60,0,0,,4")');
  a.tick(); await done;
  assert.equal(a.run('aggregateCache'), null);
  assert.equal(a.run('annualStats(2026).temperature.avg'), 10);
  a.run('CFG.source="both";CFG.mqttHost="test.example";connectMQTT()');
  a.clients[0].onMessageArrived({ payloadString:'{"temp":30,"hum":0,"rain":0,"voltage":0}' });
  assert.equal(a.run('aggregateCache'), null);
  assert.equal(a.run('annualStats(new Date().getFullYear()).temperature.max'), 30);
});

test('legacy counter differences preserve duplicate timestamps and resets without claiming hourly rainfall', () => {
  const a = app();
  a.run(`store.rows=[
    {ts:new Date(2026,0,2,0,5),temp:null,hum:null,rain:1,rainInc:1},
    {ts:new Date(2026,0,2,0),temp:null,hum:null,rain:0,rainInc:0},
    {ts:new Date(2026,0,1,23,55),temp:null,hum:null,rain:8,rainInc:4},
    {ts:new Date(2026,0,1,23,55),temp:null,hum:null,rain:4,rainInc:4},
    {ts:new Date(2026,0,1,0),temp:null,hum:null,rain:0,rainInc:0}];buildYearlyStats();`);
  const rows = JSON.parse(a.run('JSON.stringify(store.rows)')).map(row => ({ ...row, ts: new Date(row.ts) }));
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(annualStats(2026))')), plain(reference(rows, 2026)));
  assert.equal(a.run('annualStats(2026).maxRainInc'), 4);
  const html = a.nodes.get('yearStatsContent').innerHTML;
  assert.match(html, /Max\. přírůstek záznamu/);
  assert.match(html, /Bez ověření resetů čítače nejde o úhrn/);
  assert.doesNotMatch(html, /Max srážky\/h|Kolik napadlo nejvíce srážek za 1 hodinu/);
});

test('local year boundaries use the same timezone as the daily and monthly snapshot', () => {
  const helper = path.join(__dirname, 'helpers', 'app.js');
  for (const [TZ, year] of [['Europe/Prague',2026],['America/Los_Angeles',2025]]) {
    const out = execFileSync(process.execPath, ['-e', `const {app}=require(${JSON.stringify(helper)});const a=app();
      a.run('store.rows=[{ts:new Date("2026-01-01T00:30:00Z"),temp:10,hum:0}]');
      console.log(a.run('annualStats(${year}).temperature.count'));`], { env: { ...process.env, TZ }, encoding:'utf8' });
    assert.equal(out.trim(), '1');
  }
});
