const assert=require('node:assert/strict');
const{test}=require('node:test');
const{app}=require('./helpers/app');
function ready(){const a=app({realRefresh:true});a.run(`
 globalThis.selectedTab={dataset:{tab:'now'}};
 document.querySelector=s=>s==='.tab-btn.active'?selectedTab:null;
 document.querySelectorAll=s=>s==='.tab-btn'?[selectedTab]:[];
 globalThis.visits=[];window.history={pushState(s,t,hash){visits.push(hash);location.hash=hash}};
 store.rows=[{ts:new Date(1700000000000),temp:0,hum:0,pressure:null,voltage:0,rain:0}];
 store.fullLoaded=true;`);return a;}

test('modern2 is an independent URL/view sharing original data with no chart build or request',()=>{
 const a=ready();a.run(`globalThis.source=store.rows;globalThis.config=CFG;globalThis.builds=0;buildCharts=()=>builds++;
 showAppPage('modern2');showAppPage('modern2')`);
 assert.equal(a.run('appPageFromHash()'),'modern2');assert.equal(a.run('visits.length'),1);
 assert.equal(a.nodes.get('page-main').hidden,true);assert.equal(a.nodes.get('page-modern2').hidden,false);
 assert.equal(a.nodes.get('dashboardBars').hidden,true);assert.equal(a.nodes.get('tab-analytics').hidden,true);
 assert.equal(a.run('builds'),0);assert.equal(a.requests.length,0);
 assert.equal(a.run('store.rows===source&&CFG===config'),true);
 a.run(`location.hash='#moderni';showAppPage(appPageFromHash(),{updateHistory:false});location.hash='#moderni2';showAppPage(appPageFromHash(),{updateHistory:false})`);
 assert.equal(a.run('visits.length'),1);assert.equal(a.run('currentPage'),'modern2');
});

test('simple view preserves zero/null distinctions and never invents nonfinite sensor readings',()=>{
 const a=ready();a.run(`showAppPage('modern2')`);
 for(const[id,value]of [['simpleTemp','0.0'],['simpleHum','0.0'],['simplePressure','–'],['simpleVoltage','0.00']])assert.equal(a.nodes.get(id).textContent,value);
 a.run(`store.rows[0].temp=NaN;store.rows[0].hum=Infinity;store.rows[0].voltage=null;renderDataStatus()`);
 for(const id of ['simpleTemp','simpleHum','simpleVoltage'])assert.equal(a.nodes.get(id).textContent,'–');
});

test('station reset immediately removes old readings and timestamps while keeping simple view selected',()=>{
 const a=ready();a.run(`showAppPage('modern2');switchStation(1)`);
 assert.equal(a.run('currentPage'),'modern2');assert.equal(a.nodes.get('simpleStation').value,'1');
 for(const id of ['simpleTemp','simpleHum','simplePressure','simpleVoltage'])assert.equal(a.nodes.get(id).textContent,'–');
 assert.equal(a.nodes.get('simpleTime').title,'');assert.equal(a.nodes.get('simpleTime').textContent,'Zatím bez dat');
 a.run(`store.rows=[{ts:new Date(0),temp:21,hum:50,pressure:1013.2,voltage:4.2}];refreshUI()`);
 assert.equal(a.nodes.get('simpleTemp').textContent,'21.0');assert.equal(a.nodes.get('simpleVoltage').textContent,'4.20');
});

test('existing error/future/invalid time warnings and MQTT receipt labels stay visible in the simple view',()=>{
 const a=ready();a.run(`showAppPage('modern2');dataStatus.sheets.phase='error';renderDataStatus()`);
 assert.match(a.nodes.get('simpleStatus').textContent,/Chyba přenosu/);assert.match(a.nodes.get('simpleStatus').className,/data-state-error/);
 a.run(`dataStatus.sheets.phase='ok';store.rows[0].ts=new Date(Date.now()+600000);renderDataStatus()`);
 assert.match(a.nodes.get('simpleStatus').textContent,/budoucnosti/);assert.match(a.nodes.get('simpleStatus').className,/data-state-warning/);
 a.run(`store.rows[0].ts=new Date(NaN);renderDataStatus()`);
 assert.equal(a.nodes.get('simpleTime').textContent,'Čas není dostupný');
 a.run(`CFG.source='mqtt';store.rows[0].ts=new Date();dataStatus.latestRow=store.rows[0];dataStatus.latestKind='mqtt';renderDataStatus()`);
 assert.equal(a.nodes.get('simpleTimeLabel').textContent,'Poslední příjem MQTT');
});

test('large history status projection only reads latest row and escapes configured station names',()=>{
 const a=ready();a.run(`globalThis.visitsToRows=0;globalThis.row=store.rows[0];
 store.rows=new Proxy({length:250000,0:row},{get(t,k){if(/^\\d+$/.test(String(k))){visitsToRows++;if(k!=='0')throw Error('full scan')}return t[k]}});
 stations[1].name='<img src=x onerror=bad()>"';activeIdx=1;CFG=stations[1];currentPage='modern2';renderDataStatus()`);
 assert.equal(a.run('visitsToRows'),2);assert.equal(a.requests.length,0);
 assert.match(a.nodes.get('simpleStation').innerHTML,/&lt;img/);assert.doesNotMatch(a.nodes.get('simpleStation').innerHTML,/<img/);
 assert.equal(a.nodes.get('simpleStation').value,'1');
});

test('hidden dashboard stays dirty without IO and late heavy-tab callbacks cannot build while in simple view',()=>{
 const a=ready();a.run(`globalThis.builds=0;buildCharts=()=>builds++;showAppPage('modern2');refreshUI();
 tabDirtyState.monthly=true;refreshTab('monthly')`);
 assert.equal(a.run('builds'),0);assert.equal(a.run('tabDirtyState.monthly'),true);
 assert.equal(a.run('currentChartCanRender()'),false);
 a.run(`selectedTab.dataset.tab='monthly';showAppPage('modern')`);
 assert.equal(a.run('builds'),1);assert.equal(a.run('tabDirtyState.monthly'),false);
});

test('leaving analytics for simple view destroys analytics and leaves modern card preferences unchanged',()=>{
 const a=ready();a.run(`currentPage='analytics';globalThis.destroyed=0;analyticsCharts.set(0,{destroy(){destroyed++}});
 globalThis.cards=JSON.stringify(modernCards);showAppPage('modern2')`);
 assert.equal(a.run('destroyed'),1);assert.equal(a.run('analyticsCharts.size'),0);
 assert.equal(a.run('JSON.stringify(modernCards)===cards'),true);
});
