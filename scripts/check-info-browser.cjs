// Real DOM/Chart.js regression. Dependencies stay outside this static project.
// node scripts/check-info-browser.cjs --chartjs /tmp/chart.js --paho /tmp/paho.js
// Optional: CHROMIUM_EXECUTABLE, METEO_CHROMIUM_ARGS (JSON), --output /tmp/help-qa
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { chromium } = require('playwright');
const { values: options } = parseArgs({ options: {
  chartjs: { type: 'string' }, paho: { type: 'string' }, output: { type: 'string', default: '/tmp/meteo-help-qa' }
} });
assert.ok(options.chartjs && options.paho, 'Provide the original SRI-matching Chart.js and Paho files');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'));
const configs = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json'];
const now = Date.parse('2026-10-22T12:00:00+02:00');
const errors = [], requests = [], checks = [];
fs.mkdirSync(options.output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE,
    args: JSON.parse(process.env.METEO_CHROMIUM_ARGS || '[]'), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, timezoneId: 'Europe/Prague', reducedMotion: 'reduce' });
    await page.clock.setFixedTime(now);
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url()), name = url.pathname.split('/').at(-1);
      if (url.hostname === 'meteo.test') {
        if (configs.includes(name)) return route.fulfill({ body: fs.readFileSync(path.join(root, name)), contentType: 'application/json' });
        return route.fulfill({ body: html, contentType: 'text/html' });
      }
      if (url.href.includes('chart.js')) return route.fulfill({ body: fs.readFileSync(options.chartjs), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.href.includes('paho-mqtt')) return route.fulfill({ body: fs.readFileSync(options.paho), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.hostname === 'docs.google.com') {
        requests.push(url.href);
        const count = url.searchParams.get('tq')?.includes('LIMIT 400') ? 400 : 2000;
        const rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti'];
        for (let i = 0; i < count; i++) {
          const d = new Date(now - i * 600000), z = n => String(n).padStart(2, '0');
          rows.push(`${z(d.getUTCDate())}.10.2026,${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:00,${i === 0 ? 42.123456789 : i === 1 ? -7.123456789 : 10 + i % 12},1015,62,0,0,,${4 + i % 10 / 100}`);
        }
        return route.fulfill({ body: rows.join('\n'), contentType: 'text/csv' });
      }
      if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { hourly: { uv_index: Array(24).fill(0) } } });
      return route.abort();
    });
    await page.goto('http://meteo.test/dev/');
    await page.waitForFunction(() => store.rows.length === 400);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('details[data-info]').count(), 17);
    assert.equal(await page.locator('details[data-info] > summary').allTextContents().then(xs => xs.every(s => s === 'i')), true);
    const popup = page.locator('#infoPopover'), max = page.locator('#statTempMaxSource'), min = page.locator('#statTempMinSource');
    const shown = async () => { await popup.waitFor({ state: 'visible' }); assert.equal(await page.locator('[aria-expanded="true"].info-trigger').count(), 1); };
    const gone = async () => { await popup.waitFor({ state: 'hidden' }); };
    const bounds = async () => {
      const b = await popup.boundingBox(), v = page.viewportSize();
      assert.ok(b.x >= 11 && b.y >= 11 && b.x + b.width <= v.width - 11 && b.y + b.height <= v.height - 11, JSON.stringify(b));
    };
    await page.evaluate(() => { globalThis.helpRows = store.rows; globalThis.helpCharts = Chart.instances; dataAggregates(); });
    const count = requests.length;
    await max.hover(); await shown(); await bounds();
    assert.equal(await page.evaluate(() => temperatureRecordData().temp), '42.123456789');
    await popup.hover(); await page.waitForTimeout(180); assert.equal(await popup.isVisible(), true);
    await page.screenshot({ path: path.join(options.output, 'desktop-help.png') });
    await page.mouse.move(5, 500); await gone();
    assert.equal(await page.evaluate(() => temperatureRecordView), null);
    assert.equal(await page.locator('#stationData #tempRecord').count(), 1);
    await min.hover(); await shown();
    assert.equal(await page.evaluate(() => temperatureRecordData().temp), '-7.123456789');
    await page.keyboard.press('Escape'); await gone();
    // Esc returns focus without immediately reopening the help.
    assert.equal(await min.evaluate(n => document.activeElement === n), true);
    await page.keyboard.press('Enter'); await shown();
    await page.keyboard.press('Tab'); assert.equal(await page.locator('.info-close').evaluate(n => document.activeElement === n), true);
    await page.keyboard.press('Escape'); await gone();
    assert.equal(await page.evaluate(() => store.rows === helpRows && Chart.instances === helpCharts), true);
    assert.equal(requests.length, count);
    checks.push('mouse hover/leave, popup bridge, min/max original rows, Escape, Enter/Tab, no fetch or chart creation');

    const ah = page.locator('#humidityMetricsInfo > summary');
    await ah.hover(); await shown();
    await ah.click(); assert.equal(await page.locator('#tab-now').isVisible(), true);
    await page.mouse.move(2, 500); await gone();
    await page.locator('#humidityMetricsInfo > summary').hover(); await shown();
    assert.match(await popup.innerText(), /216,7/);
    await page.locator('.tab-btn[data-tab="battery"]').click(); await gone();
    await page.waitForFunction(() => store.fullLoaded);
    await page.locator('#batteryMethod > summary').hover(); await shown();
    assert.match(await popup.innerText(), /SOC/);
    await page.mouse.move(2, 500); await gone();
    await page.locator('#batterySensitivity > summary').hover(); await shown(); await bounds();
    assert.match(await popup.innerText(), /Citlivost vztahu/);
    await page.mouse.move(2, 500); await gone();
    await page.locator('.tab-btn[data-tab="compare"]').click();
    // A chart can still open the evidence programmatically; the original
    // data selectors stay in the real DOM, not in a stale cloned tooltip.
    await page.evaluate(() => { el('cmpEvidence').open = true; }); await shown();
    assert.equal(await page.locator('#infoPopover #cmpDataQuality').count(), 1);
    await page.keyboard.press('Escape'); await gone();
    await page.locator('.tab-btn[data-tab="yearstats"]').click();
    const rain = page.locator('#yearStatsContent [data-info-text]').first();
    await rain.hover(); await shown(); assert.match(await popup.innerText(), /reset čítače/);
    await page.evaluate(() => invalidateDerivedData()); await gone();
    await page.evaluate(() => syncTemperatureRecord());
    checks.push('AH/VPD card click isolation, complete humidity formula, battery methods, programmatic chart evidence, dynamically rendered rain help, invalidation');

    await page.locator('[data-page="analytics"]').click();
    await page.locator('#anaCard0 .info-trigger').hover(); await shown(); await bounds();
    assert.equal(await page.locator('#infoPopover #anaNote0').count(), 1);
    await page.evaluate(() => setNodeText(el('anaNote0'), 'Live updated diagnostic'));
    assert.match(await popup.innerText(), /Live updated diagnostic/);
    await page.locator('[data-page="modern"]').click(); await gone();
    await page.evaluate(() => setTheme('light'));
    await max.hover(); await shown(); await bounds();
    await page.screenshot({ path: path.join(options.output, 'modern-light-help.png') });
    await page.mouse.move(2, 500); await gone();
    checks.push('analytics help next to all nine headings, live notes, page switching, modern view, light theme');

    await page.setViewportSize({ width: 320, height: 640 });
    await max.scrollIntoViewIfNeeded(); await max.hover(); await shown(); await bounds();
    await page.screenshot({ path: path.join(options.output, 'narrow-help.png') });
    await page.mouse.move(2, 200); await gone();
    const context = page.context();
    // Emulate touch through CDP on the loaded page so fixtures/cache stay equal.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await page.setViewportSize({ width: 390, height: 844 });
    const tap = async locator => {
      await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tap(max); await shown(); await bounds();
    await page.screenshot({ path: path.join(options.output, 'mobile-help.png') });
    await tap(max); await gone();
    await tap(min); await shown();
    await tap(page.locator('#modernHeading')); await gone();
    await tap(max); await shown();
    await page.evaluate(() => switchStation(1)); await gone();
    checks.push('320px bounds, touch open/second tap/outside tap, station invalidation');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(options.output, 'result.json'), JSON.stringify({ browser: browser.version(), checks, pageErrors: errors, fixtures: 'Controlled CSV/UV, actual SRI-matching Chart.js/Paho' }, null, 2) + '\n');
    console.log(JSON.stringify({ checks, pageErrors: errors }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
