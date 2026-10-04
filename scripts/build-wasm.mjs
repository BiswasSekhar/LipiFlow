import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wasm-pack/run.js',
    'build',
    'core/lipiflow-wasm',
    '--target',
    'web',
    '--release',
    '--no-pack',
    '--out-name',
    'lipiflow_wasm',
  ],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
