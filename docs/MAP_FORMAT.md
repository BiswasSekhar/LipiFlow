# Catalogue and mapping format

The beta publishes `data/catalogue.v1.json`. Its executable validator is
`apps/web/src/catalogue.ts`; CI runs `pnpm data:check`.

The catalogue carries `schemaVersion: 1`, a semantic `version`, and unique font
records. Every record includes id, font name, variant, CSS family, encoding family
(`Unicode`, `FML` or `ML-TT`), description, licence id/notice/distribution permission,
local assets, sample text, verification status, map version and source provenance.
Relative asset traversal, remote assets, unknown fields and duplicate ids fail
validation. Bundled fonts must permit redistribution.

Unicode records have null `mapVersion` and `mapAsset`. Bundled font records must
permit redistribution. Legacy mappings and user-owned font identities are stored
separately: `data/legacy/karthika.v1.map` and `data/legacy/fonts.v1.json`.
No legacy font binaries are bundled.

## Karthika encoder — version 1.0.0

The portable Rust `encode_legacy(&str) -> Encoded` API returns `text`,
`unsupported` graphemes and `map_version`. WASM exposes the result as JSON.
The published MIT map is preserved verbatim with attribution and its licence.
The implementation uses longest matches, cluster-level vowel reordering,
pre-base ra, old/new chillus and explicit virama. It never rescans encoded
characters, so mixed English, punctuation, digits and emoji retain their text.
Canonical decomposed O/OO/AU signs are accepted. U+0D57 is a right-side sign;
U+0D4C uses the map’s split pre-/post-base representation.

Supported font files from the supplied collection:

| Mode  | Regular font                   | SHA-256                                                          |
| ----- | ------------------------------ | ---------------------------------------------------------------- |
| FML   | FMLKR0NTT.ttf / FML-TTKarthika | cbbe4be215ea8451c72cc592efa451013e9552c75964cd2e91bb8874ffb34c3d |
| ML-TT | MLKR0NTT.TTF / ML-TTKarthika   | 95c51f33d6c0fdad54e9a0dc05ac10784603b775cf6d00ab450673f915e6b232 |

These files have identical decomposed glyph outlines at all 164 shared Unicode
cmap positions. They therefore use the same Windows character-position map.
The file picker validates the full binary hash, loads a browser FontFace, and
rejects unchecked variants. Font data stays in tab memory; reload requires
selecting the file again, including offline. Conversion and exports do not need
the preview font loaded. No font redistribution rights are assumed.

The published map SHA-256 is
`7fce07b4d08b33cfff2b5f000de4bd5fb2d98893f1ea55152d47e8b03ce3140e`.
Preferred duplicate entries follow the source’s last-entry precedence.
The source hyphen remapping is excluded to preserve ordinary separators.
The source’s മ്ല → U+0178 entry is unavailable in both checked fonts; it is
preserved and reported as unsupported. Other unrepresentable Malayalam and
Malayalam joiner sequences are also retained and block legacy export. Emoji
joiners are preserved without a false unsupported flag.

`data/golden-tests/legacy-karthika.json` includes 16 independently published
conversion fixtures and local boundary cases, run through native Rust and the
production WASM. Browser tests cover real font loading/shaping, stale responses,
composition, mode changes, Google candidates, copy, UTF-8 downloads and offline
reload. Font-dependent browser tests are skipped in CI when the user-owned
binaries are absent; source-only encoding tests always run.

Clipboard output is Unicode characters at the legacy font’s Latin/Windows
positions, not Unicode Malayalam. Downloads serialize those positions as UTF-8;
open them as UTF-8 and apply the matching legacy font in the receiving app.
This is not a Windows-1252 byte-file exporter. English runs need an English font
because legacy Malayalam fonts reuse their Latin character positions.

Additional families, bold/italic variants, MLW/Mac encodings and reverse legacy
conversion need separate identification and verification. Do not infer support
from a filename prefix. A new map requires exact font identity, mapping
provenance/licence, independent encoded fixtures and matching-font visual review.
Font distribution additionally requires redistribution permission.

The encoding result also contains editing `spans`: `unicode_start`, `unicode_end`,
`encoded_start` and `encoded_end`, all UTF-16 offsets. Unicode offsets refer to the
original input before canonical normalization. Spans cover whole converted clusters
and preserved characters, allowing the single editor to map carets and selections
without reverse-decoding legacy text. Encoding output and map version are unchanged.

## Mozhi rule data

The independent transliteration data uses schema version 1. `ranges` are ordered
Unicode scalar stores; `rules` carry context `c`, input key `k`, output `o` and the
reference line. Nonnegative integers are Unicode scalars; -1 through -999 encode
deadkey identities; -1000-range encodes a store matcher; -2000 copies context;
-3000-range\*100-position encodes a one-based store-index output operation. These
are internal, compiled data operations, not a public native-keyboard protocol.

Regenerate only after reviewing the reference change, licence, source digest and
published expected examples. Engine and rule versions must change together when
conversion behavior changes.
