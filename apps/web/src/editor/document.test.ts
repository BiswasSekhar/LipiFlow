import { describe, expect, it } from 'vitest';
import {
  changedRange,
  mapOffset,
  readDocument,
  renderDocument,
  replaceDocument,
  saveDocument,
} from './document';

describe('inline document editing', () => {
  it('keeps phonetic input separate from committed Unicode and restores drafts', () => {
    const model = { document: 'മലയാളം 😀', active: { at: 7, roman: 'amma ' } };
    expect(readDocument(saveDocument(model))).toEqual(model);
    expect(renderDocument(model, 'അമ്മ ')).toBe('മലയാളം അമ്മ 😀');
    expect(readDocument('namaskaaram').active?.roman).toBe('namaskaaram');
    expect(
      readDocument('{"format":"lipiflow-inline/1","document":"x","active":{"at":-1,"roman":"k"}}')
        .document,
    ).toBe('');
  });
  it('finds replacements without splitting emoji surrogate pairs', () => {
    expect(changedRange('a 😀 b', 'a 😁 b')).toEqual({ from: 2, end: 4, inserted: '😁' });
    expect(changedRange('അമ്മ', 'അമ്മn')).toEqual({ from: 4, end: 4, inserted: 'n' });
  });
  it('starts a phonetic insertion in an existing Malayalam document', () => {
    expect(replaceDocument('കേരളം', 2, 3, 'amma')).toEqual({
      document: 'കേളം',
      active: { at: 2, roman: 'amma' },
    });
    expect(replaceDocument('കേരളം', 0, 2, '😀')).toEqual({ document: '😀രളം', active: null });
  });
  it('maps selections across reordered legacy clusters', () => {
    const spans = [
      { unicode_start: 0, unicode_end: 4, encoded_start: 0, encoded_end: 4 },
      { unicode_start: 4, unicode_end: 6, encoded_start: 4, encoded_end: 6 },
    ];
    expect(mapOffset(1, spans, 'unicode', 'start')).toBe(0);
    expect(mapOffset(1, spans, 'unicode', 'end')).toBe(4);
    expect(mapOffset(6, spans, 'encoded')).toBe(6);
  });
});
