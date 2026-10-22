const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

function ready({ realRefresh = false } = {}) {
  const a = app({ realRefresh });
  a.run(`
    globalThis.pageLinks=['main','analytics'].map(page=>({dataset:{page},attributes:{},
      setAttribute(key,value){this.attributes[key]=value},removeAttribute(key){delete this.attributes[key]}}));
    globalThis.selectedTab={dataset:{tab:'now'}};
    document.querySelector=selector=>selector==='.tab-btn.active'?selectedTab:null;
    document.querySelectorAll=selector=>selector==='.page-link'?pageLinks:selector==='.tab-btn'?[selectedTab]:[];
    globalThis.visits=[];globalThis.scrolls=0;
    window.history={pushState(state,title,hash){visits.push(hash);location.hash=hash}};
    window.scrollTo=()=>scrolls++;
    store.rows=[{ts:new Date(2026,9,22,12),temp:0,hum:50,pressure:1000,voltage:4,rain:0,rainInc:0,tank:null}];
    store.fullLoaded=true;globalThis.originalRows=store.rows;
  `);
  return a;
}

test('top-level navigation keeps dashboard subtab, data and configuration; leaving destroys analytics only', () => {
  const a = ready();
  const cfg = a.run('JSON.stringify(CFG)');
  a.run(`globalThis.builds=0;buildAnalytics=()=>builds++;selectedTab.dataset.tab='daily';
    showAppPage('analytics');globalThis.destroyed=0;analyticsCharts.set(0,{destroy(){destroyed++}});
    analyticsStationCache.set(1,{count:2,bytes:32});`);
  assert.equal(a.nodes.get('page-main').hidden, true);
  assert.equal(a.nodes.get('dashboardBars').hidden, true);
  assert.equal(a.nodes.get('tab-analytics').hidden, false);
  assert.equal(a.run('pageLinks[1].attributes["aria-current"]'), 'page');
  assert.equal(a.run('pageLinks[0].attributes["aria-current"]'), undefined);
  assert.equal(a.run('analyticsActive()'), true);
  a.run('showAppPage("main")');
  assert.equal(a.nodes.get('page-main').hidden, false);
  assert.equal(a.nodes.get('dashboardBars').hidden, false);
  assert.equal(a.nodes.get('tab-analytics').hidden, true);
  assert.equal(a.run('selectedTab.dataset.tab'), 'daily');
  assert.equal(a.run('destroyed'), 1);
  assert.equal(a.run('analyticsStationCache.size'), 1);
  assert.equal(a.run('analyticsCharts.size'), 0);
  assert.equal(a.run('store.rows===originalRows'), true);
  assert.equal(a.run('JSON.stringify(CFG)'), cfg);
  assert.equal(a.requests.length, 0);
});

test('page URLs support direct selection and history without duplicate entries or rebuilding the same page', () => {
  const a = ready();
  a.run('globalThis.builds=0;buildAnalytics=()=>builds++;showAppPage("analytics");showAppPage("analytics")');
  assert.equal(a.run('builds'), 1);
  assert.equal(a.run('JSON.stringify(visits)'), '["#analytika"]');
  assert.equal(a.run('appPageFromHash()'), 'analytics');
  a.run('location.hash="#prehled";showAppPage(appPageFromHash(),{updateHistory:false})');
  assert.equal(a.run('analyticsActive()'), false);
  assert.equal(a.run('visits.length'), 1);
  a.run('location.hash="#analytika";showAppPage(appPageFromHash(),{updateHistory:false});showAppPage(appPageFromHash(),{updateHistory:false})');
  assert.equal(a.run('builds'), 2);
  assert.equal(a.run('visits.length'), 1);
  assert.equal(a.run('scrolls'), 3);
  a.run('showAppPage("unrecognised")');
  assert.equal(a.run('analyticsActive()'), true);
});

test('refresh and a late subtab callback render only the visible page; returning consumes dashboard dirty state', () => {
  const a = ready({ realRefresh: true });
  a.run(`globalThis.builds=0;globalThis.mainBuilds=0;buildAnalytics=()=>builds++;
    buildCharts=()=>mainBuilds++;showAppPage('analytics');refreshUI();
    tabDirtyState.now=true;refreshTab('now');`);
  assert.equal(a.run('builds'), 2);
  assert.equal(a.run('mainBuilds'), 0);
  assert.equal(a.run('tabDirtyState.now'), true);
  a.run('showAppPage("main")');
  assert.equal(a.run('mainBuilds'), 1);
  assert.equal(a.run('tabDirtyState.now'), false);
  assert.equal(a.run('store.rows===originalRows'), true);
  assert.equal(a.requests.length, 0);
});

test('a station reset keeps analytics selected and replaces stale graphs with an empty state without fetching old configuration', () => {
  const a = ready();
  a.run(`store.rows=[];store.fullLoaded=false;showAppPage('analytics');`);
  assert.equal(a.requests.length, 0);
  assert.equal(a.nodes.get('anaGrid').hidden, true);
  assert.equal(a.nodes.get('anaDataEmpty').hidden, false);
  assert.doesNotMatch(a.nodes.get('anaStatus').textContent, /Neplatné/);
  a.run(`globalThis.destroyed=0;analyticsCharts.set(0,{destroy(){destroyed++}});
    analyticsState.domain={from:1,to:2};resetStationStore();`);
  assert.equal(a.run('destroyed'), 1);
  assert.equal(a.run('analyticsActive()'), true);
  assert.equal(a.nodes.get('page-main').hidden, true);
  assert.equal(a.nodes.get('anaGrid').hidden, true);
  assert.equal(a.nodes.get('anaDataEmpty').hidden, false);
  assert.equal(a.run('analyticsState.domain'), null);
  assert.equal(a.requests.length, 0);
});
