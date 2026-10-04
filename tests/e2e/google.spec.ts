import { expect, test } from '@playwright/test';

// Keep these endpoint fixtures deterministic: a service worker can bypass
// Playwright's page routing, particularly in WebKit. Real PWA coverage is separate.
test.use({ serviceWorkers: 'block' });

test('Google word suggestions, protected text, UTF-8 export and provider persistence', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('https://inputtools.google.com/request?**', async (route) => {
    const word = new URL(route.request().url()).searchParams.get('text')!;
    requests.push(word);
    const candidates = word === 'ente' ? ['എന്റെ', 'എൻ്റെ'] : ['പേര്', 'പേരും'];
    await route.fulfill({ json: ['SUCCESS', [[word, candidates]]] });
  });
  await page.goto('/');
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await source.fill('ente peru!\n{LipiFlow} 😀 123');
  await expect(output).toHaveValue('എന്റെ പേര്!\nLipiFlow 😀 123');
  expect(requests).toHaveLength(2);
  expect(requests).toContain('ente');
  expect(requests).toContain('peru');
  await expect(page.getByLabel('Typing method', { exact: true })).toHaveValue('google');
  await page.getByText('Choose another spelling · Google suggestions').click();
  await page.getByLabel('Spelling for ente').selectOption('എൻ്റെ');
  await expect(output).toHaveValue('എൻ്റെ പേര്!\nLipiFlow 😀 123');
  await page.getByRole('button', { name: 'FML', exact: true }).click();
  await expect(output).toHaveValue('എൻ്റെ പേര്!\nLipiFlow 😀 123');
  await expect(page.getByRole('button', { name: 'Copy FML', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Unicode', exact: true }).click();
  await expect(output).toHaveValue('എൻ്റെ പേര്!\nLipiFlow 😀 123');
  await expect(source).toHaveValue('എൻ്റെ പേര്!\nLipiFlow 😀 123');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt' }).click();
  const { readFile } = await import('node:fs/promises');
  expect(await readFile((await (await downloadPromise).path())!, 'utf8')).toBe(
    'എൻ്റെ പേര്!\nLipiFlow 😀 123',
  );
  await page.reload();
  await expect(page.getByLabel('Typing method', { exact: true })).toHaveValue('google');
  await expect(source).toHaveValue('');
});

test('keeps an already converted word visible while the next word is converting', async ({
  page,
}) => {
  const requests: string[] = [];
  let releaseSecond!: () => void;
  let secondStarted!: () => void;
  const secondRequest = new Promise<void>((resolve) => {
    secondStarted = resolve;
  });
  const secondResponse = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  await page.route('https://inputtools.google.com/request?**', async (route) => {
    const word = new URL(route.request().url()).searchParams.get('text')!;
    requests.push(word);
    if (word === 'peru') {
      secondStarted();
      await secondResponse;
    }
    const output = word === 'ente' ? 'എന്റെ' : 'പേര്';
    await route.fulfill({ json: ['SUCCESS', [[word, [output]]]] });
  });
  await page.goto('/');
  const editor = page.getByLabel('Malayalam editor', { exact: true });
  await editor.fill('ente');
  await expect(editor).toHaveValue('എന്റെ');
  await editor.pressSequentially(' peru', { delay: 60 });
  await secondRequest;
  await expect(editor).toHaveValue('എന്റെ peru');
  expect(requests).toEqual(['ente', 'peru']);
  releaseSecond();
  await expect(editor).toHaveValue('എന്റെ പേര്');
});

test('Google rejects stale replies, pauses composition, and recovers from failures', async ({
  page,
}) => {
  let fail = false;
  let started = false;
  await page.route('https://inputtools.google.com/request?**', async (route) => {
    const phrase = new URL(route.request().url()).searchParams.get('text')!;
    if (fail) return route.fulfill({ status: 503, body: '' });
    if (phrase === 'old') {
      started = true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await route
      .fulfill({ json: ['SUCCESS', [[phrase, [phrase === 'old' ? 'പഴയത്' : 'പുതിയത്']]]] })
      .catch(() => {});
  });
  await page.goto('/');
  const source = page.getByLabel('Malayalam editor', { exact: true });
  const output = page.getByLabel('Malayalam editor', { exact: true });
  await source.fill('old');
  await expect.poll(() => started).toBe(true);
  await source.fill('new');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  await expect(output).toHaveValue('പുതിയത്');
  await page.waitForTimeout(1100);
  await expect(output).toHaveValue('പുതിയത്');
  await expect(source).toBeFocused();
  await source.dispatchEvent('compositionstart');
  await source.fill('composing');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  await expect(output).toHaveValue('composing');
  await source.dispatchEvent('compositionend');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeEnabled();
  fail = true;
  await source.fill('failure');
  await expect(page.getByText(/Google could not convert this text/)).toBeVisible();
  await expect(source).toHaveValue('failure');
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Retry conversion' }).click();
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeEnabled();
  await page.getByLabel('Typing method', { exact: true }).selectOption('mozhi');
  await source.fill('amma');
  await expect(output).toHaveValue('അമ്മ');
});

test('Google selection uses a labelled local fallback offline without requests', async ({
  page,
}) => {
  let requests = 0;
  await page.route('https://inputtools.google.com/request?**', async (route) => {
    requests++;
    await route.abort();
  });
  await page.goto('/');
  // Dispatch browser connectivity state on all engines, including WebKit.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await page.getByLabel('Malayalam editor', { exact: true }).fill('amma');
  await expect(page.getByLabel('Malayalam editor', { exact: true })).toHaveValue('അമ്മ');
  await expect(page.getByText('Offline · using Mozhi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Malayalam' })).toBeEnabled();
  expect(requests).toBe(0);
});
