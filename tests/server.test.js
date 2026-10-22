const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { createServer } = require('../server');

describe('static server document root', () => {
  let directory, server, port;
  const privateContent = 'private fixture: must never be served';

  before(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meteo-server-'));
    const root = path.join(directory, 'public');
    const sibling = path.join(directory, 'public-backup');
    fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>Meteo fixture</h1>');
    fs.writeFileSync(path.join(root, 'config.json'), '{"source":"sheets"}');
    fs.writeFileSync(path.join(root, 'nested', 'style sheet.css'), 'body { color: blue; }');
    fs.writeFileSync(path.join(root, 'app.js'), 'console.log("fixture");');
    fs.writeFileSync(path.join(root, '.env'), privateContent);
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), privateContent);
    fs.writeFileSync(path.join(root, 'nested', '.hidden'), privateContent);
    fs.writeFileSync(path.join(directory, 'private.txt'), privateContent);
    fs.writeFileSync(path.join(sibling, 'private.txt'), privateContent);
    fs.symlinkSync(path.join(directory, 'private.txt'), path.join(root, 'external-file'));
    fs.symlinkSync(sibling, path.join(root, 'external-dir'));
    fs.symlinkSync(path.join(sibling, 'private.txt'), path.join(root, 'sibling-file'));
    fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'public-link'));
    fs.symlinkSync(path.join(root, '.env'), path.join(root, 'hidden-alias'));
    fs.symlinkSync(path.join(root, '.git'), path.join(root, 'metadata-alias'));
    server = createServer(root);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  // Use a raw request path: fetch/URL would normalize away traversal attempts.
  function request(requestPath, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: requestPath, method }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('serves the dashboard, JSON, JavaScript and encoded public filenames', async () => {
    const routes = [
      ['/', '<h1>Meteo fixture</h1>', 'text/html'],
      ['/index.html?cache=1', '<h1>Meteo fixture</h1>', 'text/html'],
      ['/config.json', '{"source":"sheets"}', 'application/json'],
      ['/app.js', 'console.log("fixture");', 'application/javascript'],
      ['/nested/style%20sheet.css', 'body { color: blue; }', 'text/css'],
    ];
    for (const [route, content, type] of routes) {
      const res = await request(route);
      assert.equal(res.status, 200, route);
      assert.equal(res.body, content, route);
      assert.equal(res.headers['content-type'], type, route);
      assert.equal(res.headers['access-control-allow-origin'], undefined, route);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', route);
    }
  });

  it('allows only read methods and applies local response protections to errors too', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await request('/index.html', method);
      assert.equal(res.status, 405);
      assert.equal(res.headers.allow, 'GET, HEAD');
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin');
    }
    const head = await request('/index.html', 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, '');
    const missing = await request('/missing');
    assert.equal(missing.headers['x-content-type-options'], 'nosniff');
    assert.equal(missing.headers['x-frame-options'], 'DENY');
    assert.equal(server.headersTimeout, 10000);
    assert.equal(server.requestTimeout, 30000);
  });

  it('returns 404 for missing files and directories', async () => {
    for (const route of ['/missing.json', '/nested', '/nested/']) {
      assert.equal((await request(route)).status, 404, route);
    }
  });

  it('rejects raw and encoded parent traversal', async () => {
    for (const route of [
      '/../private.txt', '/../../private.txt', '/nested/../../private.txt',
      '/%2e%2e/private.txt', '/%2E%2E%2Fprivate.txt', '/nested/%2e%2e/%2e%2e/private.txt',
    ]) {
      const res = await request(route);
      assert.equal(res.status, 403, route);
      assert.ok(!res.body.includes(privateContent), route);
    }
  });

  it('rejects hidden files and metadata at every path depth', async () => {
    for (const route of ['/.git/HEAD', '/.env', '/nested/.hidden', '/%2egit/HEAD']) {
      const res = await request(route);
      assert.equal(res.status, 403, route);
      assert.ok(!res.body.includes(privateContent), route);
    }
  });

  it('rejects symlinks outside the root and aliases to hidden content', async () => {
    for (const route of [
      '/external-file', '/external-dir/private.txt', '/sibling-file',
      '/hidden-alias', '/metadata-alias/HEAD',
    ]) {
      const res = await request(route);
      assert.equal(res.status, 403, route);
      assert.ok(!res.body.includes(privateContent), route);
    }
    // Symlinks to public content inside the root remain useful for local assets.
    const res = await request('/public-link');
    assert.equal(res.status, 200);
    assert.equal(res.body, '<h1>Meteo fixture</h1>');
  });

  it('returns 400 for invalid encodings, NUL and backslashes without crashing', async () => {
    for (const route of ['/%', '/%GG', '/%E0%A4%A', '/%C0%AF', '/index.html%00', '/..\\private.txt', '/%5cprivate.txt']) {
      assert.equal((await request(route)).status, 400, route);
    }
    const res = await request('/');
    assert.equal(res.status, 200);
    assert.equal(res.body, '<h1>Meteo fixture</h1>');
  });
});
