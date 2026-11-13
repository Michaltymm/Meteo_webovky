const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');

// Independent index/bucket oracle, including first ties and one missing marker.
const oracle=`globalThis.verifyCurrentSampling=(source,limit=800)=>{
 const before=JSON.stringify(source),get=[r=>r.temp,r=>r.hum,r=>dewPoint(r.temp,r.hum)];
 const indices=new Set([0,source.length-1]),buckets=Math.floor((limit-2)/9);
 for(let b=0;b<buckets;b++)for(const fn of get){
   let lo=null,hi=null,missing=null;
   for(let i=Math.floor(b*source.length/buckets);i<Math.floor((b+1)*source.length/buckets);i++){
     const y=fn(source[i]);if(!Number.isFinite(y)){if(missing===null)missing=i;continue}
     if(lo===null||y<fn(source[lo]))lo=i;
     if(hi===null||y>fn(source[hi]))hi=i;
   }
   for(const i of [lo,hi,missing])if(i!==null)indices.add(i);
 }
 const expected=[...indices].sort((a,b)=>a-b),result=currentChartData(source,limit);
 if(result.labels.length>limit||JSON.stringify(result.series[0].map(p=>p.sourceIndex))!==JSON.stringify(expected))return false;
 for(let j=0;j<3;j++){
   let previous=-1;
   for(const p of result.series[j]){
     const row=source[p.sourceIndex],value=get[j](row);
     if(p.x!==+row.ts||p.y!==(Number.isFinite(value)?value:null))return false;
     let broken=false;
     for(let i=Math.max(0,previous);i<=p.sourceIndex;i++){
       if(!Number.isFinite(get[j](source[i])))broken=true;
       if(i>previous&&i>0&&+source[i].ts-(+source[i-1].ts)>10800000)broken=true;
     }
     // The first point has no connection to an earlier point.
     if(previous>=0&&p.breakBefore!==broken)return false;
     previous=p.sourceIndex;
   }
   const values=source.map(get[j]).filter(Number.isFinite),shown=result.series[j].map(p=>p.y).filter(Number.isFinite);
   if(Math.min(...values)!==Math.min(...shown)||Math.max(...values)!==Math.max(...shown))return false;
 }
 return JSON.stringify(source)===before;
}`;

test('bounded selection preserves independent bucket extrema, original pairs, zeros, all three extrema and missing spans',()=>{
 const a=app();a.run(oracle);
 assert.equal(a.run(`(()=>{
 const source=Object.freeze(Array.from({length:12000},(_,i)=>Object.freeze({ts:new Date(1700000000000+i*1000),
 temp:i%107?i%71-25:null,hum:i%97?i%101:null})));
 return verifyCurrentSampling(source);
 })()`),true);
});

test('100 irregular histories including equal timestamps, multi-hour gaps and constant/null metrics match independent oracle',()=>{
 const a=app();a.run(oracle);
 assert.equal(a.run(`(()=>{let state=573;
 const random=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
 for(let trial=0;trial<100;trial++){
   let time=0;const source=Array.from({length:801+random()%3000},(_,i)=>{
     time+=i%503===0?10800001:random()%2000;
     return {ts:new Date(time),temp:trial%7===0?null:trial%5===0?0:random()%60-20,
       hum:i%11===0?null:random()%101};
   });
   if(!verifyCurrentSampling(source))return false;
 }return true})()`),true);
});

test('index-only sampler is compatible with the existing API including repeated object references',()=>{
 const a=app();
 assert.equal(a.run(`(()=>{const row=Object.freeze({ts:new Date(0),temp:0,hum:50});
 const rows=Object.freeze(Array(4000).fill(row)),get=[r=>r.temp,r=>r.hum,r=>dewPoint(r.temp,r.hum)];
 const indices=sampleExtrema(rows,get,800,true),ordinary=sampleExtrema(rows,get,800),data=currentChartData(rows,800);
 return indices[0]===0&&indices.at(-1)===3999&&indices.length<=800&&
   ordinary.every((r,i)=>r===rows[indices[i]])&&JSON.stringify(indices)===JSON.stringify(data.series[0].map(p=>p.sourceIndex));})()`),true);
 assert.equal(a.run('sampleExtrema([{temp:0}],[r=>r.temp],800,true)[0]'),0);
});

