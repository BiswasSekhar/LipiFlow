# What is needed for FML and ML-TT

Start with one exact FML font and one exact ML-TT font. A family label alone does
not establish compatibility: maps must be associated with tested font assets.

## Material to collect

1. **Exact font:** original `.ttf`/`.otf`, family and variant name, version, source
   and SHA-256. Record the application and operating system where it works.
2. **Permission:** the font's original licence and permission for web embedding
   and redistribution. A converter's open-source licence does not license its fonts.
   Fonts without bundling permission require a separate local-font workflow.
3. **Mapping source:** an authoritative character chart or a licensed existing map
   from Malayalam Unicode sequences to the font's legacy character positions.
   Keep attribution, map licence and source revision separate from the font licence.
4. **Independent reference material:** known-good legacy text paired with its
   Unicode equivalent and a screenshot/PDF rendered with the exact font. Include
   vowels, all consonants, chillus, conjuncts, explicit virama, vowel signs on both
   sides of consonants, Malayalam/Arabic digits, punctuation and mixed English.
5. **Export destination:** name the application that will receive copied text or
   downloaded files. Establish whether it expects Unicode characters representing
   legacy positions, a particular byte code page, or another format. UTF-8 text and
   legacy bytes are not interchangeable. Agree how unsupported characters behave.

The implementation needs sequence rules and glyph ordering, not only a
letter-to-letter table. Pre-base vowel signs and conjunct glyphs can require
reordering or many-character substitutions. Keep Unicode as the editor's internal
text, and apply the selected verified font map at preview/export boundaries.

## Existing starting points

- [aslamplr/unicode-to-mltt-converter](https://github.com/aslamplr/unicode-to-mltt-converter)
  explicitly uses ML-TTKarthika mappings. It is a candidate reference for that font,
  not evidence of compatibility with every ML-TT variant.
- [deepushajia/ASCII-Unicode-Converter-for-Malayalam](https://github.com/deepushajia/ASCII-Unicode-Converter-for-Malayalam)
  has per-font map files and a font-to-map index. Review the exact mapping source,
  licence and variant association before importing anything.

The MIT Karthika map and independent fixtures from aslamplr are now imported.
The regular FML-TTKarthika and ML-TTKarthika files in the supplied collection
were checked for matching glyph outlines and browser rendering. See
[MAP_FORMAT.md](MAP_FORMAT.md) for exact supported hashes and export behavior.
The per-font deepushajia maps remain research only.

## Verification before enabling a mode

Give each map an explicit version, font hash, source notices and expected encoded
fixtures. Test independently supplied examples in Rust and WASM. Render the result
with the actual legacy font and compare the reference. Check clipboard and file
exports in the intended receiving application; round-trip tests alone cannot prove
correctness. Only then mark the catalogue entry verified and enable that variant.

The existing catalogue validates identities, encoding family, assets, licence
metadata and map versions. See [MAP_FORMAT.md](MAP_FORMAT.md). The checked Karthika encoder is implemented; no user-owned legacy font is
distributed. Additional variants need the same verification workflow.
