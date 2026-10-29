const assert=require('node:assert/strict');
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {app}=require('./helpers/app');

const rows=`store.rows=[{ts:new Date(1700000000000),temp:0,hum:0},
  {ts:new Date(1700000000000-60000),temp:null,hum:50},
  {ts:new Date(1700000000000-660000),temp:10,hum:null}];buildCharts('now')`;

test('current chart uses original epoch pairs and its own linear scale/options without changing other charts',()=>{
  const a=app();a.run(rows);
  assert.equal(a.run('chart24.options.scales.x.type'),'linear');
  assert.equal(a.run('chart24.options.parsing'),false);
  assert.equal(a.run('chart24.options.normalized'),false);
  assert.equal(a.run('chart24.options.interaction.axis'),'x');
  assert.equal(a.run('JSON.stringify(chart24.data.datasets[0].data)'),
    '[{"x":1699999340000,"y":10},{"x":1699999940000,"y":null},{"x":1700000000000,"y":0}]');
  assert.equal(a.run('chart24.options.scales.x.max-chart24.options.scales.x.min'),660000);
  assert.equal(a.run('chart24.data.datasets.every(ds=>ds.spanGaps===false&&ds.tension===0)'),true);
  assert.equal(a.run('baseScales.x.type'),undefined);
  assert.equal(a.run('baseOpts.plugins.tooltip.callbacks'),undefined);
  assert.equal(a.run('chartMonthly.options.scales.x.type'),undefined);
  assert.equal(a.run('chartYearly.options.plugins.tooltip.callbacks'),undefined);
});

test('render-only gaps appear strictly above 3h; missing and zero samples remain aligned and original rows unchanged',()=>{
  const a=app();
  a.run(`globalThis.source=Object.freeze([0,10800000,10800001,21600002].map((ms,i)=>
    Object.freeze({ts:new Date(ms),temp:i===1?null:i,hum:i===2?null:50})));
    globalThis.result=currentChartData(source)`);
  assert.equal(a.run('result.labels.length'),4);
  assert.equal(a.run('result.series.every(data=>data.length===5)'),true);
  assert.equal(a.run('JSON.stringify(result.series[0])'),
    '[{"x":0,"y":0},{"x":10800000,"y":null},{"x":10800001,"y":2},{"x":10800002,"y":null,"gap":true},{"x":21600002,"y":3}]');
  assert.equal(a.run('result.series.every(data=>data.filter(p=>p.gap).every(p=>p.y===null))'),true);
  assert.equal(a.run('result.series.every(data=>JSON.stringify(data.map(p=>p.x))===JSON.stringify(result.series[0].map(p=>p.x)))'),true);
  assert.equal(a.run('source.length'),4);
  assert.equal(a.run('source[0].temp'),0);
});

test('single/duplicate times have a bounded finite axis and visible markers; empty resets prior bounds',()=>{
  const a=app();
  for(const n of [1,3]){
    a.run(`store.rows=Array.from({length:${n}},(_,i)=>({ts:new Date(0),temp:i,hum:0}));buildCharts('now')`);
    assert.equal(a.run('chart24.options.scales.x.min'),-60000);
    assert.equal(a.run('chart24.options.scales.x.max'),60000);
    assert.equal(a.run('chart24.data.datasets[0].data.length'),n);
    assert.equal(a.run('chart24.data.datasets[0].pointRadius'),2);
  }
  a.run('store.rows=[];buildCharts("now")');
  assert.equal(a.run('chart24.options.scales.x.min'),undefined);
  assert.equal(a.run('chart24.options.scales.x.max'),undefined);
  assert.equal(a.run('chart24.data.labels.length'),0);
  assert.equal(a.run('chart24.data.datasets.every(ds=>ds.data.length===0)'),true);
});

test('tooltip uses seconds and UTC offset from selected raw sample, not category/tick text or current clock',()=>{
  const a=app();a.run(rows);
  assert.equal(a.run(`chart24.options.plugins.tooltip.callbacks.title([{raw:{x:1700000000123},label:'incorrect'}])`),
    a.run('intervalTimestamp(new Date(1700000000123))'));
  assert.equal(a.run('chart24.options.plugins.tooltip.callbacks.title([])'),'');
  assert.equal(a.run(`chart24.options.plugins.tooltip.callbacks.label({dataset:{label:'Teplota [°C]'},raw:{y:0}})`),'Teplota [°C]: 0');
  assert.equal(a.run(`chart24.options.plugins.tooltip.callbacks.label({dataset:{label:'Rosný bod [°C]'},raw:{y:null}})`),'Rosný bod [°C]: –');
});

test('fall-back repeated local times retain different epoch positions and UTC offsets in tooltip',()=>{
  const code=`const{app}=require('./tests/helpers/app');const a=app();
    const result=a.run(\`store.rows=[{ts:new Date('2026-10-25T01:30:15Z'),temp:2,hum:50},
      {ts:new Date('2026-10-25T00:30:15Z'),temp:1,hum:50}];buildCharts('now');
      ({labels:chart24.data.labels,titles:chart24.data.datasets[0].data.map(raw=>chart24.options.plugins.tooltip.callbacks.title([{raw}]))})\`);
    if(result.labels[1]-result.labels[0]!==3600000)throw Error('incorrect epoch distance');
    if(!result.titles[0].includes('02:30:15 UTC+02:00')||!result.titles[1].includes('02:30:15 UTC+01:00'))throw Error('ambiguous time detail')`;
  execFileSync(process.execPath,['-e',code],{cwd:process.cwd(),env:{...process.env,TZ:'Europe/Prague'},stdio:'pipe'});
});

test('nonfinite sensor data stay null and cannot create fictitious dew point',()=>{
  const a=app();a.run(`globalThis.result=currentChartData([
    {ts:new Date(0),temp:NaN,hum:50},{ts:new Date(1),temp:Infinity,hum:null},
    {ts:new Date(2),temp:0,hum:0},{ts:new Date(3),temp:-0,hum:100}])`);
  assert.equal(a.run('JSON.stringify(result.series[0].map(p=>p.y))'),'[null,null,0,0]');
  assert.equal(a.run('JSON.stringify(result.series[2].map(p=>p.y))'),'[null,null,null,0]');
});

test('isolated original samples get markers using cached segments; hidden, skipped and continuous samples do not',()=>{
  const a=app();
  a.run(`globalThis.arcs=[];globalThis.clips=0;globalThis.fills=0;
    const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){clips++},arc(...args){arcs.push(args)},fill(){fills++}};
    drawCurrentChartIsolated({ctx,chartArea:{left:0,top:0,width:100,height:80},
      data:{datasets:[{pointRadius:0,borderColor:'red'},{pointRadius:0,borderColor:'blue'},{pointRadius:2,borderColor:'green'}]},
      isDatasetVisible:i=>i!==1,
      getDatasetMeta:()=>({dataset:{segments:[{start:0,end:0},{start:1,end:2},{start:3,end:3}]},
        data:[{x:10,y:20},{x:20,y:20},{x:30,y:20},{x:40,y:20,skip:true}]})});`);
  assert.equal(a.run('arcs.length'),1);
  assert.equal(a.run('JSON.stringify(arcs[0].slice(0,3))'),'[10,20,2]');
  assert.equal(a.run('fills'),1);assert.equal(a.run('clips'),1);
  assert.equal(a.run('chart24.plugins.some(p=>p.id==="currentIsolated")'),true);
  assert.equal(a.run('chartMonthly.plugins.some(p=>p.id==="currentIsolated")'),false);
});
