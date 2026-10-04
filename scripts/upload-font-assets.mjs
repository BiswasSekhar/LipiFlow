import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
function enabled(name) {
  return args.includes(name);
}
function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...values] = rows;
  const keys = header.map((key) => key.replace(/^\uFEFF/, '').trim());
  return values.map((values) =>
    Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ''])),
  );
}
function quote(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}
async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile() && /\.(?:ttf|otf)$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}
async function run(command, params, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, params, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      error = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (error += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error((error || output).slice(-3000) || `Exit ${code}`)),
    );
  });
}
function sqlFor(asset) {
  return `INSERT INTO fontAssets(id,filename,name,family,variant,sourceCategory,encoding,sourceId,mapVersion,objectKey,sha256,bytes,importedAt)
    VALUES(${[
      asset.id,
      asset.filename,
      asset.name,
      asset.family,
      asset.variant,
      asset.sourceCategory,
      asset.encoding,
      asset.sourceId,
      asset.mapVersion,
      asset.objectKey,
      asset.sha256,
      asset.bytes,
      Date.now(),
    ]
      .map((value) =>
        typeof value === 'number' ? String(value) : value === null ? 'NULL' : quote(value),
      )
      .join(',')})
    ON CONFLICT(id) DO UPDATE SET filename=excluded.filename,name=excluded.name,family=excluded.family,
      variant=excluded.variant,sourceCategory=excluded.sourceCategory,encoding=excluded.encoding,
      sourceId=excluded.sourceId,mapVersion=excluded.mapVersion,objectKey=excluded.objectKey,
      sha256=excluded.sha256,bytes=excluded.bytes;`;
}

const rootArg = option('--root');
if (!rootArg) throw new Error('Pass --root with the folder that contains the font subfolders.');
const root = path.resolve(rootArg);
if (!(await stat(root)).isDirectory()) throw new Error('The font root is not a directory.');
const inventory = parseCsv(
  await readFile(path.join(repo, 'data/imports/local-font-files-inventory.csv'), 'utf8'),
);
const comparison = parseCsv(
  await readFile(
    path.join(repo, 'data/imports/malayalamfont.com-local-font-comparison.csv'),
    'utf8',
  ),
);
const legacyFonts = JSON.parse(
  await readFile(path.join(repo, 'data/legacy/fonts.v1.json'), 'utf8'),
);
const mapVersions = new Map(legacyFonts.map((font) => [font.sha256, font.mapVersion]));
const normalizePath = (value) => path.resolve(value).toLocaleLowerCase('en-US');
const metadata = new Map(inventory.map((row) => [normalizePath(row.Path), row]));
const exactSource = new Map();
for (const source of comparison) {
  if (source.matchStatus !== 'exact') continue;
  for (const absolute of source.localFiles.split(' | ').filter(Boolean))
    exactSource.set(normalizePath(absolute), source.sourceId);
}
let files = (await walk(root)).sort((a, b) => a.localeCompare(b));
const only = option('--only');
if (only) {
  const wanted = only.split(/[\\/]/).join('/').toLocaleLowerCase('en-US');
  files = files.filter(
    (file) =>
      path.relative(root, file).split(path.sep).join('/').toLocaleLowerCase('en-US') === wanted,
  );
  if (!files.length) throw new Error(`No font matched --only ${only}.`);
}
if (!files.length) throw new Error('No TTF or OTF font files were found.');
const fonts = [];
let totalBytes = 0;
for (const absolute of files) {
  const relativePath = path.relative(root, absolute).split(path.sep).join('/');
  const info = metadata.get(normalizePath(absolute));
  const contents = await readFile(absolute);
  const digest = createHash('sha256').update(contents).digest('hex');
  const id = `local-font-${createHash('sha256')
    .update(`${relativePath.toLocaleLowerCase('en-US')}\0${digest}`)
    .digest('hex')
    .slice(0, 24)}`;
  const extension = path.extname(absolute).toLowerCase();
  const category = relativePath.includes('/') ? relativePath.split('/')[0] : 'Downloaded';
  const encoding = ['FML', 'ML-TT', 'Unicode'].includes(info?.Encoding) ? info.Encoding : 'Other';
  const asset = {
    id,
    relativePath,
    filename: path.basename(absolute),
    name: info?.FullName || info?.FileName || path.basename(absolute, extension),
    family: info?.Family || info?.FileName || path.basename(absolute, extension),
    variant: info?.Variant || '',
    sourceCategory: category,
    encoding,
    sourceId: exactSource.get(normalizePath(absolute)) ?? null,
    mapVersion: mapVersions.get(digest) ?? '',
    objectKey: `catalogue-fonts/${id}${extension}`,
    sha256: digest,
    bytes: contents.byteLength,
  };
  fonts.push(asset);
  totalBytes += contents.byteLength;
}
const manifestPath = path.resolve(
  option('--manifest') || path.join(os.tmpdir(), `lipiflow-font-assets-${Date.now()}.json`),
);
await writeFile(manifestPath, JSON.stringify(fonts, null, 2) + '\n', 'utf8');
const matched = fonts.filter((font) => font.sourceId).length;
const mapped = fonts.filter((font) => font.mapVersion).length;
process.stdout.write(
  `Prepared ${fonts.length} assets (${(totalBytes / 1024 / 1024).toFixed(1)} MiB); ${matched} exact source matches; ${mapped} verified legacy map files. Manifest: ${manifestPath}\n`,
);

