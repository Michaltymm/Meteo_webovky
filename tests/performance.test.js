const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

function fixture(a, n = 100000) {
  a.run(`store.rows = Array.from({length:${n}}, (_,i) => ({
    ts:new Date(Date.now()-i*300000), temp: i===17 ? 85 : 10,
    hum: i===19 ? 0 : 60, pressure:1010, voltage:4, rain:0, rainInc:0, tank:null
  })); store.fullLoaded=true; expRange="all"; el("expMetric").value="temp_hum"`);
}

test('explorer preserves both metric extrema and computes statistics from all measurements', () => {
  const a = app(); fixture(a);
  a.run('buildExplorer()');
  assert.equal(a.run('expAllPts.length'), 100000);
  assert.ok(a.run('chartExplorer.data.labels.length <= 800'));
  assert.equal(a.run('chartExplorer.data.datasets[0].data.includes(85)'), true);
  assert.equal(a.run('chartExplorer.data.datasets[1].data.includes(0)'), true);
  assert.match(a.nodes.get('expStats').innerHTML, /100000&nbsp;měření/);
  assert.match(a.nodes.get('expStats').innerHTML, /85\.0/);
  assert.equal(a.run('store.rows[17].temp'), 85);
  assert.equal(a.run('store.rows[0].ts > store.rows.at(-1).ts'), true);
});

test('explorer summaries use independent finite measurements and preserve zeroes', () => {
  const a = app(); fixture(a, 4);
  a.run(`Object.assign(store.rows[0], {temp:null, hum:25});
    Object.assign(store.rows[1], {temp:-8, hum:25});
    Object.assign(store.rows[2], {temp:0, hum:0});
    Object.assign(store.rows[3], {temp:20, hum:null});
    buildExplorer()`);
  const [temperature, humidity] = a.nodes.get('expStats').innerHTML.split('💧 Vlhkost');
  assert.match(temperature, /Min:&nbsp;<span>-8\.0&nbsp;°C.*Prům:&nbsp;<span>4\.0&nbsp;°C.*Max:&nbsp;<span>20\.0&nbsp;°C.*3&nbsp;měření/s);
  assert.match(humidity, /Min:&nbsp;<span>0\.0&nbsp;%.*Prům:&nbsp;<span>16\.7&nbsp;%.*Max:&nbsp;<span>25\.0&nbsp;%.*3&nbsp;měření/s);
});

test('explorer sampling shares metric evaluations with exact full-range summaries', () => {
  const a = app();
  assert.equal(a.run(`[800, 801, 15000].every(length => {
    const rows = Array.from({length}, (_, i) => ({
      t: [1e16, 1, -1e16, null, -0, 0, Infinity, NaN, 3][i % 9],
      h: [0, -0, null, NaN][i % 4]
    }));
    const getters = [row => row.t, row => row.h, () => null];
    const expected = getters.map(get => numericSummary(rows, get));
    const points = sampleExtrema(rows, getters);
    const calls = getters.map(() => 0);
    const actual = explorerSeries(rows, getters.map((get, i) => ({
      fn: row => { calls[i]++; return get(row); }
    })));
    return actual.points.length === points.length &&
      actual.points.every((row, i) => row === points[i]) &&
      calls.every(count => count === length) &&
      actual.summaries.every((summary, i) => Object.keys(summary).every(
        key => Object.is(summary[key], expected[i][key])));
  })`), true);
});

test('slider statistics and endpoints use the complete selected interval', () => {
  const a = app(); fixture(a, 10000);
  a.run('buildExplorer(); el("expSliderL").value="20"; el("expSliderR").value="80"; expSliderUpdate()');
  assert.match(a.nodes.get('expStats').innerHTML, /6000&nbsp;měření/);
  assert.ok(a.run('chartExplorer.data.labels.length <= 800'));
  assert.equal(a.run('chartExplorer.data.labels[0] === fmtDT(expAllPts[2000].ts)'), true);
  assert.equal(a.run('chartExplorer.data.labels.at(-1) === fmtDT(expAllPts[7999].ts)'), true);
  a.run('el("expSliderL").value="100"; el("expSliderR").value="100"; expSliderUpdate()');
  assert.equal(a.run('chartExplorer.data.labels.length'), 1);
  assert.match(a.nodes.get('expStats').innerHTML, /1&nbsp;měření/);
});

