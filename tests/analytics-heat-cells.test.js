const assert=require('node:assert/strict');
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {app}=require('./helpers/app');

// Original inline aggregation: one full page scan, assigning each record by
// its local date and hour. Keep it independent of the new daily selection.
function originalCells(source,keys,from,to) {
  const cells=keys.map(()=>Array.from({length:24},()=>({temp:{sum:0,count:0,min:null,max:null},hum:{sum:0,count:0,min:null,max:null}})));
  if(keys.length){
    const low=localDayBounds(keys.at(-1)).from,high=localDayBounds(keys[0]).to;
    const {start,end}=historyRangeBounds(source,Math.max(from,low),Math.min(to,high));
    const map=new Map(keys.map((key,i)=>[key,i]));
    for(let i=end-1;i>=start;i--){const row=source[i],day=map.get(localDateKey(row.ts));if(day===undefined)continue;
      for(const metric of ['temp','hum']){const v=row[metric],s=cells[day][row.ts.getHours()][metric];
        if(!Number.isFinite(v))continue;s.sum+=v;s.count++;s.min=s.min===null?v:Math.min(s.min,v);s.max=s.max===null?v:Math.max(s.max,v);
      }
    }
  }
  return cells;
}
function fixture(){const a=app();a.run(`globalThis.originalCells=${originalCells.toString()};
  globalThis.rows=[];globalThis.keys=[];globalThis.from=-8e15;globalThis.to=8e15;
  globalThis.row=(ts,temp,hum)=>({ts:new Date(ts),temp,hum});`);return a;}
const plain=v=>Array.isArray(v)?Array.from(v,plain):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)])):v;
function same(a){const actual=plain(a.run('analyticsHeatCells(rows,keys,from,to)'));assert.deepEqual(actual,plain(a.run('originalCells(rows,keys,from,to)')));return actual;}

test('heat cells keep 24 empty hours and independent validity/zero/extrema for each metric',()=>{
  const a=fixture();assert.deepEqual(same(a),[]);
  a.run(`keys=['2026-10-24'];rows=[row(new Date(2026,9,24,10),0,null),row(new Date(2026,9,24,10),null,0),
    row(new Date(2026,9,24,10),-5,90),row(new Date(2026,9,24,9),NaN,Infinity)];`);
  const cells=same(a);assert.equal(cells[0].length,24);
  assert.deepEqual(cells[0][10].temp,{sum:-5,count:2,min:-5,max:0});
  assert.deepEqual(cells[0][10].hum,{sum:90,count:2,min:0,max:90});
  assert.deepEqual(cells[0][9].temp,{sum:0,count:0,min:null,max:null});
});

test('inclusive custom boundaries retain all duplicates and precise accumulation order',()=>{
  const a=fixture();
  a.run(`keys=['2026-10-24','2026-10-23'];from=+new Date(2026,9,23,23,59,59,999);to=+new Date(2026,9,24,0);
    rows=[row(to+1,999,999),row(to,3,3),row(to,-1e16,4),row(to,1,5),row(to,1e16,6),row(from,0,0),row(from,2,2),row(from-1,999,999)];`);
  const cells=same(a);assert.equal(cells[0][0].temp.count,4);assert.equal(cells[0][0].temp.sum,3);
  assert.equal(cells[1][23].temp.count,2);
});

test('sparse page keys exclude intervening days and never invent missing observations',()=>{
  const a=fixture();
  a.run(`keys=['2026-10-24','2026-10-20'];rows=[row(new Date(2026,9,24,10),1,10),row(new Date(2026,9,22,10),999,999),row(new Date(2026,9,20,10),2,20)];`);
  const cells=same(a);assert.equal(cells[0][10].temp.sum,1);assert.equal(cells[1][10].temp.sum,2);
  a.run('from=to=+new Date(2026,9,22,10)');
  assert.ok(same(a).every(day=>day.every(cell=>cell.temp.count===0&&cell.hum.count===0)));
});

test('all nonnumeric/nonfinite inputs and derived overflow preserve the original aggregation',()=>{
  const a=fixture();
  a.run(`keys=['2026-10-24'];rows=[null,undefined,NaN,Infinity,-Infinity,'7',-0,0,1e308,1e308].map(v=>row(new Date(2026,9,24,10),v,v));`);
  const cells=same(a);assert.equal(cells[0][10].temp.count,4);assert.equal(cells[0][10].temp.sum,Infinity);
});

