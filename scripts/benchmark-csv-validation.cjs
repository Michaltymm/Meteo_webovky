// Parser cost with active-station diagnostics; baseline has no collector.
// METEO_TEST_HTML=/path/to/baseline.html node --expose-gc scripts/benchmark-csv-validation.cjs
const { app } = require('../tests/helpers/app');
const a = app(), results = [];
a.run(`globalThis.runParser=()=>{
  globalThis.validation=typeof newCSVValidation==='function'?newCSVValidation('full'):null;
  globalThis.parsed=parseHistoryCSV(fixture,validation);
  return parsed.length;
}`);
for (const count of [1000, 10000, 100000, 250000]) {
  a.run(String.raw`globalThis.fixture=Array.from({length:${count}},(_,i)=>
    (i%41===0?'31.02.2026':'23.10.2026')+',12:00,'+(i%7)+',1010,50,0,0,,'+(i%3?'4 V':'')
  ).join('\n');runParser();parsed=null;validation=null;`);
  const times = [], heaps = [];
  for (let repeat = 0; repeat < 5; repeat++) {
    a.run('parsed=null;validation=null'); global.gc?.();
    const start = performance.now();
    const accepted = a.run('runParser()');
    times.push(performance.now()-start);
    heaps.push(process.memoryUsage().heapUsed/1048576);
    const expected = count-Math.ceil(count/41);
    if (accepted !== expected) throw new Error('Changed accepted rows');
    if (!a.run('parsed.every(r=>r.temp!==null && r.ts.getTime()===parsed[0].ts.getTime())')) throw new Error('Changed values/order');
    if (!a.run('validation===null || (validation.complete && validation.accepted===parsed.length && validation.total===validation.accepted+validation.rejected && validation.samples.length===8)')) throw new Error('Invalid diagnostic totals');
  }
  const sorted = [...times].sort((x,y)=>x-y);
  const preserved = a.run('JSON.stringify([parsed.length,parsed.reduce((sum,r)=>sum+r.temp,0),parsed.filter(r=>r.voltage===null).length])');
  results.push({rows:count,samplesMs:times,medianMs:+sorted[2].toFixed(2),heapAfterMiB:heaps,preserved:JSON.parse(preserved),
    reportBytes:a.run('validation?new TextEncoder().encode(JSON.stringify(validation)).length:0')});
}
console.log(JSON.stringify({node:process.version,diagnostics:a.run('typeof newCSVValidation==="function"'),results},null,2));
