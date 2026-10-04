import { describe, expect, it } from 'vitest';
import { externalFontDownloadUrl } from '@lipiflow/library';

describe('external font download links', () => {
  it('keeps downloads on the original Malayalam font source', () => {
    expect(
      externalFontDownloadUrl({
        sourceUrl: 'https://www.malayalamfont.com/download.php?id=1000',
        rightsStatus: 'cleared',
      }),
    ).toBe('https://www.malayalamfont.com/download.php?id=1000');
  });

  it.each(['unverified', 'rights-review', 'restricted'] as const)(
    'withholds download links while rights are %s',
    (rightsStatus) => {
      expect(
        externalFontDownloadUrl({
          sourceUrl: 'https://www.malayalamfont.com/download.php?id=1000',
          rightsStatus,
        }),
      ).toBeNull();
    },
  );

  it.each([
    'http://www.malayalamfont.com/download.php?id=1000',
    'https://malayalamfont.com/download.php?id=1000',
    'https://malayalamfont.com.evil.example/download.php?id=1000',
    'https://www.malayalamfont.com/other?id=1000',
    'https://www.malayalamfont.com/download.php?id=javascript:alert(1)',
  ])('rejects an unsafe source link: %s', (sourceUrl) => {
    expect(externalFontDownloadUrl({ sourceUrl, rightsStatus: 'cleared' })).toBeNull();
  });
});
