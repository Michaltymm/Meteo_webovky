#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');

const formats = {
  overview: {
    settings: ['mode', 'browser'],
    key: ['n', 'range'],
    hashes: ['chart', 'table'],
    timings: { 'overview': s => s.total, 'chart': s => s.chart, 'table insertion': s => s.html },
  },
  refresh: {
    settings: ['browser', 'cpu', 'view'],
    key: ['fixture', 'rows'],
    hashes: ['rows', 'stats', 'chart', 'measurements'],
    timings: { 'refresh': s => s.completedMs, 'commit': s => s.ui?.ms, 'chart': s => s.chartMs },
  },
};

function readProfile(file) {
  const profile = JSON.parse(readFileSync(file, 'utf8'));
  let kind;
  if (['repeat', 'change', 'range'].includes(profile?.mode)) kind = 'overview';
  else if (['visible', 'offscreen'].includes(profile?.view) &&
           Number.isFinite(profile.cpu) && profile.cpu >= 1 && typeof profile.browser === 'string') kind = 'refresh';
  else throw new Error(`${file}: unsupported profile format`);
  const format = formats[kind];
  if (!Array.isArray(profile.results) || !profile.results.length) throw new Error(`${file}: no scenarios`);
  const scenarios = new Map();
  for (const result of profile.results) {
    const count = kind === 'overview' ? result?.n : result?.rows;
    const validRange = kind === 'overview' ? [0, 30].includes(result?.range)
      : ['regular', 'dense'].includes(result?.fixture);
    if (!Number.isSafeInteger(count) || count < 1 || !validRange) throw new Error(`${file}: invalid scenario`);
    const key = format.key.map(field => result[field]).join('/');
    const label = `${file}: ${key}`;
    if (scenarios.has(key)) throw new Error(`${label}: duplicate scenario`);
    for (const field of format.hashes) {
      if (typeof result.sha256?.[field] !== 'string' || !/^[a-f0-9]{64}$/.test(result.sha256[field])) {
        throw new Error(`${label}: missing or invalid ${field} SHA-256`);
      }
    }
    if (!Array.isArray(result.samples) || !result.samples.length ||
        result.samples.some(sample => !sample || typeof sample !== 'object')) {
      throw new Error(`${label}: missing or invalid samples`);
    }
    scenarios.set(key, result);
  }
  return { kind, format, profile, scenarios };
}

function median(samples, getTime) {
  const times = samples.map(getTime);
  if (!times.every(time => Number.isFinite(time) && time >= 0)) return null;
  times.sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return times.length % 2 ? times[mid] : times[mid - 1] / 2 + times[mid] / 2;
}

function compare(before, after) {
  if (before.kind !== after.kind) throw new Error('Different profile formats');
  const { settings, hashes, timings } = before.format;
  for (const key of settings) {
    if (before.profile[key] !== after.profile[key]) throw new Error(`Different profile setting: ${key}`);
  }
  const missing = [...before.scenarios.keys()].filter(key => !after.scenarios.has(key));
  const added = [...after.scenarios.keys()].filter(key => !before.scenarios.has(key));
  if (missing.length || added.length) {
    throw new Error(`Different scenario sets (missing: ${missing.join(', ') || 'none'}, added: ${added.join(', ') || 'none'})`);
  }
  const report = [];
  let changed = 0;
  for (const [key, previous] of before.scenarios) {
    const next = after.scenarios.get(key);
    if (previous.samples.length !== next.samples.length) throw new Error(`${key}: different sample counts`);
    const differences = hashes.filter(field => previous.sha256[field] !== next.sha256[field]);
    if (differences.length) changed++;
    const times = Object.entries(timings).map(([name, getTime]) => {
      const a = median(previous.samples, getTime), b = median(next.samples, getTime);
      return `${name} ${a === null || b === null ? 'unavailable' : `${a.toFixed(2)} → ${b.toFixed(2)} ms`}`;
    });
    report.push(`${key}: ${differences.length ? `changed ${differences.join(', ')}` : 'outputs match'} | ${times.join(' | ')}`);
  }
  return { report, changed };
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 2) throw new Error('Usage: node scripts/compare-browser-profiles.cjs BEFORE.json AFTER.json');
  const { report, changed } = compare(...args.map(readProfile));
  console.log(report.join('\n'));
  console.log(`${report.length - changed}/${report.length} scenarios match. Timing medians are informational.`);
  process.exitCode = changed ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
