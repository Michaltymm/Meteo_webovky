const fs = require('node:fs');
const path = require('node:path');

// Explicit public assets: do not publish source tools, audits, tests or Git metadata.
const PUBLIC_FILES = [
  'index.html',
  'config.json',
  'config_praha_baterie.json',
  'config_praha_okno.json',
  'config_stanice3.json'
];

function buildPages(production, development, output) {
  // Read and validate both versions before creating any output. A missing development
  // branch or asset must fail the build instead of replacing it with production.
  const files = [];
  for (const [source, prefix] of [[production, ''], [development, 'dev']]) {
    for (const name of PUBLIC_FILES) {
      const file = path.join(source, name);
      if (!fs.lstatSync(file).isFile()) {
        throw new Error(`Expected a regular public file: ${file}`);
      }
      files.push([path.join(prefix, name), fs.readFileSync(file)]);
    }
  }

  // Require a fresh directory so old artifacts cannot leak into a deployment.
  fs.mkdirSync(output);
  fs.mkdirSync(path.join(output, 'dev'));
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(output, name), content);
  }
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
}

if (require.main === module) {
  const [production, development, output] = process.argv.slice(2);
  if (!production || !development || !output) {
    console.error('Usage: node scripts/build-pages.js <main-directory> <codex-dev-directory> <new-output-directory>');
    process.exitCode = 1;
  } else {
    buildPages(production, development, output);
  }
}

module.exports = { buildPages };
