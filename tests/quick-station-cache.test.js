const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const settle = () => new Promise(setImmediate);
const csv = (temp, date = '24.11.2026') => `${date},12:00,${temp},1000,50,0,0,,4\n`;

function stationApp() {
  const a = app({ realStart: true });
  // Keep real station/config/Sheets flow. Unrelated services are replaced.
  a.run('fetchUVData=()=>{};fetchAllOv=()=>{};globalThis.now=1795521600000;Date.now=()=>now;');
  return a;
}

async function switchTo(a, index, config = {}) {
  const request = a.requests.length;
  a.run(`switchStation(${index})`);
  a.respond(request, JSON.stringify({ stationIdx: index, sheetId: `test-${index}`, sheetName: 'Measurements', source: 'sheets', ...config }));
  await settle();
}

async function respondQuick(a, text) {
  a.respond(a.requests.length - 1, text);
  await settle();
  a.tick(10);
  await settle();
}

async function visitA(a, text = csv(18)) {
  await switchTo(a, 1);
  await respondQuick(a, csv(25));
  await switchTo(a, 0);
  await respondQuick(a, text);
  await switchTo(a, 1);
  await respondQuick(a, csv(25));
}

test('A → B → A restores only A while revalidating and equal CSV skips parsing', async () => {
  const a = stationApp();
  await visitA(a);
  a.run('globalThis.previous=quickStationHistory.get(0);now+=2000;');
  const requests = a.requests.length;
  await switchTo(a, 0);
  assert.equal(a.requests.length - requests, 2);
  assert.equal(a.run('store.rows===previous.rows && store.rows[0].temp===18'), true);
  assert.equal(a.run('!store.fullLoaded && dataStatus.sheets.phase==="loading" && dataStatus.sheets.cached'), true);
  assert.equal(a.run('dataStatus.sheets.successAt===previous.successAt'), true);
  assert.match(a.nodes.get('dataStatusSummary').textContent, /Uložená data/);
  await respondQuick(a, csv(18));
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs'), 0);
  assert.equal(a.run('dataStatus.sheets.timing.unchanged'), true);
  assert.equal(a.run('!dataStatus.sheets.cached && dataStatus.sheets.successAt===Date.now()'), true);
  assert.equal(a.run('dataStatus.sheets.acceptedValidation===previous.validation'), true);
  assert.doesNotMatch(a.nodes.get('dataStatusSummary').textContent, /Uložená data/);
});

test('corrected CSV replaces the snapshot, and an obsolete response cannot repopulate it', async () => {
  const a = stationApp();
  await visitA(a);
  await switchTo(a, 0);
  await respondQuick(a, csv(-4));
  assert.equal(a.run('store.rows[0].temp'), -4);
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs'), 1);
  await switchTo(a, 1);
  const obsolete = a.requests.length - 1;
  await switchTo(a, 0);
  a.respond(obsolete, csv(99));
  await respondQuick(a, csv(-4));
  assert.equal(a.run('store.rows[0].temp'), -4);
  assert.equal(a.run('quickStationHistory.get(1).rows[0].temp'), 25);
});

test('expiry, config change and incomplete dates prevent a snapshot from being restored', async () => {
  for (const variant of ['expired', 'new source', 'new zone', 'implicit year', 'oversize']) {
    const a = stationApp();
    await visitA(a, variant === 'implicit year' ? csv(18, '24.11.') : variant === 'oversize'
      ? `24.11.2026,12:00,18,1000,50,0,0,,4,${'a'.repeat(66000)}\n` : csv(18));
    if (variant === 'expired') a.run('now+=STATION_HISTORY_TTL_MS');
    if (variant === 'new zone') a.run('stationHistoryTimeZone=()=>"Pacific/Kiritimati"');
    await switchTo(a, 0, variant === 'new source' ? { sheetName: 'Other' } : {});
    assert.equal(a.run('store.rows.length'), 0, variant);
    assert.equal(a.run('quickStationHistory.has(0)'), false, variant);
  }
});

test('failed revalidation preserves cached data, its age and the transport error', async () => {
  const a = stationApp();
  await visitA(a);
  a.run('globalThis.previous=quickStationHistory.get(0);now+=3000;');
  await switchTo(a, 0);
  for (let attempt = 0; attempt < 6; attempt++) {
    a.respond(a.requests.length - 1, '', 503);
    await settle();
  }
  assert.equal(a.run('store.rows===previous.rows && dataStatus.sheets.successAt===previous.successAt'), true);
  assert.equal(a.run('dataStatus.sheets.cached && dataStatus.sheets.phase==="error"'), true);
  assert.match(a.nodes.get('dataStatusSummary').textContent, /Chyba přenosu dat.*Uložená data/);
});

test('manual refresh still fetches full history and clears the superseded quick snapshot', async () => {
  const a = stationApp();
  await visitA(a);
  await switchTo(a, 0);
  await respondQuick(a, csv(18));
  const refresh = a.run('manualRefresh()');
  assert.doesNotMatch(a.requests.at(-1).url, /LIMIT%20400/);
  await respondQuick(a, csv(20));
  await refresh;
  assert.equal(a.run('store.fullLoaded && store.rows[0].temp===20 && !quickStationHistory.has(0)'), true);
});

