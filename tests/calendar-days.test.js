const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// A separate process per zone avoids changing the timezone of concurrent tests.
function inZone(zone, checks) {
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { app } = require('./tests/helpers/app');
    const a = app({ realRefresh: true });
    function clock(year, month, day, hour, minute = 0) {
      a.run('globalThis.fixedNow = new Date('+[year,month,day,hour,minute].join(',')+').getTime()');
      a.run(\`if (!globalThis.NativeDate) globalThis.NativeDate = Date;
        globalThis.Date = class extends NativeDate {
          constructor(...args) { super(...(args.length ? args : [fixedNow])); }
          static now() { return fixedNow; }
        }\`);
    }
    ${checks}
  `], { cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: zone }, stdio: 'pipe' });
}

for (const zone of ['Europe/Prague', 'America/New_York', 'Pacific/Kiritimati', 'UTC']) {
  test(`comparison groups midnight and late evening by the same local day as chart hours: ${zone}`, () => {
    inZone(zone, `
      a.run(\`store.rows = [
        {ts:new Date(2026,9,21,23,30),temp:30,hum:60},
        {ts:new Date(2026,9,21,0,30),temp:10,hum:50},
        {ts:new Date(2026,9,20,23,30),temp:20,hum:40}
      ]; cmpSelectedDays=['2026-10-21','2026-10-20']; el('cmpMetric').value='temp'; buildCompare()\`);
      assert.equal(a.run('chartCompare.data.datasets[0].data[0]'),10);
      assert.equal(a.run('chartCompare.data.datasets[0].data[23]'),30);
      assert.equal(a.run('chartCompare.data.datasets[1].data[23]'),20);
      assert.equal(a.run('chartCompare.data.datasets[1].data[0]'),null);
      assert.equal(a.run('store.rows[0].temp'),30);
    `);
  });

  test(`today inputs and eight quick dates use calendar arithmetic through DST: ${zone}`, () => {
    inZone(zone, `
      for (const [month,day,hour] of [[9,21,0],[9,21,23],[2,30,0],[9,25,23],[0,1,0]]) {
        clock(2026,month,day,hour,30);
        a.run('cmpSelectedDays=[];initCmpDays();expSetToday();expOneSetToday()');
        const expected = a.run('new Date().getFullYear()+"-"+_pad2(new Date().getMonth()+1)+"-"+_pad2(new Date().getDate())');
        for (const id of ['expDateFrom','expDateTo','expDateOne','cmpAddDate']) {
          assert.equal(a.nodes.get(id).value,expected,id);
        }
        const titles = [...a.nodes.get('cmpDayBtns').innerHTML.matchAll(/title="([0-9-]+)"/g)].map(m=>m[1]);
        assert.equal(titles.length,8);
        assert.equal(new Set(titles).size,8);
        assert.equal(titles[0],expected);
        const expectedDays = a.run(\`JSON.stringify(Array.from({length:8},(_,i)=>{
          const d=new Date(2026,\${month},\${day}-i,12);
          return d.getFullYear()+'-'+_pad2(d.getMonth()+1)+'-'+_pad2(d.getDate());
        }))\`);
        assert.equal(JSON.stringify(titles),expectedDays);
        assert.equal(a.run('JSON.stringify(cmpSelectedDays)'),JSON.stringify(titles.slice(0,2)));
        assert.match(a.nodes.get('cmpDayBtns').innerHTML,/>Včera</);
      }
    `);
  });
}

for (const [zone,days] of [
  ['Europe/Prague', [[2026,3,29,23],[2026,10,25,25]]],
  ['America/New_York', [[2026,3,8,23],[2026,11,1,25]]],
  ['America/Sao_Paulo', [[2018,11,4,23]]],
  ['UTC', [[2026,3,29,24],[2026,10,25,24]]]
]) {
  test(`one day and custom range keep the entire calendar day and exclude the next: ${zone}`, () => {
    inZone(zone, `
      for (const [year,month,day,hours] of ${JSON.stringify(days)}) {
        const key = year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
        a.run(\`globalThis.start=new Date(\${year},\${month}-1,\${day}).getTime();
          globalThis.next=new Date(\${year},\${month}-1,\${day}+1).getTime();
          store.rows=[next,next-1,start+3600000,start,start-1].map((t,i)=>({ts:new Date(t),temp:i,hum:60}));
          store.fullLoaded=true;invalidateDerivedData();el('expMetric').value='temp';\`);
        for (const mode of ['oneday','custom']) {
          a.run(\`expRange='\${mode}';el('expDateOne').value='\${key}';el('expDateFrom').value='\${key}';el('expDateTo').value='';buildExplorer()\`);
          assert.equal(a.run('expAllPts.length'),3);
          assert.equal(a.run('+expAllPts[0].ts===start && +expAllPts.at(-1).ts===next-1'),true);
          assert.equal(a.run('store.rows.length'),5);
        }
        assert.equal(a.run(\`(localDayBounds('\${key}').to+1-localDayBounds('\${key}').from)/3600000\`),hours);
      }
    `);
  });
}

