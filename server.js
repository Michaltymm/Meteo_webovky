const http = require('http');
const fs = require('fs');
const path = require('path');

function isPublicPath(root, file) {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative)
    && !relative.split(path.sep).some(segment => segment.startsWith('.'));
}

function createServer(rootDir = __dirname) {
  const root = fs.realpathSync(rootDir);
  const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    let urlPath;
    try {
      // Decode before validating, without URL normalization hiding dot segments.
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    if (!urlPath.startsWith('/') || /[\0\\]/.test(urlPath)) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    // Metadata and parent segments are never public, even if they normalize inside root.
    if (urlPath.split('/').some(segment => segment.startsWith('.'))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const requestedFile = path.resolve(root, '.' + (urlPath === '/' ? '/index.html' : urlPath));
    try {
      // Resolve symlinks as well: a lexical prefix alone cannot contain their targets.
      const file = fs.realpathSync(requestedFile);
      if (!isPublicPath(root, file)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.statSync(file).isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const content = fs.readFileSync(file);
      const ext = path.extname(file);
      const types = {
        '.html': 'text/html',
        '.json': 'application/json',
        '.js': 'application/javascript',
        '.css': 'text/css'
      };
      res.writeHead(200, {
        'Content-Type': types[ext] || 'text/plain'
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (require.main === module) {
  const host = process.env.METEO_PREVIEW_HOST || '127.0.0.1';
  createServer().listen(8080, host, () => console.log(`Server running at http://${host}:8080`));
}

module.exports = { createServer };
