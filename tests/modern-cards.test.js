const assert=require('node:assert/strict');
const {test}=require('node:test');
const {app}=require('./helpers/app');
const key='meteoDev:meteoModernCards';
const saved=stations=>JSON.stringify({version:1,stations});
function ready(options={}){const a=app(options);a.run('showAppPage("modern")');return a;}
const hidden=(a,key)=>a.nodes.get('sensorCard-'+key).hidden;

test('card preferences are independent per station and never change data/configuration/aggregates',()=>{
  const a=ready();
  a.run('globalThis.rowsBefore=store.rows;globalThis.cfgBefore=JSON.stringify(stations);globalThis.cacheBefore=aggregateCache;setModernCardVisible("tank",false)');
  assert.equal(hidden(a,'tank'),true);
  a.run('activeIdx=1;CFG=stations[1];syncModernStation()');
  assert.equal(hidden(a,'tank'),false);
  a.run('setModernCardVisible("voltage",false);activeIdx=0;CFG=stations[0];syncModernStation()');
  assert.equal(hidden(a,'tank'),true);assert.equal(hidden(a,'voltage'),false);
  assert.equal(a.run('store.rows===rowsBefore && JSON.stringify(stations)===cfgBefore && aggregateCache===cacheBefore'),true);
  assert.equal(a.requests.length,0);assert.equal(a.state.starts,0);assert.equal(a.state.renders,0);
});
test('a reload restores each station selection using a separate preview preference key',()=>{
  const a=ready();a.run('setModernCardVisible("rain",false)');
  const persisted=a.run('preferences.getItem("meteoModernCards")');
  const b=ready({initialStorage:{[key]:persisted}});assert.equal(hidden(b,'rain'),true);
  assert.equal(hidden(ready({initialStorage:{meteoModernCards:persisted}}),'rain'),false);
  b.run('activeIdx=2;CFG=stations[2];syncModernStation()');assert.equal(hidden(b,'rain'),false);
});
test('the classic page restores every card while the modern selection is retained',()=>{
  const a=ready();a.run('setModernCardVisible("absHum",false);showAppPage("main")');
  assert.equal(hidden(a,'absHum'),false);assert.equal(a.nodes.get('modernCardsEmpty').hidden,true);
  a.run('showAppPage("modern")');assert.equal(hidden(a,'absHum'),true);
  assert.equal(a.requests.length,0);
});
test('all cards may be hidden with a visible recovery control; reset affects only the active station',()=>{
  const a=ready();a.run('setModernCardVisible("tank",false);activeIdx=1;CFG=stations[1];syncModernStation();for(const k of MODERN_CARD_KEYS)setModernCardVisible(k,false)');
  assert.equal(a.nodes.get('sensorCards').hidden,true);assert.equal(a.nodes.get('modernCardsEmpty').hidden,false);
  assert.equal(a.nodes.get('modernCardCount').textContent,'0/7');
  a.run('resetModernCards()');assert.equal(a.nodes.get('sensorCards').hidden,false);
  assert.equal(a.nodes.get('modernCardsEmpty').hidden,true);assert.equal(a.nodes.get('modernCardCount').textContent,'7/7');
  a.run('activeIdx=0;CFG=stations[0];syncModernStation()');assert.equal(hidden(a,'tank'),true);
});
test('malformed, wrong-version and oversized preferences recover to usable defaults',()=>{
  for(const value of ['null','{}','invalid','[]',JSON.stringify({version:2,stations:[[],[],[]]}),saved([[],[]]),' '.repeat(4097),saved([null,{},23])]){
    const a=ready({initialStorage:{[key]:value}});
    assert.equal(a.run('modernCards.every(s=>s.length===7)'),true,value);
  }
});
test('preference normalization deduplicates known keys without accepting prototype or HTML names',()=>{
  const a=ready({initialStorage:{[key]:saved([['tank','tank','bad','<img>'],['__proto__'],[]])}});
  assert.equal(a.run('modernCards[0].join()'),'tank');assert.equal(a.run('modernCards[1].length'),7);
  assert.equal(a.run('modernCards[2].length'),0);
  a.run('setModernCardVisible("<img>",false);setModernCardVisible("pressure","false")');
  assert.equal(a.run('modernCards[0].join()'),'tank');
});
test('blocked storage keeps card preferences within the session and explains their scope',()=>{
  const a=ready({storageFailure:true});a.run('setModernCardVisible("rainInc",false);showAppPage("main");showAppPage("modern")');
  assert.equal(hidden(a,'rainInc'),true);
  assert.match(a.nodes.get('modernCardStorage').textContent,/jen pro tuto relaci/);
  assert.equal(a.run('preferences.persistent'),false);
});
test('hiding a card cancels a pending explanation without data fetching or rendering',()=>{
  const a=ready();a.run(`globalThis.opened=0;openInfoPopover=()=>opened++;scheduleInfoPopover({isConnected:true,hidden:false,getClientRects:()=>[{}],matches:()=>true});setModernCardVisible('vpd',false)`);
  a.tick(1500);assert.equal(a.run('opened'),0);assert.equal(a.run('pendingInfoTrigger'),null);
  assert.equal(a.requests.length,0);assert.equal(a.state.renders,0);
});
test('unchanged refreshes do not keep rewriting card visibility',()=>{
  const a=ready();let writes=0;
  for(const name of a.run('[...MODERN_CARD_KEYS]')){
    const node=a.nodes.get('sensorCard-'+name);let value=node.hidden;
    Object.defineProperty(node,'hidden',{get:()=>value,set:next=>{writes++;value=next;}});
  }
  a.run('syncModernStation();syncModernStation();syncModernStation()');assert.equal(writes,0);
});