test('small charts keep original full representation; old direct API stays full and large application chart stays bounded',()=>{
 const a=app();
 a.run(`globalThis.rows=Array.from({length:4000},(_,i)=>({ts:new Date(i*1000),temp:i%60-20,hum:50}));
 globalThis.full=currentChartData(rows);store.rows=rows.slice().reverse();buildCharts('now')`);
 assert.equal(a.run('full.labels.length'),4000);
 assert.ok(a.run('chart24.data.labels.length')<=800);
 assert.match(a.nodes.get('currentChartSampling').textContent,/z 4000 původních/);
 a.run('store.rows=rows.slice(0,10).reverse();buildCharts("now")');
 assert.equal(a.run('chart24.data.labels.length'),10);
 assert.equal(a.run('chart24.data.datasets.every(ds=>ds.segment===undefined)'),true);
 assert.match(a.nodes.get('currentChartSampling').textContent,/všech 10/);
});

test('missing observations omitted by sampling still break only affected metric using public segment styling',()=>{
 const a=app();a.run(`globalThis.rows=Array.from({length:12000},(_,i)=>({ts:new Date(i*1000),temp:i%17,hum:50}));
 rows[2].temp=null;rows[120].temp=null;rows[100].temp=50;store.rows=rows.slice().reverse();buildCharts('now');
 globalThis.data=chart24.data.datasets[0].data;
 globalThis.index=data.findIndex((p,i)=>i>0&&p.sourceIndex>120&&data[i-1].sourceIndex<120)`);
 assert.ok(a.run('index')>0);
 assert.equal(a.run('data.some(p=>p.sourceIndex===120)'),false);
 assert.ok(a.run('data[index-1].y')!==null);
 assert.equal(a.run('data[index].breakBefore'),true);
 assert.equal(a.run('chart24.data.datasets[1].data[index].breakBefore'),false);
 assert.equal(a.run('chart24.data.datasets[0].segment.borderColor({p1DataIndex:index})'),'transparent');
 assert.equal(a.run('chart24.data.datasets[1].segment.borderColor({p1DataIndex:index})'),'#2980b9');
});

test('sampling cannot shrink full-history counts or statistics and reads input in four bounded linear passes',()=>{
 const a=app({realRefresh:true});
 a.run(`store.rows=Array.from({length:10000},(_,i)=>({ts:new Date(1700000000000-i*1000),temp:i===9000?85:0,hum:50,rain:0}));
 refreshUI();globalThis.snapshot=dataAggregates();buildCharts('now')`);
 assert.equal(a.run('dataAggregates()===snapshot'),true);
 assert.equal(a.run('snapshot.temperature.count'),10000);assert.equal(a.run('snapshot.temperature.max'),85);
 assert.equal(a.run('chart24.data.datasets[0].data.some(p=>p.y===85)'),true);
 a.run(`globalThis.visits=0;globalThis.source=new Proxy(Array.from({length:250000},(_,i)=>({ts:new Date(i),temp:0,hum:50})),{
 get(target,key,receiver){if(/^\\d+$/.test(String(key)))visits++;return Reflect.get(target,key,receiver)}});
 globalThis.result=currentChartData(source,800)`);
 assert.equal(a.run('visits'),1000000);
 assert.ok(a.run('result.series.every(s=>s.length<=800)'));
});

test('isolated markers in reduced series respect nulls, missing spans and visibility without per-source-point styling',()=>{
 const a=app();
 a.run(`globalThis.arcs=[];const points=[{x:10,y:20},{x:20,y:30},{x:30,y:40},{x:40,y:0,skip:true}];
 const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},arc(...v){arcs.push(v)},fill(){}};
 drawCurrentChartIsolated({ctx,chartArea:{left:0,top:0,width:100,height:100},
 data:{datasets:[{pointRadius:0,borderColor:'red',segment:{},data:[{},{breakBefore:true},{breakBefore:true},{}]}]},
 isDatasetVisible:()=>true,getDatasetMeta:()=>({data:points})});`);
 assert.equal(a.run('arcs.length'),3);
});
