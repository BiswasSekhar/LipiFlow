import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Serve the actual release artifact on a private port for update/outage tests. */
export async function artifactServer() {
  const root = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));
  let revision = 0;
  const types: Record<string, string> = {
    js: 'application/javascript',
    wasm: 'application/wasm',
    html: 'text/html',
    css: 'text/css',
    woff2: 'font/woff2',
    json: 'application/json',
    webmanifest: 'application/manifest+json',
    svg: 'image/svg+xml',
    png: 'image/png',
    txt: 'text/plain',
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(resolve(root) + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      let bytes = await readFile(file);
      if (pathname === '/sw.js')
        bytes = Buffer.concat([bytes, Buffer.from(`\n// Acceptance test release ${revision}\n`)]);
      response.setHeader(
        'Content-Type',
        types[file.split('.').at(-1)!] ?? 'application/octet-stream',
      );
      response.setHeader('Cache-Control', 'no-store');
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test origin');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    revise: () => {
      revision++;
    },
    stop: async () => {
      if (!server.listening) return;
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}
