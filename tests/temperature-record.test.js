const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { app } = require('./helpers/app');

function install(a, rows, fullLoaded=true) {
  a.run(`store.rows=${JSON.stringify(rows)}.map(r=>({...r,ts:new Date(r.ts)})).sort((a,b)=>b.ts-a.ts);
    store.fullLoaded=${fullLoaded};invalidateDerivedData();el('appVersion').textContent='Verze test';syncTemperatureRecord();`);
}
const fixture=()=>[12,42.123456789,42.123456789,null,-7.123456789,-7.123456789,0].map((temp,i)=>({
  ts:+new Date(2026,9,22,12)-i*60000,temp,hum:50+i/7,pressure:1000+i/3,voltage:4+i/11
}));
const data=a=>JSON.parse(a.run('JSON.stringify(temperatureRecordData())'));

test('global temperature provenance keeps exact values, stable winning indices and exact ties',()=>{
  const a=app(),rows=fixture();rows[2].ts=rows[1].ts;
  install(a,rows);a.run('openTemperatureRecord("max")');
  const max=data(a);
  assert.equal(max.index,2);assert.equal(max.temp,'42.123456789');assert.equal(max.ties,2);
  assert.equal(max.count,6);assert.equal(max.excluded,1);assert.equal(max.total,7);
  assert.equal(max.hum,String(rows[1].hum));assert.equal(max.pressure,String(rows[1].pressure));
  assert.equal(max.voltage,String(rows[1].voltage));
  assert.equal(a.run('dataAggregates().temperature.maxRow===store.rows[1]'),true);
  assert.equal(a.run('dataAggregates().temperature.maxIndex'),1);
  assert.equal(a.nodes.get('tempRecordKind').value,'max');
  assert.equal(a.nodes.get('tempRecord').open,true);assert.equal(a.nodes.get('tempRecordContent').hidden,false);
  assert.match(a.nodes.get('tempRecordFormula').textContent,/Verze test/);
  a.run('openTemperatureRecord("min")');
  assert.equal(data(a).index,5);assert.equal(data(a).temp,'-7.123456789');assert.equal(data(a).ties,2);
  assert.equal(a.run('dataAggregates().temperature.minRow===store.rows[4]'),true);
  assert.equal(a.run('dataAggregates().temperature.minIndex'),4);
  assert.equal(a.requests.length,0);
});

test('equal displayed temperatures do not become equal raw extremes',()=>{
  const a=app({realRefresh:true});
  install(a,[20.041,20.049,20.049].map((temp,i)=>({ts:+new Date(2026,9,22,12)-i*60000,temp})));
  a.run('refreshUI();openTemperatureRecord("max")');
  assert.equal(data(a).temp,'20.049');assert.equal(data(a).index,2);assert.equal(data(a).ties,2);
  assert.match(a.nodes.get('statTempMax').textContent,/20[.,]0/);
  a.run('openTemperatureRecord("min")');
  assert.equal(data(a).temp,'20.041');assert.equal(data(a).index,1);assert.equal(data(a).ties,1);
  assert.match(a.nodes.get('statTempMin').textContent,/20[.,]0/);
});

test('zero can be both extremes and optional source sensors retain independent missingness',()=>{
  const a=app();
  install(a,[{ts:+new Date(2026,9,22,12),temp:0,hum:null,pressure:0,voltage:null},
    {ts:+new Date(2026,9,22,11),temp:0,hum:50,pressure:1000,voltage:4}]);
  for(const kind of ['min','max']) {
    a.run(`openTemperatureRecord(${JSON.stringify(kind)})`);
    assert.equal(data(a).temp,'0');assert.equal(data(a).index,1);assert.equal(data(a).ties,2);
    assert.equal(data(a).hum,'–');assert.equal(data(a).pressure,'0');assert.equal(data(a).voltage,'–');
  }
});

test('only finite numeric temperatures participate, and an all-missing history clears actions and old details',()=>{
  const a=app();install(a,fixture());a.run('openTemperatureRecord("max")');
  a.run(`store.rows=[null,NaN,Infinity,-Infinity,'20',0].map((temp,i)=>({ts:new Date(2026,9,22,12,0,-i),temp}));
    invalidateDerivedData();syncTemperatureRecord();openTemperatureRecord('min')`);
  assert.equal(data(a).count,1);assert.equal(data(a).excluded,5);assert.equal(data(a).total,6);
  assert.equal(data(a).index,6);assert.equal(data(a).temp,'0');
  a.run('store.rows.pop();invalidateDerivedData();syncTemperatureRecord();openTemperatureRecord("max")');
  assert.equal(a.run('temperatureRecordView'),null);assert.equal(data(a),null);
  for(const id of ['tempRecord','statTempMinSource','statTempMaxSource'])assert.equal(a.nodes.get(id).hidden,true);
  assert.equal(a.nodes.get('tempRecordBody').innerHTML,'');
  for(const field of ['min','max','minRow','maxRow','minIndex','maxIndex'])
    assert.equal(a.run(`dataAggregates().temperature.${field}`),null);
  for(const field of ['count','minTies','maxTies'])assert.equal(a.run(`dataAggregates().temperature.${field}`),0);
});