test('a combined source or an unavailable remote config never restores a previous Sheets snapshot', async () => {
  const a = stationApp();
  await visitA(a);
  const request = a.requests.length;
  a.run('switchStation(0)');
  a.respond(request, '', 404);
  await settle();
  assert.equal(a.run('store.rows.length'), 0);
  await switchTo(a, 1);
  await respondQuick(a, csv(25));
  await switchTo(a, 0, { source: 'both' });
  assert.equal(a.run('store.rows.length'), 0);
  await respondQuick(a, csv(19));
  assert.equal(a.run('store.rows[0].temp===19 && !quickStationHistory.has(0)'), true);
});

async function visitFull(a, index, text) {
  await switchTo(a, index);
  await respondQuick(a, csv(20 + index));
  const load = a.run('fetchSheets(true)');
  await respondQuick(a, text);
  await load;
}

test('analytics restores verified full history and validates it with one full request', async () => {
  const a = stationApp();
  const original = csv(18) + csv(15, '23.11.2026');
  await visitFull(a, 1, csv(25));
  await visitFull(a, 0, original);
  a.run('globalThis.saved=fullStationHistory.get(0);now+=5000;');
  await switchTo(a, 1);
  await respondQuick(a, csv(25));
  a.run('currentPage="analytics"');
  const requests = a.requests.length;
  await switchTo(a, 0);
  assert.equal(a.requests.length - requests, 2); // Configuration and the full CSV.
  assert.doesNotMatch(a.requests.at(-1).url, /LIMIT%20400/);
  assert.equal(a.run('store.fullLoaded && store.rows===saved.rows && dataStatus.sheets.cached'), true);
  assert.equal(a.run('dataStatus.sheets.successAt'), a.run('saved.successAt'));
  a.run('analyticsUpdateStatus()');
  assert.match(a.nodes.get('anaStatus').textContent, /Celá dostupná načtená historie/);
  assert.match(a.nodes.get('anaStatus').textContent, /Uložená data/);
  await respondQuick(a, original);
  assert.equal(a.run('dataStatus.sheets.timing.parse.runs'), 0);
  assert.equal(a.run('dataStatus.sheets.timing.unchanged && !dataStatus.sheets.cached'), true);
  assert.equal(a.run('fullStationHistory.get(0).successAt'), a.run('now'));
  const refresh = a.run('manualRefresh()');
  await respondQuick(a, csv(18) + csv(12, '23.11.2026'));
  await refresh;
  assert.equal(a.run('store.rows[1].temp===12 && fullStationHistory.get(0).rows===store.rows'), true);
  const revalidate = a.run('fetchSheets()');
  await respondQuick(a, csv(18));
  await revalidate;
  assert.equal(a.run('store.rows.length===1 && fullStationHistory.get(0).rows===store.rows'), true);
});

test('failed full revalidation leaves stored history labelled and preserves its timestamp', async () => {
  const a = stationApp();
  await visitFull(a, 1, csv(25));
  await visitFull(a, 0, csv(18));
  await switchTo(a, 1);
  await respondQuick(a, csv(25));
  a.run('currentPage="analytics";globalThis.saved=fullStationHistory.get(0);now+=3000;');
  await switchTo(a, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    a.respond(a.requests.length - 1, '', 503);
    await settle();
  }
  assert.equal(a.run('store.rows===saved.rows && store.fullLoaded && dataStatus.sheets.cached'), true);
  assert.equal(a.run('dataStatus.sheets.phase==="error" && dataStatus.sheets.successAt===saved.successAt'), true);
  assert.match(a.nodes.get('anaStatus').textContent, /Uložená data.*Obnova selhala/);
});

test('full cache bounds retention and ordinary views still start with the quick request', async () => {
  const a = stationApp();
  await visitFull(a, 1, csv(25));
  await visitFull(a, 0, csv(18));
  await visitFull(a, 2, csv(22));
  assert.equal(a.run('JSON.stringify([...fullStationHistory.keys()])'), '[0,2]');
  await switchTo(a, 0);
  assert.match(a.requests.at(-1).url, /LIMIT%20400/);
  assert.equal(a.run('!store.fullLoaded && store.rows.length===0'), true);
  await respondQuick(a, csv(19));
  assert.equal(a.run('!fullStationHistory.has(0) && store.rows[0].temp===19'), true);
});

test('an expired, different-source, implicit-year, or over-budget full export is never restored', async () => {
  for (const variant of ['expired', 'changed sheet', 'combined', 'new zone', 'implicit year', 'row budget', 'text budget']) {
    const a = stationApp();
    await visitFull(a, 1, csv(25));
    await visitFull(a, 0, variant === 'implicit year' ? csv(18, '24.11.') : csv(18));
    if (variant === 'row budget' || variant === 'text budget') {
      a.run(variant === 'row budget'
        ? 'store.rows=Array(FULL_HISTORY_MAX_ROWS+1).fill(store.rows[0]);saveFullStationHistory(stationContext(), store._lastFullCsv);'
        : 'saveFullStationHistory(stationContext(), "x".repeat(FULL_HISTORY_MAX_TEXT_LENGTH+1));');
    }
    await switchTo(a, 1);
    await respondQuick(a, csv(25));
    a.run('currentPage="analytics"');
    if (variant === 'expired') a.run('now+=STATION_HISTORY_TTL_MS');
    if (variant === 'new zone') a.run('stationHistoryTimeZone=()=>"Pacific/Kiritimati"');
    const config = variant === 'changed sheet' ? { sheetName: 'Other' } :
      variant === 'combined' ? { source: 'both' } : {};
    await switchTo(a, 0, config);
    assert.equal(a.run('!store.fullLoaded && store.rows.length===0 && !fullStationHistory.has(0)'), true, variant);
    assert.match(a.requests.at(-1).url, /LIMIT%20400/, variant);
  }
});