const server = path.join(repo, 'apps/server');
const wrangler = path.join(server, 'node_modules/wrangler/bin/wrangler.js');
const bucket = option('--bucket') || 'lipiflow-user-fonts';
if (enabled('--upload')) {
  const concurrency = Math.max(1, Math.min(8, Number(option('--concurrency') || 4)));
  const pending = [...fonts];
  const failures = [];
  let finished = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (pending.length) {
        const font = pending.shift();
        if (!font) break;
        const absolute = path.join(root, ...font.relativePath.split('/'));
        try {
          await run(
            process.execPath,
            [
              wrangler,
              'r2',
              'object',
              'put',
              `${bucket}/${font.objectKey}`,
              '--remote',
              '--file',
              absolute,
              '--content-type',
              font.filename.toLowerCase().endsWith('.otf') ? 'font/otf' : 'font/ttf',
              '--force',
            ],
            server,
          );
        } catch (error) {
          failures.push(
            `${font.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        finished++;
        if (finished % 25 === 0 || finished === fonts.length)
          process.stdout.write(`Uploaded ${finished}/${fonts.length}\n`);
      }
    }),
  );
  if (failures.length) {
    process.stderr.write(
      `${failures.length} uploads failed:\n${failures.slice(0, 15).join('\n')}\n`,
    );
    throw new Error('R2 upload did not finish cleanly; the manifest is safe to rerun.');
  }
}

if (enabled('--import-db')) {
  if (!enabled('--upload') && !enabled('--index-only'))
    throw new Error('Add --upload or --index-only before importing catalogue rows.');
  const chunkSize = 35;
  for (let index = 0; index < fonts.length; index += chunkSize) {
    const chunk = fonts.slice(index, index + chunkSize);
    const sourceIds = [...new Set(chunk.map((font) => font.sourceId).filter(Boolean))];
    const updateSources = sourceIds.length
      ? `UPDATE externalFontSources SET assetStored=1 WHERE sourceId IN (${sourceIds.map(quote).join(',')});`
      : '';
    const sql = `${chunk.map(sqlFor).join('\n')}\n${updateSources}`;
    const file = path.join(os.tmpdir(), `lipiflow-font-assets-${process.pid}-${index}.sql`);
    await writeFile(file, sql, 'utf8');
    try {
      await run(
        process.execPath,
        [wrangler, 'd1', 'execute', 'lipiflow-font-catalogue', '--remote', '--file', file],
        server,
      );
    } finally {
      await import('node:fs/promises').then(({ unlink }) => unlink(file).catch(() => {}));
    }
    process.stdout.write(
      `Imported ${Math.min(index + chunk.length, fonts.length)}/${fonts.length} catalogue rows\n`,
    );
  }
}

if (!enabled('--upload') && !enabled('--import-db'))
  process.stdout.write(
    'Dry run only. Add --upload --import-db to send these files to the configured Cloudflare account.\n',
  );
