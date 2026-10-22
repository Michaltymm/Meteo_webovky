const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { app } = require('./helpers/app');

test('malformed saved stations recover exactly three isolated defaults', () => {
  for (const saved of ['[null,null,null]', '[{},{},{},{}]', '{}', 'not json', '[{"interval":-1},{},{}]']) {
    const a=app({initialStorage:{'meteoDev:meteoStations':saved}});
    assert.equal(a.run('stations.length'),3);
    assert.equal(a.run('stations.every((s,i)=>s.interval>=10&&s.cfgFile===STATION_DEFAULTS[i].cfgFile)'),true);
  }
});
test('blocked storage supports start and session-only preference changes', () => {
  const a=app({storageFailure:true});
  a.run('preferences.setItem("meteoTheme","light"); switchStation(2); saveStations()');
  assert.equal(a.run('preferences.getItem("meteoTheme")'),'light');
  assert.equal(a.run('activeIdx'),2);
  assert.equal(a.run('preferences.persistent'),false);
});
test('all shipped station configs remain compatible including omitted coordinates', () => {
  const a=app();
  ['config_praha_baterie.json','config_praha_okno.json','config_stanice3.json'].forEach((file,i)=>{
    const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/^\uFEFF/,''));
    const parsed=a.run(`normalizeStationConfig(${JSON.stringify(cfg)},${i})`);
    for(const key of ['sheetId','sheetName','interval','source','mqttPort'])assert.equal(parsed[key],cfg[key]);
    assert.equal(Number.isFinite(parsed.lat),true);
  });
});
test('invalid import is atomic: data, source and station generation survive', () => {
  const a=app();a.run('store.rows=[{temp:12}]; globalThis.before=stationContext(); globalThis.previous=CFG');
  for(const input of ['null','[]','42','{interval:-1}','{interval:0}','{interval:1e9}','{lat:91}','{lon:Infinity}','{source:"other"}','{sheetId:"../other"}','{mqttHost:"https://user:pass@example.invalid"}','{mqttPort:65536}','{stationIdx:1}']) {
    assert.throws(()=>a.run(`_applyCfgObject(${input},"fixture",true)`));
    assert.equal(a.run('CFG===previous && isCurrentStation(before) && store.rows[0].temp===12'),true,input);
  }
  assert.equal(a.state.starts,0);
});
test('config allowlist discards unknown and prototype properties, preserves valid zero coordinates', () => {
  const a=app();a.run('_applyCfgObject(JSON.parse(\'{"__proto__":{"polluted":true},"unsupportedToken":"fixture","lat":0,"lon":0}\'),"fixture",false)');
  assert.equal(a.run('Object.hasOwn(CFG,"unsupportedToken") || Object.hasOwn(CFG,"__proto__") || !!({}).polluted'),false);
  assert.equal(a.run('preferences.getItem("meteoStations").includes("unsupportedToken")'),false);
  assert.equal(a.run('CFG.lat'),0);assert.equal(a.run('CFG.lon'),0);
});
test('oversized file is rejected before FileReader; invalid JSON preserves data', () => {
  const a=app();a.run('store.rows=[{temp:12}];loadConfigFromFile({files:[{size:65537,name:"fixture.json"}]})');
  assert.equal(a.readers.length,0);
  a.run('loadConfigFromFile({files:[{size:4,name:"fixture.json"}]})');
  a.readers[0].onload({target:{result:'null'}});
  assert.equal(a.run('store.rows[0].temp'),12);
  assert.match(a.nodes.get('cfgFileStatus').textContent,/Neplatná konfigurace/);
});
test('invalid active index and switch cannot escape the three stations', () => {
  const a=app({initialStorage:{'meteoDev:meteoActiveIdx':'1.5'}});
  assert.equal(a.run('activeIdx'),0);
  a.run('switchStation(-1);switchStation(3);switchStation(NaN)');
  assert.equal(a.run('activeIdx'),0);
});
