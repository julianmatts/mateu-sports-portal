const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.argv[2] || 3456;
const root = process.argv[3] || '.';
const mime = {
  '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.xlsx':'application/octet-stream',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const full = path.join(root, p);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('static-server listening on ' + port));