test('large slider previews defer drawing, then commit the latest complete interval once', () => {
  const a = app(); fixture(a, 12000);
  a.run(`buildExplorer(); globalThis.previousDraws=chartExplorer.updates;
    el('expSliderL').value='5'; expSliderUpdate(true);
    el('expSliderL').value='15'; expSliderUpdate(true);`);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  assert.equal(a.run('el("expSliderLbl1").textContent === fmtDT(expAllPts[1800].ts)'), true);
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Uvolněte pro přepočet');
  a.run('expSliderCommit(); expSliderCommit()');
  assert.equal(a.run('chartExplorer.updates - previousDraws'), 1);
  assert.match(a.nodes.get('expStats').innerHTML, /10200&nbsp;měření/);
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Výřez grafu');

  a.run(`el('expSliderL').value='90'; expSliderUpdate(true); expSliderCommit()`);
  assert.equal(a.run('chartExplorer.updates - previousDraws'), 2);
  assert.match(a.nodes.get('expStats').innerHTML, /1201&nbsp;měření/);

  a.run(`el('expSliderL').value='0'; expSliderUpdate(true);
    invalidateDerivedData(); expSliderCommit()`);
  assert.equal(a.run('chartExplorer.updates - previousDraws'), 2);
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Výřez grafu');
});

test('long slider commits finish atomically and resume the same interval on return', () => {
  const a = app(); fixture(a, 85000);
  a.run(`buildExplorer(); globalThis.activeTab="explorer";
    document.querySelector=()=>({ dataset:{ tab:activeTab } });
    globalThis.previousDraws=chartExplorer.updates;
    globalThis.originalStats=el("expStats").innerHTML;
    el("expSliderL").value="10"; expSliderUpdate(true); expSliderCommit();`);
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Počítám výřez…');
  a.tick(0);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  assert.equal(a.nodes.get('expStats').innerHTML, a.run('originalStats'));
  a.run('activeTab="daily"');
  a.tick(0);
  assert.equal(a.run('explorerRenderJob.timer'), null);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  a.run('activeTab="explorer"; refreshTab("explorer")');
  a.visibility(true);
  a.tick(0);
  assert.equal(a.run('explorerRenderJob.timer'), null);
  a.visibility(false);
  for (let i = 0; i < 30 && a.run('explorerRenderJob !== null'); i++) a.tick(0);
  assert.equal(a.run('explorerRenderJob'), null);
  assert.equal(a.run('chartExplorer.updates - previousDraws'), 1);
  assert.match(a.nodes.get('expStats').innerHTML, /76500&nbsp;měření/);
  assert.equal(a.run('el("expSliderL").value'), '10');
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Výřez grafu');
});

test('superseded slider work cannot publish after a new selection or a data change', () => {
  const a = app(); fixture(a, 85000);
  a.run(`buildExplorer();
    document.querySelector=()=>({ dataset:{ tab:"explorer" } });
    el("expSliderL").value="2"; expSliderUpdate(true); expSliderCommit();
    globalThis.firstJob=explorerRenderJob;
    globalThis.previousDraws=chartExplorer.updates;`);
  a.tick(0);
  a.run(`el("expSliderL").value="4"; expSliderUpdate(true); expSliderCommit();
    globalThis.secondJob=explorerRenderJob; runExplorerRenderJob(firstJob);`);
  assert.equal(a.run('explorerRenderJob === secondJob'), true);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  a.run('invalidateDerivedData(); runExplorerRenderJob(secondJob)');
  a.tick(0);
  assert.equal(a.run('explorerRenderJob'), null);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  assert.equal(a.nodes.get('expSliderHint').textContent, 'Výřez grafu');

  a.run(`buildExplorer(); previousDraws=chartExplorer.updates;
    el("expSliderL").value="2"; expSliderUpdate(true); expSliderCommit();
    activeIdx=1;`);
  assert.equal(a.run('explorerRenderJob !== null'), true);
  a.tick(0);
  assert.equal(a.run('explorerRenderJob'), null);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
});

