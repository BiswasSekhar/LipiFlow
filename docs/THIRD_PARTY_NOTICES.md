# Third-party notices

## Mozhi 2

The frozen `data/mozhi/reference/mozhi_malayalam.kmn` file is from the Keyman
Mozhi Malayalam keyboard 3.2.6, implementing Cibu C. J.’s Mozhi specification.
Its listed contributors are Raj Nair, Junaid P. V., Benjamin C. Varghese and
Cibu C. J. The reference and derived rule data use its MIT licence, copyright
2021–2025 Cibu C. J. The complete original notice is retained at
`data/mozhi/reference/LICENSE.md` and served as `/licenses/mozhi.txt`.

- Specification: https://sites.google.com/site/cibu/mozhi2
- Reference: https://github.com/keymanapp/keyboards/tree/master/release/m/mozhi_malayalam
- Independent examples: https://help.keyman.com/keyboard/mozhi_malayalam/3.2.6/mozhi_malayalam

## Malayalam fonts

Noto Sans Malayalam and Noto Serif Malayalam are Copyright The Noto Project
Authors. They use SIL Open Font License 1.1. Original notices are served at
`/licenses/noto-sans-malayalam.txt` and `/licenses/noto-serif-malayalam.txt`.
The unmodified WOFF2 Malayalam subsets (regular/semibold) come from Fontsource
packages pinned to 5.3.0, with their licences copied alongside the fonts.

Project: https://github.com/notofonts/malayalam

## Application dependencies

Rust and JavaScript dependency versions are locked in `Cargo.lock` and
`pnpm-lock.yaml`. Their original package licences remain in the installed
distributions. No third-party font or transliteration attribution is removed.

## Karthika legacy mapping

`data/legacy/karthika.v1.map` is from Aslam Ahammed’s
[unicode-to-mltt-converter](https://github.com/aslamplr/unicode-to-mltt-converter/blob/master/www/public/karthika.map).
Copyright 2018 Aslam Ahammed; the repository offers MIT / Apache-2.0 licensing.
We use MIT and retain its complete notice in `data/legacy/LICENSE-MIT.txt`,
served as `/licenses/legacy-karthika.txt`. The map’s attribution to
asdofindia/unicode-conversion-maps remains intact. The independent regression
fixtures come from that repository’s `tests/convertion.rs`, with provenance in
each data record. The encoder implementation is original LipiFlow code.
User-owned FML/ML-TT font binaries are never included in the release artifact.

The hosted API, admin app and library schemas use the repository’s MIT licence.
The Noto test fixture in `tests/fixtures/` is decompressed from the pinned bundled
WOFF2 asset without changing outlines; its original OFL notice is retained beside it.
Font uploads retain their own licences and are not covered by the application’s MIT
licence. No user-owned font collection is included in source or release artifacts.
