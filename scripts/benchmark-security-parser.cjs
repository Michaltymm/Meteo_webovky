const {app}=require('../tests/helpers/app');
const a=app(),results=[];
a.run('parseHistoryCSV("22.10.2026,10:00,20,1000,50,0,0,0,4\\n".repeat(1000))');
for(const n of [1000,10000,100000,250000]){
 a.run('globalThis.fixture='+JSON.stringify('22.10.2026,10:00,20,1000,50,0,0,0,4\n'.repeat(n)));
 const times=[];for(let repeat=0;repeat<3;repeat++){global.gc();const start=performance.now();if(a.run('parseHistoryCSV(fixture).length')!==n)throw new Error('row loss');times.push(performance.now()-start);}
 results.push({n,medianMs:Math.round(times.sort((x,y)=>x-y)[1]),heapAfterMiB:Math.round(process.memoryUsage().heapUsed/1048576)});
}console.log(JSON.stringify(results,null,2));
