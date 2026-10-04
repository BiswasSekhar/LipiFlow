import { useEffect, useRef, useState } from 'react';
import { convertGoogle, type GoogleSegment } from './google';
import { useEngine } from './useEngine';
import type { Preferences } from '../preferences';

export function useTransliteration(
  source: string,
  composing: boolean,
  provider: Preferences['provider'],
  online: boolean,
) {
  const googleEnabled = provider === 'google' && online;
  const local = useEngine(source, composing || googleEnabled);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    source: string;
    segments: GoogleSegment[];
    attempt: number;
  } | null>(null);
  const [error, setError] = useState('');
  const cache = useRef(new Map<string, string[]>());

  useEffect(() => {
    if (!googleEnabled || composing) return;
    const controller = new AbortController();
    let active = true;
    setError('');
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const segments = await convertGoogle(source, controller.signal, cache.current);
        if (active) setResult({ source, segments, attempt });
      } catch {
        if (active) {
          controller.abort();
          setError(
            'Google could not convert this text. Check your connection, retry, or choose Mozhi. Your input is preserved.',
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, composing, googleEnabled, attempt]);

  const current =
    !!result && result.source === source && result.attempt === attempt && !composing && !error;
  const chooseCandidate = (index: number, text: string) => {
    if (!googleEnabled || !current) return;
    setResult((previous) => {
      if (!previous || !previous.segments[index]?.candidates.includes(text)) return previous;
      return {
        ...previous,
        segments: previous.segments.map((segment, i) =>
          i === index ? { ...segment, text } : segment,
        ),
      };
    });
  };
  return {
    ...(googleEnabled
      ? {
          output: result?.segments.map((segment) => segment.text).join('') ?? '',
          current,
          status: error ? ('error' as const) : ('ready' as const),
          version: 'Google Input Tools · experimental online integration',
          retry: () => {
            setError('');
            setAttempt((value) => value + 1);
          },
        }
      : local),
    error: googleEnabled ? error : '',
    googleEnabled,
    offlineFallback: provider === 'google' && !online,
    segments: googleEnabled && current ? result!.segments : [],
    chooseCandidate,
  };
}
