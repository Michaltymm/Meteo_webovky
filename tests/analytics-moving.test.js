const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

// Original two-pass algorithm: compute every rolling mean, then run the
// unchanged general sampler. Exact numeric comparisons catch reassociation.
function originalMoving(rows,metric) {
  const points=[],queue=[];let sum=0,prev=null;
  for(const r of rows){const x=+r.ts,v=r[metric];
    if(!Number.isFinite(v)||(prev!==null&&x-prev>10800000)){queue.length=0;sum=0;}
    if(Number.isFinite(v)){queue.push(v);sum+=v;if(queue.length>5)sum-=queue.shift();}
    points.push({x,y:queue.length===5?sum/5:null});prev=x;
  }
  return sampleExtrema(points,[p=>p.y],600);
}
function fixture() {
  const a=app();a.run(`globalThis.originalMoving=${originalMoving.toString()};
    globalThis.row=(i,temp,pressure=temp)=>({ts:new Date(1792843200000+i*300000),temp,pressure});`);
  return a;
}
const plain=points=>Array.from(points,p=>({x:p.x,y:p.y}));
function same(a,metric='temp') {
  const expected=plain(a.run(`originalMoving(rows,${JSON.stringify(metric)})`));
  const actual=plain(a.run(`analyticsMoving(rows,${JSON.stringify(metric)})`));
  assert.deepEqual(actual,expected);assert.ok(actual.length<=600);
  return actual;
}

test('moving means use five original values and preserve short/empty ranges without sampling',()=>{
  const a=fixture();a.run('globalThis.rows=[]');assert.deepEqual(same(a),[]);
  for(const n of [1,4,5,6,600]) {
    a.run(`rows=Array.from({length:${n}},(_,i)=>row(i,i,1000+i))`);
    const points=same(a);assert.equal(points.length,n);
    assert.ok(points.slice(0,4).every(p=>p.y===null));
    if(n>=5)assert.equal(points[4].y,2);
    if(n>=6)assert.equal(points[5].y,3);
    same(a,'pressure');
  }
});

test('zeros, negative values, rounding order and unavailable sensors retain exact results',()=>{
  const a=fixture();
  for(const values of ['[0,0,0,0,0,0]','[-0,-0,-0,-0,-0,-0]','[-5,-4,-3,-2,-1,0]',
    '[1e16,1,-1e16,2,3,4,5,6,7,8]','[null,null,null,null,null,null]']) {
    a.run(`rows=${values}.map((v,i)=>row(i,v))`);same(a);
  }
});

test('missing, nonnumeric and nonfinite sensor values restart the five-measurement window',()=>{
  const a=fixture();
  for(const bad of ['null','undefined','NaN','Infinity','-Infinity','"4"']) {
    a.run(`rows=Array.from({length:12},(_,i)=>row(i,i));rows[5].temp=${bad}`);
    const points=same(a);
    assert.equal(points[4].y,2);assert.ok(points.slice(5,10).every(p=>p.y===null));
    assert.equal(points[10].y,8);
  }
});

test('gaps larger than three hours reset smoothing, while equal times and exact three hours remain valid',()=>{
  const a=fixture();
  a.run('rows=Array.from({length:12},(_,i)=>row(i,i));rows[5].ts=new Date(+rows[4].ts+10800000);for(let i=6;i<rows.length;i++)rows[i].ts=new Date(+rows[i-1].ts+300000)');
  assert.equal(same(a)[5].y,3);
  a.run('for(let i=5;i<rows.length;i++)rows[i].ts=new Date(+rows[i].ts+1)');
  const points=same(a);assert.ok(points.slice(5,9).every(p=>p.y===null));
  assert.equal(points[9].y,7);
  a.run('rows=Array.from({length:1000},(_,i)=>row(Math.floor(i/3),i%7));rows[497].temp=null');
  same(a);
});

test('sampler boundaries preserve endpoints, first ties, gaps and exact mean extrema',()=>{
  const a=fixture();
  for(const n of [601,602,796,1000,10000]) {
    a.run(`rows=Array.from({length:${n}},(_,i)=>row(i,i%50<20?10:i%50<40?-10:0));
      rows[0].temp=null;rows[41].temp=999;rows[42].temp=-999;rows[500].temp=null;`);
    const points=same(a);
    assert.equal(points[0].x,a.run('+rows[0].ts'));
    assert.equal(points.at(-1).x,a.run('+rows.at(-1).ts'));
    assert.ok(points.some(p=>p.y===null));
    same(a,'pressure');
  }
});

test('overflow from finite measurements preserves the original nonfinite derived gaps',()=>{
  const a=fixture();
  a.run('rows=Array.from({length:3000},(_,i)=>row(i,i<100?1e308:-1e308));');
  const points=same(a);assert.ok(points.some(p=>!Number.isFinite(p.y)));
});

test('random irregular multi-metric histories agree exactly with the original full-array algorithm',()=>{
  const a=fixture();
  a.run(`globalThis.seed=28373;globalThis.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
  for(let trial=0;trial<150;trial++) {
    a.run(`globalThis.ts=0;rows=Array.from({length:Math.floor(random()*4000)},()=>{
      ts+=random()<.01?2200:random()<.1?0:1;
      return row(ts,random()<.03?null:Math.round(random()*20)-10,random()<.02?NaN:1000+random()*20);
    });`);
    same(a);same(a,'pressure');
  }
});

test('250k observations are all evaluated once with bounded output and no source/cache/transport changes',()=>{
  const a=fixture();
  a.run(`rows=Array.from({length:250000},(_,i)=>Object.freeze(row(Math.floor(i/2),i===12345?777:i%29===0?null:10+Math.sin(i/30),i%17===0?null:1000+Math.sin(i/100))));
    Object.freeze(rows);globalThis.source=rows;globalThis.beforeCache=aggregateCache;
    globalThis.expected=originalMoving(rows,'temp');globalThis.reads=0;
    rows=new Proxy(rows,{get(target,key,receiver){if(typeof key==='string'&&/^\\d+$/.test(key))reads++;return Reflect.get(target,key,receiver)}});
    globalThis.actual=analyticsMoving(rows,'temp');`);
  assert.deepEqual(plain(a.run('actual')),plain(a.run('expected')));
  assert.equal(a.run('reads'),250000);assert.ok(a.run('actual.length<=600'));
  assert.equal(a.run('aggregateCache===beforeCache && Object.isFrozen(source) && source[12345].temp===777'),true);
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,0);
});
