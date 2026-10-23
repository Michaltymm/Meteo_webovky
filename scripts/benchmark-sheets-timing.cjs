// Compare the actual loading pipeline in the project VM; transports/UI are mocked.
// METEO_TEST_HTML=/path/to/baseline.html node --expose-gc scripts/benchmark-sheets-timing.cjs
const { app } = require('../tests/helpers/app');
const a = app(), results = [];
a.run('(clock)=>{globalThis.performance={now:clock}}')(()=>performance.now());
const settle = () => new Promise(setImmediate);
async function load() {
  const pending=a.run('fetchSheets(true)');
  a.respond(a.requests.length-1,a.run('fixture'));
  await settle();a.tick();await pending;
}
async function main() {
  for(const count of [1000,10000,100000,250000]) {
    a.run(String.raw`globalThis.fixture=Array.from({length:${count}},(_,i)=>
      '23.10.2026,12:00,'+(i%7)+',1010,50,0,0,,'+(i%3?'4 V':'')
    ).join('\n');resetStationStore()`);
    await load();
    const samples=[],heaps=[];
    for(let repeat=0;repeat<5;repeat++) {
      a.run('resetStationStore()');global.gc?.();
      const start=performance.now();await load();samples.push(performance.now()-start);
      heaps.push(process.memoryUsage().heapUsed/1048576);
      if(a.run('store.rows.length')!==count)throw new Error('row loss');
    }
    const preserved=a.run('JSON.stringify([store.rows.length,store.rows.reduce((sum,r)=>sum+r.temp,0),store.rows.filter(r=>r.voltage===null).length])');
    results.push({rows:count,samplesMs:samples,medianMs:+[...samples].sort((x,y)=>x-y)[2].toFixed(2),heapAfterMiB:heaps,
      preserved:JSON.parse(preserved),timing:a.run('JSON.stringify(dataStatus.sheets.timing||null)')});
  }
  console.log(JSON.stringify({node:process.version,results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
