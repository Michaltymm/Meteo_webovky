const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const close = (value, expected, tolerance = 1e-12) => assert.ok(Math.abs(value-expected) < tolerance, `${value} != ${expected}`);

test('warming at constant partial vapour pressure explains RH change through temperature alone', () => {
  const a = app();
  a.run(`globalThis.start={ts:new Date(0),temp:10,hum:80};
    globalThis.end={ts:new Date(3600000),temp:20,hum:80*12.2603020552852/23.3259602209781};
    globalThis.change=humidityChange(start,end)`);
  assert.equal(a.run('change.status'), 'ok');
  close(a.run('change.vaporFactor'), 1);
  close(a.run('change.vaporLog'), 0);
  close(a.run('change.rhFactor'), a.run('change.temperatureFactor'));
  close(a.run('change.counterRH'), a.run('end.hum'), 1e-9); // Rounded independent es reference.
});

test('isothermal vapour change has a unit temperature factor and the correct logarithmic contribution', () => {
  const a = app();
  a.run('globalThis.change=humidityChange({ts:new Date(0),temp:20,hum:40},{ts:new Date(1),temp:20,hum:80})');
  close(a.run('change.temperatureFactor'), 1);
  close(a.run('change.vaporFactor'), 2);
  close(a.run('change.rhLog'), Math.log(2));
  close(a.run('change.vaporLog'), Math.log(2));
  close(a.run('change.counterRH'), 40);
});

test('combined endpoint changes satisfy the independent RH ratio and log identity throughout the stated domain', () => {
  const a = app();
  assert.equal(a.run(`(() => {
    for(const t1 of [-45,-10,0,20,60]) for(const t2 of [-45,-10,0,20,60])
      for(const h1 of [.01,10,50,100]) for(const h2 of [.01,10,50,100]) {
        const result=humidityChange({ts:new Date(0),temp:t1,hum:h1},{ts:new Date(1),temp:t2,hum:h2});
        if(result.status!=='ok' || Math.abs(result.temperatureLog+result.vaporLog-Math.log(h2/h1))>1e-12 ||
          Math.abs(result.temperatureFactor*result.vaporFactor/(h2/h1)-1)>1e-12) return false;
    }
    return true;
  })()`), true);
});

test('identical valid states have no contributions and saturated RH remains valid', () => {
  const a = app();
  a.run('globalThis.change=humidityChange({ts:new Date(0),temp:0,hum:100},{ts:new Date(1),temp:0,hum:100})');
  for (const key of ['rhLog','temperatureLog','vaporLog']) close(a.run(`change.${key}`), 0);
  assert.equal(a.run('change.counterRH'), 100);
  assert.equal(a.run('change.aboveSaturation'), false);
});

test('a cooling counterfactual beyond saturation is labelled as a formal model, not observed RH', () => {
  const a = app();
  a.run(`el('expMetric').value='hum';globalThis.rows=[{ts:new Date(0),temp:20,hum:80},{ts:new Date(1),temp:0,hum:80}];
    renderIntervalComparison(rows)`);
  assert.equal(a.run('humidityChange(rows[0],rows[1]).aboveSaturation'), true);
  assert.match(a.nodes.get('expHumidityChangeValue').textContent, />100 % — překročeno nasycení; formální model bez kondenzace/);
  assert.match(a.nodes.get('expHumidityChangeValue').textContent, /Výsledný poměr RH: ×1.0000/);
});

test('zero, missing and out-of-domain endpoint values remain unavailable instead of being replaced', () => {
  const a = app();
  for (const endpoint of ['{temp:20,hum:0}','{temp:20,hum:null}','{temp:null,hum:50}',
    '{temp:61,hum:50}','{temp:-46,hum:50}','{temp:20,hum:101}','{temp:NaN,hum:50}','{temp:20,hum:Infinity}']) {
    a.run(`globalThis.rows=[{ts:new Date(0),temp:20,hum:50},{ts:new Date(1),...${endpoint}}];el('expMetric').value='hum';renderIntervalComparison(rows)`);
    assert.notEqual(a.run('humidityChange(rows[0],rows[1]).status'), 'ok');
    assert.match(a.nodes.get('expHumidityChangeValue').textContent, /Rozklad není dostupný/);
    assert.doesNotMatch(a.nodes.get('expHumidityChangeValue').textContent, /NaN|Infinity/);
  }
  assert.equal(a.run('humidityChange({ts:new Date(0),temp:20,hum:0},{ts:new Date(1),temp:20,hum:50}).status'), 'zero');
  assert.equal(a.run('absoluteHumidity(20,0)'), 0);
});

