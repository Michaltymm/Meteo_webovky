"""Real Paho with offline CSV/CDN and a mocked MQTT WebSocket."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chartjs', required=True)
    parser.add_argument('--paho', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    html = Path('index.html').read_bytes()
    chart = Path(args.chartjs).read_bytes()
    paho = Path(args.paho).read_bytes()
    files = ['config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']
    configs = {name: json.loads(Path(name).read_text(encoding='utf-8-sig')) for name in files}
    checks = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for scenario in ['sheets', 'switch', 'failed']:
            page = await browser.new_page(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Prague')
            await page.clock.set_fixed_time('2026-11-24T12:00:00Z')
            chart_gate, paho_gate = asyncio.Event(), asyncio.Event()
            errors, requests, sockets, subscriptions = [], [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def route(request):
                url = request.request.url
                parsed = urlparse(url)
                name = parsed.path.split('/')[-1]
                if parsed.hostname == 'meteo.test' and parsed.path == '/dev/':
                    return await request.fulfill(body=html, content_type='text/html')
                if 'chart.js' in url:
                    await chart_gate.wait()
                    return await request.fulfill(body=chart, content_type='application/javascript',
                                                 headers={'Access-Control-Allow-Origin': '*'})
                if 'paho-mqtt' in url:
                    requests.append('paho')
                    await paho_gate.wait()
                    if scenario == 'failed':
                        return await request.abort('failed')
                    return await request.fulfill(body=paho, content_type='application/javascript',
                                                 headers={'Access-Control-Allow-Origin': '*'})
                if name in configs:
                    config = dict(configs[name])
                    if scenario != 'sheets' and name in files[:2]:
                        index = files.index(name)
                        config.update(source='mqtt' if index == 0 else 'both',
                                      mqttHost=f'mqtt-{index}.test', mqttJson=f'weather/{index}')
                    return await request.fulfill(json=config)
                if parsed.hostname == 'docs.google.com':
                    index = next(i for i, file in enumerate(files) if configs[file]['sheetId'] in parsed.path)
                    body = ('Datum,Cas,Teplota,Tlak,Vlhkost,Prirustek,Dest,Nadrz,Napeti\n'
                            f'24.11.2026,12:00,{20 + index},1010,60,0,0,,4')
                    return await request.fulfill(body=body, content_type='text/csv')
                if parsed.hostname == 'api.open-meteo.com':
                    return await request.fulfill(json={'hourly': {'uv_index': [0] * 24}})
                return await request.abort()

            def route_socket(socket):
                sockets.append(socket.url)

                def receive(packet):
                    if packet[0] == 0x10:  # CONNECT / CONNACK
                        socket.send(b'\x20\x02\x00\x00')
                    elif packet[0] == 0x82:  # SUBSCRIBE / SUBACK, one short test topic
                        length = int.from_bytes(packet[4:6], 'big')
                        topic = packet[6:6 + length]
                        subscriptions.append(topic.decode('ascii'))
                        socket.send(b'\x90\x03' + packet[2:4] + b'\x00')
                        payload = len(topic).to_bytes(2, 'big') + topic + b'{"temp":27,"voltage":0}'
                        socket.send(bytes([0x30, len(payload)]) + payload)

                socket.on_message(receive)

            await page.route('**/*', route)
            await page.route_web_socket('**/*', route_socket)
            await page.goto('https://meteo.test/dev/#moderni2', wait_until='commit')
            if scenario == 'sheets':
                await page.wait_for_function('document.getElementById("simpleTemp")?.textContent==="20.0"')
                assert await page.evaluate('mqttLibraryPhase==="idle" && typeof Paho==="undefined"')
                assert not requests and not sockets
            else:
                await page.wait_for_function('typeof mqttLibraryPhase!=="undefined" && mqttLibraryPhase==="loading"')
                await page.select_option('#simpleStation', '1')
                await page.wait_for_function('activeIdx===1 && el("simpleTemp").textContent==="21.0"')
                assert not sockets
                paho_gate.set()
                if scenario == 'switch':
                    await page.wait_for_function('dataStatus.mqtt.phase==="connected" && el("simpleTemp").textContent==="27.0"')
                    assert subscriptions == ['weather/1']
                    assert len(sockets) == 1 and sockets[0].startswith('wss://mqtt-1.test:')
                    assert await page.evaluate('store.rows[0].voltage===0 && !chartLibraryReady()')
                else:
                    await page.wait_for_function('mqttLibraryPhase==="error" && dataStatus.mqtt.phase==="error"')
                    assert await page.locator('#simpleTemp').inner_text() == '21.0'
                    assert not sockets
                assert requests == ['paho']
            chart_gate.set()
            await page.wait_for_load_state('load')
            assert not errors, (scenario, errors)
            checks.append(scenario)
            await page.close()
        await browser.close()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'checks': checks, 'pageErrors': []}, indent=2)+'\n')
    print(output)


if __name__ == '__main__':
    asyncio.run(main())