test('opening a long explorer range only shows the latest complete result', () => {
  const a = app(); fixture(a, 85000);
  a.run(`expRange="24h"; buildExplorer();
    document.querySelector=()=>({ dataset:{ tab:"explorer" } });
    globalThis.previousDraws=chartExplorer.updates;
    setExpRange("all"); globalThis.staleRange=explorerRenderJob;`);
  assert.equal(a.nodes.get('expRangeStatus').hidden, false);
  assert.equal(a.nodes.get('expRangeStatus').textContent, 'Připravuji graf a statistiky…');
  a.tick(0);
  assert.equal(a.run('chartExplorer.updates'), a.run('previousDraws'));
  a.run(`el("expMetric").value="hum"; buildExplorer(true);
    runExplorerRenderJob(staleRange);`);
  for (let i = 0; i < 30 && a.run('explorerRenderJob !== null'); i++) a.tick(0);
  assert.equal(a.run('explorerRenderJob'), null);
  assert.equal(a.nodes.get('expRangeStatus').hidden, true);
  assert.equal(a.run('chartExplorer.updates - previousDraws'), 1);
  assert.equal(a.run('chartExplorer.data.datasets[0].label'), 'Vlhkost [%]');
  assert.match(a.nodes.get('expStats').innerHTML, /85000&nbsp;měření/);
  assert.equal(a.run('el("expSliderLbl1").textContent === fmtDT(expAllPts[0].ts)'), true);
  assert.equal(a.run('el("expSliderLbl2").textContent === fmtDT(expAllPts.at(-1).ts)'), true);
});

test('min/max sampling preserves endpoints, null gaps, order and does not mutate input', () => {
  const a = app();
  a.run(`globalThis.rows=Array.from({length:10000}, (_,i)=>({i,temp:i===23?null:i===25?100:i===26?-100:0}));
    globalThis.sample=sampleExtrema(rows,[r=>r.temp])`);
  assert.equal(a.run('sample[0] === rows[0] && sample.at(-1) === rows.at(-1)'), true);
  assert.equal(a.run('[23,25,26].every(i => sample.includes(rows[i]))'), true);
  assert.equal(a.run('sample.every((r,i) => !i || sample[i-1].i < r.i)'), true);
  assert.ok(a.run('sample.length <= 800'));
  assert.equal(a.run('rows.length'), 10000);
});

test('binary range cache handles duplicate inclusive endpoints, empty range and source invalidation', () => {
  const a = app();
  a.run('store.rows=[5,4,4,3,2,1].map(t=>({ts:new Date(t),temp:t})); globalThis.first=explorerRows(2,4)');
  assert.equal(a.run('JSON.stringify(first.map(r=>+r.ts))'), '[2,3,4,4]');
  assert.equal(a.run('explorerRows(2,4) === first'), true);
  assert.equal(a.run('explorerRows(6,7).length'), 0);
  a.run('store.rows=[{ts:new Date(3),temp:99}]');
  assert.equal(a.run('explorerRows(2,4)[0].temp'), 99);
  a.run('store.rows.unshift({ts:new Date(4),temp:100}); invalidateDerivedData()');
  assert.equal(a.run('explorerRows(2,4).length'), 2);
  a.run('resetStationStore()');
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('expAllPts.length'), 0);
});

