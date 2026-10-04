import { fontEncodingLabel } from '@lipiflow/library';

export const DEFAULT_FONT_PREVIEW_TEXT = 'മലയാളം മനസ്സിൽ നിന്ന് തന്നെ';
export const verifiedPreviewMapVersions = new Set(['karthika/1.0.0']);
const importedLegacyCollectionMap = new Map([
  ['fml fonts', 'karthika/1.0.0'],
  ['ml fonts', 'karthika/1.0.0'],
  ['apple card fonts', 'karthika/1.0.0'],
  ['scribe fonts', 'karthika/1.0.0'],
]);

export function localFontMapVersion(font: {
  encoding: string;
  mapVersion?: string | null;
  sourceCategory?: string;
}) {
  if (fontEncodingLabel(font.encoding) === 'Unicode') return '';
  if (font.mapVersion) return font.mapVersion;
  return (
    importedLegacyCollectionMap.get(font.sourceCategory?.trim().toLocaleLowerCase() ?? '') ?? ''
  );
}

export function fontPreviewMapLabel(mapVersion: string) {
  if (!verifiedPreviewMapVersions.has(mapVersion)) return 'Verified encoding map';
  return mapVersion.split('/')[0] === 'karthika'
    ? 'Verified Karthika map'
    : 'Verified encoding map';
}

export type FontPreviewResolution =
  | { kind: 'unicode' | 'mapped'; text: string }
  | { kind: 'needs-map'; text: null };

export function resolveFontPreview(
  encoding: string,
  mapVersion: string | null | undefined,
  unicodeText: string,
  encodedText: string,
): FontPreviewResolution {
  if (fontEncodingLabel(encoding) === 'Unicode') return { kind: 'unicode', text: unicodeText };
  if (mapVersion && verifiedPreviewMapVersions.has(mapVersion))
    return { kind: 'mapped', text: encodedText };
  return { kind: 'needs-map', text: null };
}
