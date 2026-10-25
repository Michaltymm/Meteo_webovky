// Compare the actual loading pipeline in the project VM; transports/UI are mocked.
// METEO_TEST_HTML=/path/to/baseline.html node --expose-gc scripts/benchmark-sheets-timing.cjs
const { app } = require('../tests/helpers/app');
const {createHash}=require('node:crypto');
const a = app(), results = [];
const shuffled=process.argv.includes('--shuffled');
const counts=(process.argv.find(v=>v.startsWith('--counts='))?.slice(9)||'1000,10000,100000,250000').split(',').map(Number);
if(counts.some(n=>!Number.isInteger(n)||n<1||n>300000))throw new Error('Invalid fixture count');
a.run('(clock)=>{globalThis.performance={now:clock}}')(()=>performance.now());
a.run(`globalThis.parseBlocks=[];globalThis.parseCalls=[];globalThis.parseDepth=0;globalThis.sortCalls=[];
  const originalSort=Array.prototype.sort;
  Array.prototype.sort=function(...args){const tracked=this.length&&this[0]?.ts instanceof Date,start=performance.now();
    try{return originalSort.apply(this,args)}finally{if(tracked)sortCalls.push(performance.now()-start)}};
  for(const name of ['parseCSV','parseHistoryCSV','parseHistoryRows','analyticsWorkSlice']){
    const original=globalThis[name];if(typeof original!=='function')continue;
    globalThis[name]=function(...args){const start=performance.now();parseDepth++;
      try{return original(...args)}finally{const ms=performance.now()-start;
        parseCalls.push({name,ms});if(--parseDepth===0)parseBlocks.push(ms);}}
  }`);
const settle = () => new Promise(setImmediate);
async function load() {
  let done=false,error;
  const pending=a.run('fetchSheets(true)');
  pending.then(()=>{done=true},e=>{done=true;error=e});
  a.respond(a.requests.length-1,a.run('fixture'));
  while(!done){await settle();a.tick();a.tick(0);}
  if(error)throw error;await pending;
}
async function main() {
  for(const count of counts) {
    if(shuffled)a.run(String.raw`globalThis.fixture=Array.from({length:${count}},(_,i)=>{
      const s=i*7919%86400,t=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');
      return '23.10.2026,'+t+','+(i%7)+',1010,50,0,0,,'+(i%3?'4 V':'');
    }).join('\n');resetStationStore()`);
    else a.run(String.raw`globalThis.fixture=Array.from({length:${count}},(_,i)=>
      '23.10.2026,12:00,'+(i%7)+',1010,50,0,0,,'+(i%3?'4 V':'')
    ).join('\n');resetStationStore()`);
    await load();
    const samples=[],heaps=[],blocks=[],calls=[],sorts=[],signatures=[];
    for(let repeat=0;repeat<5;repeat++) {
      a.run('resetStationStore();parseBlocks=[];parseCalls=[];sortCalls=[]');global.gc?.();
      const start=performance.now();await load();samples.push(performance.now()-start);
      heaps.push(process.memoryUsage().heapUsed/1048576);
      if(a.run('store.rows.length')!==count)throw new Error('row loss');
      blocks.push(Math.max(...a.run('parseBlocks')));calls.push(JSON.parse(a.run('JSON.stringify(parseCalls)')));
      sorts.push(Array.from(a.run('sortCalls')));
      signatures.push(createHash('sha256').update(a.run('JSON.stringify({rows:store.rows,validation:{...dataStatus.sheets.validation,checkedAt:0}})')).digest('hex'));
    }
    const preserved=a.run('JSON.stringify([store.rows.length,store.rows.reduce((sum,r)=>sum+r.temp,0),store.rows.filter(r=>r.voltage===null).length])');
    if(new Set(signatures).size!==1)throw new Error('inconsistent result');
    results.push({rows:count,samplesMs:samples,medianMs:+[...samples].sort((x,y)=>x-y)[2].toFixed(2),heapAfterMiB:heaps,
      longestParseBlocksMs:blocks,medianLongestBlockMs:+[...blocks].sort((x,y)=>x-y)[2].toFixed(2),parseCalls:calls,sortCallsMs:sorts,signatureSHA256:signatures[0],
      preserved:JSON.parse(preserved),timing:a.run('JSON.stringify(dataStatus.sheets.timing||null)')});
  }
  console.log(JSON.stringify({node:process.version,scenario:shuffled?'deterministic unordered timestamps':'equal timestamps',results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