test('range lookup agrees with a full scan across many bounds', () => {
  const a = app();
  a.run('store.rows=Array.from({length:1001},(_,i)=>({ts:new Date(Math.floor((1000-i)/3))}))');
  assert.equal(a.run(`Array.from({length:100},(_,i)=>i).every(i=>{
    const lo=i*4-10,hi=lo+i%13;
    return JSON.stringify(explorerRows(lo,hi).map(r=>+r.ts)) ===
      JSON.stringify(store.rows.filter(r=>+r.ts>=lo && +r.ts<=hi).reverse().map(r=>+r.ts));
  })`), true);
});

test('visible tab updates only its charts; untouched tabs retain dirty state', () => {
  const a = app(); fixture(a, 1000);
  a.run('tabDirtyState.now=true; tabDirtyState.monthly=true; refreshTab("now")');
  assert.equal(a.run('chart24.updates'), 1);
  assert.equal(a.run('chartRain'), null);
  assert.equal(a.run('chartVoltage'), null);
  assert.equal(a.run('chartMonthly'), null);
  assert.equal(a.run('chartYearly'), null);
  assert.equal(a.run('chartExplorer'), null);
  assert.equal(a.run('chartCompare'), null);
  assert.equal(a.run('chartOverview'), null);
  assert.equal(a.run('tabDirtyState.monthly'), true);
  a.run('refreshTab("monthly"); refreshTab("monthly")');
  assert.equal(a.run('chartMonthly.updates'), 0);
  assert.equal(a.run('chartYearly'), null);
  a.run('tabDirtyState.rain=true; refreshTab("rain")');
  assert.equal(a.run('chartRain.updates'), 0);
  assert.equal(a.run('chartVoltage.updates'), 0);
  assert.equal(a.run('chartRain.data.labels.length > 0 && chartRain.data.datasets[0].data.every(v=>v===0)'), true);
  assert.equal(a.run('chartVoltage.data.labels.length === chartVoltage.data.datasets[0].data.length && chartVoltage.data.datasets[0].data[499]===4'), true);
  a.run(`globalThis.rainChart=chartRain;globalThis.voltageChart=chartVoltage;globalThis.monthlyChart=chartMonthly;
    store.rows=[{ts:new Date(),rain:0,voltage:0}];invalidateDerivedData();
    tabDirtyState.rain=true;refreshTab("rain");refreshTab("rain");
    tabDirtyState.monthly=true;refreshTab("monthly");refreshTab("monthly")`);
  assert.equal(a.run('chartRain===rainChart&&chartVoltage===voltageChart'), true);
  assert.equal(a.run('chartMonthly===monthlyChart&&chartMonthly.updates===1&&chartYearly===null'), true);
  assert.equal(a.run('chartRain.updates'), 1);
  assert.equal(a.run('chartVoltage.updates'), 1);
  assert.equal(a.run('JSON.stringify(chartRain.data.datasets[0].data)'), '[0]');
  assert.equal(a.run('JSON.stringify(chartVoltage.data.datasets[0].data)'), '[0]');
  assert.equal(a.run('JSON.stringify(chartVoltage.data.datasets[1].data)'), '[null]');
});

test('explorer keeps its instance across an empty slice, daily rain and two line series', () => {
  const a = app();
  assert.equal(a.run('chartExplorer'), null);
  a.run(`_drawExplorerPts([]);const firstExplorer=chartExplorer;
    const now=new Date(2026,10,24,12).getTime();Date.now=()=>now;
    store.rows=[{ts:new Date(now),rain:5,temp:20,hum:40},{ts:new Date(now-1000),rain:3,temp:0,hum:null}];
    el("expMetric").value="rain";buildExplorer()`);
  assert.equal(a.run('chartExplorer===firstExplorer && chartExplorer.config.type==="bar"'), true);
  assert.equal(a.run('JSON.stringify(chartExplorer.data.datasets[0].data)'), '[5]');
  a.run('el("expMetric").value="temp_hum";buildExplorer()');
  assert.equal(a.run('chartExplorer===firstExplorer && chartExplorer.config.type==="line"'), true);
  assert.equal(a.run('JSON.stringify(chartExplorer.data.datasets.map(ds=>ds.data))'), '[[0,20],[null,40]]');
});

