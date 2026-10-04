import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const publicDir = 'apps/web/public';
for (const folder of ['fonts', 'licenses', 'data'])
  fs.mkdirSync(`${publicDir}/${folder}`, { recursive: true });
for (const name of ['noto-sans-malayalam', 'noto-serif-malayalam']) {
  const dir = `apps/web/node_modules/@fontsource/${name}`;
  for (const weight of [400, 600]) {
    const suffix = weight === 400 ? '' : '-600';
    fs.copyFileSync(
      `${dir}/files/${name}-malayalam-${weight}-normal.woff2`,
      `${publicDir}/fonts/${name}${suffix}.woff2`,
    );
  }
  fs.copyFileSync(`${dir}/LICENSE`, `${publicDir}/licenses/${name}.txt`);
}
fs.copyFileSync('LICENSE', `${publicDir}/licenses/lipiflow.txt`);
fs.copyFileSync('data/mozhi/reference/LICENSE.md', `${publicDir}/licenses/mozhi.txt`);
fs.copyFileSync('data/legacy/LICENSE-MIT.txt', `${publicDir}/licenses/legacy-karthika.txt`);
fs.copyFileSync('data/legacy/karthika.v1.map', `${publicDir}/data/karthika.v1.map`);
fs.copyFileSync('data/legacy/fonts.v1.json', `${publicDir}/data/legacy-fonts.v1.json`);
for (const [input, output] of [
  ['data/catalogue.v1.json', 'catalogue.v1.json'],
  ['data/mozhi/mozhi-2.v1.json', 'mozhi-2.v1.json'],
  ['data/mozhi/guide.v1.json', 'guide.v1.json'],
])
  fs.copyFileSync(input, path.join(publicDir, 'data', output));

// Standalone PNG app icons, matching the geometric SVG brand mark.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
for (const size of [192, 512]) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x * 192) / size,
        py = (y * 192) / size;
      const line =
        (px > 49 && px < 61 && py > 50 && py < 137) ||
        (px > 49 && px < 142 && py > 136 && py < 148) ||
        (px > 82 && px < 94 && py > 49 && py < 119) ||
        (px > 82 && px < 149 && py > 77 && py < 89) ||
        (px > 137 && px < 149 && py > 77 && py < 128) ||
        (px > 94 && px < 149 && py > 122 && py < 134);
      const color = line ? [255, 255, 255] : [23, 23, 23];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      rows[i] = color[0];
      rows[i + 1] = color[1];
      rows[i + 2] = color[2];
      rows[i + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  fs.writeFileSync(
    `${publicDir}/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', zlib.deflateSync(rows)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
console.log('Prepared bundled fonts, licences, versioned data and app icons.');
