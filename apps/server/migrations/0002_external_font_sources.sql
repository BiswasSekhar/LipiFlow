CREATE TABLE externalFontSources (
  sourceId TEXT PRIMARY KEY,
  sourceNumericId INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  sourceCategory TEXT NOT NULL DEFAULT '',
  encoding TEXT NOT NULL DEFAULT 'Unverified',
  sourceUrl TEXT NOT NULL,
  reportedLicence TEXT NOT NULL DEFAULT 'Not listed',
  copyrightText TEXT NOT NULL DEFAULT '',
  rightsStatus TEXT NOT NULL DEFAULT 'unverified'
    CHECK(rightsStatus IN ('unverified','cleared','restricted','rights-review')),
  assetStored INTEGER NOT NULL DEFAULT 0 CHECK(assetStored IN (0,1)),
  importedAt INTEGER NOT NULL
);
CREATE INDEX external_font_sources_name ON externalFontSources(name);
CREATE INDEX external_font_sources_rights ON externalFontSources(rightsStatus);
