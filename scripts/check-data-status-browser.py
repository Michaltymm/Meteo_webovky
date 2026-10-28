"""Offline integration of record age, transport evidence and history scope.

Uses the three original configs, real SRI libraries and controlled CSV/UV.
No live service or MQTT broker is contacted.
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--chartjs', required=True)
parser.add_argument('--paho', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()


async def main():
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = [json.loads(Path(f).read_text(encoding='utf-8-sig')) for f in files]
    html = Path('index.html').read_bytes()
    chart = Path(args.chartjs).read_bytes()
    paho = Path(args.paho).read_bytes()
    now = datetime.fromisoformat('2026-10-23T12:00:00+02:00')
    failed = False
    future = False
    requests = []
    errors = []
    layouts = []
    mqtt_layouts = []
    sockets = []
    gate = asyncio.Event()
    gate.set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, timezone_id='Europe/Prague', reduced_motion='reduce', has_touch=True)
        await page.clock.set_fixed_time(now)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('websocket', lambda socket: sockets.append(socket.url))

        async def route(r):
            url = r.request.url
            name = urlparse(url).path.split('/')[-1]
            if url == 'http://meteo.test/dev/':
                await r.fulfill(body=html, content_type='text/html')
            elif 'chart.js' in url:
                await r.fulfill(body=chart, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            elif 'paho-mqtt' in url:
                await r.fulfill(body=paho, content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
            elif name in files:
                await r.fulfill(json=configs[files.index(name)])
            elif 'docs.google.com' in url:
                station = next(i for i, c in enumerate(configs) if c['sheetId'] in url)
                requests.append({'station': station})
                if station == 1:
                    await gate.wait()
                await asyncio.sleep(.06)  # Controlled transport latency, not a live service.
                if failed:
                    await r.fulfill(body='"unterminated CSV' if failed == 'syntax' else '<html>Controlled invalid export</html>', content_type='text/html')
                    return
                quick = 'LIMIT 400' in parse_qs(urlparse(url).query).get('tq', [''])[0]
                rows = ['Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti']
                for i in range(4 if quick else 8):
                    ts = now + timedelta(days=1) if future else now - timedelta(days=1, minutes=i*10)
                    voltage = '' if station == 2 else '0' if station == 1 else '4.12'
                    rows.append(f'{ts:%d.%m.%Y},{ts:%H:%M:%S},{18-station},1010,60,0,0,,{voltage}')
                rows += ['31.02.2026,12:00,999', 'missing,,999']
                await r.fulfill(body='\n'.join(rows), content_type='text/csv')
            elif 'api.open-meteo.com' in url:
                await r.fulfill(json={'hourly': {'uv_index': [0]*24}})
            else:
                await r.abort()

        await page.route('**/*', route)
        await page.goto('http://meteo.test/dev/')
        await page.wait_for_function('dataStatus.sheets.phase==="ok" && store.rows.length===4')
        assert await page.locator('#dataRecordAge').text_content() == 'Před 1 d 0 h'
        assert await page.locator('#dataHistoryScope').text_content() == 'Částečná historie'
        details = page.locator('#dataStatusDetails')
        summary = details.locator(':scope > summary')
        assert await details.evaluate('e=>!e.open')
        assert await page.locator('#dataRecordTime').is_hidden()
        assert await page.locator('#gsStatusText').is_hidden()
        assert await page.locator('#partialBadge').is_visible()
        assert 'Měření: Před 1 d' in await page.locator('#dataStatusSummary').inner_text()
        assert await page.locator('#mqttTransport').is_hidden()
        await page.wait_for_load_state('networkidle')
        before_toggle = len(requests)
        await page.evaluate('globalThis.disclosureRows=store.rows;globalThis.disclosureCharts=Object.keys(Chart.instances).length')
        await summary.focus()
        await summary.press('Enter')
        assert await details.evaluate('e=>e.open')
        assert await page.locator('#dataRecordTime').is_visible()
        assert await page.locator('#sheetsTransport').is_visible()
        await summary.press('Space')
        assert await details.evaluate('e=>!e.open')
        await summary.tap()
        assert await details.evaluate('e=>e.open')
        assert len(requests) == before_toggle
        assert await page.evaluate('store.rows===disclosureRows && Object.keys(Chart.instances).length===disclosureCharts')
        assert await page.evaluate('dataStatus.sheets.validation.accepted===4 && dataStatus.sheets.validation.rejected===2')
        assert await page.evaluate('''dataStatus.sheets.timing.scope==='partial' && dataStatus.sheets.timing.outcome==='ok' &&
          dataStatus.sheets.timing.transfer.ms>=40 && dataStatus.sheets.timing.parse.runs===1 && dataStatus.sheets.timing.ui.runs===1 &&
          dataStatus.sheets.timing.totalMs+1>=dataStatus.sheets.timing.transfer.ms+dataStatus.sheets.timing.parse.ms+dataStatus.sheets.timing.ui.ms''')
        before = len(requests)
        charts = await page.evaluate('Object.keys(Chart.instances).length')
        await page.locator('#dataValidationTrigger').click()
        await page.locator('#infoPopover').wait_for(state='visible')
        validation = page.locator('#dataValidationPanel')
        assert 'Přijato: 4 · Vyřazeno: 2' in await validation.inner_text()
        assert 'Záznam #6' in await validation.inner_text()
        assert await validation.locator('tbody tr').count() == 7
        assert 'ms' in await page.locator('#sheetsTimeTransfer').inner_text()
        assert await validation.locator('details').evaluate('e=>!e.open')
        await validation.locator('details summary').click()
        assert 'nikoli hotový snímek' in await validation.locator('details').inner_text()
        assert len(requests) == before
        assert await page.evaluate('Object.keys(Chart.instances).length') == charts
        await page.keyboard.press('Escape')
        assert await page.locator('#dataRecordTime').inner_text() != await page.locator('#dataLastSync').inner_text()
        await page.locator('.data-state [data-info-text]').click()
        assert 'nikoli nové měření' in await page.locator('#infoBody').inner_text()
        await summary.click()
        assert await details.evaluate('e=>!e.open')
        assert await page.locator('#infoPopover').is_hidden()
        await summary.click()
        await page.evaluate('globalThis.originalRows=store.rows;globalThis.recordTime=store.rows[0].ts.getTime()')
        await page.clock.set_fixed_time(now+timedelta(minutes=10))
        await page.evaluate('fetchSheets()')
        assert await page.evaluate('store.rows===originalRows && store.rows[0].ts.getTime()===recordTime && dataStatus.sheets.successAt===Date.now()')
        assert await page.evaluate('dataStatus.sheets.timing.unchanged && dataStatus.sheets.timing.parse.runs===0 && dataStatus.sheets.timing.ui.runs===0')
        await page.locator('#partialBadge').click()
        await page.wait_for_function('store.fullLoaded && dataStatus.sheets.phase==="ok"')
        assert await page.locator('#dataHistoryScope').inner_text() == 'Celý export zdroje'
        await page.evaluate('globalThis.originalRows=store.rows;globalThis.lastSuccess=dataStatus.sheets.successAt')
        await page.locator('#dataValidationTrigger').click()
        failed = True
        await page.clock.set_fixed_time(now+timedelta(minutes=20))
        await page.evaluate('fetchSheets(true)')
        assert await page.locator('#dataTransferState').inner_text() == 'Sheets: chyba obnovy'
        assert 'Chyba přenosu dat' in await page.locator('#dataStatusSummary').inner_text()
        assert await page.evaluate('dataStatus.sheets.timing.outcome==="error" && dataStatus.sheets.timing.transfer.runs===3 && dataStatus.sheets.timing.parse.runs===3 && dataStatus.sheets.timing.ui.runs===0')
        assert await page.evaluate('store.rows===originalRows && dataStatus.sheets.successAt===lastSuccess && store.fullLoaded')
        assert 'Před 10 min' in await page.locator('#dataLastSync').inner_text()
        assert await page.locator('#dataHistoryCount').inner_text() == 'Počet záznamů: 8'
        assert await page.locator('#infoPopover').is_visible()
        assert 'Export nebyl přijat' in await validation.inner_text()
        assert 'Obnova selhala' in await validation.inner_text()
        await page.keyboard.press('Escape')
        failed = False
        await page.evaluate('fetchSheets()')
        assert await page.locator('#dataTransferState').inner_text() == 'Sheets: ověřeno'
        await page.locator('#dataValidationTrigger').click()
        assert 'Přijato: 8 · Vyřazeno: 2' in await validation.inner_text()
        assert 'Export nebyl přijat' not in await validation.inner_text()
        assert await page.locator('#sheetsTimeParse').inner_text() == 'Neproběhlo'
        assert await page.locator('#sheetsTimeUi').inner_text() == 'Neproběhlo'
        await page.keyboard.press('Escape')
        before = len(requests)
        await page.clock.set_fixed_time(now+timedelta(minutes=21))
        await page.evaluate('updateVisibleDataStatus()')
        assert len(requests) == before
        assert 'Před 1 min' in await page.locator('#dataLastSync').inner_text()
        gate.clear()
        await page.evaluate('switchStation(1)')
        await page.wait_for_function('activeIdx===1 && dataStatus.sheets.phase==="loading"')
        assert await page.locator('#dataRecordTime').inner_text() == 'Zatím bez dat'
        assert await page.locator('#dataLastSync').inner_text() == 'Úspěšná kontrola: dosud žádná'
        assert await page.evaluate('dataStatus.sheets.validation===null')
        assert await page.evaluate('dataStatus.sheets.timing===null')
        gate.set()
        await page.wait_for_function('dataStatus.sheets.phase==="ok" && store.rows.length===4')
        assert await page.locator('#curVoltage').inner_text() == '0.00'
        assert await page.evaluate('dataStatus.sheets.validation.sensors[6].valid===4')
        await page.evaluate('switchStation(2)')
        await page.wait_for_function('activeIdx===2 && dataStatus.sheets.phase==="ok"')
        assert await page.locator('#curVoltage').inner_text() == '–'
        assert await page.evaluate('dataStatus.sheets.validation.sensors[6].empty===4')
        for view in ['main', 'modern', 'analytics']:
            await page.locator(f'[data-page="{view}"]').click()
            if view == 'analytics':
                # Charts intentionally initialize only when visible. At a narrow
                # viewport an expanded diagnostic panel can put them below fold.
                await page.locator('#anaGrid').scroll_into_view_if_needed()
                await page.wait_for_function('analyticsState.model!==null')
            for theme in ['darkblue', 'light']:
                await page.evaluate('(theme)=>setTheme(theme)', theme)
                for width in [1440, 800, 390, 320]:
                    await page.set_viewport_size({'width': width, 'height': 1000})
                    await page.wait_for_timeout(300)  # Chart.js resize is asynchronous.
                    assert await page.locator('.data-state').is_visible()
                    if await details.evaluate('e=>e.open'):
                        await summary.click()
                    compact_box = await details.bounding_box()
                    assert compact_box['height'] <= 112, (view, theme, width, compact_box)
                    assert await page.locator('#dataHistoryCount').is_hidden()
                    assert await page.locator('#dataRecordTime').is_hidden()
                    assert await page.locator('#gsStatusText').is_hidden()
                    assert await page.locator('#mqttTransport').is_hidden()
                    if view == 'modern' and width in [1440, 390, 320]:
                        await page.evaluate('scrollTo(0,0)')
                        await page.screenshot(path=str(output.with_name(f'compact-{theme}-{width}.png')))
                    await summary.click()
                    expanded_box = await details.bounding_box()
                    assert expanded_box['height'] > compact_box['height']+80, (view, theme, width)
                    assert await page.locator('#dataHistoryCount').is_visible()
                    overflow = await page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                    if overflow:
                        await page.screenshot(path=str(output.with_name('overflow.png')))
                        outside = await page.evaluate('''[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right})).slice(0,20)''')
                        raise AssertionError((view, theme, width, outside))
                    await page.locator('#dataValidationTrigger').click()
                    await page.locator('#infoPopover').wait_for(state='visible')
                    box = await page.locator('#infoPopover').bounding_box()
                    assert box['x'] >= 0 and box['x'] + box['width'] <= width+1, (view, theme, width, box)
                    assert await validation.evaluate('e=>e.scrollWidth<=e.clientWidth+1'), (view, theme, width)
                    if view == 'modern' and width in [1440, 320]:
                        await page.screenshot(path=str(output.with_name(f'validation-{theme}-{width}.png')))
                    await page.keyboard.press('Escape')
                    layouts.append({'view': view, 'theme': theme, 'width': width,
                                    'compactHeight': compact_box['height'], 'expandedHeight': expanded_box['height']})
                    if view == 'modern' and width in [1440, 320]:
                        await page.screenshot(path=str(output.with_name(f'state-{theme}-{width}.png')))
        # A short failure report can grow when its explanation is expanded.
        # Reposition it in the viewport rather than overflowing below its anchor.
        failed = 'syntax'
        await page.evaluate('fetchSheets(true)')
        await page.set_viewport_size({'width': 320, 'height': 700})
        await page.locator('#dataValidationTrigger').click()
        await validation.locator('details summary').click()
        await page.wait_for_timeout(100)
        box = await page.locator('#infoPopover').bounding_box()
        assert box['x'] >= 0 and box['y'] >= 0 and box['x']+box['width'] <= 321 and box['y']+box['height'] <= 701, box
        await page.keyboard.press('Escape')
        failed = False
        future = True
        await page.evaluate('fetchSheets(true)')
        assert 'budoucnosti' in await page.locator('#dataRecordAge').inner_text()
        assert await page.locator('#dataRecordTime').get_attribute('class') == 'data-state-warning'
        await summary.click()
        assert await details.evaluate('e=>!e.open')
        assert await page.locator('#dataRecordTime').is_hidden()
        assert 'Čas záznamu je v budoucnosti' in await page.locator('#dataStatusSummary').inner_text()
        assert await page.locator('#dataStatusSummary').get_attribute('class') == 'data-state-warning'
        failed = True
        await page.evaluate('fetchSheets(true)')
        assert await details.evaluate('e=>!e.open')
        assert 'Chyba přenosu dat' in await page.locator('#dataStatusSummary').inner_text()
        assert 'budoucnosti' in await page.locator('#dataStatusSummary').inner_text()
        assert await page.locator('#dataStatusSummary').get_attribute('class') == 'data-state-error'
        failed = False
        await summary.click()

        # Exercise the actual MQTT handler with a local Client double. The real
        # SRI Paho file was loaded, but no broker/socket is contacted by this QA.
        future = False
        await page.evaluate('fetchSheets(true)')
        await page.locator('[data-page="main"]').click()
        await page.wait_for_load_state('networkidle')
        await page.evaluate('''()=>{
          cancelStationWork();globalThis.realPahoClient=Paho.Client;
          globalThis.mqttTestClients=[];
          Paho.Client=class {
            constructor(){this.disconnected=0;mqttTestClients.push(this)}
            connect(options){this.options=options}
            subscribe(){}
            disconnect(){this.disconnected++}
          };
          CFG={...CFG,source:'both',mqttHost:'fixture.invalid'};
          connectMQTT();mqttClient.options.onSuccess();
          globalThis.deliver=body=>mqttClient.onMessageArrived({payloadString:body});
          globalThis.savedCSVReport=dataStatus.sheets.validation;
          globalThis.savedTiming=dataStatus.sheets.timing;
          globalThis.initialRowCount=store.rows.length;
          deliver('bad');deliver('[]');deliver('{}');
          deliver(JSON.stringify({secret:'private-fixture-<img src=x onerror=alert(1)>'}));
          deliver('{"temp":0,"voltage":"4,2"}');
        }''')
        assert await page.evaluate('dataStatus.mqtt.diagnostics.received===5 && dataStatus.mqtt.diagnostics.accepted===1 && dataStatus.mqtt.diagnostics.rejected===4')
        await page.locator('#dataValidationTrigger').click()
        await page.locator('#mqttDiagnostics summary').click()
        assert await page.locator('#mqttDiagAccepted').inner_text() == '1'
        assert await page.locator('#mqttDiagRejected').inner_text() == '4'
        assert 'private-fixture' not in await validation.inner_text()
        assert await validation.locator('img').count() == 0
        before = len(requests)
        charts = await page.evaluate('Object.keys(Chart.instances).length')
        await page.evaluate('globalThis.counterNode=el("mqttDiagAccepted");deliver("bad");deliver(\'{"temp":0}\')')
        assert await page.locator('#infoPopover').is_visible()
        assert await page.evaluate('el("mqttDiagAccepted")===counterNode && dataStatus.sheets.validation===savedCSVReport && dataStatus.sheets.timing===savedTiming')
        assert await page.locator('#mqttDiagAccepted').inner_text() == '2'
        assert await page.locator('#mqttDiagRejected').inner_text() == '5'
        assert await page.evaluate('store.rows.length===initialRowCount+2 && store.rows[0].temp===0')
        assert len(requests) == before
        assert await page.evaluate('Object.keys(Chart.instances).length') == charts
        await page.evaluate('''()=>{
          const refresh=refreshUI;refreshUI=()=>{throw new Error('private-render-fixture')};
          deliver('{"temp":0}');refreshUI=refresh;refreshUI();
        }''')
        assert await page.locator('#mqttDiagAccepted').inner_text() == '3'
        assert await page.locator('#mqttDiagProcessingErrors').inner_text() == '1'
        assert 'private-render-fixture' not in await validation.inner_text()
        await page.evaluate('globalThis.oldMQTT=mqttClient;connectMQTT();mqttClient.options.onSuccess();oldMQTT.onMessageArrived({payloadString:"bad"});deliver("bad")')
        assert await page.locator('#mqttDiagReceived').inner_text() == '9'
        await page.evaluate('deliver("x".repeat(65537))')
        assert await page.evaluate('mqttClient===null && mqttReconnectTimer===null && dataStatus.mqtt.diagnostics.reasons.SIZE_LIMIT===1')
        assert await page.locator('#mqttDiagReason-SIZE_LIMIT').inner_text() == '1'
        await page.keyboard.press('Escape')
        # Evidence popovers retain their existing invalidation behavior.
        await page.evaluate('connectMQTT();mqttClient.options.onSuccess()')
        await page.locator('[data-info-temperature="max"]').click()
        assert await page.locator('#infoPopover').is_visible()
        await page.evaluate('deliver(\'{"temp":0}\')')
        assert await page.locator('#infoPopover').is_hidden()

        await page.evaluate('cancelStationWork();resetStationStore();CFG={...CFG,source:"mqtt"};connectMQTT();mqttClient.options.onSuccess();deliver(\'{"temp":0}\')')
        assert await page.locator('#sheetsTransport').is_hidden()
        assert await page.locator('#mqttTransport').is_visible()
        assert 'Příjem:' in await page.locator('#dataStatusSummary').inner_text()
        for view in ['main', 'modern', 'analytics']:
            await page.locator(f'[data-page="{view}"]').click()
            await page.wait_for_load_state('networkidle')
            for theme in ['darkblue', 'light']:
                await page.evaluate('(theme)=>setTheme(theme)', theme)
                for width in [1440, 320]:
                    await page.set_viewport_size({'width': width, 'height': 1000})
                    await page.wait_for_timeout(150)
                    await page.clock.set_fixed_time(now+timedelta(minutes=30+len(mqtt_layouts)))
                    await page.locator('#dataValidationTrigger').scroll_into_view_if_needed()
                    await page.wait_for_timeout(100)  # Flush scrolling before opening a dismiss-on-scroll popup.
                    # The mixed-source case above exercises pointer opening and
                    # reading inside the popup. Cover keyboard opening here;
                    # it also avoids mouse-hover dismissal during viewport QA.
                    await page.locator('#dataValidationTrigger').focus()
                    await page.locator('#dataValidationTrigger').press('Enter')
                    assert await page.locator('#mqttDiagnostics').evaluate('e=>e.open')
                    accepted = await page.evaluate('dataStatus.mqtt.diagnostics.accepted')
                    await page.evaluate('deliver("bad");deliver(\'{"temp":0}\')')
                    assert await page.locator('#infoPopover').is_visible(), (view,theme,width)
                    assert await page.locator('#mqttDiagAccepted').inner_text() == str(accepted+1)
                    box = await page.locator('#infoPopover').bounding_box()
                    assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=1001, box
                    assert await validation.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                    if view == 'modern':
                        await page.screenshot(path=str(output.with_name(f'mqtt-{theme}-{width}.png')))
                    await page.keyboard.press('Escape')
                    mqtt_layouts.append({'view':view,'theme':theme,'width':width})
        await page.evaluate('globalThis.staleMQTT=mqttClient;switchStation(1);Paho.Client=realPahoClient;staleMQTT.onMessageArrived({payloadString:"bad"})')
        await page.wait_for_function('activeIdx===1 && dataStatus.sheets.phase==="ok"')
        assert await page.evaluate('dataStatus.mqtt.diagnostics.received===0')
        assert not sockets, sockets
        assert not errors, errors
        version = browser.version
        await browser.close()
    output.write_text(json.dumps({'browser': version, 'pageErrors': errors, 'layouts': layouts, 'mqttLayouts':mqtt_layouts, 'webSockets':len(sockets),
        'checks': ['old record vs new validation', 'unchanged quick export', 'full history',
                   'invalid HTTP200 retains last success/rows', 'recovery', 'minute update without fetch',
                   'station reset before delayed CSV', 'zero/missing voltage', 'three pages/two themes', 'future time',
                   'CSV counts/rejection reasons/positions', 'diagnostics without fetch/new Chart', 'diagnostic popup bounds in all layouts',
                   'controlled 60ms transport and separate parser/UI timings', 'no stale costs for unchanged exports', 'failure/recovery timings',
                   'collapsed timing explanation', 'expanded short error report stays in viewport',
                   'native disclosure closed on load, Enter/Space/touch, no fetch/Chart/row replacement',
                   'closing disclosure dismisses help; inactive sources hidden', 'compact/expanded heights in 24 layouts',
                   'future and simultaneous transfer error visible with details closed',
                   'MQTT counts/reasons/private content excluded', 'live popup survives accepted MQTT with stable counter nodes',
                   'processing error after commit', 'reconnect/size stop/stale clients', 'evidence popup invalidation', 'pure MQTT 12 layouts and station reset'],
        'transport': 'Controlled CSV/UV; real Chart.js and Paho with SRI; MQTT Client double, no broker/socket'}, indent=2)+'\n')
    print(output)


asyncio.run(main())
