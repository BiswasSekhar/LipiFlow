import { expect, it, vi } from 'vitest';
import { convertGoogle, parseGoogleCandidates, splitGoogleInput } from './google';

it('reads the independently observed Google sample and rejects failed or mismatched replies', () => {
  expect(
    parseGoogleCandidates(['SUCCESS', [['ente peru', ['എന്റെ പേര്', 'എന്റെ പേരു']]]], 'ente peru'),
  ).toEqual(['എന്റെ പേര്', 'എന്റെ പേരു']);
  expect(() => parseGoogleCandidates(['ERROR', []], 'ente')).toThrow();
  expect(() => parseGoogleCandidates(['SUCCESS', [['different', ['മലയാളം']]]], 'ente')).toThrow();
  expect(() => parseGoogleCandidates(['SUCCESS', [['ente', [null]]]], 'ente')).toThrow();
});

it('preserves literal English, existing scripts, digits, emoji and all separators', async () => {
  const request = vi.fn(
    async () => new Response(JSON.stringify(['SUCCESS', [['ente peru', ['എന്റെ പേര്']]]])),
  );
  const result = await convertGoogle(
    'ente peru!\n{hello world} \\LipiFlow മലയാളം 中文 😀 123\t  ',
    new AbortController().signal,
    new Map(),
    request,
  );
  expect(result.map((segment) => segment.text).join('')).toBe(
    'എന്റെ പേര്!\nhello world LipiFlow മലയാളം 中文 😀 123\t  ',
  );
  expect(request).toHaveBeenCalledTimes(1);
  const [url, options] = request.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.searchParams.get('itc')).toBe('ml-t-i0-und');
  expect(options).toMatchObject({
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
});

it('sends no requests for empty or literal-only text and caches repeated phrases only in memory', async () => {
  const request = vi.fn(
    async () => new Response(JSON.stringify(['SUCCESS', [['amma', ['അമ്മ']]]])),
  );
  const cache = new Map<string, string[]>();
  expect(await convertGoogle('', new AbortController().signal, cache, request)).toEqual([]);
  await convertGoogle('{unfinished English', new AbortController().signal, cache, request);
  expect(request).not.toHaveBeenCalled();
  await convertGoogle('amma\namma', new AbortController().signal, cache, request);
  await convertGoogle('amma!', new AbortController().signal, cache, request);
  expect(request).toHaveBeenCalledTimes(1);
});

it('bounds long requests without losing separators and rejects unusably long words', () => {
  const source = 'ente peru '.repeat(100).trim();
  const segments = splitGoogleInput(source);
  expect(segments.map((segment) => segment.source).join('')).toBe(source);
  expect(
    segments
      .filter((segment) => segment.candidates.length)
      .every((segment) => segment.source.length <= 160),
  ).toBe(true);
  expect(() => splitGoogleInput('a'.repeat(161))).toThrow();
});

it('propagates cancellation and network errors without exporting partial conversion', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = vi.fn();
  await expect(convertGoogle('amma', controller.signal, new Map(), request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  await expect(
    convertGoogle(
      'amma',
      new AbortController().signal,
      new Map(),
      async () => new Response('', { status: 503 }),
    ),
  ).rejects.toThrow();
});
