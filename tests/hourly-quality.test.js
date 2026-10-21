const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { app } = require('./helpers/app');

test('hourly means match the old stable full-data calculation for all metrics and duplicates', () => {
  const a=app();
  assert.equal(a.run(`(() => {
    store.rows=Array.from({length:3000},(_,i)=>({ts:new Date(2026,9,21,23,59-Math.floor(i/3)),
      temp:i%11===0?null:(i%47-20)/3,hum:i%7===0?null:i%101,pressure:i%13===0?null:1000+i%10}));
    const key='2026-10-21',actual=hourlyDay(key);
    const rows=store.rows.filter(r=>localDateKey(r.ts)===key).slice().sort((a,b)=>a.ts-b.ts);
    for(const metric of ['temp','hum','pressure']) for(let h=0;h<24;h++) {
      const group=rows.filter(r=>r.ts.getHours()===h && Number.isFinite(r[metric]));
      const mean=group.length?+(group.reduce((n,r)=>n+r[metric],0)/group.length).toFixed(1):null;
      const stat=actual.values[metric][h];
      if(stat.avg!==mean || stat.count!==group.length || stat.unique!==new Set(group.map(r=>+r.ts)).size) return false;
    }
    return actual.count===rows.length && actual.unique===new Set(rows.map(r=>+r.ts)).size && store.rows.length===3000;
  })()`),true);
});

test('equal-time summation order is preserved rather than reversed with descending history', () => {
  const a=app();
  a.run('store.rows=[1e16,-1e16,1].map(temp=>({ts:new Date(2026,9,21,12),temp,hum:0,pressure:0}));globalThis.day=hourlyDay("2026-10-21")');
  assert.equal(a.run('day.values.temp[12].avg'),.3);
  assert.equal(a.run('day.values.hum[12].avg'),0);
  assert.equal(a.run('day.values.pressure[12].avg'),0);
  assert.equal(a.run('day.values.temp[12].count'),3);
  assert.equal(a.run('day.values.temp[12].unique'),1);
  assert.equal(a.run('day.maxGapMs'),null);
});

test('null/nonfinite values do not become zero and data counts differ from numeric metric counts', () => {
  const a=app();
  a.run('store.rows=[0,null,Infinity,NaN].map((temp,i)=>({ts:new Date(2026,9,21,12,30-i),temp,hum:null}));globalThis.day=hourlyDay("2026-10-21")');
  assert.equal(a.run('day.count'),4);
  assert.equal(a.run('day.values.temp[12].avg'),0);
  assert.equal(a.run('day.values.temp[12].count'),1);
  assert.equal(a.run('day.values.hum[12].avg'),null);
  assert.equal(a.run('day.metricSlots.hum'),0);
  assert.equal(a.run('day.observedSlots'),1);
  assert.equal(a.run('day.values.temp[0].avg'),null);
});

test('sparse endpoints report a gap rather than implying all intervening hours were observed', () => {
  const a=app();
  a.run('store.rows=[23,0].map(h=>({ts:new Date(2026,9,21,h),temp:10}));globalThis.day=hourlyDay("2026-10-21")');
  assert.equal(a.run('day.count'),2);
  assert.equal(a.run('day.unique'),2);
  assert.equal(a.run('day.observedSlots'),2);
  assert.equal(a.run('day.last-day.first'),23*3600000);
  assert.equal(a.run('day.maxGapMs'),23*3600000);
  a.run('el("cmpMetric").value="temp";cmpSelectedDays=["2026-10-21"];buildCompare()');
  assert.match(a.nodes.get('cmpDataQuality').textContent,/2\/24/);
  assert.match(a.nodes.get('cmpDataQuality').textContent,/nejsou dostupnost senzoru/);
  assert.equal(a.run('chartCompare.data.datasets[0].spanGaps'),false);
});

test('missing dates have no fabricated values and invalid input does not enter the cache', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(2026,9,21),temp:0}];globalThis.missing=hourlyDay("2026-10-20");globalThis.bad=hourlyDay("2026-02-30")');
  assert.equal(a.run('missing.count'),0);
  assert.equal(a.run('missing.values.temp.every(s=>s.avg===null && s.count===0)'),true);
  assert.equal(a.run('bad.slots'),0);
  assert.equal(a.run('dataAggregates().hourly.has("2026-02-30")'),false);
});

