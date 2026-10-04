import type { EncodingSpan } from '../engine/protocol';

export type DocumentModel = { document: string; active: { at: number; roman: string } | null };
export type Selection = { start: number; end: number };
const format = 'lipiflow-inline/1';

export function readDocument(text: string): DocumentModel {
  try {
    const value = JSON.parse(text);
    if (
      value.format === format &&
      typeof value.document === 'string' &&
      (value.active === null ||
        (typeof value.active?.roman === 'string' &&
          Number.isInteger(value.active.at) &&
          value.active.at >= 0 &&
          value.active.at <= value.document.length))
    ) {
      return { document: value.document, active: value.active };
    }
  } catch {
    /* Existing plain Manglish drafts remain readable. */
  }
  return { document: '', active: text ? { at: 0, roman: text } : null };
}
export function saveDocument(model: DocumentModel) {
  return JSON.stringify({ format, ...model });
}
export function renderDocument(model: DocumentModel, converted: string) {
  return model.active
    ? model.document.slice(0, model.active.at) + converted + model.document.slice(model.active.at)
    : model.document;
}

export function changedRange(before: string, after: string) {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  // Never split a surrogate pair when two emoji share a leading surrogate.
  if (from > 0 && /[\uDC00-\uDFFF]/.test(before[from] ?? after[from] ?? '')) from--;
  let end = before.length,
    nextEnd = after.length;
  while (end > from && nextEnd > from && before[end - 1] === after[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  return { from, end, inserted: after.slice(from, nextEnd) };
}

export function mapOffset(
  index: number,
  spans: EncodingSpan[],
  direction: 'unicode' | 'encoded',
  bias: 'start' | 'end' | 'nearest' = 'nearest',
) {
  const fromStart = direction === 'unicode' ? 'encoded_start' : 'unicode_start';
  const fromEnd = direction === 'unicode' ? 'encoded_end' : 'unicode_end';
  const toStart = direction === 'unicode' ? 'unicode_start' : 'encoded_start';
  const toEnd = direction === 'unicode' ? 'unicode_end' : 'encoded_end';
  for (const span of spans) {
    if (index === span[fromStart]) return span[toStart];
    if (index <= span[fromEnd]) {
      if (index === span[fromEnd]) return span[toEnd];
      return bias === 'start' ||
        (bias === 'nearest' && index - span[fromStart] < (span[fromEnd] - span[fromStart]) / 2)
        ? span[toStart]
        : span[toEnd];
    }
  }
  return spans.length ? spans[spans.length - 1][toEnd] : index;
}

export function replaceDocument(
  unicode: string,
  from: number,
  end: number,
  inserted: string,
): DocumentModel {
  const document = unicode.slice(0, from) + unicode.slice(end);
  if (/[A-Za-z{\\]/.test(inserted)) return { document, active: { at: from, roman: inserted } };
  return { document: document.slice(0, from) + inserted + document.slice(from), active: null };
}
