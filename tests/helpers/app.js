const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual application code, leaving automatic startup to the tests.
// UI/Chart.js and transports are replaced; cancellation deliberately does not
// settle the fake fetch, so late results exercise guards as well as AbortSignal.
function app({ realRefresh = false } = {}) {
  const html = fs.readFileSync(process.env.METEO_TEST_HTML || path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1].split('// Init: téma, stanice, config')[0];
  const requests = [], timers = new Map(), nodes = new Map(), clients = [], readers = [];
  let timerId = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: '', innerHTML: '', value: '', style: {}, disabled: false,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, getContext() { return {}; }
    });
    return nodes.get(id);
  };
  const storage = new Map();
  const context = vm.createContext({
    document: { getElementById: node, querySelectorAll: () => [], querySelector: () => null, body: {} },
    location: { pathname: '/Meteo_webovky/dev/', protocol: 'https:' },
    window: {}, console: { log() {}, warn() {} }, AbortController, AbortSignal,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    Chart: class {
      constructor(ctx, config) { Object.assign(this, config); this.config = config; this.updates = 0; }
      update() { this.updates++; }
      resize() {}
    },
    fetch(url, options) {
      const deferred = Promise.withResolvers();
      requests.push({ url, ...options, ...deferred });
      return deferred.promise;
    },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return ++timerId; }, clearInterval() {},
    Paho: { Client: class {
      constructor(...args) { this.args = args; this.disconnected = 0; this.topics = []; clients.push(this); }
      connect(options) { this.options = options; }
      disconnect() { this.disconnected++; }
      subscribe(topic) { this.topics.push(topic); }
    } },
    FileReader: class {
      constructor() { readers.push(this); }
      readAsText() {}
    }
  });
  vm.runInContext(source, context, { filename: 'index.html' });
  const state = { gs: [], mqtt: [], starts: 0, renders: 0 };
  Object.assign(context, {
    ...(realRefresh ? {} : { refreshUI() { state.renders++; } }),
    updateSunBar() {}, updateStationUI() {}, fillConfigUI() {}, updateOvBar() {},
    setGsStatus: (ok, text) => state.gs.push({ ok, text }),
    setMqttStatus: (ok, text) => state.mqtt.push({ ok, text }),
    startAll: () => { state.starts++; }
  });
  return {
    run: code => vm.runInContext(code, context), requests, timers, nodes, clients, readers, state,
    respond(index, body, status = 200) {
      requests[index].resolve({
        ok: status === 200, status,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(body).then(JSON.parse)
      });
    },
    tick(delay = 10) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.fn(); }
      }
    }
  };
}

module.exports = { app };
