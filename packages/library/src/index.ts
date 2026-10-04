import { z } from 'zod';

export const categories = ['Sans serif', 'Serif', 'Display', 'Handwriting', 'Traditional'] as const;
export const encodings = ['Unicode', 'FML', 'ML-TT'] as const;
export const maxFontBytes = 10 * 1024 * 1024;
const https = z.url().refine((value) => new URL(value).protocol === 'https:', 'Use an HTTPS link');
export const uploadSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    family: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(1200),
    variant: z.string().trim().min(1).max(60),
    category: z.enum(categories),
    encoding: z.enum(encodings),
    authorName: z.string().trim().min(2).max(100),
    authorUrl: z.union([z.literal(''), https]),
    uploaderIsAuthor: z.boolean(),
    licence: z.string().trim().min(2).max(100),
    licenceUrl: https,
    permission: z.string().trim().min(20).max(5000),
    rightsConfirmed: z.literal(true),
  })
  .strict();
export const reportSchema = z
  .object({
    fontId: z.string().regex(/^[a-z0-9-]{1,100}$/),
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    details: z.string().trim().min(20).max(5000),
    evidenceUrl: https,
    goodFaith: z.literal(true),
  })
  .strict();
export const draftSchema = z
  .object({ title: z.string().trim().min(1).max(100), text: z.string().max(200000) })
  .strict();
export type LibraryFont = {
  id: string;
  name: string;
  family: string;
  description: string;
  variant: string;
  category: (typeof categories)[number];
  encoding: (typeof encodings)[number];
  authorName: string;
  authorUrl: string;
  uploaderIsAuthor: boolean | number;
  licence: string;
  licenceUrl: string;
  permission: string;
  sha256: string;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  ownerId: string;
  createdAt: number;
  reviewNote: string;
  filename: string;
};
export type PublishedFont = Omit<LibraryFont, 'ownerId' | 'permission' | 'reviewNote' | 'filename'>;
export type Account = { id: string; name: string; role: 'user' | 'admin'; email?: string };
export type Draft = { id: string; title: string; text: string; updatedAt: string | number };
export type CopyrightReport = z.infer<typeof reportSchema> & {
  id: string;
  status: 'open' | 'resolved';
  resolution: string;
  createdAt: number;
};
export type ExternalFontSource = {
  sourceId: string;
  sourceNumericId: number;
  name: string;
  family: string;
  variant: string;
  sourceCategory: string;
  encoding: string;
  sourceUrl: string;
  reportedLicence: string;
  copyrightText: string;
  rightsStatus: 'unverified' | 'cleared' | 'restricted' | 'rights-review';
  assetStored: number;
  importedAt: number;
};

export function externalFontDownloadUrl(
  source: Pick<ExternalFontSource, 'sourceUrl' | 'rightsStatus'>,
): string | null {
  if (source.rightsStatus !== 'cleared') return null;
  try {
    const url = new URL(source.sourceUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'www.malayalamfont.com' ||
      url.pathname !== '/download.php' ||
      !/^\d+$/.test(url.searchParams.get('id') ?? '')
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function sha256(bytes: ArrayBuffer | string) {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

// Bounds-checked SFNT inspection. Only raw TTF/OTF uploads are accepted so the
// server can verify a Malayalam cmap instead of trusting a filename or form.
export function inspectFont(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  if (bytes.byteLength < 12 || bytes.byteLength > maxFontBytes)
    throw new Error('Choose a TTF or OTF font under 10 MB.');
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x4f54544f)
    throw new Error('Choose a valid TTF or OTF font.');
  const count = view.getUint16(4);
  if (!count || count > 256 || 12 + count * 16 > bytes.byteLength)
    throw new Error('Invalid font table directory.');
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...new Uint8Array(bytes, at, 4));
    const offset = view.getUint32(at + 8),
      length = view.getUint32(at + 12);
    if (offset + length > bytes.byteLength) throw new Error('Invalid font table bounds.');
    tables.set(tag, { offset, length });
  }
  for (const required of ['head', 'hhea', 'hmtx', 'maxp', 'name', 'cmap']) {
    if (!tables.has(required)) throw new Error('Missing required font tables.');
  }
  if (!(tables.has('glyf') && tables.has('loca')) && !tables.has('CFF ') && !tables.has('CFF2'))
    throw new Error('This font has no glyph outlines.');
  if (
    tables.get('head')!.length < 54 ||
    tables.get('hhea')!.length < 36 ||
    tables.get('maxp')!.length < 6 ||
    tables.get('name')!.length < 6
  )
    throw new Error('Invalid font headers.');
  const glyphCount = view.getUint16(tables.get('maxp')!.offset + 4);
  if (!glyphCount) throw new Error('This font has no glyphs.');
  const cmap = tables.get('cmap');
  if (!cmap || cmap.length < 4) throw new Error('This font has no character table.');
  const n = view.getUint16(cmap.offset + 2);
  if (4 + n * 8 > cmap.length) throw new Error('Invalid character table.');
  let unicodeMalayalam = false;
  for (let i = 0; i < n; i++) {
    const record = cmap.offset + 4 + i * 8;
    const platform = view.getUint16(record),
      encoding = view.getUint16(record + 2);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const relative = view.getUint32(record + 4);
    if (relative + 2 > cmap.length) throw new Error('Invalid character subtable.');
    const offset = cmap.offset + relative,
      format = view.getUint16(offset);
    if (format === 4) {
      if (relative + 16 > cmap.length) throw new Error('Invalid cmap format 4.');
      const length = view.getUint16(offset + 2),
        segments = view.getUint16(offset + 6) / 2;
      if (
        !Number.isInteger(segments) ||
        relative + length > cmap.length ||
        16 + 8 * segments > length
      )
        throw new Error('Invalid cmap segments.');
      for (let j = 0; j < segments; j++) {
        const end = view.getUint16(offset + 14 + j * 2),
          start = view.getUint16(offset + 16 + segments * 2 + j * 2);
        if (start <= 0x0d15 && end >= 0x0d15) {
          const delta = view.getInt16(offset + 16 + segments * 4 + j * 2);
          const rangeAt = offset + 16 + segments * 6 + j * 2;
          const range = view.getUint16(rangeAt);
          const glyphAt = rangeAt + range + (0x0d15 - start) * 2;
          let glyph =
            range === 0
              ? (0x0d15 + delta) & 0xffff
              : glyphAt + 2 <= offset + length
                ? view.getUint16(glyphAt)
                : 0;
          if (range && glyph) glyph = (glyph + delta) & 0xffff;
          unicodeMalayalam ||= glyph !== 0 && glyph < glyphCount;
        }
      }
    } else if (format === 12) {
      if (relative + 16 > cmap.length) throw new Error('Invalid cmap format 12.');
      const length = view.getUint32(offset + 4),
        groups = view.getUint32(offset + 12);
      if (relative + length > cmap.length || 16 + groups * 12 > length)
        throw new Error('Invalid cmap groups.');
      for (let j = 0; j < groups; j++) {
        const at = offset + 16 + j * 12,
          start = view.getUint32(at),
          end = view.getUint32(at + 4);
        const glyph = view.getUint32(at + 8) + 0x0d15 - start;
        if (start <= 0x0d15 && end >= 0x0d15 && glyph > 0 && glyph < glyphCount)
          unicodeMalayalam = true;
      }
    }
  }
  return { unicodeMalayalam, mime: signature === 0x4f54544f ? 'font/otf' : 'font/ttf' };
}
