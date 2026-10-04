import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, {
  transliterate,
  engine_version,
  scheme_version,
  encode_legacy,
} from '../../../../core/lipiflow-wasm/pkg/lipiflow_wasm';
import corpus from '../../../../data/golden-tests/mozhi-2.json';
import legacyCorpus from '../../../../data/golden-tests/legacy-karthika.json';
import { isCurrentResult } from './protocol';

beforeAll(async () => {
  const bytes = readFileSync(
    new URL('../../../../core/lipiflow-wasm/pkg/lipiflow_wasm_bg.wasm', import.meta.url),
  );
  await init({ module_or_path: bytes });
});
describe('the production WASM engine', () => {
  for (const example of legacyCorpus) {
    it(`encodes Karthika: ${JSON.stringify(example.input)}`, () => {
      expect(JSON.parse(encode_legacy(example.input)).text).toBe(example.output);
    });
  }
  it('reports unsupported legacy characters and preserves punctuation', () => {
    expect(JSON.parse(encode_legacy('ൠ - 😀'))).toMatchObject({
      text: 'ൠ - 😀',
      unsupported: ['ൠ'],
      map_version: 'karthika/1.0.0',
    });
  });
  for (const example of corpus) {
    it(`matches the independent corpus: ${JSON.stringify(example.input)}`, () => {
      expect(transliterate(example.input)).toBe(example.output);
    });
  }
  it('identifies the bundled engine and rule version', () => {
    expect(engine_version()).toBe('0.1.0');
    expect(scheme_version()).toContain('mozhi-2/1.0.0');
  });
  it('preserves multilingual literal input exactly', () => {
    expect(transliterate('{café 中文 മലയാളം 😀}\n123')).toBe('café 中文 മലയാളം 😀\n123');
  });
});
it('rejects stale results and non-result messages', () => {
  expect(isCurrentResult({ type: 'converted', id: 1, text: 'old' }, 2)).toBe(false);
  expect(isCurrentResult({ type: 'converted', id: 2, text: 'current' }, 2)).toBe(true);
  expect(isCurrentResult({ type: 'ready', engineVersion: '0.1', schemeVersion: '2' }, 2)).toBe(
    false,
  );
});
