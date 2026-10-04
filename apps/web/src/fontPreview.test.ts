import { describe, expect, it } from 'vitest';
import { localFontMapVersion, resolveFontPreview } from './fontPreview';

describe('resolveFontPreview', () => {
  it('uses Unicode text only for Unicode fonts', () => {
    expect(resolveFontPreview('Unicode', '', 'മലയാളം', '')).toEqual({
      kind: 'unicode',
      text: 'മലയാളം',
    });
  });

  it.each(['FML', 'ML-TT'])('uses encoded text for a verified %s map', (encoding) => {
    expect(resolveFontPreview(encoding, 'karthika/1.0.0', 'മലയാളം', 'aebmfw')).toEqual({
      kind: 'mapped',
      text: 'aebmfw',
    });
  });

  it.each([
    ['FML', ''],
    ['ML-TT', ''],
    ['Other', ''],
    ['FML', 'unknown/1.0.0'],
  ])('does not show Unicode Malayalam for %s with map %s', (encoding, mapVersion) => {
    expect(resolveFontPreview(encoding, mapVersion, 'മലയാളം', 'aebmfw')).toEqual({
      kind: 'needs-map',
      text: null,
    });
  });

  it('keeps a valid empty encoded preview empty', () => {
    expect(resolveFontPreview('FML', 'karthika/1.0.0', '', '')).toEqual({
      kind: 'mapped',
      text: '',
    });
  });

  it.each(['FML Fonts', 'ML Fonts', 'Apple Card Fonts', 'Scribe Fonts'])(
    'selects the visually verified legacy map for the imported %s collection',
    (sourceCategory) => {
      expect(localFontMapVersion({ encoding: 'Other', sourceCategory })).toBe('karthika/1.0.0');
    },
  );

  it('keeps explicitly unknown font maps unavailable and does not guess from other collections', () => {
    expect(
      localFontMapVersion({
        encoding: 'FML',
        mapVersion: 'unknown/1.0.0',
        sourceCategory: 'FML Fonts',
      }),
    ).toBe('unknown/1.0.0');
    expect(localFontMapVersion({ encoding: 'Other', sourceCategory: 'Downloaded' })).toBe('');
    expect(localFontMapVersion({ encoding: 'Unicode', sourceCategory: 'ML Fonts' })).toBe('');
  });
});
