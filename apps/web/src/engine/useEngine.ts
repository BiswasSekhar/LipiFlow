import { useEffect, useRef, useState } from 'react';
import {
  isCurrentResult,
  type EngineMessage,
  type EngineRequest,
  type EncodingSpan,
} from './protocol';
import { createEngineClient, type EngineClient } from './client';

export function useEngine(
  source: string,
  composing: boolean,
  operation: EngineRequest['type'] = 'convert',
) {
  const worker = useRef<EngineClient | null>(null);
  const currentId = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [version, setVersion] = useState('');
  const [result, setResult] = useState({
    id: -1,
    text: '',
    source: '',
    unsupported: [] as string[],
    spans: [] as EncodingSpan[],
  });
  const requestSource = useRef('');
  const [pendingId, setPendingId] = useState(0);

  useEffect(() => {
    setStatus('loading');
    let active = true;
    let instance: EngineClient;
    try {
      instance = createEngineClient();
    } catch {
      setStatus('error');
      return;
    }
    worker.current = instance;
    instance.onmessage = ({ data }: MessageEvent<EngineMessage>) => {
      if (!active) return;
      if (data.type === 'ready') {
        setStatus('ready');
        setVersion(`Engine ${data.engineVersion} · ${data.schemeVersion}`);
      } else if (isCurrentResult(data, currentId.current)) {
        setResult({
          id: data.id,
          text: data.text,
          source: requestSource.current,
          unsupported: data.unsupported ?? [],
          spans: data.spans ?? [],
        });
      } else if (
        data.type === 'error' &&
        (data.id === undefined || data.id === currentId.current)
      ) {
        setStatus('error');
      }
    };
    instance.onerror = (event) => {
      event.preventDefault();
      if (active) setStatus('error');
    };
    instance.onmessageerror = () => {
      if (active) setStatus('error');
    };
    return () => {
      active = false;
      instance.terminate();
      worker.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const id = ++currentId.current;
    setPendingId(id);
    if (status !== 'ready' || composing) return;
    const timer = setTimeout(() => {
      requestSource.current = source;
      const message: EngineRequest = { type: operation, id, text: source };
      worker.current?.postMessage(message);
    }, 25);
    return () => clearTimeout(timer);
  }, [source, status, composing, attempt, operation]);

  // Matching source also invalidates exports before the next effect runs.
  const current =
    result.source === source && !composing && status === 'ready' && result.id === pendingId;
  return {
    output: result.text,
    unsupported: result.unsupported,
    spans: result.spans,
    current,
    status,
    version,
    retry: () => {
      setStatus('loading');
      setAttempt((value) => value + 1);
    },
  };
}