test('scope reports every loaded row and distinguishes partial from full history',()=>{
  const a=app(),rows=fixture();
  install(a,rows,false);a.run('openTemperatureRecord("max")');
  const partial=data(a);
  assert.equal(partial.from,a.run('intervalTimestamp(store.rows.at(-1).ts)'));
  assert.equal(partial.to,a.run('intervalTimestamp(store.rows[0].ts)'));
  assert.match(a.nodes.get('tempRecordInfo').textContent,/částečná/i);
  a.run('store.fullLoaded=true');
  assert.equal(a.run('temperatureRecordIsCurrent()'),false);assert.equal(data(a),null);
  a.run('syncTemperatureRecord()');assert.equal(a.run('temperatureRecordView'),null);
  assert.equal(a.nodes.get('tempRecord').open,false);
  a.run('openTemperatureRecord("max")');
  assert.match(a.nodes.get('tempRecordInfo').textContent,/celá dostupná/i);
  assert.deepEqual(data(a),partial);
});

test('warm opening is constant work even with 250k matching records, without copied tie lists',()=>{
  const a=app();
  a.run(`globalThis.reads=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
    ts:new Date(+new Date(2026,9,22,12)-i*1000),temp:0,hum:50,pressure:1000,voltage:4
  })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver)}});
    store.fullLoaded=true;syncTemperatureRecord();globalThis.start=reads;syncTemperatureRecord();`);
  assert.equal(a.run('reads'),a.run('start'));assert.equal(a.run('temperatureRecordView'),null);
  a.run('openTemperatureRecord("max")');
  assert.ok(a.run('reads-start')<=3);
  a.run('globalThis.start=reads;globalThis.record=temperatureRecordData()');
  assert.ok(a.run('reads-start')<=3);
  assert.equal(a.run('record.ties'),250000);assert.equal(a.run('record.count'),250000);
  assert.equal(a.run('record.index'),1);
  assert.equal(a.run('Object.values(temperatureRecordView).some(Array.isArray)'),false);
  assert.equal(a.run('Object.values(dataAggregates().temperature).some(Array.isArray)'),false);
  assert.equal((a.nodes.get('tempRecordBody').innerHTML.match(/<tr>/g)||[]).length,1);
  assert.equal(a.requests.length,0);
});

test('source replacement, correction, deletion, station/reset and collapse cannot retain a stale winner',()=>{
  for(const action of [
    'store.rows=store.rows.map(r=>({...r,temp:99}));syncTemperatureRecord()',
    'store.rows[1].temp=-99;invalidateDerivedData()',
    'store.rows.pop();invalidateDerivedData()',
    'switchStation(1)',
    'resetStationStore()',
    'el("tempRecord").open=false;toggleTemperatureRecord()'
  ]) {
    const a=app();install(a,fixture());a.run('openTemperatureRecord("max");'+action);
    assert.equal(a.run('temperatureRecordView'),null);
    assert.equal(a.nodes.get('tempRecordBody').innerHTML,'');
    assert.equal(a.nodes.get('tempRecordInfo').textContent,'');
    assert.equal(a.nodes.get('tempRecordContent').hidden,true);
    assert.equal(data(a),null);
  }
});

test('stale guards cover raw source identity, length, local day, station, fullness and selected kind',()=>{
  for(const action of [
    'store.rows=store.rows.slice()', 'store.rows.pop()',
    'temperatureRecordView.snapshot.dayKey="1900-01-01"',
    'activeIdx=1', 'store.fullLoaded=false', 'el("tempRecordKind").value="min"'
  ]) {
    const a=app();install(a,fixture());a.run('openTemperatureRecord("max");'+action);
    assert.equal(a.run('temperatureRecordIsCurrent()'),false);assert.equal(data(a),null);
    a.run('syncTemperatureRecord()');assert.equal(a.run('temperatureRecordView'),null);
    assert.equal(a.nodes.get('tempRecord').open,false);
  }
});