test('rain explorer redraws only when day values change and retries a failed draw', () => {
  const a = app();
  a.run(`const now=new Date(2026,10,24,12).getTime();Date.now=()=>now;
    store.rows=[{ts:new Date(now),rain:5,temp:20}];
    el("expMetric").value="rain";buildExplorer();const initial=chartExplorer.data.datasets[0];
    store.rows.push({ts:new Date(now-60000),rain:3,temp:18});invalidateDerivedData();buildExplorer();`);
  assert.equal(a.run('chartExplorer.updates===1 && chartExplorer.data.datasets[0]===initial'), true);
  assert.equal(a.nodes.get('expInfo').textContent, '2 záznamů v rozsahu');
  a.run(`store.rows[1].rain=9;invalidateDerivedData();
    const update=chartExplorer.update;chartExplorer.update=()=>{throw Error("failed")};`);
  assert.throws(()=>a.run('buildExplorer()'), /failed/);
  a.run('chartExplorer.update=update;buildExplorer();buildExplorer()');
  assert.equal(a.run('chartExplorer.updates'), 2);
  assert.equal(a.run('chartExplorer.data.datasets[0].data[0]'), 9);
  a.run('el("expMetric").value="temp";buildExplorer();el("expMetric").value="rain";buildExplorer()');
  assert.equal(a.run('chartExplorer.updates===4 && chartExplorer.config.type==="bar"'), true);
  a.run('const sameRows=store.rows;resetStationStore();store.rows=sameRows;buildExplorer()');
  assert.equal(a.run('chartExplorer.updates'), 5);
});

test('explorer rain daily maxima match the original grouping across missing data, ties and repeated dates', () => {
  const a = app();
  a.run(`const rows=Object.freeze([
    [2025,9,26,1,0],[2025,9,26,2,null],[2025,9,26,3,0],
    [2026,9,25,1,3],[2026,9,25,2,12],[2026,9,25,2,12],
    [2026,9,26,12,null],[2025,9,26,4,2],[2026,9,25,4,9],
    [2026,8,25,12,-0],[2026,8,25,13,0]
  ].map(([y,m,d,h,rain])=>Object.freeze({ts:new Date(y,m,d,h),rain})).concat([
    Object.freeze({ts:new Date('2026-10-25T02:30:00+02:00'),rain:4}),
    Object.freeze({ts:new Date('2026-10-25T02:30:00+01:00'),rain:8})
  ]));
  const reference={};
  for(const r of rows){
    if(r.rain===null)continue;
    const key=fmtDateShort(r.ts);
    if(!reference[key]||r.rain>reference[key].val)reference[key]={val:r.rain,ts:r.ts};
  }
  const expected=Object.keys(reference).sort((a,b)=>reference[a].ts-reference[b].ts);
  const actual=explorerRainDays(rows);`);
  assert.equal(a.run('JSON.stringify(actual.labels)'), a.run('JSON.stringify(expected)'));
  assert.equal(a.run('expected.every((key,i)=>Object.is(actual.values[i],reference[key].val))'), true);
});

test('explorer rain formats the local date once per consecutive measured day', () => {
  const a = app();
  a.run(`let count=0;const originalFormat=fmtDateShort;
    fmtDateShort=date=>{count++;return originalFormat(date)};
    const rows=Array.from({length:100000},(_,i)=>({ts:new Date(2026,9,25,0,i),rain:i%10}));
    const model=explorerRainDays(rows);`);
  assert.equal(a.run('count===model.labels.length && count < 75'), true);
  assert.equal(a.run('model.values.every(v=>v===9)'), true);
});

