const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');
const settle = () => new Promise(setImmediate);
const header = 'Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti,Poznamka';
const valid = '23.10.2026,12:00,0,1010,50,0,0,,4.2';
async function parse(a, text, scope = 'unknown') {
  const promise = a.run(`parseAndStore(${JSON.stringify(text)},stationContext(),${JSON.stringify(scope)})`);
  a.tick(); return await promise;
}
async function fetchCSV(a, full = false, text = valid) {
  const promise = a.run(`fetchSheets(${full})`);
  a.respond(a.requests.length-1, text); await settle(); a.tick(); await promise;
}

test('diagnostics preserve all original rows, ordering, duplicates, notes, numeric prefixes and midnight fallback', () => {
  const a = app(), text = header+'\n'+valid+'\n'+valid+'\n22.10.2026,,12suffix,1000,,,,,4 V,"literal <b>note</b>"';
  a.run(`globalThis.text=${JSON.stringify(text)};globalThis.report=newCSVValidation();globalThis.plain=parseHistoryCSV(text);globalThis.reported=parseHistoryCSV(text,report)`);
  assert.equal(a.run('JSON.stringify(plain)===JSON.stringify(reported)'), true);
  assert.equal(a.run('report.accepted'), 3);
  assert.equal(a.run('reported[2].temp'), 12);
  assert.equal(a.run('reported[2].ts.getHours()'), 0);
  assert.equal(a.run('report.complete'), true);
});

test('logical positions include blank records and headers, not newlines inside quoted notes', () => {
  const a = app(), text = '\uFEFF'+['"Weather\nprivate title"',header,'','"  "',valid+',"private\n20.10.2026,14:00,999"',
    'missing,,1','31.02.2026,12:00,1','','23.10.2026,25:00,1',valid].join('\n')+'\n';
  a.run(`globalThis.report=newCSVValidation();parseHistoryCSV(${JSON.stringify(text)},report)`);
  assert.equal(a.run('JSON.stringify([report.total,report.empty,report.leading,report.accepted,report.rejected])'), '[10,3,2,2,3]');
  assert.equal(a.run('JSON.stringify(report.samples)'), JSON.stringify([
    {record:6,code:'DATE_MISSING'},{record:7,code:'DATETIME_INVALID'},{record:9,code:'DATETIME_INVALID'}]));
  assert.equal(a.run('report.total===report.empty+report.leading+report.accepted+report.rejected'), true);
});

test('only bounded reason codes and logical positions enter rejected samples, never raw input', async () => {
  const a = app(), secret = 'private-test-value-123<img src=x onerror=alert(1)>';
  await parse(a, header+'\n'+valid+'\n'+Array.from({length:100},()=>secret+',badtime,1').join('\n'));
  assert.equal(a.run('dataStatus.sheets.validation.rejected'), 100);
  assert.equal(a.run('dataStatus.sheets.validation.samples.length'), 8);
  assert.equal(a.run('dataStatus.sheets.validation.samples[0].record'), 3);
  assert.equal(a.run('dataStatus.sheets.validation.samples[7].record'), 10);
  assert.equal(a.run('JSON.stringify(dataStatus.sheets.validation)').includes(secret), false);
  a.run('renderCSVValidation()');
  assert.equal(a.nodes.get('dataValidationPanel').innerHTML.includes(secret), false);
  a.run('store.rows=new Proxy([],{get(){throw new Error("history scan")}});renderCSVValidation()');
  assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Vyřazeno: 100/);
});

test('sensor counts distinguish numeric zero, missing fields and invalid numbers without inventing physical validation', async () => {
  const a = app();
  await parse(a, header+'\n'+['23.10.2026,12:00,0,0,0,0,0,0,0',
    '23.10.2026,11:00,,,,,,,', '23.10.2026,10:00,NaN,Infinity,abc,x,x,x,x'].join('\n'));
  assert.equal(a.run('dataStatus.sheets.validation.accepted'), 3);
  assert.equal(a.run('dataStatus.sheets.validation.sensors.every(s=>s.valid===1 && s.empty===1 && s.invalid===1)'), true);
  assert.equal(a.run('store.rows[0].voltage'), 0);
  assert.equal(a.run('store.rows[1].voltage'), null);
  assert.equal(a.run('store.rows[2].temp'), null);
});

