import { describe, expect, it } from 'vitest';
import { catalogue, catalogueSchema, fontSchema, fonts } from './catalogue';
describe('font catalogue', () => {
  it('contains only two licensed and verified Unicode fonts', () => {
    expect(fonts).toHaveLength(2);
    expect(
      fonts.every((font) => font.encodingFamily === 'Unicode' && font.licence.redistributable),
    ).toBe(true);
  });
  it('rejects unbacked verified legacy mappings', () => {
    expect(fontSchema.safeParse({ ...fonts[0], encodingFamily: 'FML' }).success).toBe(false);
    expect(
      fontSchema.safeParse({
        ...fonts[0],
        encodingFamily: 'ML-TT',
        mapVersion: '1.0.0',
        mapAsset: '/maps/verified.json',
      }).success,
    ).toBe(true);
  });
  it('rejects duplicate ids, unknown properties and remote assets', () => {
    expect(catalogueSchema.safeParse({ ...catalogue, fonts: [fonts[0], fonts[0]] }).success).toBe(
      false,
    );
    expect(fontSchema.safeParse({ ...fonts[0], invented: 'field' }).success).toBe(false);
    expect(
      fontSchema.safeParse({ ...fonts[0], assets: { regular: 'https://example.com/font.woff2' } })
        .success,
    ).toBe(false);
  });
});
