import { expect, test } from '@playwright/test';
test('monochrome themes, compact searchable fonts and editor-text specimens', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const editor = page.getByLabel('Malayalam editor', { exact: true });
  await editor.fill('കേരളം');
  await expect(editor).toHaveValue('കേരളം');
  await page.getByRole('button', { name: 'Noto Sans Malayalam' }).click();
  await page.getByRole('searchbox', { name: 'Search Unicode fonts' }).fill('Serif');
  await page.getByRole('option', { name: /Noto Serif Malayalam/ }).click();
  await expect(editor).toHaveCSS('font-family', /Noto Serif Malayalam/);
  await expect(
    page.getByText('Google receives your Manglish. Online service · experimental.'),
  ).toHaveCount(0);
  await expect(page.getByText('Google', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  await expect(page.locator('.catalogue-row')).toHaveCount(2);
  await expect(page.locator('.catalogue-specimen').first()).toHaveText('കേരളം');
  await page.getByLabel('Font category').selectOption('Serif');
  await expect(page.locator('.catalogue-row')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Noto Serif Malayalam' })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noto Serif Malayalam' })).toBeVisible();
  await expect(page.locator('.font-detail-specimen')).toHaveText('കേരളം');
  await page.getByRole('button', { name: '← All fonts' }).click();
  await page.getByLabel('Font category').selectOption('All');
  await page
    .getByRole('group', { name: 'Filter by encoding' })
    .getByRole('button', { name: 'FML', exact: true })
    .click();
  await expect(page.getByText('No fonts match. Try another name or category.')).toBeVisible();
  await page
    .getByRole('group', { name: 'Filter by encoding' })
    .getByRole('button', { name: 'All', exact: true })
    .click();
  await page.getByLabel('Search fonts and families').fill('nothing-matches');
  await expect(page.getByText('No fonts match. Try another name or category.')).toBeVisible();
  await page.getByLabel('Search fonts and families').fill('');
  await page.screenshot({ path: `artifacts/fonts-desktop-${browserName}.png` });
  for (const theme of ['Light', 'Dark']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel(theme, { exact: true }).check();
    const colours = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ['--canvas', '--surface', '--paper'].map((key) => style.getPropertyValue(key).trim());
    });
    expect(new Set(colours).size).toBe(1);
    await page.getByRole('button', { name: 'Type', exact: true }).click();
    await expect(editor).toHaveValue('കേരളം');
    await page.screenshot({ path: `artifacts/editor-${theme.toLowerCase()}-${browserName}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fonts', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/fonts-mobile-${browserName}.png` });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