test('a full-history callback leaves the explorer dirty until its tab returns', () => {
  const a = app();
  a.run(`globalThis.finishLoad=null;ensureFullData=callback=>finishLoad=callback;
    store.rows=[{ts:new Date(),temp:20,hum:40}];el("expMetric").value="temp";
    setExpRange("7d");finishLoad()`);
  assert.equal(a.run('chartExplorer===null && tabDirtyState.explorer'), true);
  a.run('refreshTab("explorer")');
  assert.equal(a.run('chartExplorer.data.datasets[0].data[0]'), 20);
});

test('crosshair requests a chart render only when its position changes', () => {
  const a = app();
  a.run(`const graph={chartArea:{left:20,right:300},draw(){throw Error("direct draw")}};
    const moveCrosshair=(type,x,changed=false)=>{
      const args={event:{type,x},changed};crosshairPlugin.afterEvent(graph,args);
      return JSON.stringify([graph._crossX??null,args.changed]);
    };`);
  assert.equal(a.run('moveCrosshair("mousemove",10)'), '[null,false]');
  assert.equal(a.run('moveCrosshair("mousemove",20)'), '[20,true]');
  assert.equal(a.run('moveCrosshair("mousemove",20)'), '[20,false]');
  assert.equal(a.run('moveCrosshair("mousedown",40,true)'), '[20,true]');
  assert.equal(a.run('moveCrosshair("mousemove",300)'), '[300,true]');
  assert.equal(a.run('moveCrosshair("mousemove",301)'), '[null,true]');
  assert.equal(a.run('moveCrosshair("mouseout",0)'), '[null,false]');
  assert.equal(a.run('moveCrosshair("mousemove",120)'), '[120,true]');
  assert.equal(a.run('moveCrosshair("mouseleave",0)'), '[null,true]');
});

test('chart library completion renders the current data and tab after a station change', () => {
  const a = app();
  a.run(`const RealChart=Chart;Chart=undefined;
    let activeTab="now";document.querySelector=()=>({dataset:{tab:activeTab}});
    store.rows=[{ts:new Date(),temp:18,rain:1}];tabDirtyState.now=true;refreshTab("now");
    updateChartLibraryStatus();`);
  assert.equal(a.run('chart24===null && tabDirtyState.now'), true);
  assert.match(a.nodes.get('chartLibraryStatus').textContent, /Načítám/);
  a.run(`activeTab="rain";store.rows=[{ts:new Date(),temp:24,rain:7}];tabDirtyState.rain=true;refreshTab("rain");
    Chart=RealChart;finishChartLibraryLoad();`);
  assert.equal(a.run('chart24===null && chartRain.data.datasets[0].data[0]===7'), true);
  assert.equal(a.nodes.get('chartLibraryStatus').hidden, true);
});

test('chart library failure leaves the overview table and simple view usable', () => {
  const a = app();
  a.run(`Chart=undefined;document.querySelector=()=>({dataset:{tab:"overview"}});
    store.rows=[{ts:new Date(),temp:24}];el("ovMetric").value="temp";
    finishChartLibraryLoad();buildTempOverview();`);
  assert.equal(a.run('chartOverview'), null);
  assert.match(a.nodes.get('ovTableBody').innerHTML, /24\.0/);
  assert.match(a.nodes.get('chartLibraryStatus').textContent, /nepodařilo/);
  a.run('updateChartLibraryStatus("daily")');
  assert.equal(a.nodes.get('chartLibraryStatus').hidden, true);
  a.run('currentPage="modern2";updateChartLibraryStatus("overview")');
  assert.equal(a.nodes.get('chartLibraryStatus').hidden, true);
});

test('large histories and statistics do not exceed the function argument limit', () => {
  const a = app({ realRefresh: true }); fixture(a, 250000);
  a.run('refreshUI(); buildExplorer()');
  assert.match(a.nodes.get('statTempMax').textContent, /85/);
  assert.match(a.nodes.get('expStats').innerHTML, /250000&nbsp;měření/);
  assert.equal(a.run('JSON.stringify(numericSummary([null,NaN,Infinity,0,-2,5]))'),
    '{"min":-2,"max":5,"avg":1,"count":3}');
});

