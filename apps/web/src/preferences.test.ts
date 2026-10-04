import { expect, it } from 'vitest';
import { defaultPreferences, keys, persistPreferences, readPreferences } from './preferences';
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
it('discards malformed preferences and unknown font ids', () => {
  const storage = store();
  storage.setItem(keys.preferences, '{broken');
  expect(readPreferences(storage)).toEqual(defaultPreferences);
  storage.setItem(
    keys.preferences,
    JSON.stringify({ theme: 'unexpected', fontId: 'missing', size: 999, rememberDraft: 'yes' }),
  );
  expect(readPreferences(storage)).toEqual(defaultPreferences);
});
it('defaults to Google online while preserving an explicit Mozhi choice', () => {
  const storage = store();
  expect(readPreferences(storage).provider).toBe('google');
  storage.setItem(keys.preferences, JSON.stringify({ provider: 'mozhi' }));
  expect(readPreferences(storage).provider).toBe('mozhi');
});
it('stores drafts only with explicit opt-in and deletes them when disabled', () => {
  const storage = store();
  persistPreferences(defaultPreferences, 'private', storage);
  expect(storage.getItem(keys.draft)).toBeNull();
  persistPreferences({ ...defaultPreferences, rememberDraft: true }, 'private', storage);
  expect(storage.getItem(keys.draft)).toBe('private');
  persistPreferences({ ...defaultPreferences, theme: 'dark' }, 'private', storage);
  expect(storage.getItem(keys.draft)).toBeNull();
  expect(readPreferences(storage).theme).toBe('dark');
});
