const assert=require('node:assert/strict');
const{test}=require('node:test');
const{app}=require('./helpers/app');
function ready(options){const a=app(options);a.run(`el('deviceSettings').open=true;renderDeviceSettings(true)`);return a;}
test('device settings use stable station keys and no fabricated interval, identity or contact',()=>{
 const a=ready();assert.equal(a.nodes.get('deviceInterval').value,'');
 assert.equal(a.nodes.get('deviceStationKey').textContent,'config_praha_baterie');
 assert.match(a.nodes.get('deviceLastMeasurement').textContent,/bez měření/);
 assert.equal(a.requests.length,0);
});
test('device draft is isolated from website settings, each station and production preferences',()=>{
 const a=ready();const original=a.run('JSON.stringify(stations)');
 for(let i=0;i<3;i++){
  a.run(`activeIdx=${i};CFG=stations[activeIdx];renderDeviceSettings();el('deviceInterval').value='${300+i}';saveDeviceDraft()`);
  assert.match(a.nodes.get('deviceDraftStatus').textContent,/neodesláno do ESP/);
 }
 for(let i=0;i<3;i++){
  a.run(`activeIdx=${i};CFG=stations[activeIdx];renderDeviceSettings()`);
  assert.equal(a.nodes.get('deviceInterval').value,String(300+i));
 }
 assert.equal(a.run('JSON.stringify(stations)'),original);assert.equal(a.requests.length,0);
 assert.equal(a.run('preferenceMemory.has("meteoStations")'),false);
 assert.equal(a.run('preferencePrefix'),'meteoDev:');
});
test('invalid intervals cannot overwrite a valid draft',()=>{
 const a=ready();a.run(`el('deviceInterval').value='300';saveDeviceDraft()`);
 for(const value of ['',0,59,86401,300.5,'Infinity','NaN']){
  a.nodes.get('deviceInterval').value=String(value);assert.equal(a.run('saveDeviceDraft()'),null);
  assert.equal(a.run('readDeviceDraft().measurementIntervalSeconds'),300);
 }
 for(const value of [60,86400])assert.equal(a.run(`validateDeviceDraft({schemaVersion:1,measurementIntervalSeconds:${value}}).measurementIntervalSeconds`),value);
});
test('data refresh does not erase unsaved input and station change cannot show the previous draft',()=>{
 const a=ready({realRefresh:true});a.run(`el('deviceInterval').value='600';refreshUI()`);
 assert.equal(a.nodes.get('deviceInterval').value,'600');
 a.run(`activeIdx=1;CFG=stations[1];renderDeviceSettings()`);assert.equal(a.nodes.get('deviceInterval').value,'');
 a.run(`store.rows=[{ts:new Date(0),temp:0}];renderDeviceSettings()`);
 assert.match(a.nodes.get('deviceLastMeasurement').textContent,/1970/);
 a.run('resetStationStore()');assert.match(a.nodes.get('deviceLastMeasurement').textContent,/bez měření/);
});
test('storage failure is honest; malformed or wrong-schema stored data is ignored',()=>{
 const a=ready({storageFailure:true});a.run(`el('deviceInterval').value='600';saveDeviceDraft()`);
 assert.match(a.nodes.get('deviceDraftStatus').textContent,/pouze v paměti/);
 for(const raw of ['{','null','{"schemaVersion":2,"measurementIntervalSeconds":300}','{"schemaVersion":1,"measurementIntervalSeconds":"300"}']){
  const b=ready({initialStorage:{'meteoDev:deviceDraft:config_praha_baterie':raw}});
  assert.equal(b.nodes.get('deviceInterval').value,'');
 }
});
