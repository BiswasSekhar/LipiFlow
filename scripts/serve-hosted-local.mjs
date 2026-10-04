import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps/server/dist');
const adminRoot = path.join(root, 'admin');
const port = Number(process.env.LIPIFLOW_TEST_PORT ?? 4174);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff2', 'font/woff2'],
]);

function proxyApi(request, response) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: 8787,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: '127.0.0.1:8787' },
    },
    (result) => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
    response.end('The local font API is unavailable.');
  });
  request.pipe(upstream);
}

function within(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

http
  .createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(request, response);
    if (pathname === '/admin') {
      response.writeHead(302, { Location: '/admin/' });
      response.end();
      return;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const admin = decoded.startsWith('/admin/');
    const base = admin ? adminRoot : root;
    const relative = admin ? decoded.slice('/admin/'.length) : decoded.replace(/^\/+/, '');
    let file = path.resolve(base, relative || 'index.html');
    if (!within(base, file)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.statSync(file).isFile()) throw new Error('not a file');
    } catch {
      file = path.join(base, 'index.html');
    }
    response.writeHead(200, {
      'Content-Type': mime.get(path.extname(file)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, '127.0.0.1', () => console.log(`Hosted local test site: http://127.0.0.1:${port}`));
