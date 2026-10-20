const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const settle = () => new Promise(setImmediate);
const csv = temp => `"20.10.2026","12:00",${temp},1010,60,0,0,0,4.2\n`;
const config = index => JSON.stringify({ stationIdx: index, sheetId: `sheet-${index}`, source: 'sheets' });

test('late A config cannot replace B config or start B a second time', async () => {
  const a = app();
  const old = a.run('tryLoadConfigJson(0)');
  a.run('switchStation(1)');
  a.respond(1, config(1)); await settle();
  a.respond(0, config(0)); await old;
  assert.equal(a.run('stations[1].sheetId'), 'sheet-1');
  assert.equal(a.requests[0].signal.aborted, true);
  assert.equal(a.nodes.get('stationData').hidden, true);
  assert.equal(a.state.starts, 1);
});

test('A → B → A invalidates the first A generation, even at the same index', async () => {
  const a = app();
  const old = a.run('tryLoadConfigJson(0)');
  a.run('switchStation(1); switchStation(0)');
  a.respond(2, JSON.stringify({ stationIdx: 0, sheetId: 'latest-A' })); await settle();
  a.respond(0, JSON.stringify({ stationIdx: 0, sheetId: 'obsolete-A' })); await old;
  assert.equal(a.run('stations[0].sheetId'), 'latest-A');
  assert.equal(a.requests[1].signal.aborted, true);
});

test('failure of an obsolete config does not start the new station as a fallback', async () => {
  const a = app();
  const old = a.run('loadStationConfig()');
  a.run('switchStation(1)');
  a.requests[0].reject(new Error('old connection failed')); await old;
  assert.equal(a.state.starts, 0);
  a.respond(1, config(1)); await settle();
  assert.equal(a.state.starts, 1);
});

test('a late response body cannot overwrite new data, full-load flags or status', async () => {
  const a = app();
  const body = Promise.withResolvers();
  const old = a.run('fetchSheets(true)');
  a.respond(0, body.promise); await settle();
  a.run('switchStation(1)');
  a.respond(1, config(1)); await settle();
  const current = a.run('fetchSheets(true)');
  a.respond(2, csv(27)); await settle(); a.tick(); await current;
  const status = a.state.gs.at(-1);
  body.resolve(csv(-5)); await old;
  assert.equal(a.run('store.rows[0].temp'), 27);
  assert.equal(a.run('store.fullLoaded'), true);
  assert.equal(a.state.gs.at(-1), status);
});

test('a queued parser cannot publish old data or mark new partial data as full', async () => {
  const a = app();
  const old = a.run('fetchSheets(true)');
  a.respond(0, csv(-5)); await settle();
  a.run('switchStation(1)');
  const current = a.run(`parseAndStore(${JSON.stringify(csv(25))})`);
  a.tick(); await Promise.all([old, current]);
  assert.equal(a.run('store.rows[0].temp'), 25);
  assert.equal(a.run('store.fullLoaded'), false);
});

test('full-load callbacks run only after valid rows have been committed', async () => {
  const a = app();
  a.run('globalThis.observed = []; ensureFullData(() => observed.push([store.rows[0].temp, store.fullLoaded]))');
  a.respond(0, csv(22)); await settle();
  assert.equal(a.run('store.rows.length'), 0);
  assert.equal(a.run('store.fullLoaded'), false);
  assert.equal(a.run('observed.length'), 0);
  a.tick(); await settle();
  assert.equal(a.run('JSON.stringify(observed)'), '[[22,true]]');
  assert.equal(a.run('store._fullLoadPending'), false);
});

test('HTML instead of CSV never confirms full history or invokes callbacks', async () => {
  const a = app();
  a.run('globalThis.calls = 0; ensureFullData(() => calls++)');
  for (let i = 0; i < 3; i++) {
    a.respond(i, '<html>upstream service unavailable</html>');
    await settle(); a.tick(); await settle();
  }
  assert.equal(a.run('store.fullLoaded'), false);
  assert.equal(a.run('store._fullLoadPending'), false);
  assert.equal(a.run('calls'), 0);
  assert.equal(a.run('store._onFullLoad.length'), 0);
  assert.equal(a.state.gs.some(s => s.ok === true), false);
});

