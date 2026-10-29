const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');

function ready(){
  const a=app({realRefresh:true});
  a.run(`globalThis.selectedTab={dataset:{tab:'now'}};
    document.querySelector=s=>s==='.tab-btn.active'?selectedTab:null;
    document.querySelectorAll=s=>s==='.tab-btn'?[selectedTab]:[];
    globalThis.rect={top:1200,bottom:1400,left:0,right:390};globalThis.attached=true;
    window.innerHeight=844;window.innerWidth=390;
    el('chart24h').getClientRects=()=>attached?[rect]:[];
    el('chart24h').getBoundingClientRect=()=>rect;
    globalThis.observers=[];
    globalThis.IntersectionObserver=class{
      constructor(callback){this.callback=callback;this.targets=[];observers.push(this)}
      observe(target){this.targets.push(target)}disconnect(){this.disconnected=true}
    };
    globalThis.notify=()=>observers[0].callback([{target:el('chart24h'),isIntersecting:true}]);
    globalThis.makeRows=temp=>[{ts:new Date(1700000000000),temp,hum:0,rain:0,voltage:0}];
    store.rows=makeRows(0);store.fullLoaded=true;initCurrentChartVisibility();invalidateDerivedData();`);
  return a;
}

test('offscreen refreshes coalesce without a graph build, new timers, observers or requests',()=>{
  const a=ready();const timers=a.timers.size;
  a.run(`for(let i=0;i<100;i++){store.rows=makeRows(i);invalidateDerivedData();refreshTab('now');notify();initCurrentChartVisibility()}`);
  assert.equal(a.run('chart24.updates'),0);
  assert.equal(a.run('tabDirtyState.now'),true);
  assert.equal(a.nodes.get('chart24h').style.visibility,'hidden');
  assert.equal(a.run('observers.length'),1);
  assert.equal(a.run('observers[0].targets.length'),1);
  assert.equal(a.requests.length,0);assert.equal(a.timers.size,timers);
  a.run('rect={top:400,bottom:600,left:0,right:390};notify();notify()');
  assert.equal(a.run('JSON.stringify(chart24.data.datasets[0].data.filter(p=>!p.gap).map(p=>p.y))'),'[99]');
  assert.equal(a.run('chart24.updates'),1);
  assert.equal(a.run('tabDirtyState.now'),false);
  assert.equal(a.nodes.get('chart24h').style.visibility,'');
});

test('notifications recheck page, subtab, geometry and attached canvas before rendering',()=>{
  const a=ready();
  a.run(`rect={top:400,bottom:600,left:0,right:390};selectedTab.dataset.tab='daily';notify();
    selectedTab.dataset.tab='now';currentPage='analytics';notify();currentPage='main';
    attached=false;notify();attached=true;rect={top:400,bottom:600,left:500,right:890};notify();
    rect={top:-250,bottom:-1,left:0,right:390};notify()`);
  assert.equal(a.run('chart24.updates'),0);
  a.run('rect={top:843,bottom:1043,left:0,right:390};notify()');
  assert.equal(a.run('chart24.updates'),1);
});

test('station reset hides old graph and a queued old notification reads only current station data',()=>{
  const a=ready();a.run('rect={top:400,bottom:600,left:0,right:390};notify();globalThis.oldRows=store.rows;switchStation(1);notify()');
  assert.equal(a.run('chart24.updates'),1);
  assert.equal(a.nodes.get('chart24h').style.visibility,'hidden');
  a.run('store.rows=makeRows(-12);invalidateDerivedData();notify()');
  assert.equal(a.run('JSON.stringify(chart24.data.datasets[0].data.filter(p=>!p.gap).map(p=>p.y))'),'[-12]');
  assert.equal(a.run('store.rows===oldRows'),false);
  assert.equal(a.run('chart24.updates'),2);
});

test('background data waits for resume even when IntersectionObserver sends no new entry',()=>{
  const a=ready();a.run('rect={top:400,bottom:600,left:0,right:390}');
  a.visibility(true);a.run('refreshTab("now");notify()');
  assert.equal(a.run('chart24.updates'),0);
  a.visibility(false);
  assert.equal(a.run('chart24.updates'),1);
  assert.equal(a.run('tabDirtyState.now'),false);
});

test('main/modern return consumes dirty state only for a visible current tab',()=>{
  const a=ready();a.run('showAppPage("analytics");store.rows=makeRows(17);invalidateDerivedData();showAppPage("modern");notify()');
  assert.equal(a.run('chart24.updates'),0);
  a.run('rect={top:400,bottom:600,left:0,right:390};notify();showAppPage("main");notify()');
  assert.equal(a.run('chart24.updates'),1);
  assert.equal(a.run('JSON.stringify(chart24.data.datasets[0].data.filter(p=>!p.gap).map(p=>p.y))'),'[17]');
});

test('unavailable, failed constructor and failed observe fall back to the synchronous chart path',()=>{
  for(const setup of ['','globalThis.IntersectionObserver=class{constructor(){throw Error("unavailable")}}',
    'globalThis.IntersectionObserver=class{observe(){throw Error("failed observe")}disconnect(){globalThis.disconnected=true}}']){
    const a=app();a.run(`store.rows=[{ts:new Date(),temp:0,hum:0}];${setup};initCurrentChartVisibility();tabDirtyState.now=true;refreshTab('now')`);
    assert.equal(a.run('chart24.updates'),1);
    assert.equal(a.run('currentChartObserver'),null);
    assert.equal(a.run('tabDirtyState.now'),false);
  }
});

test('motion changes and delayed manual resizes avoid updating the offscreen current graph',()=>{
  const a=ready();a.run(`globalThis.resizes=0;chart24.canvas=el('chart24h');chart24.resize=()=>resizes++;
    el('tab-now').contains=canvas=>canvas===el('chart24h');resizeChartsInTab('now')`);
  a.motion(true);
  assert.equal(a.run('chart24.updates'),0);assert.equal(a.run('resizes'),0);
  assert.equal(a.run('chart24.options.animation'),false);
  a.run('rect={top:400,bottom:600,left:0,right:390};notify();resizeChartsInTab("now")');
  assert.equal(a.run('resizes'),1);assert.equal(a.run('chart24.updates'),1);
});

test('failed draw stays dirty/hidden and a later attempt can recover',()=>{
  const a=ready();a.run('rect={top:400,bottom:600,left:0,right:390};globalThis.realBuild=buildCharts;buildCharts=()=>{throw Error("controlled") }');
  assert.throws(()=>a.run('notify()'),/controlled/);
  assert.equal(a.run('tabDirtyState.now'),true);assert.equal(a.nodes.get('chart24h').style.visibility,'hidden');
  a.run('buildCharts=realBuild;notify()');
  assert.equal(a.run('tabDirtyState.now'),false);assert.equal(a.nodes.get('chart24h').style.visibility,'');
});
