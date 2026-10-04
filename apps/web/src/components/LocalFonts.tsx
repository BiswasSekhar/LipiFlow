import { useEffect, useRef, useState } from 'react';
import { inspectFont, sha256 } from '@lipiflow/library';
import { legacyFonts } from '../legacy';

const positions = ['A', 'a', 'I', 'i', 'k', 'm', 'n', 's', 't', 'u', 'v', 'w', 'À', 'Ø', 'ß', 'ÿ'];
type Proof = {
  name: string;
  family: string;
  unicode: boolean;
  verified: boolean;
  encoding: string;
};

export function LocalFonts({
  sample,
  encodedSample,
  query,
  encoding,
}: {
  sample: string;
  encodedSample: string;
  query: string;
  encoding: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const faces = useRef<FontFace[]>([]);
  const generation = useRef(0);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(
    () => () => {
      generation.current++;
      faces.current.forEach((face) => document.fonts.delete(face));
    },
    [],
  );

  async function openFiles(files: FileList | null) {
    if (!files?.length) return;
    const id = ++generation.current;
    faces.current.forEach((face) => document.fonts.delete(face));
    faces.current = [];
    setProofs([]);
    setLoading(true);
    setNotice(
      files.length > 12 ? 'Showing the first 12 fonts. Open another group to inspect more.' : '',
    );
    const errors: string[] = [];
    const loaded = await Promise.all(
      Array.from(files)
        .slice(0, 12)
        .map(async (file, index) => {
          try {
            const family = `LipiFlowLocal-${id}-${index}`;
            const bytes = await file.arrayBuffer();
            const info =
              new DataView(bytes).getUint32(0) === 0x774f4632
                ? { unicodeMalayalam: false }
                : inspectFont(bytes);
            const digest = await sha256(bytes);
            const matching = legacyFonts.find((font) => font.sha256 === digest);
            const face = await new FontFace(family, bytes).load();
            if (generation.current !== id) return null;
            document.fonts.add(face);
            faces.current.push(face);
            return {
              name: file.name,
              family,
              unicode: info.unicodeMalayalam,
              verified: !!matching,
              encoding:
                matching?.mode ??
                (info.unicodeMalayalam ? 'Unicode' : file.name.startsWith('FML') ? 'FML' : 'ML-TT'),
            };
          } catch {
            errors.push(file.name);
            return null;
          }
        }),
    );
    if (generation.current !== id) return;
    setProofs(loaded.filter((proof): proof is Proof => proof !== null));
    setLoading(false);
    if (errors.length) setNotice(`Could not open: ${errors.join(', ')}. Choose a valid font file.`);
  }

  return (
    <section className="local-fonts" aria-label="Local font proof">
      <div className="section-heading">
        <div>
          <h2>Local fonts</h2>
        </div>
        <button
          className="button secondary"
          onClick={() => input.current?.click()}
          disabled={loading}
        >
          {loading ? 'Opening fonts…' : 'Open font files'}
        </button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          multiple
          accept=".ttf,.otf,.woff2"
          aria-label="Local font files"
          tabIndex={-1}
          onChange={(event) => {
            void openFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {notice ? (
        <p className="banner" role="status">
          {notice}
        </p>
      ) : null}
      {proofs
        .filter(
          (proof) =>
            proof.name.toLowerCase().includes(query.toLowerCase()) &&
            (encoding === 'All' || encoding === proof.encoding),
        )
        .map((proof) => (
          <article className="font-proof card" key={proof.family}>
            <div className="section-heading">
              <h3>{proof.name}</h3>
              <span className="tag">
                {proof.unicode
                  ? 'Unicode'
                  : proof.verified
                    ? proof.encoding
                    : 'Local file · unmapped'}
              </span>
            </div>
            {proof.unicode || proof.verified ? (
              <p className="catalogue-specimen" lang="ml" style={{ fontFamily: proof.family }}>
                {proof.unicode ? sample : encodedSample || '…'}
              </p>
            ) : (
              <p className="muted small">Encoding not verified</p>
            )}
            <details>
              <summary>Character details</summary>
              <div className="font-proof-strip" aria-label={`Character proof for ${proof.name}`}>
                {positions.map((position) => (
                  <div className="font-proof-cell" key={position}>
                    <span style={{ fontFamily: `"${proof.family}"` }} aria-hidden="true">
                      {position}
                    </span>
                    <code>
                      {position} · {position.charCodeAt(0).toString(16).toUpperCase()}
                    </code>
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
    </section>
  );
}