test('calendar validation, leap day and reversed ranges do not normalize into another date', () => {
  inZone('Europe/Prague', `
    for (const key of ['2026-02-29','2026-02-30','2026-13-01','2026-00-01','2026-01-00','2026-1-01','', 'bad']) {
      assert.equal(a.run('localDayBounds('+JSON.stringify(key)+')'),null,key);
    }
    assert.equal(a.run("localDateKey(new Date(localDayBounds('2024-02-29').from))"),'2024-02-29');
    a.run(\`store.rows=[{ts:new Date(2026,9,21,12),temp:10}];el('expMetric').value='temp';
      expRange='custom';el('expDateFrom').value='2026-10-21';el('expDateTo').value='2026-10-20';buildExplorer()\`);
    assert.equal(a.run('expAllPts.length'),0);
    a.run("el('expDateTo').value='2026-02-30';buildExplorer()");
    assert.equal(a.run('expAllPts.length'),0);
    assert.equal(a.nodes.get('expInterval').hidden,true);
  `);
});

test('repeated autumn hour is explicitly a sample average; missing spring hour stays missing', () => {
  inZone('Europe/Prague', `
    a.run(\`store.rows=[
      {ts:new Date('2026-10-25T02:30:00+02:00'),temp:10},
      {ts:new Date('2026-10-25T02:30:00+01:00'),temp:20},
      {ts:new Date('2026-03-29T01:30:00+01:00'),temp:5},
      {ts:new Date('2026-03-29T03:30:00+02:00'),temp:15}
    ].sort((a,b)=>b.ts-a.ts);cmpSelectedDays=['2026-10-25','2026-03-29'];el('cmpMetric').value='temp';buildCompare()\`);
    assert.equal(a.run('chartCompare.data.datasets[0].data[2]'),15);
    assert.equal(a.run('chartCompare.data.datasets[1].data[2]'),null);
    assert.ok(a.nodes.get('cmpInfo').textContent.includes('Europe/Prague'));
    assert.match(a.nodes.get('cmpInfo').textContent,/Opakovaná hodina/);
    assert.equal(a.run('store.rows.length'),4);
  `);
});

test('today statistics exclude future and previous calendar days on a short DST day', () => {
  inZone('Europe/Prague', `
    clock(2026,2,29,12);
    a.run(\`store.rows=[
      {ts:new Date(2026,2,30,0),temp:100,hum:100,rain:100},
      {ts:new Date(2026,2,29,23,59,59),temp:20,hum:60,rain:2},
      {ts:new Date(2026,2,29,0),temp:10,hum:50,rain:0},
      {ts:new Date(2026,2,28,23,59,59),temp:-100,hum:0,rain:99}
    ];refreshUI();buildDailyGrid()\`);
    assert.equal(a.nodes.get('dayTempMax').textContent,'20.0');
    assert.equal(a.nodes.get('dayTempMin').textContent,'10.0');
    assert.equal(a.nodes.get('dayTempAvg').textContent,'15.00');
    assert.equal(a.nodes.get('dayRain').textContent,'2.0');
    assert.doesNotMatch(a.nodes.get('dailyGrid').innerHTML,/100\.0/);
  `);
});

test('today cards clear previous values when the local day or its sensors have no data', () => {
  inZone('Europe/Prague', `
    clock(2026,2,29,12);
    a.run("store.rows=[{ts:new Date(2026,2,29,12),temp:20,hum:60,rain:2}];refreshUI()");
    assert.equal(a.nodes.get('dayTempMax').textContent,'20.0');
    a.run('store.rows=[{ts:new Date(2026,2,30,0),temp:100,hum:100,rain:100}];refreshUI();buildDailyGrid()');
    for (const id of ['dayTempMin','dayTempMax','dayTempAvg','dayHumMin','dayHumMax','dayHumAvg','dayRain']) {
      assert.equal(a.nodes.get(id).textContent,'–',id);
    }
    assert.match(a.nodes.get('dailyGrid').innerHTML,/Žádná data/);
    a.run('store.rows=[{ts:new Date(2026,2,29,12),temp:null,hum:0,rain:0}];refreshUI()');
    assert.equal(a.nodes.get('dayTempMax').textContent,'–');
    assert.equal(a.nodes.get('dayHumMax').textContent,'0.0');
    assert.equal(a.nodes.get('dayRain').textContent,'0.0');
  `);
});

test('UV cache rolls over at the local calendar day instead of UTC midnight', () => {
  inZone('Europe/Prague', `
    (async()=>{
      clock(2026,9,21,0,30);
      a.run("uvStore.lat=CFG.lat;uvStore.lon=CFG.lon;uvStore.date='2026-10-20';uvStore.hourly=[9]");
      const first=a.run('fetchUVData()');
      assert.equal(a.requests.length,1);
      a.respond(0,JSON.stringify({hourly:{uv_index:[2]}}));await first;
      assert.equal(a.run('uvStore.date'),'2026-10-21');
      await a.run('fetchUVData()');assert.equal(a.requests.length,1);
      clock(2026,9,22,0,30);
      const second=a.run('fetchUVData()');assert.equal(a.requests.length,2);
      a.respond(1,JSON.stringify({hourly:{uv_index:[3]}}));await second;
      assert.equal(a.run('uvStore.date'),'2026-10-22');
    })().catch(error=>{console.error(error);process.exitCode=1});
  `);
});