test('CSV replacement and MQTT insertion invalidate an open global extreme',async()=>{
  for(const transport of ['csv','mqtt']) {
    const a=app();install(a,fixture());a.run('openTemperatureRecord("max")');
    if(transport==='csv') {
      const done=a.run('parseAndStore("Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\\n20.10.2026,12:00,10,1010,60,0,0,,4")');
      a.tick();await done;
    } else {
      a.run('CFG.source="both";CFG.mqttHost="test.example";connectMQTT()');
      a.clients[0].onMessageArrived({payloadString:'{"temp":99,"hum":0,"rain":0,"voltage":0}'});
    }
    assert.equal(a.run('temperatureRecordView'),null);assert.equal(data(a),null);
    assert.equal(a.nodes.get('tempRecordBody').innerHTML,'');
    assert.equal(a.nodes.get('tempRecord').open,false);
    a.run('syncTemperatureRecord();openTemperatureRecord("max")');
    assert.equal(data(a).temp,transport==='csv'?'10':'99');
  }
});

test('invalid extreme kinds and an empty history cannot create a source row',()=>{
  const a=app();install(a,fixture());
  for(const kind of ['mean','__proto__','constructor','']) {
    a.run(`openTemperatureRecord(${JSON.stringify(kind)})`);
    assert.equal(a.run('temperatureRecordView'),null);assert.equal(data(a),null);
    assert.equal(a.nodes.get('tempRecordBody').innerHTML,'');
  }
  a.run('store.rows=[];invalidateDerivedData();syncTemperatureRecord();openTemperatureRecord("min")');
  assert.equal(a.run('temperatureRecordView'),null);assert.equal(data(a),null);
  assert.equal(a.nodes.get('tempRecord').hidden,true);
});

test('untrusted legacy text cannot inject HTML through the original row or its context',()=>{
  const a=app(),payload='<img src=x onerror=globalThis.injected=1>';
  install(a,[{ts:+new Date(2026,9,22,12),temp:0,hum:payload,pressure:null,voltage:0,note:payload}]);
  a.run(`globalThis.intervalTimestamp=()=>${JSON.stringify(payload)};el('appVersion').textContent=${JSON.stringify(payload)};CFG.name=${JSON.stringify(payload)};openTemperatureRecord('max')`);
  const markup=a.nodes.get('tempRecordBody').innerHTML;
  assert.ok(!markup.includes('<img'));assert.ok(markup.includes('&lt;img'));
  assert.equal(data(a).hum,'–');assert.equal(a.run('typeof globalThis.injected'),'undefined');
});

test('global extrema ignore annual and comparison selections and leave existing aggregates untouched',()=>{
  const a=app({realRefresh:true});
  install(a,[{ts:+new Date(2026,9,22,12),temp:10,hum:50,rain:0},
    {ts:+new Date(2025,9,22,12),temp:90,hum:60,rain:1}]);
  a.run('refreshUI();el("yearStatsFilter").value="2026";buildYearlyStats();cmpSelectedDays=["2026-10-22"];el("cmpMetric").value="temp";buildCompare()');
  const before=a.run('JSON.stringify([dataAggregates().today,annualStats(2026),hourlyDay("2026-10-22").values,chartCompare.data])');
  a.run('openTemperatureRecord("max")');
  assert.equal(data(a).temp,'90');assert.equal(data(a).index,2);assert.equal(data(a).total,2);
  assert.match(a.nodes.get('statTempMax').textContent,/90[.,]0/);
  assert.equal(a.run('annualStats(2026).temperature.max'),10);
  assert.equal(a.run('JSON.stringify([dataAggregates().today,annualStats(2026),hourlyDay("2026-10-22").values,chartCompare.data])'),before);
});

test('repeated local times retain the UTC offset of each chosen original temperature extreme',()=>{
  execFileSync(process.execPath,['-e',`
    const assert=require('node:assert/strict'),{app}=require('./tests/helpers/app');const a=app();
    a.run(\`store.rows=[
      {ts:new Date('2026-10-25T02:30:00+01:00'),temp:20},
      {ts:new Date('2026-10-25T02:30:00+02:00'),temp:10}
    ];syncTemperatureRecord();openTemperatureRecord('max')\`);
    assert.equal(a.run('temperatureRecordData().time.includes("02:30:00 UTC+01:00")'),true);
    assert.equal(a.run('temperatureRecordData().index'),1);
    a.run('openTemperatureRecord("min")');
    assert.equal(a.run('temperatureRecordData().time.includes("02:30:00 UTC+02:00")'),true);
    assert.equal(a.run('temperatureRecordData().index'),2);
  `],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:'Europe/Prague'},stdio:'pipe'});
});
