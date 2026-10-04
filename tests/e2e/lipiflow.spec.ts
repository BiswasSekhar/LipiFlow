import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { artifactServer } from './artifact-server';

async function open(page: import('@playwright/test').Page, url = '/') {
  await page.goto(url);
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
}

test('typing, fonts, guide, UTF-8 export and navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  await source.fill('namaskaaram!\n{LipiFlow} 😀');
  await expect(output).toHaveValue('നമസ്കാരം!\nLipiFlow 😀');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('lipiflow-malayalam.txt');
  expect(await readFile((await download.path())!, 'utf8')).toBe('നമസ്കാരം!\nLipiFlow 😀');
  await page.getByLabel('Preview font').selectOption('noto-serif-malayalam');
  await expect(output).toHaveCSS('font-family', /Noto Serif Malayalam/);
  await expect(output).toHaveValue('നമസ്കാരം!\nLipiFlow 😀');
  await page.getByRole('button', { name: 'Typing guide' }).click();
  await page.getByLabel('Find a letter, spelling or example').fill('chillu');
  await expect(page.getByText('Word-ending chillus')).toBeVisible();
  await expect(page.getByText('Velar consonants', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close typing guide' }).click();
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noto Sans Malayalam' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Noto Serif Malayalam' })).toBeVisible();
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await expect(source).toHaveValue('നമസ്കാരം!\nLipiFlow 😀');
  await expect(page.getByRole('button', { name: 'FML', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('rapid edits, selection replacement, undo and composition', async ({ page }) => {
  await open(page);
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await source.fill('amma');
  await source.fill('njaan');
  await source.fill('nandi');
  await expect(output).toHaveValue('നന്ദി');
  await source.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 5));
  await source.press('n');
  await expect(output).toHaveValue('ൻ');
  await source.press('ControlOrMeta+z');
  await expect(source).toHaveValue('നന്ദി');
  await expect(output).toHaveValue('നന്ദി');
  await source.evaluate((element: HTMLTextAreaElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      element,
      'amma',
    );
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: 'amma',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    );
  });
  await expect(page.getByText('Composing', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  await expect(output).toHaveValue('amma');
  await source.evaluate((element) =>
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'amma' })),
  );
  await expect(output).toHaveValue('അമ്മ');
  await expect(source).toBeFocused();
});

test('draft privacy, settings persistence and deletion', async ({ page }) => {
  await open(page);
  await page.getByLabel('Malayalam editor', { exact: true }).fill('amma');
  await page.reload();
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('');
  await page.getByLabel('Malayalam editor', { exact: true }).fill('njaan');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: /Remember draft/ }).check();
  await page.getByLabel('Dark', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: /Remember draft/ }).uncheck();
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ');
  await page.reload();
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('');
});

test('offline reload includes engine, fonts and exports; typing makes no requests', async ({
  page,
  context,
  browserName,
  browser,
}) => {
  // Playwright #42775: WebKit's offline emulation rejects even cached SW
  // responses. Stop an isolated real origin instead; no network fallback exists.
  const isolated = browserName === 'webkit' ? await artifactServer() : undefined;
  try {
    await open(page, isolated?.origin);
    await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    if (isolated) await isolated.stop();
    else await context.setOffline(true);
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(
      page.getByText(isolated ? 'Ready offline' : 'Working offline', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.getByLabel('Malayalam editor', { exact: true }).fill('njaan {offline}');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ offline');
    await page.getByLabel('Preview font').selectOption('noto-serif-malayalam');
    await page.evaluate(async () => {
      await document.fonts.load('36px "Noto Serif Malayalam"', 'മലയാളം');
    });
    expect(
      await page.evaluate(() => document.fonts.check('36px "Noto Serif Malayalam"', 'മലയാളം')),
    ).toBe(true);
    // Font fetches are local cache lookups; text conversion must make no requests.
    const before = requests.length;
    await page.getByLabel('Malayalam editor', { exact: true }).fill('namaskaaram');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('നമസ്കാരം');
    expect(requests.slice(before)).toEqual([]);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .txt' }).click();
    expect((await download).suggestedFilename()).toBe('lipiflow-malayalam.txt');
    for (const mode of ['FML', 'ML-TT']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByLabel('Malayalam editor', { exact: true }).fill('കേരളം');
      await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('കേരളം');
      const legacyDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download .txt' }).click();
      expect(await readFile((await (await legacyDownload).path())!, 'utf8')).toBe('tIcfw');
    }
    expect(requests.slice(before)).toEqual([]);
    if (isolated) {
      const control = await browser.newContext();
      try {
        await expect((await control.newPage()).goto(isolated.origin)).rejects.toThrow();
      } finally {
        await control.close();
      }
    }
  } finally {
    if (isolated) await isolated.stop();
    else await context.setOffline(false);
  }
});

test('accepting a service-worker update preserves an unsaved draft', async ({ page }) => {
  const server = await artifactServer();
  try {
    await open(page, server.origin);
    await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
    await page.getByLabel('Malayalam editor', { exact: true }).fill('njaan {unsaved}');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ unsaved');
    server.revise();
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(page.getByRole('button', { name: 'Update app' })).toBeVisible();
    await page.getByRole('button', { name: 'Update app' }).click();
    await expect(page.getByRole('button', { name: 'Update app' })).toHaveCount(0);
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ unsaved');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ unsaved');
    expect(await page.evaluate(() => localStorage.getItem('lipiflow.draft.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('lipiflow.update.v1'))).toBeNull();
  } finally {
    await server.stop();
  }
});

test('clipboard refusal offers selected output for manual copying', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    }),
  );
  await open(page);
  await page.getByLabel('Malayalam editor', { exact: true }).fill('amma');
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('അമ്മ');
  await page.getByRole('button', { name: 'Copy Malayalam' }).click();
  await expect(page.getByText(/Clipboard access is unavailable/)).toBeVisible();
  expect(
    await page
      .getByLabel('Malayalam editor', { exact: true })
      .evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart),
  ).toBe('അമ്മ'.length);
});

