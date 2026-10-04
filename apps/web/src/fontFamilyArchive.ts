const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatenate(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export type ArchiveFile = { filename: string; bytes: Uint8Array };

export function createFontFamilyZip(files: ArchiveFile[]) {
  if (!files.length) throw new Error('This font family has no downloadable files.');
  if (files.length > 0xffff) throw new Error('This family has too many files for one download.');

  const localParts: Uint8Array[] = [];
  const directoryParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const file of files) {
    const filename = file.filename.replaceAll('\\', '/').split('/').pop() || 'font.ttf';
    const nameBytes = new TextEncoder().encode(filename);
    const size = file.bytes.byteLength;
    if (nameBytes.length > 0xffff || size > 0xffffffff || localOffset > 0xffffffff)
      throw new Error('This family archive is too large.');
    const checksum = crc32(file.bytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(12, 0x21, true);
    local.setUint32(14, checksum, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, file.bytes);

    const directoryHeader = new Uint8Array(46 + nameBytes.length);
    const directory = new DataView(directoryHeader.buffer);
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(4, 20, true);
    directory.setUint16(6, 20, true);
    directory.setUint16(8, 0x0800, true);
    directory.setUint16(14, 0x21, true);
    directory.setUint32(16, checksum, true);
    directory.setUint32(20, size, true);
    directory.setUint32(24, size, true);
    directory.setUint16(28, nameBytes.length, true);
    directory.setUint32(42, localOffset, true);
    directoryHeader.set(nameBytes, 46);
    directoryParts.push(directoryHeader);
    localOffset += localHeader.length + size;
  }

  const directory = concatenate(directoryParts);
  const end = new Uint8Array(22);
  const footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, files.length, true);
  footer.setUint16(10, files.length, true);
  footer.setUint32(12, directory.length, true);
  footer.setUint32(16, localOffset, true);
  return concatenate([...localParts, directory, end]);
}
