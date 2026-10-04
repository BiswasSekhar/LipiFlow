"""Read SFNT name/cmap metadata without copying or modifying the source fonts."""
import argparse
import hashlib
import json
import struct
from collections import Counter
from pathlib import Path


def inspect(path, root):
    data = path.read_bytes()
    count = struct.unpack_from('>H', data, 4)[0]
    tables = {}
    for index in range(count):
        tag, _, offset, size = struct.unpack_from('>4sIII', data, 12 + 16 * index)
        tables[tag.decode('ascii')] = (offset, size)
    offset, _ = tables['name']
    _, records, storage = struct.unpack_from('>HHH', data, offset)
    names = {}
    for index in range(records):
        platform, _, language, name_id, length, start = struct.unpack_from('>HHHHHH', data, offset + 6 + 12 * index)
        value = data[offset + storage + start:offset + storage + start + length]
        value = value.decode('utf-16-be' if platform in (0, 3) else 'mac_roman', errors='replace')
        if name_id not in names or language == 0x409:
            names[name_id] = value
    codes = set()
    if 'cmap' in tables:
        offset, _ = tables['cmap']
        records = struct.unpack_from('>H', data, offset + 2)[0]
        for index in range(records):
            platform, encoding, start = struct.unpack_from('>HHI', data, offset + 4 + 8 * index)
            if platform not in (0, 3):
                continue
            start += offset
            form = struct.unpack_from('>H', data, start)[0]
            if form == 4:
                segments = struct.unpack_from('>H', data, start + 6)[0] // 2
                for part in range(segments):
                    end = struct.unpack_from('>H', data, start + 14 + part * 2)[0]
                    begin = struct.unpack_from('>H', data, start + 16 + segments * 2 + part * 2)[0]
                    if end != 0xffff:
                        codes.update(range(begin, end + 1))
            elif form == 12:
                groups = struct.unpack_from('>I', data, start + 12)[0]
                for part in range(groups):
                    begin, end, _ = struct.unpack_from('>III', data, start + 16 + part * 12)
                    codes.update(range(begin, end + 1))
    embedding = struct.unpack_from('>H', data, tables['OS/2'][0] + 8)[0] if 'OS/2' in tables else None
    return {
        'file': path.relative_to(root).as_posix(),
        'family': names.get(16, names.get(1, '')),
        'variant': names.get(17, names.get(2, '')),
        'fullName': names.get(4, ''),
        'version': names.get(5, ''),
        'copyright': names.get(0, ''),
        'licence': names.get(13, ''),
        'licenceUrl': names.get(14, ''),
        'embeddingFlags': embedding,
        'malayalamCmapPositions': sum(0x0d00 <= code <= 0x0d7f for code in codes),
        'sha256': hashlib.sha256(data).hexdigest(),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    records = []
    errors = []
    for path in sorted(args.folder.rglob('*')):
        if path.suffix.lower() not in ('.ttf', '.otf'):
            continue
        try:
            records.append(inspect(path, args.folder))
        except (ValueError, KeyError, struct.error, UnicodeError) as error:
            errors.append({'file': path.relative_to(args.folder).as_posix(), 'error': str(error)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'fonts': records, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'fonts': len(records), 'errors': len(errors), 'folders': dict(Counter(Path(font['file']).parent.name for font in records)), 'embeddedLicenceCount': sum(bool(font['licence'] or font['licenceUrl']) for font in records)}, indent=2))
