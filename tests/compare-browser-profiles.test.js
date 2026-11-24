const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const script = join(__dirname, '..', 'scripts', 'compare-browser-profiles.cjs');
const hash = 'a'.repeat(64);

function overview() {
  return {
    browser: '154.0.0.0', mode: 'change', results: [30, 0].map(range => ({
      n: 1000, range, sha256: { chart: hash, table: hash },
      samples: [{ total: 3, chart: 2, html: .1 }, { total: 9, chart: 4, html: .3 }],
    })),
  };
}

function refresh() {
  return {
    browser: '154.0.0.0', view: 'visible', cpu: 1, results: [{
      rows: 1000, fixture: 'regular',
      sha256: { rows: hash, stats: hash, chart: hash, measurements: hash },
      samples: [{ completedMs: 10, ui: { ms: 2 }, chartMs: 1 }],
    }],
  };
}

function compare(before, after) {
  const directory = mkdtempSync(join(tmpdir(), 'meteo-profile-'));
  try {
    const input = [before, after].map((profile, index) => {
      const file = join(directory, `${index}.json`);
      writeFileSync(file, JSON.stringify(profile));
      return file;
    });
    return spawnSync(process.execPath, [script, ...input], { encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('matching outputs pass in either scenario order despite slower timing medians', () => {
  const before = overview(), after = overview();
  after.results.reverse();
  after.results[1].samples[1].total = 9000;
  const result = compare(before, after);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1000\/30: outputs match \| overview 6\.00 → 4501\.50 ms/);
  assert.match(result.stdout, /2\/2 scenarios match/);
});

test('data, statistics and original measurements are checked separately from render timings', () => {
  const before = refresh(), after = refresh();
  for (const key of ['rows', 'stats', 'measurements']) after.results[0].sha256[key] = 'b'.repeat(64);
  after.results[0].samples[0].ui.ms = null;
  const result = compare(before, after);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /regular\/1000: changed rows, stats, measurements/);
  assert.match(result.stdout, /commit unavailable/);
});

test('a changed chart or table fails the comparison and reports the affected scenarios', () => {
  const before = overview(), after = overview();
  after.results[0].sha256.chart = 'b'.repeat(64);
  after.results[1].sha256.table = 'b'.repeat(64);
  const result = compare(before, after);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /1000\/30: changed chart/);
  assert.match(result.stdout, /1000\/0: changed table/);
});

test('different settings, scenario sets or sample counts cannot pass the comparison', () => {
  for (const [modify, message] of [
    [p => p.browser = '155.0.0.0', /Different profile setting: browser/],
    [p => p.mode = 'repeat', /Different profile setting: mode/],
    [p => p.results.pop(), /missing: 1000\/0/],
    [p => p.results[0].samples.pop(), /different sample counts/],
  ]) {
    const before = overview(), after = overview();
    modify(after);
    const result = compare(before, after);
    assert.equal(result.status, 2);
    assert.match(result.stderr, message);
  }
});

test('missing hashes and duplicated scenarios are rejected as invalid inputs', () => {
  for (const [modify, message] of [
    [p => delete p.results[0].sha256.table, /missing or invalid table SHA-256/],
    [p => p.results.push(p.results[0]), /duplicate scenario/],
  ]) {
    const before = overview(), after = overview();
    modify(after);
    const result = compare(before, after);
    assert.equal(result.status, 2);
    assert.match(result.stderr, message);
  }
});
