import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lipiflow.preferences.v1', JSON.stringify({ provider: 'mozhi' }));
  });
});

test('FML and ML-TT encode real text, export codes, reject unknown fonts and preserve Unicode', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as Window & { copied?: string }).copied = text;
        },
      },
    });
  });
  await page.goto('/');
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await source.fill('കേരളം!\n{English} 😀 123 -');
  await expect(output).toHaveValue('കേരളം!\nEnglish 😀 123 -');
  await page.getByRole('button', { name: 'FML', exact: true }).click();
  await expect(output).toHaveValue('കേരളം!\nEnglish 😀 123 -');
  await page.getByRole('button', { name: 'Copy FML', exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copied?: string }).copied)).toBe(
    'tIcfw!\nEnglish 😀 123 -',
  );
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('lipiflow-fml-karthika.txt');
  expect(await readFile((await download.path())!, 'utf8')).toBe('tIcfw!\nEnglish 😀 123 -');
  await page
    .getByLabel('Load matching legacy font')
    .setInputFiles({ name: 'wrong.ttf', mimeType: 'font/ttf', buffer: Buffer.from('wrong') });
  await expect(page.getByText(/This font variant has not been checked/)).toBeVisible();
  await expect(source).toHaveValue('കേരളം!\nEnglish 😀 123 -');
  await page.getByRole('button', { name: 'ML-TT', exact: true }).click();
  await expect(output).toHaveValue('കേരളം!\nEnglish 😀 123 -');
  await expect(page.getByRole('button', { name: 'Copy ML-TT', exact: true })).toBeEnabled();
  await source.fill('ക്രോ ഫ്രൈ ൺൻർൽൾ ക്‌');
  await expect(output).toHaveValue('ക്രോ ഫ്രൈ ൺൻർൽൾ ക്‌');
  await source.dispatchEvent('compositionstart');
  await source.fill('മലയാളം');
  await expect(page.getByRole('button', { name: 'Copy ML-TT', exact: true })).toBeDisabled();
  await source.dispatchEvent('compositionend');
  await expect(output).toHaveValue('മലയാളം');
  await source.fill('ൠ 😀');
  await expect(page.getByRole('alert')).toContainText('U+D60');
  await expect(page.getByRole('button', { name: 'Copy ML-TT', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Unicode', exact: true }).click();
  await expect(output).toHaveValue('ൠ 😀');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 760 });
  await page.getByRole('button', { name: 'FML', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/encoder-mobile-${browserName}.png` });
});

test('legacy worker rejects delayed old results after rapid edits', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      set onmessage(callback: ((event: MessageEvent) => void) | null) {
        super.onmessage = (event) => {
          if (event.data.type === 'converted' && event.data.text === 'aebmfw') {
            (window as Window & { delayed?: boolean }).delayed = true;
            setTimeout(() => callback?.call(this, event), 500);
          } else callback?.call(this, event);
        };
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'FML', exact: true }).click();
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await source.fill('മലയാളം');
  await expect
    .poll(() => page.evaluate(() => (window as Window & { delayed?: boolean }).delayed))
    .toBe(true);
  await source.fill('കേരളം');
  await expect(output).toHaveValue('കേരളം');
  await page.waitForTimeout(650);
  await expect(output).toHaveValue('കേരളം');
  await expect(source).toBeFocused();
  await expect(page.getByRole('button', { name: 'Copy FML', exact: true })).toBeEnabled();
});

test('supplied regular Karthika fonts render encoded text without upload', async ({
  page,
  browserName,
}) => {
  const base = 'C:/Users/biswa/Downloads/Malayalam Fonts/Malayalam Fonts';
  const fml = `${base}/FML Fonts/FMLKR0NTT.ttf`;
  const mltt = `${base}/ML Fonts/MLKR0NTT.TTF`;
  test.skip(!existsSync(fml) || !existsSync(mltt), 'User-owned fonts are not distributed in CI.');
  await page.goto('/');
  await page
    .getByLabel('Malayalam editor', { exact: true })
    .fill('കേരളം ക്രോ ഫ്രൈ സ്ഥലത്തേ\nൺൻർൽൾ കൊ കോ കൈ കൗ');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  for (const [mode, file] of [
    ['FML', fml],
    ['ML-TT', mltt],
  ]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await page.getByLabel('Load matching legacy font').setInputFiles(file);
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveCSS(
      'font-family',
      /LipiFlow-/,
    );
    await expect(page.getByRole('button', { name: `Copy ${mode}`, exact: true })).toBeEnabled();
    await page.screenshot({ path: `artifacts/encoder-${mode}-${browserName}.png` });
  }
  expect(requests).toEqual([]);
});