test('single mobile editor, keyboard access and unclipped font rendering', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const editor = page.getByRole('textbox', { name: 'Malayalam editor' });
  await page.getByRole('button', { name: /Load example/ }).click();
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeEnabled();
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(editor).toBeVisible();
  await editor.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Load example/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeFocused();
  const copy = await page.getByRole('button', { name: 'Copy Malayalam' }).boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(copy!.y + copy!.height).toBeLessThanOrEqual(nav!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/mobile-${test.info().project.name}.png` });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('local font files load without upload and show an explicitly unmapped character proof', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url());
  });
  await page.getByLabel('Local font files').setInputFiles({
    name: 'local-proof.woff2',
    mimeType: 'font/woff2',
    buffer: await readFile('apps/web/public/fonts/noto-sans-malayalam.woff2'),
  });
  await expect(page.getByRole('heading', { name: 'local-proof.woff2' })).toBeVisible();
  await expect(page.getByText('Local file · unmapped')).toBeVisible();
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (font) => font.family.startsWith('LipiFlowLocal-') && font.status === 'loaded',
      ),
    ),
  ).toBe(true);
  expect(externalRequests).toEqual([]);
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some((font) => font.family.startsWith('LipiFlowLocal-')),
    ),
  ).toBe(false);
  await expect(page.getByRole('button', { name: 'FML', exact: true })).toBeEnabled();
});

test('WASM startup failure preserves source and offers recovery', async ({ page }) => {
  await page.route('**/*.wasm', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry conversion' })).toBeVisible();
  await page.getByLabel('Malayalam editor', { exact: true }).fill('njaan');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  await page.unroute('**/*.wasm');
  await page.getByRole('button', { name: 'Retry conversion' }).click();
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ');
});

test('blocked browser storage does not prevent private typing', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage'])
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException('Storage blocked', 'SecurityError');
        },
      });
  });
  await open(page);
  await page.getByLabel('Malayalam editor', { exact: true }).fill('amma');
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('അമ്മ');
  await expect(page.getByText(/This browser could not save/)).toBeVisible();
});

test('another tab accepting an update cannot discard this tab’s text', async ({
  page,
  context,
}) => {
  const server = await artifactServer();
  try {
    await open(page, server.origin);
    await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
    await page.getByLabel('Malayalam editor', { exact: true }).fill('njaan {first tab}');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ first tab');
    const other = await context.newPage();
    await open(other, server.origin);
    await other.getByLabel('Malayalam editor', { exact: true }).fill('amma');
    server.revise();
    await other.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(other.getByRole('button', { name: 'Update app' })).toBeVisible();
    await other.getByRole('button', { name: 'Update app' }).click();
    await expect(other.getByRole('button', { name: 'Update app' })).toHaveCount(0);
    await expect(other.getByLabel('Malayalam editor', { exact: true })).toHaveValue('അമ്മ');
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ first tab');
    await expect(page.getByRole('button', { name: 'Update app' })).toBeVisible();
    await page.getByRole('button', { name: 'Update app' }).click();
    await expect(page.getByRole('button', { name: 'Update app' })).toHaveCount(0);
    await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('ഞാൻ first tab');
  } finally {
    await server.stop();
  }
});
