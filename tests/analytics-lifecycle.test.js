const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);
const csv='Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n22.10.2026,12:00,0,1000,50,0,0,,4\n22.10.2026,11:00,20,1000,60,0,0,,4\n22.10.2026,11:00,21,1000,60,0,0,,4\n22.10.2026,10:00,,1000,60,0,0,,4';
function ready(){const a=app();a.run(`globalThis.inAnalytics=true;analyticsActive=()=>inAnalytics;
  analyticsDrawCard=()=>{};analyticsUpdateStatus=()=>{};
  store.rows=[{ts:new Date(2026,9,22,12),temp:99}];globalThis.original=store.rows;`);return a;}
async function config(a,index,station){a.respond(index,JSON.stringify({stationIdx:station,name:'Configured '+station,sheetId:'sheet-'+station,sheetName:'Prijem_dat'}));await settle();}

test('foreign histories load once through real configs and shared parser without changing active store or CFG',async()=>{
 const a=ready(),cfg=a.run('JSON.stringify(CFG)');
 const first=a.run('analyticsLoadStations()'),second=a.run('analyticsLoadStations()');
 assert.equal(a.requests.length,1);assert.match(a.requests[0].url,/config_praha_okno/);
 await config(a,0,1);assert.match(a.requests[1].url,/sheet-1/);assert.match(a.requests[1].url,/Prijem_dat/);
 a.respond(1,csv);await settle();await config(a,2,2);a.respond(3,csv);await Promise.all([first,second]);
 assert.equal(a.run('analyticsStationCache.size'),2);assert.equal(a.requests.length,4);
 assert.equal(a.run('analyticsStationCache.get(1).count'),3);assert.equal(a.run('analyticsStationCache.get(1).bytes'),48);
 assert.equal(a.run('analyticsStationCache.get(1).temps[0]'),0);
 assert.equal(a.run('analyticsStationCache.get(1).name'),'Configured 1');
 assert.equal(a.run('store.rows===original'),true);assert.equal(a.run('store.rows[0].temp'),99);assert.equal(a.run('JSON.stringify(CFG)'),cfg);
 await a.run('analyticsLoadStations()');assert.equal(a.requests.length,4);
});

test('leaving analytics aborts foreign requests and late completion cannot rebuild charts or commit cache',async()=>{
 const a=ready(),pending=a.run('analyticsLoadStations()');await config(a,0,1);
 a.run('inAnalytics=false;analyticsStop()');assert.equal(a.requests[1].signal.aborted,true);
 a.respond(1,csv);await pending;
 assert.equal(a.requests.length,2);assert.equal(a.run('analyticsStationCache.size'),0);assert.equal(a.run('analyticsCharts.size'),0);
 assert.equal(a.run('store.rows===original'),true);
});

test('A to B to A session changes reject an old foreign response even after analytics is active again',async()=>{
 const a=ready(),pending=a.run('analyticsLoadStations()');await config(a,0,1);
 a.run('switchStation(1);switchStation(0)');a.respond(1,csv);await pending;
 assert.equal(a.run('activeIdx'),0);assert.equal(a.run('analyticsStationCache.size'),0);assert.equal(a.run('analyticsCharts.size'),0);
});

test('foreign source changes while loading reject the old configuration result',async()=>{
 const a=ready(),pending=a.run('analyticsLoadStations()');await config(a,0,1);
 a.run('stations[1].sheetId="different"');a.respond(1,csv);await settle();
 await config(a,2,2);a.respond(3,csv);await pending;
 assert.equal(a.run('analyticsStationCache.has(1)'),false);assert.equal(a.run('analyticsStationCache.has(2)'),true);
 assert.equal(a.run('store.rows===original'),true);
});

test('foreign failure is explicit, leaves active data intact and does not automatically retry',async()=>{
 const a=ready(),pending=a.run('analyticsLoadStations()');a.respond(0,'{}',503);await settle();
 await config(a,1,2);a.respond(2,csv);await pending;
 assert.match(a.run('analyticsState.errors.get(1)'),/503/);assert.equal(a.run('analyticsStationCache.has(1)'),false);
 assert.equal(a.run('analyticsStationCache.has(2)'),true);assert.equal(a.run('store.rows===original'),true);
 const count=a.requests.length;await a.run('analyticsLoadStations()');assert.equal(a.requests.length,count);
});

test('oversized compact history is rejected before cache insertion',async()=>{
 const a=ready();a.run('analyticsCompact=()=>({times:new Float64Array(1),temps:new Float64Array(1),count:1,bytes:9*1024*1024})');
 const pending=a.run('analyticsLoadStations()');await config(a,0,1);a.respond(1,csv);await settle();await config(a,2,2);a.respond(3,csv);await pending;
 assert.equal(a.run('analyticsStationCache.size'),0);assert.match(a.run('analyticsState.errors.get(1)'),/8 MiB/);
});

