const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { buildPages } = require('../scripts/build-pages');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meteo-pages-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const production = path.join(directory, 'main');
  const development = path.join(directory, 'codex-dev');
  for (const [source, label] of [[production, 'stable'], [development, 'preview']]) {
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'index.html'), `<html>${label}</html>`);
    for (const name of ['config.json', 'config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']) {
      fs.writeFileSync(path.join(source, name), JSON.stringify({ name, label }));
    }
    fs.writeFileSync(path.join(source, '.env'), 'private fixture');
    fs.writeFileSync(path.join(source, 'server.js'), 'not a website asset');
    fs.mkdirSync(path.join(source, 'docs'));
    fs.writeFileSync(path.join(source, 'docs', 'audit.md'), 'not a website asset');
  }
  return { production, development, output: path.join(directory, 'site') };
}

test('publishes distinct main/dev pages and branch-specific configs, without private/tooling files', t => {
  const { production, development, output } = fixture(t);
  buildPages(production, development, output);
  assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), '<html>stable</html>');
  assert.equal(fs.readFileSync(path.join(output, 'dev', 'index.html'), 'utf8'), '<html>preview</html>');
  for (const name of ['config.json', 'config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, name))).label, 'stable');
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'dev', name))).label, 'preview');
  }
  assert.deepEqual(fs.readdirSync(output).sort(), [
    '.nojekyll', 'config.json', 'config_praha_baterie.json', 'config_praha_okno.json',
    'config_stanice3.json', 'dev', 'index.html'
  ]);
  assert.deepEqual(fs.readdirSync(path.join(output, 'dev')).sort(), [
    'config.json', 'config_praha_baterie.json', 'config_praha_okno.json', 'config_stanice3.json', 'index.html'
  ]);
});

test('a missing development asset fails before creating a partial website', t => {
  const { production, development, output } = fixture(t);
  fs.unlinkSync(path.join(development, 'config_stanice3.json'));
  assert.throws(() => buildPages(production, development, output), { code: 'ENOENT' });
  assert.equal(fs.existsSync(output), false);
});

test('rejects symlinks rather than publishing files outside the asset list', t => {
  const { production, development, output } = fixture(t);
  fs.unlinkSync(path.join(development, 'config.json'));
  fs.symlinkSync(path.join(development, '.env'), path.join(development, 'config.json'));
  assert.throws(() => buildPages(production, development, output), /regular public file/);
  assert.equal(fs.existsSync(output), false);
});

test('never merges a new build into a directory containing stale artifacts', t => {
  const { production, development, output } = fixture(t);
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, 'old-secret.txt'), 'existing content');
  assert.throws(() => buildPages(production, development, output), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(path.join(output, 'old-secret.txt'), 'utf8'), 'existing content');
  assert.equal(fs.existsSync(path.join(output, 'index.html')), false);
});