test('repeated, reversed and invalid timestamps cannot claim a temporal development', () => {
  const a = app();
  for (const end of ['0','-1','NaN']) {
    assert.equal(a.run(`humidityChange({ts:new Date(0),temp:20,hum:50},{ts:new Date(${end}),temp:10,hum:50}).status`), 'time');
  }
  assert.equal(a.run('humidityChange(null,null).status'), 'time');
  assert.equal(a.run(`humidityChange({ts:new Date('2026-10-25T02:30:00+02:00'),temp:20,hum:50},
    {ts:new Date('2026-10-25T02:30:00+01:00'),temp:10,hum:50}).status`), 'ok');
});

test('numerical underflow is rejected and tiny valid quantities use nonzero scientific notation', () => {
  const a = app();
  assert.equal(a.run('humidityChange({ts:new Date(0),temp:0,hum:5e-324},{ts:new Date(1),temp:0,hum:50}).status'), 'numeric');
  a.run(`el('expMetric').value='hum';renderIntervalComparison([
    {ts:new Date(0),temp:20,hum:.0001},{ts:new Date(1),temp:20,hum:.0002}])`);
  assert.match(a.nodes.get('expHumidityChangeValue').textContent, /RH 1.000e-4 %/);
  assert.doesNotMatch(a.nodes.get('expHumidityChangeValue').textContent, /NaN|Infinity/);
});

test('the new endpoint calculation reads exactly two original rows even in a 250k interval', () => {
  const a = app();
  a.run(`globalThis.reads=0;globalThis.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(i*60000),temp:10+i/25000,hum:i===0?80:i===249999?60:0
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver)}});
    el('expMetric').value='hum';renderIntervalComparison(rows)`);
  assert.equal(a.run('reads'), 2);
  assert.match(a.nodes.get('expHumidityChangeValue').textContent, /RH 80.00 %/);
  assert.match(a.nodes.get('expHumidityChangeValue').textContent, /RH 60.00 %/);
  assert.equal(a.requests.length, 0);
});

test('slider uses original endpoints and the panel clears on unrelated metrics, missing intervals and source reset', () => {
  const a = app();
  a.run(`store.rows=Array.from({length:1000},(_,i)=>({ts:new Date(Date.now()-i*60000),temp:20+i/100,hum:50}));
    el('expMetric').value='hum';expRange='all';buildExplorer();
    globalThis.realChange=humidityChange;globalThis.selected=null;
    humidityChange=(start,end)=>{selected={start,end};return realChange(start,end)};
    el('expSliderL').value='20';el('expSliderR').value='80';expSliderUpdate()`);
  assert.equal(a.run('selected.start===expAllPts[200] && selected.end===expAllPts[799]'), true);
  assert.equal(a.nodes.get('expHumidityChange').hidden, false);
  a.run('el("expMetric").value="vpd";buildExplorer()');
  assert.equal(a.nodes.get('expHumidityChange').hidden, false);
  assert.equal(a.nodes.get('expInterval').hidden, true);
  a.run('el("expMetric").value="pressure";buildExplorer()');
  assert.equal(a.nodes.get('expHumidityChange').hidden, true);
  assert.equal(a.nodes.get('expHumidityChangeValue').textContent, '');
  a.run('el("expMetric").value="hum";buildExplorer();invalidateDerivedData()');
  assert.equal(a.nodes.get('expHumidityChange').hidden, true);
  assert.equal(a.nodes.get('expHumidityChangeValue').textContent, '');
  a.run('renderIntervalComparison([{ts:new Date(),temp:20,hum:50}])');
  assert.equal(a.nodes.get('expHumidityChange').hidden, true);
  a.run('switchStation(1)');
  assert.equal(a.nodes.get('expHumidityChange').hidden, true);
});
