// Local preview for this static workspace; binds only to loopback.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.wasm': 'application/wasm', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
const open = process.argv.includes('--open');
const port = Number(process.env.PORT || 8089);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('PORT must be 1–65535');
const url = `http://127.0.0.1:${port}/#showcase`;
function openBrowser() {
  console.log('Opening Microsoft Edge: ' + url);
  const browser = require('node:child_process').spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [url], { windowsHide:true, stdio:'inherit' });
  function failed(message) { console.error('Could not open the browser: ' + message + '\nOpen this address manually: ' + url); process.exitCode = 1; }
  browser.on('error', error => failed(error.message));
  browser.on('exit', code => { if (code !== 0) failed('exit code ' + code); });
}
server.on('error', error => {
  if (!open || error.code !== 'EADDRINUSE') throw error;
  // Reuse the listener only if it serves this project's current entry page.
  http.get(url, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => body += chunk);
    response.on('end', () => {
      if (response.statusCode === 200 && body === fs.readFileSync(path.join(root, 'index.html'), 'utf8')) openBrowser();
      else { console.error(`Port ${port} is occupied by another site. Close that preview and retry.`); process.exitCode = 1; }
    });
  }).on('error', error => { console.error(error.message); process.exitCode = 1; });
});
server.listen(port, '127.0.0.1', () => { console.log('Preview: ' + url); if (open) openBrowser(); });
