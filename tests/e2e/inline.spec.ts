import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('background encoding preserves a native selection in the Unicode-rendered editor', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      set onmessage(callback: ((event: MessageEvent) => void) | null) {
        super.onmessage = (event) => {
          if (event.data.type === 'converted' && event.data.text === 'tIcfw') {
            (window as Window & { encodingQueued?: boolean }).encodingQueued = true;
            setTimeout(() => callback?.call(this, event), 400);
          } else callback?.call(this, event);
        };
      }
    };
  });
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Malayalam editor' });
  await editor.fill('കേരളം');
  await expect(editor).toHaveValue('കേരളം');
  await page.getByRole('button', { name: 'FML', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { encodingQueued?: boolean }).encodingQueued),
    )
    .toBe(true);
  await editor.focus();
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, el.value.length));
  await expect(page.getByRole('button', { name: 'Copy FML', exact: true })).toBeEnabled();
  expect(
    await editor.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 'കേരളം'.length]);
  await editor.press('a');
  await expect(editor).toHaveValue('അ');
});

test('one editable textbox transliterates while typing and keeps the caret, selection and undo', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Malayalam editor' });
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(editor).toBeEditable();
  await editor.pressSequentially('namaskaaram', { delay: 70 });
  await expect(editor).toHaveValue('നമസ്കാരം');
  expect(await editor.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    'നമസ്കാരം'.length,
  );
  await editor.pressSequentially(' amma', { delay: 60 });
  await expect(editor).toHaveValue('നമസ്കാരം അമ്മ');
  await editor.fill('മലയാളം കേരളം');
  await expect(editor).toHaveValue('മലയാളം കേരളം');
  await editor.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange('മലയാളം '.length, 'മലയാളം '.length),
  );
  await editor.pressSequentially('amma ', { delay: 60 });
  await expect(editor).toHaveValue('മലയാളം അമ്മ കേരളം');
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue('മലയാളം അമ്മകേരളം');
  await editor.press('ControlOrMeta+Shift+z');
  await expect(editor).toHaveValue('മലയാളം അമ്മ കേരളം');
  await editor.fill('👩‍👩‍👧‍👦 കേരളം\nമലയാളം');
  await expect(editor).toHaveValue('👩‍👩‍👧‍👦 കേരളം\nമലയാളം');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await page.screenshot({ path: `artifacts/inline-mobile-${browserName}.png` });
});

test('one editor exports each selected encoding and edits the real legacy font projection', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Malayalam editor' });
  await editor.fill('കേരളം');
  for (const mode of ['Unicode', 'FML', 'ML-TT']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(editor).toHaveValue('കേരളം');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .txt' }).click();
    expect(await readFile((await (await pending).path())!, 'utf8')).toBe(
      mode === 'Unicode' ? 'കേരളം' : 'tIcfw',
    );
  }
  const file = 'C:/Users/biswa/Downloads/Malayalam Fonts/Malayalam Fonts/FML Fonts/FMLKR0NTT.ttf';
  if (existsSync(file)) {
    await page.getByRole('button', { name: 'FML', exact: true }).click();
    await page.getByLabel('Load matching legacy font').setInputFiles(file);
    await expect(editor).toHaveValue('tIcfw');
    await expect(editor).toBeEditable();
    await editor.focus();
    await editor.press('End');
    await editor.pressSequentially(' amma', { delay: 60 });
    await expect(editor).toHaveValue('tIcfw A½');
    // Native selection copy/cut must use the legacy projection, with Unicode undo.
    const copied = await editor.evaluate((el: HTMLTextAreaElement) => {
      el.setSelectionRange(6, 8);
      const clipboard = new DataTransfer();
      const event = new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      });
      el.dispatchEvent(event);
      // Firefox clones the supplied DataTransfer; inspect the actual event payload.
      return event.clipboardData!.getData('text/plain');
    });
    expect(copied).toBe('A½');
    await editor.evaluate((el: HTMLTextAreaElement) => {
      el.dispatchEvent(
        new ClipboardEvent('cut', {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        }),
      );
    });
    await expect(editor).toHaveValue('tIcfw ');
    await editor.press('ControlOrMeta+z');
    await expect(editor).toHaveValue('tIcfw A½');
    await page.getByRole('button', { name: 'Unicode', exact: true }).click();
    await editor.fill('അമ്മ കേരളം');
    await page.getByRole('button', { name: 'FML', exact: true }).click();
    await expect(editor).toHaveValue('A½ tIcfw');
    await editor.focus();
    await editor.evaluate((el: HTMLTextAreaElement) => {
      el.setSelectionRange(3, 3);
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        el,
        'A½ namaskaaram tIcfw',
      );
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
    });
    await expect(page.getByText('Composing', { exact: true })).toBeVisible();
    await editor.evaluate((el) =>
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
    );
    await page.getByRole('button', { name: 'Unicode', exact: true }).click();
    await expect(editor).toHaveValue('അമ്മ നമസ്കാരം കേരളം');
    await editor.evaluate((el) =>
      el.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'historyUndo',
        }),
      ),
    );
    await expect(editor).toHaveValue('അമ്മ കേരളം');
    await editor.evaluate((el) =>
      el.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'historyRedo',
        }),
      ),
    );
    await expect(editor).toHaveValue('അമ്മ നമസ്കാരം കേരളം');
    await page.getByRole('button', { name: 'Unicode', exact: true }).click();
    await expect(editor).toHaveValue('അമ്മ നമസ്കാരം കേരളം');
    await page.screenshot({ path: `artifacts/inline-desktop-${browserName}.png` });
  }
});
