import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(execFile);
const origin = 'http://127.0.0.1:4174';
const repo = process.cwd();
const server = path.join(repo, 'apps/server');
const wrangler = path.join(server, 'node_modules/wrangler/bin/wrangler.js');
const fixturePath = path.join(repo, 'tests/fixtures/noto-sans-malayalam.ttf');
const assetId = `local-font-${randomBytes(12).toString('hex')}`;
const objectKey = `catalogue-fonts/${assetId}.ttf`;
const family = `R2 fixture ${assetId.slice(-6)}`;
const sha = createHash('sha256')
  .update(await readFile(fixturePath))
  .digest('hex');
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;

async function wranglerRun(...args: string[]) {
  await exec(process.execPath, [wrangler, ...args], { cwd: server, windowsHide: true });
}

test.beforeAll(async () => {
  await wranglerRun(
    'r2',
    'object',
    'put',
    `lipiflow-user-fonts-local/${objectKey}`,
    '--local',
    '--env',
    'local',
    '--file',
    fixturePath,
    '--content-type',
    'font/ttf',
    '--force',
  );
  await wranglerRun(
    'd1',
    'execute',
    'DB',
    '--local',
    '--env',
    'local',
    '--command',
    `INSERT OR REPLACE INTO fontAssets(id,filename,name,family,variant,sourceCategory,encoding,sourceId,mapVersion,objectKey,sha256,bytes,importedAt) VALUES(${[
      assetId,
      'noto-sans-malayalam.ttf',
      'Noto R2 fixture',
      family,
      'Regular',
      'Unicode Fonts',
      'Unicode',
      null,
      '',
      objectKey,
      sha,
      (await readFile(fixturePath)).byteLength,
      Date.now(),
    ]
      .map((value) =>
        typeof value === 'number' ? String(value) : value === null ? 'NULL' : sql(value),
      )
      .join(',')})`,
  );
});

test.afterAll(async () => {
  await wranglerRun(
    'd1',
    'execute',
    'DB',
    '--local',
    '--env',
    'local',
    '--command',
    `DELETE FROM fontAssetReports WHERE assetId=${sql(assetId)}; DELETE FROM fontAssets WHERE id=${sql(assetId)};`,
  ).catch(() => {});
  await wranglerRun(
    'r2',
    'object',
    'delete',
    `lipiflow-user-fonts-local/${objectKey}`,
    '--local',
    '--env',
    'local',
  ).catch(() => {});
});

async function signIn(request: APIRequestContext, role: 'user' | 'admin' = 'user') {
  const response = await request.post('/api/dev/sign-in', {
    headers: { Origin: origin },
    data: { role, testId: randomBytes(12).toString('hex') },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).csrf as string;
}

test('R2 catalogue assets preview, download and pause after a copyright report', async ({
  page,
}: {
  page: Page;
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('lipiflow.preferences.v1', JSON.stringify({ provider: 'mozhi' }));
  });
  await page.goto('/');
  await page.getByLabel('Malayalam editor', { exact: true }).fill('മലയാളം');
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  await page.getByLabel('Search fonts and families').fill(family);
  const row = page.locator('.local-font-family-row').filter({ hasText: family });
  await expect(row).toBeVisible();
  const catalogue = page.locator('.catalogue-list');
  await expect(catalogue).toHaveAttribute('data-view', 'list');
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(catalogue).toHaveAttribute('data-view', 'cards');
  await expect(row).toHaveCSS('display', 'flex');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(catalogue).toHaveAttribute('data-view', 'list');
  await row.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByRole('heading', { name: family })).toBeVisible();
  await page.getByLabel('Type Manglish preview text').fill('manassil ninnu thanne');
  await expect(page.locator('.font-detail-specimen')).toContainText('മന');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download family (.zip)' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);

  await page.getByRole('button', { name: 'Report copyright' }).click();
  await page.getByLabel('Your name').fill('Test owner');
  await page.getByLabel('Contact email').fill('owner@example.com');
  await page.getByLabel('Ownership or permission evidence').fill('https://example.com/rights');
  await page
    .getByLabel('Describe the copyright concern')
    .fill('This local R2 fixture is used to test removal after a copyright report.');
  await page.getByLabel('I believe this report is accurate and made in good faith.').check();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText(/Report received. Reference:/)).toBeVisible();
  const publicAssets = await (await page.request.get('/api/font-assets')).json();
  expect(publicAssets.fonts.some((font: { id: string }) => font.id === assetId)).toBe(false);

  const csrf = await signIn(page.request, 'admin');
  const reports = await (await page.request.get('/api/admin/font-asset-reports')).json();
  const report = reports.reports.find((item: { assetId: string }) => item.assetId === assetId);
  expect(report).toBeTruthy();
  const resolved = await page.request.patch(`/api/admin/source-font-reports/${report.id}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf },
    data: {
      resolution: 'Verified the local test fixture and restored its listing.',
      restoreDownload: true,
    },
  });
  expect(resolved.ok()).toBe(true);
  const restoredAssets = await (await page.request.get('/api/font-assets')).json();
  expect(restoredAssets.fonts.some((font: { id: string }) => font.id === assetId)).toBe(true);
});
