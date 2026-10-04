import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
function build(name, env = {}) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, '--filter', name, 'build'],
    { stdio: 'inherit', env: { ...process.env, ...env } },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
build('@lipiflow/web', { VITE_LIPIFLOW_EDITION: 'hosted' });
build('@lipiflow/admin');
const destination = path.resolve('apps/server/dist');
if (destination !== path.join(process.cwd(), 'apps', 'server', 'dist'))
  throw new Error('Unexpected build destination');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
fs.cpSync('apps/web/dist-hosted', destination, { recursive: true });
fs.cpSync('apps/admin/dist', path.join(destination, 'admin'), { recursive: true });
console.log('Hosted Vercel site and admin app prepared in apps/server/dist.');