test('random multi-day pages and partial ranges equal the original algorithm exactly',()=>{
  const a=fixture();
  a.run(`globalThis.seed=7279;globalThis.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
  for(let trial=0;trial<100;trial++) {
    a.run(`rows=Array.from({length:3000},()=>row(+new Date(2026,8,1)+Math.floor(random()*60*24)*3600000,
      random()<.1?null:random()<.1?0:(random()-.5)*60,random()<.1?NaN:random()*100));
      rows.sort((a,b)=>b.ts-a.ts);keys=[...new Set(rows.map(r=>localDateKey(r.ts)))].sort().reverse();
      globalThis.page=Math.floor(random()*5);keys=keys.slice(page*14,(page+1)*14);
      from=+rows[Math.floor(rows.length*.8)].ts+1;to=+rows[Math.floor(rows.length*.1)].ts;`);
    same(a);
  }
});

test('250k history only visits selected daily ranges, reads the hour once, and leaves source/cache unchanged',()=>{
  const a=fixture();
  a.run(`globalThis.hourReads=0;rows=Array.from({length:250000},(_,i)=>{
      const r=row(+new Date(2026,9,24,12)-i*300000,i%23===0?null:Math.sin(i/40),i%29===0?null:50);
      r.ts.getHours=function(){hourReads++;return Date.prototype.getHours.call(this)};return Object.freeze(r);
    });Object.freeze(rows);keys=Array.from({length:14},(_,i)=>localDateKey(localCalendarDay(-i,rows[0].ts)));
    globalThis.expected=originalCells(rows,keys,from,to);globalThis.count=rows.filter(r=>+r.ts>=localDayBounds(keys.at(-1)).from).length;
    globalThis.source=rows;globalThis.cache=aggregateCache;globalThis.reads=0;hourReads=0;
    rows=new Proxy(rows,{get(target,key,receiver){if(typeof key==='string'&&/^\\d+$/.test(key))reads++;return Reflect.get(target,key,receiver)}});
    globalThis.actual=analyticsHeatCells(rows,keys,from,to);`);
  assert.deepEqual(plain(a.run('actual')),plain(a.run('expected')));
  assert.equal(a.run('hourReads'),a.run('count'));
  assert.ok(a.run('reads<=count+2*keys.length*Math.ceil(Math.log2(source.length))'));
  assert.equal(a.run('aggregateCache===cache && Object.isFrozen(source)'),true);
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,0);
});

test('actual local calendar days retain skipped/repeated hours and half-hour DST transitions',()=>{
  const script=`const {app}=require('./tests/helpers/app');const assert=require('node:assert/strict');const a=app();
    a.run('globalThis.originalCells='+${JSON.stringify(originalCells.toString())});
    for(const key of process.argv[1].split(',')){
      a.run('globalThis.keys=['+JSON.stringify(key)+'];globalThis.b=localDayBounds(keys[0]);globalThis.from=b.from;globalThis.to=b.to;globalThis.rows=[];for(let t=b.to+1;t>=b.from-1;t-=60000)rows.push({ts:new Date(t),temp:1,hum:2});rows.push({ts:new Date(b.from),temp:0,hum:0});rows.sort((a,b)=>b.ts-a.ts)');
      assert.equal(a.run('JSON.stringify(analyticsHeatCells(rows,keys,from,to))'),a.run('JSON.stringify(originalCells(rows,keys,from,to))'));
      assert.equal(a.run('analyticsHeatCells(rows,keys,from,to)[0].reduce((n,c)=>n+c.temp.count,0)'),a.run('rows.filter(r=>+r.ts>=from&&+r.ts<=to).length'));
    }`;
  for(const [TZ,days] of [['Europe/Prague','2026-03-29,2026-10-25'],['America/New_York','2026-03-08,2026-11-01'],['Australia/Lord_Howe','2026-04-05,2026-10-04'],['UTC','2026-03-29,2026-10-25']])
    execFileSync(process.execPath,['-e',script,days],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ},stdio:'pipe'});
});
