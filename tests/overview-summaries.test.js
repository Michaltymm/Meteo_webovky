const assert=require('node:assert/strict');
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {app}=require('./helpers/app');
const oracle=`globalThis.referenceOverview=(rows,get,cut)=>{
 const groups={};for(const row of rows){if(row.ts<new Date(cut))continue;const v=get(row);if(v===null)continue;
 const k=String(row.ts.getDate()).padStart(2,'0')+'. '+String(row.ts.getMonth()+1).padStart(2,'0')+'. '+row.ts.getFullYear();
 (groups[k]??=[]).push(v);}
 return Object.fromEntries(Object.entries(groups).map(([k,values])=>{
 const finite=values.filter(Number.isFinite);return [k,{min:finite.length?Math.min(...finite):null,max:finite.length?Math.max(...finite):null,
 avg:finite.length?finite.reduce((sum,v)=>sum+v,0)/finite.length:null,count:finite.length}];}));
};globalThis.checkOverview=(rows,get,cut)=>{
 const expected=referenceOverview(rows,get,cut),actual=overviewDaySummaries(rows,get,cut);
 return JSON.stringify(Object.fromEntries(Object.entries(actual).map(([k,v])=>[k,v.summary])))===JSON.stringify(expected);
};`;
test('streamed day summaries equal full-array numeric statistics for all three metrics and exact ranges',()=>{
 const a=app();a.run(oracle);
 assert.equal(a.run(`(()=>{
 const rows=Array.from({length:12000},(_,i)=>({ts:new Date(1700000000000-Math.floor(i/2)*300000),temp:i%11?i%73/3:null,hum:i%7?i%101:null,pressure:i%13?i%17+1000:null}));
 for(const metric of ['temp','hum','pressure'])for(const days of [0,1,7,30]){
 const cut=days?1700000000000-days*86400000:0;if(!checkOverview(rows,r=>r[metric],cut))return false;
 }return true;})()`),true);
});
test('same-time ties, floating-point summation, missing values and zero retain source order without mutation',()=>{
 const a=app();a.run(oracle);
 assert.equal(a.run(`(()=>{
 const rows=Object.freeze([1,-1e16,1e16,0,null].map(temp=>Object.freeze({ts:new Date(1700000000000),temp})));
 const actual=overviewDaySummaries(rows,r=>r.temp,0),value=Object.values(actual)[0].summary;
 return checkOverview(rows,r=>r.temp,0)&&value.avg===0&&value.count===4&&rows[0].temp===1;
 })()`),true);
});
test('time boundary includes original exact-cut and future rows, excludes pre-epoch data for all-time mode',()=>{
 const a=app();a.run(oracle);
 assert.equal(a.run(`(()=>{
 const cut=1700000000000,rows=[cut+86400000,cut+1,cut,cut-1,0,-1].map((t,i)=>({ts:new Date(t),temp:i}));
 return checkOverview(rows,r=>r.temp,cut)&&checkOverview(rows,r=>r.temp,0)&&
 Object.values(overviewDaySummaries(rows,r=>r.temp,cut)).reduce((n,d)=>n+d.summary.count,0)===3;
 })()`),true);
});
test('small selected interval does not traverse 250k old rows or format every measurement date',()=>{
 const a=app();a.run(`globalThis.reads=0;globalThis.dates=0;globalThis.realFmt=fmtDateShort;
 fmtDateShort=d=>{dates++;return realFmt(d)};
 const source=Array.from({length:250000},(_,i)=>({ts:new Date(1700000000000-i*300000),temp:i%7}));
 globalThis.rows=new Proxy(source,{get(t,k,r){if(/^\\d+$/.test(String(k)))reads++;return Reflect.get(t,k,r)}});
 globalThis.summary=overviewDaySummaries(rows,r=>r.temp,1700000000000-86400000);`);
 assert.ok(a.run('reads')<400);assert.ok(a.run('dates')<=2);
 assert.equal(a.run('Object.values(summary).reduce((n,d)=>n+d.summary.count,0)'),289);
});
test('MQTT and combined source clocks keep the full predicate for unsorted receipt timestamps',()=>{
 const a=app();a.run(oracle);
 for(const source of ['mqtt','both']){
  a.run(`CFG.source='${source}';globalThis.rows=[0,5,-2,3,1,-1].map((h,i)=>({ts:new Date(1700000000000+h*3600000),temp:i%3?i:0}))`);
  assert.equal(a.run('checkOverview(rows,r=>r.temp,1700000000000)'),true);
 }
});
test('calendar grouping remains exact across DST, repeated local hours and non-hour offsets',()=>{
 const script=`const {app}=require('./tests/helpers/app');const a=app();a.run(${JSON.stringify(oracle)});
 const ok=a.run(${JSON.stringify(`(()=>{
 CFG.source='sheets';
 for(const base of ['2026-10-25T03:00:00Z','2026-03-29T03:00:00Z']){
 const rows=Array.from({length:3000},(_,i)=>({ts:new Date(Date.parse(base)-i*60000),temp:i%11?i/3:null}));
 if(!checkOverview(rows,r=>r.temp,Date.parse(base)-86400000))return false;
 }return true;})()`)});if(!ok)process.exit(1);`;
 for(const TZ of ['Europe/Prague','Australia/Lord_Howe','Asia/Kathmandu'])execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ}});
});
test('overview chart and table retain old precise summaries for temperature, humidity and pressure',()=>{
 const a=app();a.run(oracle);
 for(const metric of ['temp','hum','pressure']){
 a.run(`store.rows=Array.from({length:500},(_,i)=>({ts:new Date(Date.now()-i*3600000),temp:i%11?i/3:null,hum:i%7?i%101:null,pressure:i%13?1000+i:null}));
 ovDays=0;el('ovMetric').value='${metric}';buildTempOverview();globalThis.expected=referenceOverview(store.rows,r=>r['${metric}'],0);`);
 assert.equal(a.run(`chartOverview.data.labels.every((k,i)=>chartOverview.data.datasets[0].data[i]===+expected[k].max.toFixed(1)&&
 chartOverview.data.datasets[1].data[i]===+expected[k].min.toFixed(1)&&chartOverview.data.datasets[2].data[i]===+expected[k].avg.toFixed(1)&&
 el('ovTableBody').innerHTML.includes('<td>'+expected[k].avg.toFixed(1)+'</td>'))`),true);
 }
});
test('cached civil-day grouping preserves DST and non-hour offsets in three time zones',()=>{
 const code=`const assert=require('node:assert/strict');const {app}=require('./tests/helpers/app');const a=app();
 a.run(${JSON.stringify(oracle)});
 assert.equal(a.run(\`(()=>{
 const base=Date.parse('2026-10-26T12:00:00Z');
 const rows=Array.from({length:3000},(_,i)=>({ts:new Date(base-Math.floor(i/2)*37*60000),temp:i%7?i%67/3:null}));
 for(const cut of [0,Date.parse('2026-10-25T00:30:00Z'),Date.parse('2026-10-25T00:30:00Z')+1])if(!checkOverview(rows,r=>r.temp,cut))return false;
 return true;})()\`),true);`;
 for(const zone of ['UTC','Europe/Prague','Asia/Kathmandu'])execFileSync(process.execPath,['-e',code],{cwd:process.cwd(),env:{...process.env,TZ:zone}});
});
