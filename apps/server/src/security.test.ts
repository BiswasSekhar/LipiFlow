import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localAllowed, requireOrigin } from './index';
import { inspectFont, reportSchema, sourceFontReportSchema, uploadSchema } from '@lipiflow/library';
test('local sign-in requires the local flag and loopback HTTP', () => {
  assert.equal(localAllowed({ LIPIFLOW_LOCAL: '1' }, new URL('http://127.0.0.1:8787')), true);
  for (const url of ['https://example.com', 'http://example.com', 'https://127.0.0.1'])
    assert.equal(localAllowed({ LIPIFLOW_LOCAL: '1' }, new URL(url)), false);
  assert.equal(localAllowed({}, new URL('http://localhost')), false);
});
test('mutations require the configured exact origin', () => {
  const env = { APP_ORIGIN: 'https://fonts.example' };
  for (const origin of ['', 'https://evil.example', 'https://fonts.example.evil'])
    assert.throws(() =>
      requireOrigin(
        new Request('https://fonts.example/api/fonts', { headers: { Origin: origin } }),
        env,
      ),
    );
  assert.doesNotThrow(() =>
    requireOrigin(
      new Request('https://fonts.example/api/fonts', { headers: { Origin: env.APP_ORIGIN } }),
      env,
    ),
  );
});
test('uploads and reports require permission, evidence and bounded fields', () => {
  assert.equal(
    uploadSchema.safeParse({
      name: 'Font',
      family: 'Test family',
      description: 'A synthetic typeface made for the upload flow test.',
      variant: 'Regular',
      category: 'Serif',
      encoding: 'Unicode',
      authorName: 'Test creator',
      authorUrl: 'https://example.com/creator',
      uploaderIsAuthor: true,
      licence: 'MIT',
      licenceUrl: 'https://example.com/licence',
      permission: 'I created and licensed these synthetic glyphs.',
      rightsConfirmed: true,
    }).success,
    true,
  );
  assert.equal(uploadSchema.safeParse({ name: 'Font' }).success, false);
  const validUpload = {
    name: 'Font',
    family: 'Font family',
    description: 'A short description of the font family and its script support.',
    variant: 'Regular',
    category: 'Serif',
    encoding: 'FML',
    authorName: 'Font author',
    authorUrl: '',
    uploaderIsAuthor: false,
    licence: 'OFL-1.1',
    licenceUrl: 'https://example.com/licence',
    permission: 'The author has provided permission for hosted redistribution.',
    rightsConfirmed: true,
  };
  assert.equal(uploadSchema.safeParse(validUpload).success, true);
  assert.equal(
    uploadSchema.safeParse({ ...validUpload, authorUrl: 'http://example.com' }).success,
    false,
  );
  assert.equal(uploadSchema.safeParse({ ...validUpload, uploaderIsAuthor: 'yes' }).success, false);
  assert.equal(
    reportSchema.safeParse({
      fontId: 'test-font',
      name: 'Owner',
      email: 'owner@example.com',
      details: 'I own this font and redistribution has not been granted.',
      evidenceUrl: 'https://example.com/ownership',
      goodFaith: true,
    }).success,
    true,
  );
  assert.equal(
    reportSchema.safeParse({
      fontId: 'test',
      name: 'x',
      email: 'bad',
      details: 'x',
      evidenceUrl: 'javascript:alert(1)',
      goodFaith: true,
    }).success,
    false,
  );
});
test('source copyright reports require a valid source id and evidence', () => {
  const report = {
    sourceId: 'malayalamfont-1000',
    name: 'Font owner',
    email: 'owner@example.com',
    details: 'I own this font and did not grant distribution through this listing.',
    evidenceUrl: 'https://example.com/ownership',
    goodFaith: true,
  };
  assert.equal(sourceFontReportSchema.safeParse(report).success, true);
  assert.equal(
    sourceFontReportSchema.safeParse({ ...report, sourceId: 'malayalamfont-1/../../admin' })
      .success,
    false,
  );
  assert.equal(
    sourceFontReportSchema.safeParse({ ...report, evidenceUrl: 'javascript:alert(1)' }).success,
    false,
  );
});
test('font inspection rejects arbitrary and out-of-bounds binaries', () => {
  assert.throws(() => inspectFont(new TextEncoder().encode('not a font').buffer));
  const data = new ArrayBuffer(28),
    view = new DataView(data);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  view.setUint32(20, 1000);
  view.setUint32(24, 500);
  assert.throws(() => inspectFont(data), /bounds/);
});
