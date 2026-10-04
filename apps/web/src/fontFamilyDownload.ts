import { createFontFamilyZip, type ArchiveFile } from './fontFamilyArchive';

export type FontDownloadSource = { filename: string; url: string };

function safeName(value: string) {
  return value
    .replaceAll('\\', '/')
    .split('/')
    .pop()!
    .replace(/[^\p{L}\p{N} ._-]+/gu, '-')
    .trim()
    .slice(0, 120);
}

function extensionFromType(contentType: string) {
  if (/woff2/i.test(contentType)) return '.woff2';
  if (/opentype|font\/otf|x-font-otf/i.test(contentType)) return '.otf';
  if (/truetype|font\/ttf|x-font-ttf/i.test(contentType)) return '.ttf';
  return '';
}

export async function downloadFontFamilyArchive(family: string, sources: FontDownloadSource[]) {
  if (!sources.length) throw new Error('This family has no downloadable files.');
  const files: ArchiveFile[] = [];
  const usedNames = new Set<string>();
  for (const source of sources) {
    const response = await fetch(source.url, { cache: 'no-store', credentials: 'include' });
    if (!response.ok) throw new Error(`Could not download ${source.filename}. Try again.`);
    const contentType = response.headers.get('content-type') ?? '';
    const extension =
      extensionFromType(contentType) ||
      /\.(?:ttf|otf|woff2)$/i.exec(source.filename)?.[0] ||
      '.ttf';
    const base = safeName(source.filename).replace(/\.(?:ttf|otf|woff2)$/i, '') || 'font';
    let filename = `${base}${extension}`;
    let suffix = 2;
    while (usedNames.has(filename.toLocaleLowerCase())) {
      filename = `${base} (${suffix++})${extension}`;
    }
    usedNames.add(filename.toLocaleLowerCase());
    files.push({ filename, bytes: new Uint8Array(await response.arrayBuffer()) });
  }

  const bytes = createFontFamilyZip(files);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName(family) || 'font-family'}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
