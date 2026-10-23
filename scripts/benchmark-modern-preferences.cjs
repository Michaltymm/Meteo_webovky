// VM microbenchmark of unchanged header/card visibility synchronization, not browser layout.
// node --expose-gc scripts/benchmark-modern-preferences.cjs [baseline-index.html]
const path = require('node:path');
if (process.argv[2]) process.env.METEO_TEST_HTML = path.resolve(process.argv[2]);
const { app } = require('../tests/helpers/app');
const a = app();
a.run('showAppPage("modern")');
const results = [];
for (const count of [1000, 10000, 100000, 250000]) {
  a.run(`store.rows=Array.from({length:${count}},()=>({ts:new Date(0),temp:12,hum:50,pressure:1000,voltage:4}));for(let i=0;i<1000;i++)syncModernStation()`);
  const samples = [];
  for (let repeat = 0; repeat < 7; repeat++) {
    global.gc?.();
    const start = performance.now();
    a.run('for(let i=0;i<1000;i++)syncModernStation()');
    samples.push(performance.now() - start);
  }
  samples.sort((x,y) => x-y);
  results.push({ count, calls: 1000, medianMs: +samples[3].toFixed(2) });
}
console.log(JSON.stringify(results, null, 2));