test('hourly lookup scans only its day and cached metric changes do not rescan 250k rows', () => {
  const a=app();
  a.run(`globalThis.reads=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(Date.now()-i*300000),temp:i%20,hum:i%100,pressure:1000
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key))) reads++;return Reflect.get(target,key,receiver)}});
    dataAggregates();globalThis.startReads=reads;globalThis.day=hourlyDay(localDateKey());globalThis.afterReads=reads`);
  assert.ok(a.run('afterReads-startReads<2000'));
  a.run('cmpSelectedDays=[localDateKey()];el("cmpMetric").value="temp_hum";buildCompare();el("cmpMetric").value="pressure";buildCompare()');
  assert.equal(a.run('reads===afterReads'),true);
  assert.equal(a.run('store.rows.length'),250000);
});

test('hourly cache is bounded to eight days and evicts the least recently used entry', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(2026,9,21),temp:0}];for(let i=1;i<=8;i++)hourlyDay("2026-10-"+_pad2(i));hourlyDay("2026-10-01");hourlyDay("2026-10-09")');
  assert.equal(a.run('dataAggregates().hourly.size'),8);
  assert.equal(a.run('dataAggregates().hourly.has("2026-10-01")'),true);
  assert.equal(a.run('dataAggregates().hourly.has("2026-10-02")'),false);
});

test('historical correction, station change and an empty store clear stale comparison evidence', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(2026,9,21,12),temp:10}];cmpSelectedDays=["2026-10-21"];el("cmpMetric").value="temp";buildCompare();globalThis.previous=hourlyDay("2026-10-21");store.rows[0].temp=20;invalidateDerivedData()');
  assert.equal(a.nodes.get('cmpDataQuality').textContent,'');
  assert.equal(a.run('hourlyDay("2026-10-21")===previous'),false);
  assert.equal(a.run('hourlyDay("2026-10-21").values.temp[12].avg'),20);
  a.run('buildCompare();switchStation(1)');
  assert.equal(a.nodes.get('cmpDataQuality').textContent,'');
  a.run('buildCompare()');
  assert.equal(a.run('chartCompare.data.datasets.length'),0);
});

test('tooltip and evidence distinguish counts, distinct timestamps and partial/full history', () => {
  const a=app();
  a.run('store.rows=[{ts:new Date(2026,9,21,12),temp:0},{ts:new Date(2026,9,21,12),temp:10}];cmpSelectedDays=["2026-10-21"];el("cmpMetric").value="temp";buildCompare()');
  assert.equal(a.run('compareTooltip({dataset:chartCompare.data.datasets[0],dataIndex:12})'),'Číselné hodnoty: 2 · různé časy: 1');
  assert.match(a.nodes.get('cmpDataQuality').textContent,/částečná historie/);
  a.run('store.fullLoaded=true;buildCompare()');
  assert.match(a.nodes.get('cmpDataQuality').textContent,/celá dostupná historie/);
  assert.equal(a.run('compareTooltip({dataset:{},dataIndex:0})'),'');
});

for (const [zone,cases] of [
  ['Europe/Prague',[['2026-03-29',23,23],['2026-10-25',25,25]]],
  ['America/New_York',[['2026-03-08',23,23],['2026-11-01',25,25]]],
  ['Australia/Lord_Howe',[['2026-04-05',24.5,25],['2026-10-04',23.5,24]]],
  ['Pacific/Kiritimati',[['2026-10-21',24,24]]]
]) {
  test(`hour groups and day duration follow the actual zone, including partial-hour DST: ${zone}`,()=>{
    execFileSync(process.execPath,['-e',`
      const assert=require('node:assert/strict');const {app}=require('./tests/helpers/app');const a=app();
      for(const [key,hours,slots] of ${JSON.stringify(cases)}) {
        a.run('globalThis.day=hourlyDay('+JSON.stringify(key)+')');
        assert.equal(a.run('day.durationMs/3600000'),hours);
        assert.equal(a.run('day.slots'),slots);assert.equal(a.run('day.count'),0);
      }
    `],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:zone},stdio:'pipe'});
  });
}

test('two autumn offsets count as two observed groups while sharing the comparison hour',()=>{
  execFileSync(process.execPath,['-e',`
    const assert=require('node:assert/strict');const {app}=require('./tests/helpers/app');const a=app();
    a.run(\`store.rows=[{ts:new Date('2026-10-25T02:30:00+01:00'),temp:20},{ts:new Date('2026-10-25T02:30:00+02:00'),temp:10}];globalThis.day=hourlyDay('2026-10-25')\`);
    assert.equal(a.run('day.observedSlots'),2);assert.equal(a.run('day.unique'),2);
    assert.equal(a.run('day.values.temp[2].count'),2);assert.equal(a.run('day.values.temp[2].avg'),15);
    assert.equal(a.run('day.maxGapMs'),3600000);
  `],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:'Europe/Prague'},stdio:'pipe'});
});
