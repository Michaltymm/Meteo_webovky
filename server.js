const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  let file = path.join(process.cwd(), urlPath === '/' ? 'index.html' : urlPath);
  try {
    const content = fs.readFileSync(file);
    const ext = path.extname(file);
    const types = {
      '.html': 'text/html',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.css': 'text/css'
    };
    res.writeHead(200, {
      'Content-Type': types[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found: ' + req.url);
  }
});

server.listen(8080, () => console.log('Server running at http://localhost:8080'));
