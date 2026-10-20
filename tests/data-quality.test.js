const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

const settle = () => new Promise(setImmediate);
const headers = '"Meteostanice"\n"Datum","Čas","Teplota","Tlak","Vlhkost","Přírůstek","Déšť","Nádrž","Napětí","Poznámka"\n';
function history(oldest = 19) {
  return headers + Array.from({ length: 61 }, (_, i) => {
    const minute = 12 * 60 - i;
    const time = `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
    return `"20.10.2026","${time}",${i === 60 ? oldest : 20},1010,60,0,0,0,4.2,"poznámka"`;
  }).join('\n');
}
async function fullHistory(a, text) {
  const load = a.run('fetchSheets(true)');
  a.respond(a.requests.length - 1, text);
  await settle(); a.tick(); await load;
}

test('history and notes render untrusted date/time/note as text, including HTML entities', () => {
  const a = app();
  const payload = '<img src=x onerror=globalThis.injected=1>';
  // Also protect legacy/cached data that did not pass the current strict parser.
  const row = { date: `20.10.2026${payload}`, time: `12:00${payload}`, note: `${payload}&lt;b&gt;` };
  a.run(`store.rows = [{ ...${JSON.stringify(row)}, ts:new Date(2026,9,20), temp:20 }]`);
  a.run('updateHistoryTable()');
  const rendered = a.nodes.get('histTableBody').innerHTML;
  assert.equal(rendered.includes('<img'), false);
  assert.ok(rendered.includes('&lt;img'));
  a.run('buildNotesTable()');
  const notes = a.nodes.get('notesTableBody').innerHTML;
  assert.equal(notes.includes('<img'), false);
  assert.ok(notes.includes('&lt;img'));
  assert.ok(notes.includes('&amp;lt;b&amp;gt;'));
});

test('history All means all rows; invalid limits retain the default', () => {
  const a = app();
  a.run('store.rows = Array.from({length: 501}, () => ({date:"20.10.2026", time:"12:00"}))');
  for (const [value, expected] of [['0', 501], ['2', 2], ['invalid', 500], ['-1', 500]]) {
    a.nodes.get('histLimit').value = value;
    a.run('updateHistoryTable()');
    assert.equal((a.nodes.get('histTableBody').innerHTML.match(/<tr>/g) || []).length, expected);
  }
});

test('charts survive a missing voltage sensor and continue rendering other aggregates', () => {
  const a = app();
  a.run('buildTempOverview = () => {}; store.rows = [{ts:new Date(),temp:20,hum:60,rain:0,voltage:null}]');
  a.run('buildCharts()');
  assert.equal(a.run('chartVoltage.data.labels.length'), 0);
  assert.equal(a.run('chartVoltage.data.datasets.every(s => s.data.length === 0)'), true);
  assert.equal(a.run('chartMonthly.data.datasets[0].data[0]'), 20);
  assert.equal(a.run('chartYearly.updates'), 1);
});

test('zero volts is valid, but a single sample does not invent a forecast', () => {
  const a = app();
  a.run('globalThis.series = voltageSeries([{ts:new Date(),voltage:null},{ts:new Date(),voltage:0}])');
  assert.equal(a.run('JSON.stringify(series.actual)'), '[0]');
  assert.equal(a.run('JSON.stringify(series.predicted)'), '[null]');
  assert.equal(a.run('series.labels.length'), 1);
});

test('voltage regression uses finite real samples in chronological order', () => {
  const a = app();
  a.run(`globalThis.series = voltageSeries([
    {ts:new Date(),voltage:1}, {ts:new Date(Date.now()-600000),voltage:0},
    {ts:new Date(),voltage:null}, {ts:new Date(),voltage:Infinity}, {ts:new Date(),voltage:NaN}
  ])`);
  assert.equal(a.run('JSON.stringify(series.actual.slice(0,2))'), '[0,1]');
  assert.equal(a.run('JSON.stringify(series.predicted.slice(0,4))'), '[null,1,2,3]');
  assert.equal(a.run('series.actual.length === series.labels.length && series.predicted.length === series.labels.length'), true);
});

test('duplicate timestamps and stale samples produce no unsupported forecast', () => {
  const a = app();
  a.run('globalThis.t = new Date(); globalThis.same = voltageSeries([{ts:t,voltage:4.2},{ts:t,voltage:4.1}])');
  assert.equal(a.run('JSON.stringify(same.predicted)'), '[null,null]');
  a.run('globalThis.stale = voltageSeries([{ts:new Date(0),voltage:4},{ts:new Date(600000),voltage:3.9}])');
  assert.equal(a.run('JSON.stringify(stale.predicted)'), '[null,null]');
});

test('explorer clears missing voltage and empty ranges instead of retaining old curves', () => {
  const a = app();
  a.run('el("expMetric").value = "voltage"');
  a.run('_drawExplorerPts([{ts:new Date(),voltage:4.2}])');
  assert.equal(a.run('chartExplorer.data.labels.length'), 1);
  a.run('_drawExplorerPts([{ts:new Date(),voltage:null}])');
  assert.equal(a.run('chartExplorer.data.labels.length'), 0);
  a.run('_drawExplorerPts([{ts:new Date(),voltage:4.2}]); _drawExplorerPts([])');
  assert.equal(a.run('chartExplorer.data.labels.length'), 0);
  assert.equal(a.run('chartExplorer.data.datasets.length'), 0);
  assert.equal(a.nodes.get('expStats').innerHTML, '');
  assert.match(a.nodes.get('expInfo').textContent, /Žádná data/);
});

test('unchanged full CSV avoids reparsing; manual refresh still revalidates', async () => {
  const a = app(); const text = history();
  await fullHistory(a, text);
  const renders = a.state.renders;
  const check = a.run('fetchSheets()');
  const url = new URL(a.requests[1].url);
  assert.equal(url.searchParams.get('sheet'), a.run('CFG.sheetName'));
  assert.equal(url.searchParams.has('range'), false);
  a.respond(1, text); await check;
  assert.equal(a.state.renders, renders);
  assert.equal(a.timers.size, 0);
  assert.match(a.state.gs.at(-1).text, /beze změn/);
  await fullHistory(a, text);
  assert.equal(a.state.renders, renders + 1);
});

test('stable headers and latest timestamp do not hide an edited historical measurement', async () => {
  const a = app(); await fullHistory(a, history(19));
  const load = a.run('fetchSheets()');
  a.respond(1, history(7)); await settle(); a.tick(); await load;
  assert.equal(a.run('store.rows.at(-1).temp'), 7);
  assert.equal(a.run('store._lastFullCsv'), history(7));
  assert.doesNotMatch(a.state.gs.at(-1).text, /beze změn/);
});

test('failed refresh never commits an invalid CSV fingerprint and can be retried', async () => {
  const a = app(); const text = history(); await fullHistory(a, text);
  const failed = a.run('fetchSheets()');
  for (let i = 1; i <= 3; i++) {
    a.respond(i, '<html>invalid upstream response</html>');
    await settle(); a.tick(); await settle();
  }
  await failed;
  assert.equal(a.run('store._lastFullCsv'), text);
  assert.equal(a.state.gs.at(-1).ok, false);
  await fullHistory(a, history(8));
  assert.equal(a.run('store.rows.at(-1).temp'), 8);
  assert.equal(a.run('store._lastFullCsv'), history(8));
});

test('CSV preserves escaped quotes, commas, empty fields, BOM and CRLF', () => {
  const a = app();
  const input = '\uFEFF"a""b","čárka, uvnitř",\r\n"","x",0\r\n';
  assert.equal(a.run(`JSON.stringify(parseCSV(${JSON.stringify(input)}))`), JSON.stringify([['a"b', 'čárka, uvnitř', ''], ['', 'x', '0']]));
  assert.equal(a.run(`JSON.stringify(splitCSV('"a""b",0,'))`), JSON.stringify(['a"b', '0', '']));
  assert.equal(a.run('parseCSV("").length'), 0);
});

test('multiline notes stay in their record and keep literal quotes and apostrophes', async () => {
  const a = app();
  const note = '\'Měření "OK", řádek 1\r\n20.10.2026,13:00,999\'';
  const cells = ['20.10.2026', '12:05:09', '20,3', '1 012,3', '60', '0', '0', '', '', note];
  const line = cells.map(c => '"' + c.replaceAll('"', '""') + '"').join(',');
  const parsed = a.run(`parseAndStore(${JSON.stringify(headers + line)})`);
  a.tick(); assert.equal(await parsed, true);
  assert.equal(a.run('store.rows.length'), 1);
  assert.equal(a.run('store.rows[0].note'), note);
  assert.equal(a.run('store.rows[0].pressure'), 1012.3);
  assert.equal(a.run('store.rows[0].voltage'), null);
  assert.equal(a.run('store.rows[0].ts.getSeconds()'), 9);
});

test('unterminated and misplaced CSV quotes fail without replacing valid data', async () => {
  const a = app();
  for (const text of ['"unterminated', 'abc"def,1', '"closed"tail,1']) {
    assert.throws(() => a.run(`parseCSV(${JSON.stringify(text)})`), /CSV:/);
  }
  a.run('store.rows = [{temp:27}]');
  const parsed = a.run('parseAndStore("\\\"unterminated")');
  a.tick(); await assert.rejects(parsed, /CSV:/);
  assert.equal(a.run('store.rows[0].temp'), 27);
});

test('overview can read complete logical CSV records without scanning the rest', () => {
  const a = app();
  const text = '"title\nsecond line"\r\n"20.10.2026","12:00",20\r\n"incomplete';
  assert.equal(a.run(`JSON.stringify(parseCSV(${JSON.stringify(text)}, 2))`), JSON.stringify([['title\nsecond line'], ['20.10.2026', '12:00', '20']]));
  assert.throws(() => a.run(`parseCSV(${JSON.stringify(text)})`), /CSV:/);
});

test('date/time parsing rejects impossible values and suffix injection', () => {
  const a = app();
  for (const [date, time] of [
    ['31.02.2026', '12:00'], ['29.02.2025', '12:00'], ['20.13.2026', '12:00'],
    ['20.10.2026', '25:99'], ['20.10.2026', '24:00'], ['20.10.2026', '12:00:60'],
    ['20.10.2026<img src=x>', '12:00'], ['20.10.2026', '12:00<img src=x>']
  ]) assert.equal(a.run(`parseCSDateTime(${JSON.stringify(date)},${JSON.stringify(time)})`), null);
});

test('valid leap dates, two-digit years and seconds remain supported', () => {
  const a = app();
  a.run('globalThis.leap = parseCSDateTime("29. 2. 2024", "23:59:59")');
  assert.equal(a.run('leap.getFullYear()'), 2024);
  assert.equal(a.run('leap.getDate()'), 29);
  assert.equal(a.run('leap.getSeconds()'), 59);
  assert.equal(a.run('parseCSDateTime("20.10.26", "9:05").getFullYear()'), 2026);
});

test('inferred years cross New Year, follow explicit dates and ignore rejected dates', () => {
  const a = app();
  a.run('globalThis.years = {inferredYear:2026,lastDt:new Date(2026,0,2)}; parseCSDateTime("31.12.","23:55",years)');
  assert.equal(a.run('years.inferredYear'), 2025);
  const previous = a.run('years.lastDt.getTime()');
  assert.equal(a.run('parseCSDateTime("31.02.","25:99",years)'), null);
  assert.equal(a.run('years.lastDt.getTime()'), previous);
  a.run('parseCSDateTime("29.02.2024","12:00",years)');
  assert.equal(a.run('parseCSDateTime("28.02.","12:00",years).getFullYear()'), 2024);
});

test('nonfinite measurements and invalid relative humidity never produce NaN/Infinity', () => {
  const a = app();
  assert.equal(a.run('pf("Infinity")'), null);
  assert.equal(a.run('pf("1 020,6")'), 1020.6);
  assert.equal(a.run('pf("0")'), 0);
  for (const args of ['20,0', '20,-1', '20,101', 'null,50', 'Infinity,50', '-243.04,50']) {
    assert.equal(a.run(`dewPoint(${args})`), null);
  }
  assert.equal(a.run('dewPoint(20,100)'), 20);
  assert.equal(a.run('dewPoint(20,50)'), 9.3);
});

test('daily aggregation keeps the same day in different years separate', () => {
  const a = app();
  a.run(`buildAgg(chartMonthly, [
    {ts:new Date(2026,9,20,12),temp:20,hum:60},
    {ts:new Date(2025,9,20,12),temp:0,hum:50},
    {ts:new Date(2025,9,20,11),temp:2,hum:null}
  ], "day", 30)`);
  assert.equal(a.run('chartMonthly.data.labels.length'), 2);
  assert.notEqual(a.run('chartMonthly.data.labels[0]'), a.run('chartMonthly.data.labels[1]'));
  assert.equal(a.run('JSON.stringify(chartMonthly.data.datasets[0].data)'), '[1,20]');
  assert.equal(a.run('JSON.stringify(chartMonthly.data.datasets[1].data)'), '[50,60]');
});
