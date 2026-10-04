let apiBase = '';
let accessTokenProvider: () => Promise<string> = async () => '';
export function setApiOrigin(origin: string) {
  apiBase = origin.replace(/\/$/, '');
}
export function setAccessTokenProvider(provider: () => Promise<string>) {
  accessTokenProvider = provider;
}
export function apiUrl(path: string) {
  return apiBase ? new URL(path, apiBase).toString() : path;
}
export async function authHeaders() {
  const headers = new Headers();
  const token = await accessTokenProvider();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}
export async function api<T>(path: string, options: RequestInit = {}, csrf = ''): Promise<T> {
  const headers = new Headers(options.headers);
  const token = await accessTokenProvider();
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (csrf) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The library is unavailable.');
  return result as T;
}
