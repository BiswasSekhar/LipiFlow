PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','admin')));
CREATE TABLE sessions (tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE oauthStates (stateHash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE fonts (
 id TEXT PRIMARY KEY, ownerId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, variant TEXT NOT NULL,
 category TEXT NOT NULL, encoding TEXT NOT NULL, licence TEXT NOT NULL, licenceUrl TEXT NOT NULL,
 permission TEXT NOT NULL, filename TEXT NOT NULL, sha256 TEXT NOT NULL, objectKey TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','hidden')), reviewNote TEXT NOT NULL DEFAULT '', createdAt INTEGER NOT NULL
);
CREATE INDEX fonts_status ON fonts(status, createdAt);
CREATE INDEX fonts_owner ON fonts(ownerId);
CREATE TABLE favourites (userId TEXT NOT NULL REFERENCES users(id), fontId TEXT NOT NULL, PRIMARY KEY(userId,fontId));
CREATE TABLE drafts (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, text TEXT NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX drafts_owner ON drafts(userId);
CREATE TABLE reports (
 id TEXT PRIMARY KEY, fontId TEXT NOT NULL REFERENCES fonts(id), name TEXT NOT NULL, email TEXT NOT NULL,
 details TEXT NOT NULL, evidenceUrl TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '', createdAt INTEGER NOT NULL
);
CREATE TABLE audit (id TEXT PRIMARY KEY, actorId TEXT NOT NULL, targetId TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE rateLimits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
