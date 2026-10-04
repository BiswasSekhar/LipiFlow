CREATE TABLE sourceFontReports (
  id TEXT PRIMARY KEY,
  sourceId TEXT NOT NULL REFERENCES externalFontSources(sourceId),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  details TEXT NOT NULL,
  evidenceUrl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  resolution TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL
);

CREATE INDEX source_font_reports_status ON sourceFontReports(status, createdAt);
CREATE INDEX source_font_reports_source ON sourceFontReports(sourceId, status);