test('voltage regression uses all recent samples, independently of display sampling', () => {
  const a = app();
  a.run(`globalThis.rows=Array.from({length:2000},(_,i)=>({
    ts:new Date(Date.now()-(1999-i)*60000), voltage: i===1998 ? 3 : 4-i/10000
  }));
  globalThis.full=voltageSeries(rows);
  globalThis.reduced=voltageSeries(sampleExtrema(rows,[r=>r.voltage]),Infinity,rows);`);
  // Forecast starts after the common last observed sample, with the same slope.
  assert.equal(a.run('full.predicted[2000]'), a.run('reduced.predicted[reduced.actual.findIndex(v=>v===null)]'));
});

test('two-pass voltage regression preserves the old floating-point result in input order', () => {
  const a = app();
  assert.equal(a.run(`(() => {
    const cutoff = Date.parse("2026-11-24T10:00:00Z");
    const row = (time, voltage) => ({ ts: new Date(time), voltage });
    const reference = (rows, from) => {
      const recent = rows.filter(r => Number.isFinite(r.voltage) && Number.isFinite(+r.ts) && +r.ts >= from);
      if (recent.length < 2) return null;
      const tMean = recent.reduce((sum, r) => sum + r.ts.getTime(), 0) / recent.length;
      const vMean = recent.reduce((sum, r) => sum + r.voltage, 0) / recent.length;
      const divisor = recent.reduce((sum, r) => sum + (r.ts.getTime() - tMean) ** 2, 0);
      return divisor > 0
        ? recent.reduce((sum, r) => sum + (r.ts.getTime() - tMean) * (r.voltage - vMean), 0) / divisor
        : null;
    };
    const readings = [0, -0, 3.7, null, NaN, 3.87, Infinity, 1e16, -1e16, 1];
    const dense = Array.from({ length: 9001 }, (_, i) =>
      row(i % 19 === 0 ? NaN : cutoff + ((i * 761) % 81 - 17) * 1000, readings[i % readings.length]));
    const ties = [row(cutoff, 3), row(cutoff, 0), row(cutoff - 1, 1)];
    return [[], dense, ties, [row(cutoff, 0)]].every(rows =>
      [NaN, -Infinity, cutoff, cutoff + 1, Infinity].every(from =>
        Object.is(voltageSlope(rows, from), reference(rows, from))));
  })()`), true);
});

test('explorer voltage keeps cutoff ties and the complete interval for unsorted sources', () => {
  const a = app();
  assert.equal(a.run(`(() => {
    const cutoff = Date.parse("2026-11-24T10:00:00Z");
    const readings = [-60000, -1, 0, 0, 0, 60000, 90000, 120000].map((offset, i) => ({
      ts: new Date(cutoff + offset), voltage: [100, 400, 0, null, 3.2, 4, 3.9, 3.8][i]
    }));
    const points = [readings[0], readings.at(-1)];
    const same = (rows, from) => JSON.stringify(explorerVoltageSeries(points, rows, from)) ===
      JSON.stringify(voltageSeries(points, Infinity, rows, from));
    CFG.source = "sheets";
    if (![cutoff, cutoff + 1, cutoff + 120001].every(from => same(readings, from))) return false;
    const unsorted = [readings[7], readings[2], { ts: new Date(NaN), voltage: 80 },
      readings[4], readings[0], readings[5], readings[1], readings[6], readings[3]];
    return ["mqtt", "both"].every(source => {
      CFG.source = source;
      return same(unsorted, cutoff);
    });
  })()`), true);
});

