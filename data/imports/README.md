# External font catalogue metadata

`malayalamfont.com-font-catalog.csv` is a source-attributed index of font names and metadata found through the public sitemap and individual detail pages on [malayalamfont.com](https://www.malayalamfont.com/). The site says it did not create the fonts and that terms vary by font; each row therefore remains marked `unverified` until an administrator checks the original author's redistribution terms.

The checked-in source import contains metadata only. The font binaries are not
stored in Git. A separately supplied local font folder can be copied into the
configured Cloudflare R2 bucket and indexed in D1; exact filename/family matches
link back to these source records. The site's pages did not expose a catalogue
CSV, so this CSV is LipiFlow's generated export.

To refresh the index and create the matching D1 SQL file, run `scripts/import-malayalamfont-catalog.ps1`. The importer checks `robots.txt`, follows only font detail URLs in the site's sitemap, and waits between requests. It writes the CSV here and generates a local SQL import file alongside it.

To upload a local collection, first refresh the file inventory and source-match
report with `scripts/compare-mal-font-catalog.ps1 -LocalFonts "<font-folder>"`.
Apply the Worker migration, then run
`node scripts/upload-font-assets.mjs --root "<font-folder>" --upload --import-db`.
The uploader stores the binaries under content-derived R2 keys and writes D1
rows only after all uploads succeed. It can be rerun after an interrupted upload.
The manifest is written to the operating system's temporary folder by default;
absolute paths and font binaries do not enter Git.

If all R2 uploads succeeded but D1 indexing did not, finish with
`node scripts/upload-font-assets.mjs --root "<font-folder>" --index-only --import-db`.
Use `--only "<relative-font-path>"` to retry one failed object before indexing.
