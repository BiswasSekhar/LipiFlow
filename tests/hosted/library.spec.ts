import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
const origin = 'http://127.0.0.1:4174';
async function login(request: APIRequestContext, role = 'user') {
  const response = await request.post('/api/dev/sign-in', {
    headers: { Origin: origin },
    data: { role, testId: randomUUID() },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).csrf as string;
}
const metadata = {
  name: 'OFL test font',
  family: 'OFL test family',
  description: 'A test font family for verifying private upload and public previews.',
  variant: 'Regular',
  category: 'Sans serif',
  encoding: 'Unicode',
  authorName: 'Test author',
  authorUrl: 'https://github.com/notofonts/malayalam',
  uploaderIsAuthor: true,
  licence: 'OFL-1.1',
  licenceUrl: 'https://github.com/notofonts/malayalam',
  permission: 'This is the bundled Noto OFL fixture used only for local automated tests.',
  rightsConfirmed: true,
};

test('D1/R2 approval, ownership, CSRF, favourites, private drafts and copyright removal', async ({
  page,
  browser,
}) => {
  const owner = page.request,
    csrf = await login(owner);
  const form = {
    metadata: JSON.stringify(metadata),
    file: {
      name: 'noto-fixture.ttf',
      mimeType: 'font/ttf',
      buffer: await readFile('tests/fixtures/noto-sans-malayalam.ttf'),
    },
  };
  const bad = await owner.post('/api/fonts', { headers: { Origin: origin }, multipart: form });
  expect(bad.status()).toBe(403);
  const wrongOrigin = await owner.post('/api/fonts', {
    headers: { Origin: 'https://evil.example', 'X-CSRF-Token': csrf },
    multipart: form,
  });
  expect(wrongOrigin.status()).toBe(403);
  const upload = await owner.post('/api/fonts', {
    headers: { Origin: origin, 'X-CSRF-Token': csrf },
    multipart: form,
  });
  expect(upload.status()).toBe(201);
  const { id } = await upload.json();
  const publicContext = await browser.newContext({ baseURL: origin }),
    publicClient = publicContext.request;
  const memberContext = await browser.newContext({ baseURL: origin }),
    other = memberContext.request;
  await login(other);
  const adminContext = await browser.newContext({ baseURL: origin }),
    admin = adminContext.request,
    adminCsrf = await login(admin, 'admin');
  try {
    expect((await publicClient.get(`/api/fonts/${id}/file`)).status()).toBe(404);
    expect((await other.get(`/api/fonts/${id}/file`)).status()).toBe(404);
    expect((await owner.get(`/api/fonts/${id}/file`)).status()).toBe(200);
    expect((await owner.get('/api/admin/library')).status()).toBe(403);
    const denied = await admin.patch(`/api/admin/fonts/${id}`, {
      headers: { Origin: origin, 'X-CSRF-Token': adminCsrf },
      data: { status: 'approved', note: 'OFL permission reviewed', rightsReviewed: false },
    });
    expect(denied.status()).toBe(400);
    const approved = await admin.patch(`/api/admin/fonts/${id}`, {
      headers: { Origin: origin, 'X-CSRF-Token': adminCsrf },
      data: {
        status: 'approved',
        note: 'OFL permission reviewed for the local fixture',
        rightsReviewed: true,
      },
    });
    expect(approved.ok()).toBe(true);
    const published = (await (await publicClient.get('/api/fonts')).json()).fonts.find(
      (font: { id: string }) => font.id === id,
    );
    expect(published).toBeTruthy();
    expect(published).toMatchObject({
      family: metadata.family,
      description: metadata.description,
      authorName: metadata.authorName,
      authorUrl: metadata.authorUrl,
      uploaderIsAuthor: 1,
    });
    for (const key of ['ownerId', 'permission', 'reviewNote', 'filename', 'objectKey'])
      expect(published).not.toHaveProperty(key);
    const bytes = await publicClient.get(`/api/fonts/${id}/file`);
    expect(bytes.status()).toBe(200);
    expect(await bytes.body()).toEqual(form.file.buffer);
    expect(bytes.headers()['cache-control']).toBe('no-store');
    const download = await publicClient.get(`/api/fonts/${id}/file?download=1`);
    expect(download.headers()['content-disposition']).toMatch(/^attachment;/);
    expect(
      (
        await owner.put(`/api/favourites/${id}`, {
          headers: { Origin: origin, 'X-CSRF-Token': csrf },
        })
      ).ok(),
    ).toBe(true);
    expect((await (await owner.get('/api/me')).json()).favourites).toContain(id);
    const saved = await owner.post('/api/drafts', {
      headers: { Origin: origin, 'X-CSRF-Token': csrf },
      data: { title: 'Private test draft', text: 'മലയാളം 😀' },
    });
    expect(saved.status()).toBe(201);
    const draft = (await saved.json()).id;
    expect((await other.get('/api/drafts')).status()).toBe(200);
    expect(
      (await (await other.get('/api/drafts')).json()).drafts.some(
        (x: { id: string }) => x.id === draft,
      ),
    ).toBe(false);
    await other.delete('/api/drafts/' + draft, {
      headers: { Origin: origin, 'X-CSRF-Token': (await (await other.get('/api/me')).json()).csrf },
    });
    expect(
      (await (await owner.get('/api/drafts')).json()).drafts.some(
        (x: { id: string }) => x.id === draft,
      ),
    ).toBe(true);
    const report = await publicClient.post('/api/reports', {
      headers: { Origin: origin },
      data: {
        fontId: id,
        name: 'Test owner',
        email: 'owner@example.com',
        details: 'Test copyright report to verify immediate removal of font distribution.',
        evidenceUrl: 'https://github.com/notofonts/malayalam',
        goodFaith: true,
      },
    });
    expect(report.status()).toBe(201);
    const reportId = (await report.json()).id;
    expect((await publicClient.get('/api/admin/library')).status()).toBe(401);
    await admin.patch('/api/admin/reports/' + reportId, {
      headers: { Origin: origin, 'X-CSRF-Token': adminCsrf },
      data: {
        resolution: 'Local fixture report resolved; font hidden for regression coverage.',
        hideFont: true,
      },
    });
    expect((await publicClient.get(`/api/fonts/${id}/file`)).status()).toBe(404);
    expect(
      (await (await publicClient.get('/api/fonts')).json()).fonts.some(
        (font: { id: string }) => font.id === id,
      ),
    ).toBe(false);
    await owner.delete('/api/drafts/' + draft, {
      headers: { Origin: origin, 'X-CSRF-Token': csrf },
    });
    await owner.post('/api/auth/sign-out', { headers: { Origin: origin, 'X-CSRF-Token': csrf } });
    expect((await owner.get('/api/me/fonts')).status()).toBe(401);
  } finally {
    await Promise.all([publicContext.close(), memberContext.close(), adminContext.close()]);
  }
});

test('browser upload → separate admin review → live font preview → user report → hidden asset', async ({
  page,
  browserName,
}) => {
  const name = 'Noto review ' + browserName + ' ' + randomUUID().slice(0, 8);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in as member', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local member', exact: true })).toBeVisible();
  await page.getByLabel('Draft title').fill(name);
  await page.getByRole('button', { name: 'Save current text', exact: true }).click();
  await expect(page.getByText('Draft saved', { exact: true })).toBeVisible();
  await page
    .getByLabel('Font file', { exact: true })
    .setInputFiles('tests/fixtures/noto-sans-malayalam.ttf');
  await page.getByLabel('Font or style name', { exact: true }).fill(name);
  await page.getByLabel('Family', { exact: true }).fill(name + ' family');
  await page
    .getByLabel('About this font', { exact: true })
    .fill('A reviewed test family with a live Malayalam preview.');
  await page.getByLabel('I am the font’s author').check();
  await expect(page.getByText('മലയാളം, മനസ്സിൽ നിന്ന്.', { exact: true }).last()).toBeVisible();
  await page.getByLabel('Licence', { exact: true }).fill('OFL-1.1');
  await page
    .getByLabel('Licence or permission link')
    .fill('https://github.com/notofonts/malayalam');
  await page.getByLabel('Redistribution permission', { exact: true }).fill(metadata.permission);
  await page
    .getByLabel('I have permission to upload this font for review and redistribution.')
    .check();
  await page.getByRole('button', { name: 'Submit font', exact: true }).click();
  await expect(page.getByText('Uploaded privately. Waiting for admin review.')).toBeVisible();
  const font = (await (await page.request.get('/api/me/fonts')).json()).fonts.find(
    (font: { name: string }) => font.name === name,
  );
  expect(font.status).toBe('pending');
  expect(font.family).toBe(name + ' family');
  expect(font.uploaderIsAuthor).toBe(1);
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Sign in as local admin' }).click();
  await page.getByLabel('Search uploads').fill(name);
  const review = page.locator('.review-row').filter({ hasText: name });
  await review
    .getByLabel('Review note for ' + name)
    .fill('Reviewed bundled Noto OFL notice for this local test fixture.');
  await review.getByLabel('I reviewed the permission to host and redistribute this font.').check();
  await review.getByRole('button', { name: 'Publish font', exact: true }).click();
  await expect(review).toHaveCount(0);
  await page.screenshot({ path: `artifacts/admin-${browserName}.png` });
  await page.goto('/');
  const editor = page.getByLabel('Malayalam editor', { exact: true });
  await editor.fill('കേരളം');
  await expect(editor).toHaveValue('കേരളം');
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  await page.getByLabel('Search fonts and families').fill(name);
  const row = page.locator('.font-family-row').filter({ hasText: name });
  await expect(row.locator('.catalogue-specimen')).toHaveText('കേരളം');
  await row.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByText('Author uploaded', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download family (.zip)' })).toBeVisible();
  await page.getByLabel('Type Manglish preview text').fill('keralam');
  await expect(page.locator('.font-detail-specimen')).toHaveText('കേരളം');
  const fontDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download family (.zip)' }).click();
  expect((await fontDownload).suggestedFilename()).toMatch(/\.zip$/);
  await page.getByRole('button', { name: '← All font families' }).click();
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  await page.getByLabel('Search fonts and families').fill(name);
  await page
    .locator('.font-family-row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Details' })
    .click();
  await page.getByRole('button', { name: 'Report copyright' }).click();
  await page.getByLabel('Your name').fill('Test owner');
  await page.getByLabel('Contact email').fill('owner@example.com');
  await page
    .getByLabel('Ownership or permission evidence')
    .fill('https://github.com/notofonts/malayalam');
  await page
    .getByLabel('Describe the copyright concern')
    .fill('Local automated test report for removal of the uploaded fixture.');
  await page.getByLabel('I believe this report is accurate and made in good faith.').check();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText(/Report received. Reference:/)).toBeVisible();
  await page.getByRole('button', { name: 'Close report' }).click();
  await page.goto('/admin/');
  await page.getByRole('button', { name: /Copyright reports/ }).click();
  const report = page
    .locator('.review-row')
    .filter({ hasText: font.id })
    .filter({ hasText: 'Test owner' });
  await report
    .getByLabel('Resolution note')
    .fill('Fixture report resolved by removing this font from public distribution.');
  await report.getByRole('button', { name: 'Resolve report' }).click();
  await expect(report.getByText('resolved', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/admin-reports-${browserName}.png` });
});