test('invalid syntax and limits record an incomplete report and preserve the last accepted history', async () => {
  const a = app(); await parse(a, valid); a.run('globalThis.saved=store.rows');
  for (const [text, code] of [['"unclosed','CSV_SYNTAX'],['x'.repeat(16385),'DATA_LIMIT']]) {
    await assert.rejects(parse(a, text, 'full'));
    assert.equal(a.run('store.rows===saved'), true);
    assert.equal(a.run('dataStatus.sheets.validation.complete'), false);
    assert.equal(a.run('dataStatus.sheets.validation.failure'), code);
    a.run('renderCSVValidation()');
    assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Součty nejsou k dispozici/);
    assert.doesNotMatch(a.nodes.get('dataValidationPanel').innerHTML,/Hodnoty v přijatých/);
  }
});

test('zero accepted rows report rejection without replacing retained measurements or reporting transport success', async () => {
  const a = app(); await fetchCSV(a, true); a.run('globalThis.saved=store.rows;globalThis.success=dataStatus.sheets.successAt');
  assert.equal(await parse(a, header+'\n31.02.2026,12:00,1', 'full'), false);
  assert.equal(a.run('store.rows===saved && dataStatus.sheets.successAt===success'), true);
  assert.equal(a.run('dataStatus.sheets.validation.accepted'), 0);
  assert.equal(a.run('dataStatus.sheets.validation.rejected'), 1);
  a.run('renderCSVValidation()'); assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Export nebyl přijat/);
});

test('unchanged quick/full exports retain parser evidence while validating transport again', async () => {
  for (const full of [false,true]) {
    const a = app(); await fetchCSV(a, full);
    a.run('globalThis.previous=dataStatus.sheets.validation');
    await fetchCSV(a);
    assert.equal(a.run('dataStatus.sheets.validation===previous'), true);
    assert.equal(a.run('dataStatus.sheets.validation.scope'), full?'full':'partial');
    if(!full) { await fetchCSV(a,true); assert.equal(a.run('dataStatus.sheets.validation.scope'),'full'); }
  }
});

test('station reset and late prior-generation parser cannot move diagnostics to another station', async () => {
  const a = app(); await parse(a, valid);
  const pending = a.run(`parseAndStore(${JSON.stringify(valid)})`);
  a.run('switchStation(1)'); a.tick();
  assert.equal(await pending, false);
  assert.equal(a.run('dataStatus.sheets.validation'), null);
  a.run('renderCSVValidation()'); assert.doesNotMatch(a.nodes.get('dataValidationPanel').innerHTML,/Přijato:/);
});

test('recovery of unchanged quick/full CSV restores its accepted report without reparsing or changing its timestamp', async () => {
  for (const full of [false,true]) {
    const a=app();await fetchCSV(a,full);
    a.run('globalThis.accepted=dataStatus.sheets.validation;globalThis.parsedAt=accepted.checkedAt;globalThis.rowsBefore=store.rows');
    await parse(a,header+'\n31.02.2026,12:00,1');
    assert.equal(a.run('dataStatus.sheets.validation.accepted'),0);
    const renders=a.state.renders;
    await fetchCSV(a);
    assert.equal(a.run('dataStatus.sheets.validation===accepted && accepted.checkedAt===parsedAt && store.rows===rowsBefore'),true);
    assert.equal(a.state.renders,renders);
    assert.equal(a.run('dataStatus.sheets.validation.accepted'),1);
  }
});

test('pure foreign parser, overview and MQTT do not overwrite active CSV evidence', async () => {
  const a = app(); await parse(a, valid); a.run('globalThis.previous=dataStatus.sheets.validation');
  a.run(`parseHistoryCSV(${JSON.stringify(header+'\n'+valid)})`);
  const overview=a.run('fetchOvStation(1)');a.respond(0,valid);await overview;
  a.run('CFG.source="both";CFG.mqttHost="fixture.invalid";connectMQTT()');
  a.clients[0].onMessageArrived({payloadString:'{"temp":0}'});
  assert.equal(a.run('dataStatus.sheets.validation===previous && previous.accepted===1'), true);
  a.run('CFG.source="mqtt";dataStatus.sheets.validation=null;renderCSVValidation()');
  assert.match(a.nodes.get('dataValidationPanel').innerHTML,/používá MQTT/);
});

test('diagnostic rendering allowlists labels and numeric counters even for corrupted in-memory metadata', () => {
  const a = app(), payload = '<img src=x onerror=alert(1)>';
  a.run(`dataStatus.sheets.validation=newCSVValidation();Object.assign(dataStatus.sheets.validation,{complete:true,checkedAt:${JSON.stringify(payload)},scope:${JSON.stringify(payload)},accepted:${JSON.stringify(payload)},samples:[{record:${JSON.stringify(payload)},code:${JSON.stringify(payload)}}]});renderCSVValidation()`);
  assert.equal(a.nodes.get('dataValidationPanel').innerHTML.includes(payload), false);
  assert.match(a.nodes.get('dataValidationPanel').innerHTML,/Neznámý důvod/);
});
