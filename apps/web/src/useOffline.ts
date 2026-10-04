import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { keys } from './preferences';

async function hasOfflineCache() {
  if (
    !('serviceWorker' in navigator) ||
    !('caches' in window) ||
    !navigator.serviceWorker.controller
  )
    return false;
  const urls = [
    '/index.html',
    '/data/mozhi-2.v1.json',
    '/data/catalogue.v1.json',
    '/fonts/noto-sans-malayalam.woff2',
    '/fonts/noto-serif-malayalam.woff2',
  ];
  return (await Promise.all(urls.map((url) => caches.match(url, { ignoreSearch: true })))).every(
    Boolean,
  );
}

export function useOffline() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [updating, setUpdating] = useState(false);
  const updateRequested = useRef(false);
  const reloadAcceptedUpdate = () => {
    if (updateRequested.current) {
      updateRequested.current = false;
      window.location.reload();
    }
  };
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onOfflineReady() {
      void hasOfflineCache()
        .then(setReady)
        .catch(() => setReady(false));
    },
    onRegisterError() {
      setError('Offline setup failed. Reopen LipiFlow online to try again.');
    },
    // Another tab may activate an update. Never reload this tab's draft until
    // its own user accepts and a handoff has been saved.
    onNeedReload: reloadAcceptedUpdate,
  });
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    let active = true;
    const verify = () => {
      reloadAcceptedUpdate();
      void hasOfflineCache()
        .then((cached) => {
          if (active) setReady(cached);
        })
        .catch(() => {
          if (active) setReady(false);
        });
    };
    if ('serviceWorker' in navigator && 'caches' in window) {
      navigator.serviceWorker.addEventListener('controllerchange', verify);
      navigator.serviceWorker.ready.then(verify).catch(() => {
        if (active) setError('Offline setup failed. Reopen LipiFlow online to try again.');
      });
    }
    return () => {
      active = false;
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
      navigator.serviceWorker?.removeEventListener('controllerchange', verify);
    };
  }, []);
  async function update(text: string) {
    setUpdating(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('No registered app worker');
      sessionStorage.setItem(keys.update, JSON.stringify({ text, created: Date.now() }));
      updateRequested.current = true;
      // Use the native lifecycle rather than Workbox's timing heuristic for
      // classifying updates installed shortly after the first visit.
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      else reloadAcceptedUpdate();
    } catch {
      updateRequested.current = false;
      setUpdating(false);
      setError(
        'Save or copy your text before reloading. This browser could not preserve it for the update.',
      );
    }
  }
  return { ready, online, needRefresh, error, update, updating };
}
