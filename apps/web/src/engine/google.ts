// Experimental adapter for the Input Tools endpoint. This is not a supported
// Google Cloud API; keep it isolated so an endpoint change cannot break Mozhi.
export const GOOGLE_ENDPOINT = 'https://inputtools.google.com/request';
export type GoogleSegment = { source: string; text: string; candidates: string[] };

export function splitGoogleInput(source: string): GoogleSegment[] {
  const segments: GoogleSegment[] = [];
  // Translate one word at a time so adding a later word cannot change a word
  // the user has already typed. Keep every separator as its own literal part.
  for (const match of source.matchAll(/\{[^}]*\}?|\\[A-Za-z]+|[A-Za-z]+|[\s\S]/g)) {
    const value = match[0];
    if (value.startsWith('{')) {
      segments.push({
        source: value,
        text: value.endsWith('}') ? value.slice(1, -1) : value,
        candidates: [],
      });
    } else if (/^\\[A-Za-z]/.test(value)) {
      segments.push({ source: value, text: value.slice(1), candidates: [] });
    } else if (/^[A-Za-z]/.test(value)) {
      if (value.length > 160)
        throw new Error('A word is too long for Google. Use Mozhi for this text.');
      segments.push({ source: value, text: value, candidates: ['pending'] });
    } else {
      segments.push({ source: value, text: value, candidates: [] });
    }
  }
  return segments;
}

export function parseGoogleCandidates(data: unknown, source: string): string[] {
  if (!Array.isArray(data) || data[0] !== 'SUCCESS' || !Array.isArray(data[1]))
    throw new Error('Google returned an invalid response.');
  const entry: unknown = data[1][0];
  if (
    !Array.isArray(entry) ||
    entry[0] !== source ||
    !Array.isArray(entry[1]) ||
    !entry[1].length ||
    !entry[1].every((value: unknown) => typeof value === 'string' && value.length > 0)
  )
    throw new Error('Google returned no usable spelling.');
  return [...new Set(entry[1] as string[])];
}

export async function convertGoogle(
  source: string,
  signal: AbortSignal,
  cache: Map<string, string[]>,
  request: typeof fetch = fetch,
): Promise<GoogleSegment[]> {
  const segments = splitGoogleInput(source);
  const queue = [
    ...new Set(
      segments.filter((segment) => segment.candidates.length).map((segment) => segment.source),
    ),
  ];
  const resolved = new Map<string, string[]>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (cursor < queue.length) {
        signal.throwIfAborted();
        const phrase = queue[cursor++];
        let candidates = cache.get(phrase);
        if (!candidates) {
          const url = new URL(GOOGLE_ENDPOINT);
          url.search = new URLSearchParams({
            text: phrase,
            itc: 'ml-t-i0-und',
            num: '5',
            cp: '0',
            cs: '1',
            ie: 'utf-8',
            oe: 'utf-8',
            app: 'demopage',
          }).toString();
          const response = await request(url, {
            signal,
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
          });
          if (!response.ok) throw new Error('Google is unavailable. Retry or choose Mozhi.');
          candidates = parseGoogleCandidates(await response.json(), phrase);
          signal.throwIfAborted();
          if (cache.size >= 128) cache.delete(cache.keys().next().value!);
          cache.set(phrase, candidates);
        }
        resolved.set(phrase, candidates);
      }
    }),
  );
  return segments.map((segment) => {
    const candidates = segment.candidates.length ? resolved.get(segment.source)! : [];
    return { ...segment, candidates, text: candidates[0] ?? segment.text };
  });
}
