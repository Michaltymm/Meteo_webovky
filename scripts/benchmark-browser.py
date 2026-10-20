"""Manual, offline browser benchmark. Requires Python Playwright and Chromium.

python scripts/benchmark-browser.py --html index.html --chartjs /path/to/chart.js \
    --output /tmp/benchmark.json
Chart.js must be the same 4.4.0 version used by the page. No network is used.
Times measure synchronous JS + real Chart.js update, not Web Vitals or network.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--html", default="index.html")
parser.add_argument("--chartjs", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
html = Path(args.html).read_text()
# Keep real UI and application, suppress automatic configuration/network startup.
html = html.split("// Init: téma, stanice, config")[0] + "</script></body></html>"
chart = Path(args.chartjs).read_text()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
    for count in (1000, 10000, 100000):
        page = browser.new_page(viewport={"width": 1280, "height": 900}, timezone_id="Europe/Prague")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def route(request):
            url = request.request.url
            if url.endswith("/index.html"):
                request.fulfill(body=html, content_type="text/html")
            elif "chart.js" in url:
                request.fulfill(body=chart, content_type="text/javascript")
            else:
                request.abort()

        page.route("**/*", route)
        page.goto("http://meteo.test/dev/index.html")
        page.evaluate("""count => {
          const now = Date.now();
          store.rows = Array.from({length: count}, (_, i) => ({
            ts: new Date(now - i * 300000), date: "20.10.2026", time: "12:00",
            temp: i === 17 ? 85 : 10 + 8 * Math.sin(i / 40),
            hum: 60 + 20 * Math.sin(i / 33), pressure: 1010 + Math.cos(i / 100),
            voltage: 4 + .1 * Math.sin(i / 80), rain: i % 48 / 10,
            rainInc: 0, tank: null, note: ""
          }));
          store.fullLoaded = true;
          globalThis.chartUpdates = 0;
          const update = Chart.prototype.update;
          Chart.prototype.update = function(...args) {
            chartUpdates++;
            return update.apply(this, args);
          };
          globalThis.showTab = tab => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === "tab-" + tab));
          };
        }""", count)
        samples = []
        for repeat in range(5):
            samples.append(page.evaluate("""() => {
              const measure = fn => {
                const t = performance.now();
                try { fn(); return {ms: +(performance.now()-t).toFixed(2)}; }
                catch(e) { return {error: String(e)}; }
              };
              showTab("now"); chartUpdates = 0;
              const current = measure(() => refreshUI());
              current.updates = chartUpdates;
              showTab("explorer"); expRange = "all"; el("expMetric").value = "temp_hum";
              const explorer = measure(() => buildExplorer());
              explorer.points = chartExplorer.data.labels.length;
              explorer.stats = el("expStats").textContent.replace(/\\s+/g, " ").trim();
              el("expSliderL").value = "20"; el("expSliderR").value = "80";
              const slider = measure(() => expSliderUpdate());
              return {current, explorer, slider};
            }"""))
            page.wait_for_timeout(350)
        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate('buildExplorer()')
        page.wait_for_timeout(350)
        smoke = page.evaluate("""() => {
          const failures = [];
          for (const tab of ["now","daily","rain","monthly","yearly","compare","overview","yearstats","hist","notes"]) {
            try { showTab(tab); tabDirtyState[tab] = true; refreshTab(tab); }
            catch(e) { failures.push(tab + ": " + e); }
          }
          showTab("explorer");
          for (const metric of ["temp","hum","temp_hum","pressure","dew","rain","rainInc","voltage"]) {
            try { el("expMetric").value = metric; buildExplorer(); }
            catch(e) { failures.push(metric + ": " + e); }
          }
          return failures;
        }""")
        page.wait_for_timeout(350)
        results.append({"rows": count, "samples": samples, "pageErrors": errors,
                        "smokeFailures": smoke,
                        "mobileOverflow": page.evaluate("document.documentElement.scrollWidth > innerWidth")})
        page.close()
    version = browser.version
    browser.close()
Path(args.output).write_text(json.dumps({"browser": version, "results": results}, indent=2))
print(args.output)
if any(r["pageErrors"] or r["smokeFailures"] or r["mobileOverflow"] or
       any("error" in sample[key] for sample in r["samples"] for key in ("current", "explorer", "slider"))
       for r in results):
    raise SystemExit("Browser benchmark reported errors; inspect the JSON report.")
