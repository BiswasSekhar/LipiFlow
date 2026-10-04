# External font catalogue metadata

`malayalamfont.com-font-catalog.csv` is a source-attributed index of font names and metadata found through the public sitemap and individual detail pages on [malayalamfont.com](https://www.malayalamfont.com/). The site says it did not create the fonts and that terms vary by font; each row therefore remains marked `unverified` until an administrator checks the original author's redistribution terms.

This import contains metadata only. It does not include font binaries, bypass the site's download CAPTCHA, or make the indexed files available in LipiFlow. The site's pages did not expose a catalogue CSV, so this CSV is LipiFlow's generated export.

To refresh the index and create the matching D1 SQL file, run `scripts/import-malayalamfont-catalog.ps1`. The importer checks `robots.txt`, follows only font detail URLs in the site's sitemap, and waits between requests. It writes the CSV here and generates a local SQL import file alongside it.
