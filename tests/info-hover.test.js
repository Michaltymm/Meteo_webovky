const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app } = require('./helpers/app');

function fixture() {
  const a = app();
  a.run(`globalThis.opened=[];globalThis.openInfoPopover=trigger=>opened.push(trigger.id);
    globalThis.triggerA={id:'a',isConnected:true,hidden:false,getClientRects:()=>[{}],matches:()=>true};
    globalThis.triggerB={...triggerA,id:'b'};`);
  return a;
}

test('hover waits 1500ms without preparing a panel, and only the latest icon opens', () => {
  const a = fixture();
  a.run('scheduleInfoPopover(triggerA)');
  a.tick(140); a.tick(1499);
  assert.equal(a.run('opened.length'), 0);
  assert.equal(a.requests.length, 0);
  a.run('scheduleInfoPopover(triggerB)');
  assert.equal([...a.timers.values()].filter(t => t.delay === 1500).length, 1);
  a.tick(1500);
  assert.equal(a.run('opened.join()'), 'b');
  assert.equal(a.run('pendingInfoTrigger'), null);
});

test('leaving, dismissal and data invalidation cancel a pending hover', () => {
  for (const action of ['cancelPendingInfo()', 'closeInfoPopover()', 'invalidateDerivedData()']) {
    const a = fixture();
    a.run(`scheduleInfoPopover(triggerA);${action}`);
    a.tick(1500);
    assert.equal(a.run('opened.length'), 0, action);
    assert.equal(a.run('pendingInfoTrigger'), null);
  }
});

test('a hidden, removed, nonhovered or no longer visible icon cannot open later', () => {
  for (const change of ['hidden=true', 'isConnected=false', 'getClientRects=()=>[]', 'matches=()=>false']) {
    const a = fixture();
    a.run(`scheduleInfoPopover(triggerA);triggerA.${change}`);
    a.tick(1500);
    assert.equal(a.run('opened.length'), 0, change);
  }
});
