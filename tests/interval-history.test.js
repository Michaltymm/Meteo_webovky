const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

test('nearest history search matches the original full scan including ties and duplicates', () => {
  const a = app();
  assert.equal(a.run(`(() => {
    const rows=Array.from({length:1001},(_,i)=>({ts:new Date(Math.floor((1000-i)/3)*1000),id:i}));
    const reference=(t,tol)=>{
      let best=null,distance=Infinity;
      for(const r of rows){const d=Math.abs(r.ts-t);if(d<tol&&d<distance){best=r;distance=d;}}
      return best;
    };
    for(let t=-1000;t<335000;t+=499) for(const tol of [0,1,500,1000,1800000,Infinity,NaN]) {
      if(nearestHistoryRow(rows,t,tol)!==reference(t,tol)) return false;
    }
    return nearestHistoryRow([],0,1)===null && nearestHistoryRow(rows,NaN,1)===null;
  })()`), true);
});

test('nearest history lookup is bounded logarithmically on 250k measurements', () => {
  const a = app();
  a.run(`globalThis.reads=0;globalThis.large=Array.from({length:250000},(_,i)=>({ts:{
    getTime(){reads++;return 250000-i},valueOf(){return this.getTime()}
  }}));nearestHistoryRow(large,123456.5,10)`);
  assert.ok(a.run('reads < 100'), 'at most two binary searches, not a scan');
});

test('unchanged history markup does not replace DOM, but corrected values do', () => {
  const a = app(); const box = a.nodes.get('historyRows') || (a.run('el("historyRows")'), a.nodes.get('historyRows'));
  let writes = 0, value = '';
  Object.defineProperty(box, 'innerHTML', { get: () => value, set: v => { value = v; writes++; } });
  a.run('store.rows=[{ts:new Date(Date.now()-86400e3),temp:10,hum:60}];buildHistoryRows();buildHistoryRows()');
  assert.equal(writes, 1);
  a.run('store.rows[0].temp=0;buildHistoryRows()');
  assert.equal(writes, 2);
  assert.match(value, /0\.0 °C/);
});

test('endpoint comparison keeps real values, elapsed time, valid zero and original rows', () => {
  const a = app();
  a.run(`globalThis.rows=[{ts:new Date(0),temp:0,hum:50,pressure:1000,voltage:4.2},
    {ts:new Date(60000),temp:100,hum:null,pressure:null,voltage:null},
    {ts:new Date(7200000),temp:-2,hum:55,pressure:1001,voltage:4}];globalThis.result=intervalComparison(rows)`);
  assert.equal(a.run('result.elapsedMs'), 7200000);
  assert.equal(a.run('result.start===rows[0] && result.end===rows[2]'), true);
  assert.equal(a.run('JSON.stringify([result.delta.temp,result.delta.hum,result.delta.pressure])'), '[-2,5,1]');
  assert.ok(Math.abs(a.run('result.delta.voltage') + .2) < 1e-12);
  assert.equal(a.run('rows[1].temp'), 100);
});

test('missing endpoints are never replaced by valid interior samples or nonfinite deltas', () => {
  const a = app();
  a.run(`globalThis.rows=[{ts:new Date(0),temp:null,hum:Infinity,pressure:-1e308},
    {ts:new Date(1),temp:10,hum:50,pressure:1000},
    {ts:new Date(2),temp:20,hum:60,pressure:1e308}];globalThis.result=intervalComparison(rows)`);
  assert.equal(a.run('JSON.stringify(result.delta)'), '{"temp":null,"hum":null,"pressure":null,"voltage":null}');
  a.run('el("expMetric").value="temp";renderIntervalComparison(rows)');
  assert.match(a.nodes.get('expInterval').textContent, /nedostupné → 20\.00 °C · změna nedostupná/);
});

test('empty, single and invalid intervals clear previous content; duplicate time does not invent a rate', () => {
  const a = app();
  a.run('el("expMetric").value="temp";globalThis.pair=[{ts:new Date(0),temp:0},{ts:new Date(0),temp:1}];renderIntervalComparison(pair)');
  assert.match(a.nodes.get('expInterval').textContent, /0 h 0 min 0 s/);
  assert.equal(a.run('intervalComparison(pair).delta.temp'), 1);
  assert.equal(a.run('intervalComparison([{ts:new Date(2)},{ts:new Date(1)}])'), null);
  assert.equal(a.run('intervalComparison([{ts:new Date(NaN)},{ts:new Date(1)}])'), null);
  a.run('renderIntervalComparison([pair[0]])');
  assert.equal(a.nodes.get('expInterval').hidden, true);
  assert.equal(a.nodes.get('expInterval').textContent, '');
  a.run('_drawExplorerPts(pair);_drawExplorerPts([])');
  assert.equal(a.nodes.get('expInterval').hidden, true);
});

test('explorer uses unsampled slider endpoints, percentage points, and resets across station/metric changes', () => {
  const a = app();
  a.run(`store.rows=Array.from({length:10000},(_,i)=>({ts:new Date(Date.now()-i*300000),temp:i/100,hum:i%100,voltage:4,rain:0}));
    expRange="all";el("expMetric").value="temp_hum";buildExplorer();
    el("expSliderL").value="80";el("expSliderR").value="20";expSliderUpdate()`);
  assert.match(a.nodes.get('expInterval').textContent, /79\.99 °C → 20\.00 °C · změna -59\.99 °C/);
  assert.match(a.nodes.get('expInterval').textContent, /p\. b\./);
  a.run('el("expMetric").value="rain";buildExplorer()');
  assert.equal(a.nodes.get('expInterval').hidden, true);
  a.run('el("expMetric").value="voltage";buildExplorer()');
  assert.equal(a.nodes.get('expInterval').hidden, false);
  a.run('switchStation(1)');
  assert.equal(a.nodes.get('expInterval').hidden, true);
  assert.equal(a.nodes.get('expInterval').textContent, '');
});

test('elapsed time across a DST fold follows timestamps, not repeated wall clock labels', () => {
  const a = app();
  assert.equal(a.run(`intervalComparison([
    {ts:new Date('2026-10-25T02:30:00+02:00'),temp:10},
    {ts:new Date('2026-10-25T02:30:00+01:00'),temp:11}]).elapsedMs`), 3600000);
});

test('refresh preserves unchanged text nodes and writes changed values including zero', () => {
  const a = app({ realRefresh: true });
  a.run(`store.rows=[0,1].map(i=>({ts:new Date(Date.now()-i*60000),temp:20-i*10,hum:60,
    pressure:1010,voltage:4,rain:0,rainInc:0,tank:null}));refreshUI()`);
  let writes = 0;
  for (const node of a.nodes.values()) {
    let content = node.textContent;
    Object.defineProperty(node, 'textContent', { get: () => content, set: value => { content = value; writes++; } });
  }
  a.run('refreshUI()');
  assert.equal(writes, 0);
  a.run('store.rows[0].temp=0;invalidateDerivedData();refreshUI()');
  assert.ok(writes > 0);
  assert.equal(a.nodes.get('curTemp').textContent, '0.0');
  assert.equal(a.nodes.get('tempTrend').textContent, '↓');
  a.run('CFG.name="<img src=x>";refreshUI()');
  assert.equal(a.nodes.get('statLocation').textContent, '<img src=x>');
});
