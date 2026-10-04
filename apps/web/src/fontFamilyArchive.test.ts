import { describe, expect, it } from 'vitest';
import { fontEncodingLabel } from '@lipiflow/library';
import { createFontFamilyZip } from './fontFamilyArchive';

describe('font family archive', () => {
  it('writes a standards-compatible ZIP containing every font filename and byte', () => {
    const first = new Uint8Array([1, 2, 3, 4]);
    const second = new Uint8Array([8, 9]);
    const zip = createFontFamilyZip([
      { filename: 'Family-Regular.ttf', bytes: first },
      { filename: 'Family-Semibold.otf', bytes: second },
    ]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 14, true)).toBe(2);
    expect(new TextDecoder().decode(zip)).toContain('Family-Regular.ttf');
    expect(new TextDecoder().decode(zip)).toContain('Family-Semibold.otf');
    expect([...zip]).toContain(9);
  });

  it('rejects an empty family', () => {
    expect(() => createFontFamilyZip([])).toThrow('no downloadable files');
  });

  it('normalizes unknown collection encodings to Other', () => {
    expect(fontEncodingLabel('FML')).toBe('FML');
    expect(fontEncodingLabel('ml tt')).toBe('ML-TT');
    expect(fontEncodingLabel('Unverified')).toBe('Other');
    expect(fontEncodingLabel('Apple Card')).toBe('Other');
  });
});
