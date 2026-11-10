// Local stand-in for the production Nginx site: serves dist/ with the same Content-Security-Policy
// and proxies /api/ to a local participation API, answering JSON 503 when it is not running.
// Usage: node scripts/serve.mjs [--port 4173] [--api http://127.0.0.1:8787]
import {createServer, request as httpRequest} from 'node:http';
import {readFileSync, statSync, createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const option = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const port = Number(option('port', process.env.PORT || 4173));
const api = new URL(option('api', process.env.INDIEK_API_URL || 'http://127.0.0.1:8787'));
// The policy comes from deploy/nginx.conf; only the HTTPS upgrade is dropped for plain-HTTP localhost.
const csp = readFileSync(path.join(root, 'deploy/nginx.conf'), 'utf8').match(/add_header Content-Security-Policy "([^"]+)"/)[1].replace(/;\s*upgrade-insecure-requests/, '');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.ttf':'font/ttf', '.xml':'application/xml', '.txt':'text/plain'};
const json = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };

function proxy(req, res) {
  const upstream = httpRequest({
    host:api.hostname, port:api.port, method:req.method, path:req.url,
    headers:{...req.headers, host:api.host, cookie:'', authorization:'', 'x-real-ip':req.socket.remoteAddress},
    timeout:10000,
  }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!res.headersSent) json(res, 503, {error:'unavailable'}); else res.destroy(); });
  req.pipe(upstream);
}

createServer((req, res) => {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return proxy(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  try { if (statSync(file).isDirectory()) file = path.join(file, 'index.html'); statSync(file); }
  catch { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist/ on http://127.0.0.1:${port} with the production CSP; /api/ → ${api.origin}`);
  console.log(`Start the API with INDIEK_API_ALLOWED_ORIGINS=http://127.0.0.1:${port} so browser posts are accepted.`);
});
