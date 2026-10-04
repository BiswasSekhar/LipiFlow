import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  changedRange,
  mapOffset,
  replaceDocument,
  type DocumentModel,
  type Selection,
} from './document';
import type { EncodingSpan } from '../engine/protocol';

type Props = {
  model: DocumentModel;
  unicode: string;
  display: string;
  encoded: boolean;
  conversionCurrent: boolean;
  spans: EncodingSpan[];
  onChange(model: DocumentModel): void;
  onComposition(value: boolean): void;
  composing: boolean;
  readOnly: boolean;
  fontFamily: string;
  size: number;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  onCopy(event: React.ClipboardEvent<HTMLTextAreaElement>, selection: Selection): boolean;
};
type HistoryItem = { model: DocumentModel; caret: number | 'active-end' | Selection };
type Projection = Pick<
  Props,
  'display' | 'unicode' | 'encoded' | 'spans' | 'fontFamily' | 'conversionCurrent'
>;
const noSpans: EncodingSpan[] = [];

export function InlineEditor(props: Props) {
  // Encoding responses must not reset a Unicode editor's native selection.
  const editingSpans = props.encoded ? props.spans : noSpans;
  const history = useRef<HistoryItem[]>([]);
  const future = useRef<HistoryItem[]>([]);
  const caret = useRef<number | 'active-end' | Selection>(props.unicode.length);
  const restored = useRef<Selection | null>(null);
  const beforeSelection = useRef<Selection>({ start: 0, end: 0 });
  const [compositionValue, setCompositionValue] = useState('');
  const compositionStart = useRef<Projection | null>(null);

  const toUnicode = (index: number, bias: 'start' | 'end' | 'nearest' = 'nearest') =>
    props.encoded ? mapOffset(index, props.spans, 'unicode', bias) : index;
  function selection(element: HTMLTextAreaElement): Selection {
    const collapsed = element.selectionStart === element.selectionEnd;
    return {
      start: toUnicode(element.selectionStart, collapsed ? 'nearest' : 'start'),
      end: toUnicode(element.selectionEnd, collapsed ? 'nearest' : 'end'),
    };
  }
  function remember() {
    history.current.push({ model: props.model, caret: caret.current });
    if (history.current.length > 200) history.current.shift();
    future.current = [];
  }
  function undo(redo = false) {
    if (props.readOnly || props.composing) return;
    const stack = redo ? future.current : history.current;
    const item = stack.pop();
    if (!item) return;
    (redo ? history.current : future.current).push({ model: props.model, caret: caret.current });
    caret.current = item.caret;
    props.onChange(item.model);
  }

  function activeInput(element: HTMLTextAreaElement, inputType: string, inserted: string) {
    const active = props.model.active;
    if (
      !active ||
      props.composing ||
      props.readOnly ||
      element.selectionStart !== element.selectionEnd
    )
      return false;
    const end = active.at + props.unicode.length - props.model.document.length;
    if (toUnicode(element.selectionEnd) !== end) return false;
    if (inputType === 'insertText' || inputType === 'insertLineBreak') {
      remember();
      caret.current = 'active-end';
      props.onChange({ ...props.model, active: { ...active, roman: active.roman + inserted } });
      return true;
    }
    if (inputType === 'deleteContentBackward') {
      remember();
      const roman = Array.from(active.roman).slice(0, -1).join('');
      caret.current = roman ? 'active-end' : active.at;
      props.onChange({ ...props.model, active: roman ? { ...active, roman } : null });
      return true;
    }
    return false;
  }
  const beforeInputAction = useRef(activeInput);
  beforeInputAction.current = activeInput;

  function change(value: string, inputType = '', projection: Projection = props) {
    const before = projection.display;
    if (value === before) return;
    const delta = changedRange(before, value);
    const map = (index: number, bias: 'start' | 'end' | 'nearest') =>
      projection.encoded ? mapOffset(index, projection.spans, 'unicode', bias) : index;
    const from = map(delta.from, delta.from === delta.end ? 'nearest' : 'start');
    const end = map(delta.end, delta.from === delta.end ? 'nearest' : 'end');
    const active = props.model.active;
    const activeEnd = active
      ? active.at + (projection.unicode.length - props.model.document.length)
      : -1;
    remember();
    if (active && !projection.conversionCurrent && from >= active.at && end <= activeEnd) {
      const roman =
        active.roman.slice(0, from - active.at) +
        delta.inserted +
        active.roman.slice(end - active.at);
      caret.current = 'active-end';
      props.onChange({ ...props.model, active: roman ? { ...active, roman } : null });
    } else if (active && from === end && from === activeEnd && delta.inserted) {
      caret.current = 'active-end';
      props.onChange({
        ...props.model,
        active: { ...active, roman: active.roman + delta.inserted },
      });
    } else if (
      active &&
      inputType === 'deleteContentBackward' &&
      beforeSelection.current.start === beforeSelection.current.end &&
      map(beforeSelection.current.end, 'nearest') === activeEnd &&
      !delta.inserted
    ) {
      const roman = Array.from(active.roman).slice(0, -1).join('');
      caret.current = roman ? 'active-end' : active.at;
      props.onChange({ ...props.model, active: roman ? { ...active, roman } : null });
    } else {
      const model = replaceDocument(projection.unicode, from, end, delta.inserted);
      caret.current = model.active ? 'active-end' : from + delta.inserted.length;
      props.onChange(model);
    }
  }

  // Mobile undo gestures use beforeinput; desktop shortcuts use the same history.
  useEffect(() => {
    const element = props.editorRef.current;
    if (!element) return;
    const listener = (event: Event) => {
      const input = event as InputEvent;
      beforeSelection.current = { start: element.selectionStart, end: element.selectionEnd };
      if (input.inputType === 'historyUndo' || input.inputType === 'historyRedo') {
        event.preventDefault();
        // Read the latest render's handler through the ref below.
        historyAction.current(input.inputType === 'historyRedo');
      } else if (
        !input.isComposing &&
        input.cancelable &&
        (input.data !== null ||
          input.inputType === 'deleteContentBackward' ||
          input.inputType === 'insertLineBreak')
      ) {
        if (
          beforeInputAction.current(
            element,
            input.inputType,
            input.inputType === 'insertLineBreak' ? '\n' : (input.data ?? ''),
          )
        )
          event.preventDefault();
      }
    };
    element.addEventListener('beforeinput', listener);
    return () => element.removeEventListener('beforeinput', listener);
  }, [props.editorRef]);
  const historyAction = useRef(undo);
  historyAction.current = undo;

  useLayoutEffect(() => {
    const element = props.editorRef.current;
    if (!element || props.composing || document.activeElement !== element) return;
    const point =
      caret.current === 'active-end' && props.model.active
        ? props.model.active.at + props.unicode.length - props.model.document.length
        : typeof caret.current === 'number'
          ? caret.current
          : typeof caret.current === 'object'
            ? caret.current.end
            : props.unicode.length;
    const start = typeof caret.current === 'object' ? caret.current.start : point;
    const displayPoint = props.encoded
      ? mapOffset(point, props.spans, 'encoded', start === point ? 'nearest' : 'end')
      : point;
    const displayStart = props.encoded
      ? mapOffset(start, props.spans, 'encoded', start === point ? 'nearest' : 'start')
      : start;
    const scrollTop = element.scrollTop;
    element.setSelectionRange(displayStart, displayPoint);
    element.scrollTop = scrollTop;
    restored.current = { start: displayStart, end: displayPoint };
  }, [
    props.display,
    props.unicode,
    props.model,
    props.encoded,
    editingSpans,
    props.composing,
    props.editorRef,
  ]);

  return (
    <textarea
      ref={props.editorRef}
      id="editor"
      aria-label="Malayalam editor"
      aria-describedby="editor-help"
      value={props.composing ? compositionValue : props.display}
      readOnly={props.readOnly}
      lang="ml"
      placeholder="Type Manglish here…"
      style={{
        fontFamily: props.composing ? compositionStart.current?.fontFamily : props.fontFamily,
        fontSize: `${props.size}px`,
      }}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => {
        if (props.composing || (event.nativeEvent as InputEvent).isComposing)
          setCompositionValue(event.target.value);
        else change(event.target.value, (event.nativeEvent as InputEvent).inputType);
      }}
      onSelect={(event) => {
        if (props.composing) return;
        const element = event.currentTarget;
        beforeSelection.current = { start: element.selectionStart, end: element.selectionEnd };
        if (
          restored.current?.start === element.selectionStart &&
          restored.current.end === element.selectionEnd
        )
          return;
        caret.current = selection(element);
        restored.current = null;
      }}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          ['z', 'y'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          undo(event.shiftKey || event.key.toLowerCase() === 'y');
        } else if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.nativeEvent.isComposing
        ) {
          const type =
            event.key === 'Backspace'
              ? 'deleteContentBackward'
              : event.key === 'Enter'
                ? 'insertLineBreak'
                : event.key.length === 1
                  ? 'insertText'
                  : '';
          if (
            type &&
            activeInput(event.currentTarget, type, event.key === 'Enter' ? '\n' : event.key)
          )
            event.preventDefault();
        }
      }}
      onCompositionStart={(event) => {
        compositionStart.current = {
          display: event.currentTarget.value,
          unicode: props.unicode,
          encoded: props.encoded,
          spans: props.spans,
          fontFamily: props.fontFamily,
          conversionCurrent: props.conversionCurrent,
        };
        setCompositionValue(event.currentTarget.value);
        props.onComposition(true);
      }}
      onCompositionEnd={(event) => {
        change(
          event.currentTarget.value,
          'insertCompositionText',
          compositionStart.current ?? props,
        );
        props.onComposition(false);
      }}
      onCopy={(event) => props.onCopy(event, selection(event.currentTarget))}
      onCut={(event) => {
        const range = selection(event.currentTarget);
        if (!props.onCopy(event, range) || props.readOnly || range.start === range.end) return;
        remember();
        caret.current = range.start;
        props.onChange(replaceDocument(props.unicode, range.start, range.end, ''));
      }}
    />
  );
}
