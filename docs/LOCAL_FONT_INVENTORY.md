# Supplied Malayalam font collection

Inspected on 3 October 2026 from `Downloads/Malayalam Fonts`, without changing,
installing or copying the font binaries into the app. All 782 SFNT font files were
read successfully. The full name, version, copyright, embedded licence fields,
embedding flags, character-map range coverage and SHA-256 are recorded in
`artifacts/local-font-inventory.json` (local artifact, excluded from Git).

| Folder           | Font files |
| ---------------- | ---------: |
| FML Fonts        |        224 |
| ML Fonts         |        298 |
| Apple Card Fonts |         52 |
| Scribe Fonts     |        141 |
| Unicode Fonts    |         67 |

For example, `FML-Mohini.otf` identifies as **FML-Mohini Regular**, copyright
2011 C-DAC, Pune, all rights reserved. `FMLAA0NTT.ttf` identifies as
**FML-TTAathira Regular**, version 1.0 from December 1998, copyright C-DAC.
Neither of these files contains Malayalam Unicode character-map ranges or an
embedded licence notice. Their presence confirms that actual legacy assets are
available; applying them directly to Unicode Malayalam would not convert text.

No separate licence or mapping document was present in the supplied folder.
One font across the entire collection has embedded licence metadata. Font
embedding flags and words such as “FREE” in a copyright field are metadata, not
proof of permission to redistribute a whole font collection.

The Fonts screen can now open these `.ttf`/`.otf` files directly for a local
character proof. Files are read into browser memory, never uploaded or bundled,
and released when leaving the Fonts screen. The proof renders legacy character
positions, and is labelled unmapped. It does not present simulated Malayalam
conversion or enable legacy export.

The next mapping step needs a licensed map/reference chart and independently
known-good Unicode/legacy text for exact selected variants. For distribution,
retain the original font licence separately. See
[legacy intake](LEGACY_FONT_INTAKE.md) for the remaining verification requirements.

Reinspect a collection with Python's standard library:

```sh
python scripts/inspect-fonts.py "path/to/Malayalam Fonts" artifacts/local-font-inventory.json
```
