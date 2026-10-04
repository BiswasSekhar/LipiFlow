import { useEffect, useRef, useState } from 'react';
import type { Account, PublishedFont } from '@lipiflow/library';
import { api, apiUrl, authHeaders } from '@lipiflow/library/client';
import {
  auth,
  currentAccount,
  firebaseConfigured,
  onAuthStateChanged,
  readFavourites,
  saveProfile,
  writeFavourite,
} from '@lipiflow/firebase';
export const hostedEdition = import.meta.env.VITE_LIPIFLOW_EDITION === 'hosted';
export function useLibrary() {
  const [user, setUser] = useState<Account | null>(null),
    [csrf, setCsrf] = useState('');
  const [favourites, setFavourites] = useState<string[]>([]),
    [library, setLibrary] = useState<PublishedFont[]>([]);
  const [config, setConfig] = useState({ local: false, loginAvailable: false }),
    [error, setError] = useState('');
  const [families, setFamilies] = useState<Record<string, string>>({});
  const faces = useRef(new Map<string, FontFace>()),
    pending = useRef(new Map<string, Promise<string>>());
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let unsubscribe: (() => void) | undefined;
    if (hostedEdition && auth) {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void (async () => {
          if (firebaseUser) {
            const account = await currentAccount(firebaseUser);
            if (!active.current) return;
            setUser(account);
            await saveProfile(firebaseUser);
            setFavourites(await readFavourites(firebaseUser.uid));
          } else {
            setUser(null);
            setFavourites([]);
          }
          await refresh();
        })().catch(() => {
          if (active.current)
            setError('Firebase could not load your account. Your editor is still available.');
        });
      });
      void refresh();
    } else if (hostedEdition) void refresh();
    return () => {
      active.current = false;
      unsubscribe?.();
      faces.current.forEach((face) => document.fonts.delete(face));
      faces.current.clear();
    };
  }, []);
  async function refresh() {
    try {
      const [me, fonts, settings] = await Promise.all([
        api<{ user: Account | null; csrf: string; favourites?: string[] }>('/api/me'),
        api<{ fonts: PublishedFont[] }>('/api/fonts'),
        api<typeof config>('/api/config'),
      ]);
      if (!active.current) return;
      const available = new Set(fonts.fonts.map((font) => font.id));
      faces.current.forEach((face, id) => {
        if (!available.has(id)) {
          document.fonts.delete(face);
          faces.current.delete(id);
        }
      });
      setFamilies((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([id]) => available.has(id))),
      );
      if (!auth) setUser(me.user);
      setCsrf(me.csrf);
      if (!auth?.currentUser) setFavourites(me.favourites ?? []);
      setLibrary(fonts.fonts);
      setConfig({ ...settings, loginAvailable: settings.loginAvailable && firebaseConfigured });
      setError('');
    } catch {
      if (active.current) setError('The online library is unavailable. Local typing still works.');
    }
  }
  async function favourite(id: string) {
    if (auth?.currentUser) {
      await writeFavourite(auth.currentUser.uid, id, !favourites.includes(id));
      setFavourites(await readFavourites(auth.currentUser.uid));
    } else {
      await api(
        '/api/favourites/' + id,
        { method: favourites.includes(id) ? 'DELETE' : 'PUT' },
        csrf,
      );
      await refresh();
    }
  }
  function load(font: PublishedFont): Promise<string> {
    const loaded = faces.current.get(font.id);
    if (loaded) return Promise.resolve(loaded.family);
    const inFlight = pending.current.get(font.id);
    if (inFlight) return inFlight;
    const task = (async () => {
      const response = await fetch(apiUrl(`/api/fonts/${font.id}/file`), {
        cache: 'no-store',
        credentials: 'include',
        headers: await authHeaders(),
      });
      if (!response.ok) throw new Error('Font unavailable. Refresh the library.');
      const family = `LipiFlowHosted-${font.id}`,
        face = await new FontFace(family, await response.arrayBuffer()).load();
      if (!active.current) throw new Error('The library was closed.');
      document.fonts.add(face);
      faces.current.set(font.id, face);
      setFamilies((previous) => ({ ...previous, [font.id]: family }));
      return family;
    })();
    pending.current.set(font.id, task);
    void task.finally(() => pending.current.delete(font.id)).catch(() => {});
    return task;
  }
  return { user, csrf, favourites, library, config, error, families, refresh, favourite, load };
}
export type LibraryStore = ReturnType<typeof useLibrary>;
