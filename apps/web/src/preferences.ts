import { fonts } from './catalogue';
export type Preferences = {
  provider: 'mozhi' | 'google';
  theme: 'system' | 'light' | 'dark';
  fontId: string;
  size: number;
  rememberDraft: boolean;
};
export const defaultPreferences: Preferences = {
  provider: 'mozhi',
  theme: 'system',
  fontId: fonts[0].id,
  size: 36,
  rememberDraft: false,
};
export const keys = {
  preferences: 'lipiflow.preferences.v1',
  draft: 'lipiflow.draft.v1',
  update: 'lipiflow.update.v1',
};

export function readPreferences(storage?: Pick<Storage, 'getItem'>): Preferences {
  try {
    const p = JSON.parse((storage ?? window.localStorage).getItem(keys.preferences) ?? '{}');
    return {
      provider: p.provider === 'google' ? 'google' : 'mozhi',
      theme: ['system', 'light', 'dark'].includes(p.theme) ? p.theme : 'system',
      fontId: fonts.some((font) => font.id === p.fontId) ? p.fontId : defaultPreferences.fontId,
      size: [28, 36, 44].includes(p.size) ? p.size : 36,
      rememberDraft: p.rememberDraft === true,
    };
  } catch {
    return { ...defaultPreferences };
  }
}

export function readInitialText(prefs: Preferences): string {
  try {
    const relay = sessionStorage.getItem(keys.update);
    sessionStorage.removeItem(keys.update);
    if (relay) {
      const data = JSON.parse(relay);
      if (typeof data.text === 'string' && Date.now() - data.created < 300000) return data.text;
    }
    if (prefs.rememberDraft) return localStorage.getItem(keys.draft) ?? '';
    localStorage.removeItem(keys.draft);
  } catch {
    /* Private browser modes may block storage. */
  }
  return '';
}

export function persistPreferences(
  prefs: Preferences,
  text: string,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
) {
  storage.setItem(keys.preferences, JSON.stringify(prefs));
  if (prefs.rememberDraft) storage.setItem(keys.draft, text);
  else storage.removeItem(keys.draft);
}
