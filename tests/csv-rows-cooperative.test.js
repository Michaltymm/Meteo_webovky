const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const settle=()=>new Promise(setImmediate);
function fixture(){const a=app();a.run(`globalThis.mono=0;globalThis.performance={now:()=>++mono};
  globalThis.csv=Array.from({length:12000},(_,i)=>'25.10.2026,12:00,'+(i%7)+',1010,50,0,0,,4,"id'+i+'"').join('\\n');
  globalThis.oldRows=store.rows;globalThis.oldReport=dataStatus.sheets.validation;globalThis.timing=newSheetsTiming('full');
  globalThis.realRowsSteps=parseHistoryRowSteps;globalThis.privateReport=null;
  parseHistoryRowSteps=(...args)=>{privateReport=args[2];return realRowsSteps(...args)};`);return a;}
async function start(a){const p=a.run('parseAndStore(csv,stationContext(),"full",timing)');a.tick();await settle();return pWrap(p);}
const pWrap=p=>({p});
async function until(a,expression){for(let i=0;i<3000;i++){if(a.run(expression))return;await settle();a.tick(0);}assert.fail('phase must progress');}
async function drain(a,p){let done=false;p.then(()=>done=true,()=>done=true);for(let i=0;!done;i++){assert.ok(i<3000);await settle();a.tick(0);}return p;}

test('partial filtering and validation reports remain private until the whole result is ready',async()=>{
  const a=fixture(),{p}=await start(a);
  await until(a,'privateReport!==null');assert.equal(a.run('privateReport.total'),0);
  a.tick(0);assert.equal(a.run('privateReport.total'),0);
  assert.equal(a.run('store.rows===oldRows && dataStatus.sheets.validation===oldReport'),true);
  await until(a,'privateReport.accepted>0');
  assert.ok(a.run('privateReport.accepted<12000 && !privateReport.complete'));
  assert.equal(a.run('store.rows===oldRows && dataStatus.sheets.validation===oldReport'),true);
  assert.equal(await drain(a,p),true);assert.equal(a.run('privateReport.complete'),true);
  assert.equal(a.run('timing.parse.runs'),1);assert.equal(a.state.renders,1);
});

test('abort in filtering or row conversion settles immediately and clears callbacks without publishing',async()=>{
  for(const phase of ['privateReport!==null','privateReport?.accepted>0']){
    const a=fixture(),{p}=await start(a);await until(a,phase);
    const callback=[...a.timers.values()].find(t=>t.delay===0).fn;
    a.run('switchStation(1);store.rows=[{temp:777}];globalThis.newReport=dataStatus.sheets.validation');
    assert.equal(await p,false);assert.equal([...a.timers.values()].some(t=>t.delay===0),false);
    callback();assert.equal(a.run('store.rows.length===1 && store.rows[0].temp===777 && dataStatus.sheets.validation===newReport'),true);
  }
});

test('station change after validation finishes but before the await continuation blocks the final commit',async()=>{
  const a=fixture(),{p}=await start(a);
  for(let i=0;!a.run('privateReport?.complete===true');i++){assert.ok(i<3000);await settle();a.tick(0);}
  a.run('switchStation(1);switchStation(0);store.rows=[{temp:999}]');
  assert.equal(await p,false);assert.equal(a.run('store.rows[0].temp'),999);
  assert.equal(a.run('dataStatus.sheets.validation'),null);
});

test('blank records, multiline notes and rejected logical positions survive batch filtering exactly',async()=>{
  const a=fixture();a.run(`csv=['Weather','Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti','',
    '" "','25.10.2026,12:00,0,0,0,0,0,0,0,"a\\nb"','missing,,1','31.02.2026,12:00,1',csv].join('\\n');`);
  const {p}=await start(a);assert.equal(await drain(a,p),true);
  assert.equal(a.run('JSON.stringify([privateReport.total,privateReport.empty,privateReport.leading,privateReport.accepted,privateReport.rejected])'),'[12007,2,2,12001,2]');
  assert.equal(a.run('JSON.stringify(privateReport.samples)'),'[{"record":6,"code":"DATE_MISSING"},{"record":7,"code":"DATETIME_INVALID"}]');
  assert.equal(a.run('store.rows[0].note'),'a\nb');assert.equal(a.run('store.rows[0].voltage'),0);
  assert.equal(a.run('privateReport.sensors.every(s=>s.valid===12001 || s.valid===1)'),true);
});

test('year inference crosses validation boundaries without reinitializing yearState',async()=>{
  const a=fixture();a.run(`globalThis.NativeDate=Date;globalThis.Date=class extends NativeDate{
    constructor(...args){super(...(args.length?args:[2026,0,2,12]))}static now(){return +new NativeDate(2026,0,2,12)}};
    csv=Array.from({length:12000},(_,i)=>(i<256?'01.01.':i===256?'31.12.':'30.12.2025')+',12:00,1,1010,50,0,0,,4,"id'+i+'"').join('\\n');`);
  const {p}=await start(a);assert.equal(await drain(a,p),true);
  assert.equal(a.run('store.rows.find(r=>r.note==="id0").ts.getFullYear()'),2026);
  assert.equal(a.run('store.rows.find(r=>r.note==="id256").ts.getFullYear()'),2025);
  assert.equal(a.run('privateReport.accepted'),12000);
});

test('zero accepted records preserve old measurements and count one completed parse attempt',async()=>{
  const a=fixture();a.run('csv="31.02.2026,12:00,1,1010,50,0,0,,4\\n".repeat(12000)');
  const {p}=await start(a);assert.equal(await drain(a,p),false);
  assert.equal(a.run('store.rows===oldRows'),true);assert.equal(a.state.renders,0);
  assert.equal(a.run('dataStatus.sheets.validation.rejected'),12000);
  assert.equal(a.run('dataStatus.sheets.validation.complete'),true);assert.equal(a.run('timing.parse.runs'),1);
});

test('unexpected conversion failure preserves old data with one incomplete attempt and no leaked timer',async()=>{
  const a=fixture();a.run(`globalThis.realDateParser=parseCSDateTime;globalThis.converted=0;
    parseCSDateTime=(...args)=>{if(++converted===1200)throw new Error('controlled failure');return realDateParser(...args)};`);
  const {p}=await start(a);const rejected=assert.rejects(p,/controlled failure/);
  await assert.rejects(drain(a,p),/controlled failure/);await rejected;
  assert.equal(a.run('store.rows===oldRows'),true);assert.equal(a.state.renders,0);
  assert.equal(a.run('dataStatus.sheets.validation.complete'),false);assert.equal(a.run('timing.parse.runs'),1);
  assert.equal([...a.timers.values()].some(t=>t.delay===0),false);
});

test('native sorting remains descending and stable for time duplicates after all validation batches',async()=>{
  const a=fixture();a.run(`csv=Array.from({length:12000},(_,i)=>'25.10.2026,'+(i%2?'11:00':'12:00')+','+i+',1010,50,0,0,,4').join('\\n')`);
  const {p}=await start(a);assert.equal(await drain(a,p),true);
  assert.equal(a.run('store.rows.every((r,i,rows)=>i===0||+rows[i-1].ts>=+r.ts)'),true);
  assert.equal(a.run('store.rows.slice(0,6000).every((r,i)=>r.temp===i*2)'),true);
  assert.equal(a.run('store.rows.slice(6000).every((r,i)=>r.temp===i*2+1)'),true);
});
