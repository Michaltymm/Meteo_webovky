"""Local-only SRI acceptance/tampering checks against script tags from index.html."""
import argparse
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--chartjs', required=True)
parser.add_argument('--paho', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()

async def main():
    tags = re.findall(r'<script src="https:[^>]+></script>', Path('index.html').read_text())
    assert len(tags) == 2 and all('integrity="sha384-' in tag and 'crossorigin="anonymous"' in tag for tag in tags)
    assets = {'chart.js': Path(args.chartjs).read_bytes(), 'paho-mqtt': Path(args.paho).read_bytes()}
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for tampered in [False, True]:
            page = await browser.new_page()
            errors = []
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            async def route(r):
                if r.request.url == 'https://meteo.test/':
                    await r.fulfill(body='<!doctype html>'+''.join(tags), content_type='text/html')
                    return
                for name, body in assets.items():
                    if name in r.request.url:
                        if tampered: body += b'\n;globalThis.untrustedExecuted=true;'
                        await r.fulfill(body=body, content_type='application/javascript', headers={'Access-Control-Allow-Origin':'*'})
                        return
                await r.abort()
            await page.route('**/*', route)
            await page.goto('https://meteo.test/')
            loaded = await page.evaluate('typeof Chart === "function" && typeof Paho?.Client === "function"' if not tampered else 'typeof Chart !== "undefined" || typeof Paho !== "undefined" || !!globalThis.untrustedExecuted')
            if tampered:
                assert not loaded
                assert len([e for e in errors if 'integrity' in e.lower()]) == 2
            else:
                assert loaded and not errors, errors
            results.append({'tampered': tampered, 'passed': True, 'expectedIntegrityErrors': len(errors)})
            await page.close()
        version = browser.version
        await browser.close()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'browser':version,'results':results}, indent=2)+'\n')
    print(output)

asyncio.run(main())