test('destroying the workspace releases every Chart instance, models and pending work but keeps compact cache',()=>{
 const a=ready();a.run('globalThis.destroyed=0;analyticsCharts.set(0,{destroy(){destroyed++}});analyticsCharts.set(1,{destroy(){destroyed++}});analyticsState.model={rows:store.rows};analyticsStationCache.set(1,{count:3,bytes:48});analyticsStop()');
 assert.equal(a.run('destroyed'),2);assert.equal(a.run('analyticsCharts.size'),0);assert.equal(a.run('analyticsState.model'),null);assert.equal(a.run('analyticsState.visible.size'),0);assert.equal(a.run('analyticsStationCache.size'),1);
});

test('model statistics use all original rows and render-only gaps never become measured data',()=>{
 const a=ready();a.run(`store.rows=[{ts:new Date(2026,9,22,12),temp:85,hum:0,voltage:4},{ts:new Date(2026,9,20,12),temp:0,hum:null,voltage:0}];
 globalThis.m=analyticsBuildModel({from:+store.rows[1].ts,to:+store.rows[0].ts})`);
 assert.equal(a.run('m.summary.stats.temp.count'),2);assert.equal(a.run('m.summary.stats.temp.avg'),42.5);
 assert.equal(a.run('m.rows.length'),2);assert.equal(a.run('m.samples.some(r=>r.anaGap)'),true);
 assert.equal(a.run('m.xy.every(p=>p.ts===+store.rows[0].ts||p.ts===+store.rows[1].ts)'),true);
});

test('a failed forced refresh keeps cached temperatures and explicitly labels the failed refresh',async()=>{
 const a=ready(),pending=a.run('analyticsLoadStations()');await config(a,0,1);a.respond(1,csv);await settle();await config(a,2,2);a.respond(3,csv);await pending;
 const entry=a.run('analyticsStationCache.get(1)'),again=a.run('analyticsLoadStations(true)');a.respond(4,'{}',503);await settle();await config(a,5,2);a.respond(6,csv);await again;
 assert.equal(a.run('analyticsStationCache.get(1)'),entry);
 a.run('globalThis.model={rows:store.rows,samples:store.rows};globalThis.result=analyticsComparison({from:+store.rows[0].ts-86400000,to:+store.rows[0].ts},model)');
 assert.match(a.run('result.note'),/obnova selhala/);assert.match(a.run('result.note'),/předchozí cache/);
 assert.equal(a.run('result.datasets.length'),3);assert.equal(a.run('store.rows===original'),true);
});

test('cache insertion enforces the total 16 MiB budget and evicts the least recently used source',async()=>{
 const a=ready();a.run(`analyticsStationCache.set(0,{bytes:8*1024*1024,preferences:analyticsSourceSignature(0)});
  analyticsStationCache.set(2,{bytes:8*1024*1024,preferences:analyticsSourceSignature(2)});
  analyticsCompact=()=>({times:new Float64Array(1),temps:new Float64Array(1),count:1,bytes:8*1024*1024});`);
 const pending=a.run('analyticsLoadStations()');await config(a,0,1);a.respond(1,csv);await pending;
 assert.equal(a.run('analyticsStationCache.has(0)'),false);assert.equal(a.run('analyticsStationCache.has(1)'),true);assert.equal(a.run('analyticsStationCache.has(2)'),true);
 assert.equal(a.run('[...analyticsStationCache.values()].reduce((n,c)=>n+c.bytes,0)'),16*1024*1024);
});

test('250k raw rows retain global spikes and complete statistics within one bounded cached visual model',()=>{
 const a=ready();a.run(`globalThis.reads=0;store.rows=new Proxy(Array.from({length:250000},(_,i)=>({
  ts:new Date(+new Date(2026,9,22,12)-i*1000),temp:i===17?85:i%41,hum:i%13===0?null:i%101,pressure:1010,voltage:i===4321?7:4+i%99/100
 })),{get(target,key,receiver){if(/^\\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver)}});
 el('anaSync').checked=true;analyticsState.domain=analyticsRange(store.rows,'all');globalThis.m=analyticsModel(0);globalThis.initial=reads;`);
 assert.equal(a.run('m.summary.stats.temp.count'),250000);assert.equal(a.run('m.summary.stats.temp.max'),85);
 assert.equal(a.run('m.pair.count'),250000);assert.equal(a.run('m.samples.some(r=>r===store.rows[17])'),true);
 assert.equal(a.run('m.xy.some(p=>p.ts===+store.rows[4321].ts&&p.y===7)'),true);
 assert.ok(a.run('m.samples.length<=600 && m.xy.length<=580 && m.summary.rates.length<=600'));
 a.run('globalThis.initial=reads;globalThis.second=analyticsModel(0)');assert.equal(a.run('m===second'),true);assert.equal(a.run('reads'),a.run('initial'));
});