test('rain tab fits all valid recent voltages and keeps the 500 measured display samples', () => {
  const a = app();
  a.run(`const end=Date.parse('2026-11-24T10:00:00Z');Date.now=()=>end;
    store.rows=Array.from({length:2000},(_,i)=>({ts:new Date(end-i*60000),rain:0,voltage:i<500?4:3.5}));
    buildCharts('rain');`);
  assert.equal(a.run('chartVoltage.data.datasets[0].data.filter(v=>v!==null).length'), 500);
  assert.equal(a.run('chartVoltage.data.datasets[1].data[500]'), 4.003);
  assert.equal(a.run('store.rows.length'), 2000);
});

test('bounded Sheets voltage series preserves boundary ties and full regression data', () => {
  const a = app();
  a.run(`const end=Date.parse('2026-11-24T10:00:00Z');Date.now=()=>end;
    const cutoff=end-3*86400000;
    const rows=Object.freeze(Array.from({length:10000},(_,i)=>Object.freeze({
      ts:new Date(end-Math.floor(i/11)*60000),voltage:i%13===0?null:3+i/10000
    })).concat([{ts:new Date(cutoff),voltage:0},{ts:new Date(cutoff),voltage:6},{ts:new Date(cutoff-1),voltage:900}]));
    const expected=voltageSeries(rows,500,rows,cutoff);
    const optimized=rainVoltageSeries(rows);
    const withoutBoundary=voltageSeries(rows,500,rows,cutoff+1);`);
  assert.equal(a.run('JSON.stringify(optimized) === JSON.stringify(expected)'), true);
  assert.notEqual(a.run('JSON.stringify(optimized.predicted)'), a.run('JSON.stringify(withoutBoundary.predicted)'));
});

test('rain voltage uses full inputs for out-of-order MQTT and hybrid measurements', () => {
  const a = app();
  a.run(`const end=Date.parse('2026-11-24T10:00:00Z');Date.now=()=>end;
    const rows=Array.from({length:1500},(_,i)=>({
      ts:new Date(end-((i*31)%1500)*60000),voltage:i%7===0?null:3+i/10000
    }));
    const expected=JSON.stringify(voltageSeries(rows,500,rows));`);
  for (const source of ['mqtt', 'both']) {
    a.run(`CFG.source=${JSON.stringify(source)}`);
    assert.equal(a.run('JSON.stringify(rainVoltageSeries(rows))'), a.run('expected'));
  }
});

test('unchanged quick response skips parsing, while corrected data still commits', async () => {
  const a = app();
  const csv = value => 'Datum,Cas,Teplota,Tlak,Vlhkost\n20.10.2026,12:00,' + value + ',1010,60';
  async function load(value) {
    const done = a.run('fetchSheets()');
    a.respond(a.requests.length - 1, csv(value));
    await new Promise(resolve => setImmediate(resolve));
    a.tick();
    await done;
  }
  await load(10); await load(10);
  assert.equal(a.state.renders, 1);
  await load(11);
  assert.equal(a.state.renders, 2);
  assert.equal(a.run('store.rows[0].temp'), 11);
  a.run('resetStationStore()');
  assert.equal(a.run('store._lastQuickCsv'), null);
});

test('CSV commits and live MQTT messages invalidate cached views and CSV fingerprints', async () => {
  const a = app(); fixture(a, 1000);
  a.run('buildExplorer()');
  const parsed = a.run('parseAndStore("20.10.2026,12:00,27,1010,60,0,0,0,4.2")');
  a.tick(); await parsed;
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('expAllPts.length'), 0);
  a.run(`buildExplorer(); store._lastQuickCsv="old"; store._lastFullCsv="old";
    CFG.source="both"; CFG.mqttHost="test.invalid"; connectMQTT()`);
  a.clients[0].onMessageArrived({ payloadString: '{"temp":12,"hum":60,"voltage":4}' });
  assert.equal(a.run('store.rows[0].temp'), 12);
  assert.equal(a.run('explorerRangeCache'), null);
  assert.equal(a.run('store._lastQuickCsv'), null);
  assert.equal(a.run('store._lastFullCsv'), null);
});