test('periodic requests share a load and full history waits for the quick load', async () => {
  const a = app();
  const quick = a.run('fetchSheets()');
  const repeated = a.run('fetchSheets()');
  const full = a.run('fetchSheets(true)');
  assert.equal(a.requests.length, 1);
  a.respond(0, csv(15)); await settle(); a.tick(); await settle();
  assert.equal(a.requests.length, 2);
  a.respond(1, csv(18)); await settle(); a.tick();
  await Promise.all([quick, repeated, full]);
  assert.equal(a.run('store.rows[0].temp'), 18);
  assert.equal(a.run('store.fullLoaded'), true);
});

for (const failure of [false, true]) {
  test(`late UV ${failure ? 'failure' : 'success'} cannot replace the current forecast`, async () => {
    const a = app();
    const old = a.run('fetchUVData()');
    a.run('switchStation(1)'); a.respond(1, config(1)); await settle();
    const current = a.run('fetchUVData()');
    a.respond(2, JSON.stringify({ hourly: { uv_index: [2, 3] } })); await current;
    if (failure) a.requests[0].reject(new Error('obsolete UV failure'));
    else a.respond(0, JSON.stringify({ hourly: { uv_index: [9, 9] } }));
    await old;
    assert.equal(a.run('JSON.stringify(uvStore.hourly)'), '[2,3]');
  });
}

test('late overview and imported file results cannot change the new station', async () => {
  const a = app();
  const old = a.run('fetchOvStation(1)');
  a.run('loadConfigFromFile({ files: [{ name: "old.json" }] }); switchStation(1)');
  a.respond(1, config(1)); await settle();
  a.run('ovStores[1] = { temp: 26 }');
  a.respond(0, csv(-5)); await old;
  a.readers[0].onload({ target: { result: JSON.stringify({ sheetId: 'wrong-import' }) } });
  assert.equal(a.run('ovStores[1].temp'), 26);
  assert.equal(a.run('stations[1].sheetId'), 'sheet-1');
});

test('MQTT disconnects old clients and ignores their messages, success and retry callbacks', async () => {
  const a = app();
  a.run('CFG.source = "both"; CFG.mqttHost = "old.example"; connectMQTT()');
  const old = a.clients[0];
  old.options.onSuccess(); old.onConnectionLost({});
  const retry = [...a.timers.values()].find(t => t.delay === 5000).fn;
  a.run('switchStation(1)');
  assert.equal(old.disconnected, 1);
  assert.equal([...a.timers.values()].some(t => t.delay === 5000), false);
  a.respond(0, config(1)); await settle();
  a.run('CFG.source = "both"; CFG.mqttHost = "new.example"; connectMQTT()');
  const current = a.clients[1]; current.options.onSuccess();
  const status = a.state.mqtt.at(-1);
  old.onMessageArrived({ payloadString: '{"temp":-5}' });
  old.options.onSuccess(); old.options.onFailure({ errorMessage: 'obsolete' }); retry();
  assert.equal(a.run('store.rows.length'), 0);
  assert.equal(a.clients.length, 2);
  assert.equal(a.state.mqtt.at(-1), status);
  current.onMessageArrived({ payloadString: '{"temp":26}' });
  assert.equal(a.run('store.rows[0].temp'), 26);
});

test('editing the data source invalidates requests even without switching station', async () => {
  const a = app();
  const old = a.run('fetchSheets(true)');
  a.run('_applyCfgObject({ sheetId: "replacement" }, "test", true)');
  assert.equal(a.requests[0].signal.aborted, true);
  a.respond(0, csv(-5)); await old;
  assert.equal(a.run('CFG.sheetId'), 'replacement');
  assert.equal(a.run('store.rows.length'), 0);
});

test('a full-load callback that switches station invalidates the remaining callbacks', async () => {
  const a = app();
  a.run('globalThis.calls = 0; ensureFullData(() => switchStation(1)); ensureFullData(() => calls++)');
  a.respond(0, csv(22)); await settle(); a.tick(); await settle();
  assert.equal(a.run('activeIdx'), 1);
  assert.equal(a.run('calls'), 0);
  assert.equal(a.run('store.fullLoaded'), false);
});
