const http = require('http');
const fs = require('fs');
const path = require('path');

const publicFolder = path.join(__dirname, 'bomberGame');
console.log("----",__dirname);


const server = http.createServer((req, res) => {
let filePath = path.join(publicFolder, req.url === '/' ? 'index.html' : req.url);

  const ext = path.extname(filePath).slice(1);

  // Content-Type mapping
  const mimeTypes = {
    'html': 'text/html',
    'js': 'text/javascript',
    'css': 'text/css',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'gif': 'image/gif',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Page Not Found (404)');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Bomberman server taykhdem 3la http://localhost:${PORT}`);
});
