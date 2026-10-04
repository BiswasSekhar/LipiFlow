CREATE TABLE fontAssets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  sourceCategory TEXT NOT NULL DEFAULT '',
  encoding TEXT NOT NULL,
  sourceId TEXT REFERENCES externalFontSources(sourceId),
  mapVersion TEXT NOT NULL DEFAULT '',
  objectKey TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  rightsStatus TEXT NOT NULL DEFAULT 'unverified'
    CHECK(rightsStatus IN ('unverified','cleared','restricted','rights-review')),
  importedAt INTEGER NOT NULL
);

CREATE INDEX font_assets_family ON fontAssets(family COLLATE NOCASE);
CREATE INDEX font_assets_encoding ON fontAssets(encoding, rightsStatus);
CREATE INDEX font_assets_source ON fontAssets(sourceId);

CREATE TABLE fontAssetReports (
  id TEXT PRIMARY KEY,
  assetId TEXT NOT NULL REFERENCES fontAssets(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  details TEXT NOT NULL,
  evidenceUrl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  resolution TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL
);

CREATE INDEX font_asset_reports_status ON fontAssetReports(status, createdAt);
CREATE INDEX font_asset_reports_asset ON fontAssetReports(assetId, status);
