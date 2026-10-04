import fs from 'node:fs';
import { catalogue } from '../apps/web/src/catalogue.ts';
import legacyFonts from '../data/legacy/fonts.v1.json' with { type: 'json' };
const hashes = new Set<string>();
for (const font of legacyFonts) {
  if (
    !/^[a-f0-9]{64}$/.test(font.sha256) ||
    hashes.has(font.sha256) ||
    !['FML', 'ML-TT'].includes(font.mode) ||
    font.mapVersion !== 'karthika/1.0.0'
  )
    throw new Error(`Invalid legacy font identity: ${font.id}`);
  hashes.add(font.sha256);
}
if (!fs.existsSync('data/legacy/karthika.v1.map')) throw new Error('Missing Karthika map');
for (const font of catalogue.fonts) {
  if (!font.licence.redistributable) throw new Error(`Non-distributable asset: ${font.id}`);
  if (font.encodingFamily !== 'Unicode' && font.verificationStatus === 'verified') {
    if (!font.mapAsset || !fs.existsSync(`apps/web/public${font.mapAsset}`))
      throw new Error(`Missing verified map: ${font.id}`);
  }
}
console.log(
  `Catalogue ${catalogue.version}: ${catalogue.fonts.length} bundled Unicode fonts; Karthika map for ${legacyFonts.length} local legacy variants.`,
);
