import { useEffect, useRef, useState } from 'react';
import records from '../../../data/legacy/fonts.v1.json';

export type OutputMode = 'Unicode' | 'FML' | 'ML-TT';
export const legacyFonts = records;

export function useLegacyFonts() {
  const faces = useRef(new Map<string, FontFace>());
  const generation = useRef(0);
  const [loaded, setLoaded] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
      faces.current.forEach((face) => document.fonts.delete(face));
    },
    [],
  );

  async function load(file: File | undefined, mode: OutputMode) {
    if (!file) return;
    const id = ++generation.current;
    setLoading(true);
    setNotice('');
    try {
      const bytes = await file.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const record = records.find((font) => font.mode === mode && font.sha256 === digest);
      if (!record)
        throw new Error(
          `Choose ${records.find((font) => font.mode === mode)?.fileName}. This font variant has not been checked against the Karthika map.`,
        );
      const family = `LipiFlow-${record.id}`;
      const face = await new FontFace(family, bytes).load();
      if (id !== generation.current) return;
      const previous = faces.current.get(record.id);
      if (previous) document.fonts.delete(previous);
      document.fonts.add(face);
      faces.current.set(record.id, face);
      setLoaded((values) => ({ ...values, [mode]: family }));
      setNotice(`${record.family} loaded. Font stays in this tab.`);
    } catch (error) {
      if (id === generation.current)
        setNotice(error instanceof Error ? error.message : 'Could not open this font.');
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  return { loaded, notice, loading, load };
}
