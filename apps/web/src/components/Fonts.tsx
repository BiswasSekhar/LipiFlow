import { useEffect, useState } from 'react';
import { apiUrl } from '@lipiflow/library/client';
import {
  categories,
  encodings,
  externalFontDownloadUrl,
  fontEncodingLabel,
  type ExternalFontSource,
  type LocalFontAsset,
  type PublishedFont,
} from '@lipiflow/library';
import { fonts } from '../catalogue';
import { useEngine } from '../engine/useEngine';
import { useTransliteration } from '../engine/useTransliteration';
import type { Preferences } from '../preferences';
import { type LibraryStore } from '../hosted';
import { downloadFontFamilyArchive, type FontDownloadSource } from '../fontFamilyDownload';
import { ReportFont } from './ReportFont';
import { ReportSourceFont } from './ReportSourceFont';
import './source-fonts.css';

const DEFAULT_PREVIEW_INPUT = 'malayalam manassil ninnu thanne';
const DEFAULT_PREVIEW_TEXT = 'മലയാളം മനസ്സിൽ നിന്ന് തന്നെ';

function useLiveFontPreview(
  input: string,
  provider: Preferences['provider'],
  online: boolean,
  mapVersion = '',
) {
  const transliteration = useTransliteration(input, false, provider, online);
  const encoded = useEngine(
    mapVersion ? transliteration.preview : '',
    !mapVersion || !transliteration.current,
    'encode',
  );
  const current = transliteration.current && (!mapVersion || encoded.current);
  return {
    text: mapVersion ? encoded.output : transliteration.preview,
    current,
    mapped: !!mapVersion && encoded.current,
  };
}

function useFamilyDownload() {
  const [downloading, setDownloading] = useState('');
  const [notice, setNotice] = useState('');
  async function download(name: string, files: FontDownloadSource[]) {
    setDownloading(name);
    setNotice('');
    try {
      await downloadFontFamilyArchive(name, files);
      setNotice(`${name} family downloaded.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not download this font family.');
    } finally {
      setDownloading('');
    }
  }
  return { downloading, notice, download };
}

type FontFamily = {
  key: string;
  name: string;
  encoding: string;
  category: string;
  fonts: PublishedFont[];
};

type SourceFontFamily = {
  key: string;
  name: string;
  encoding: string;
  category: string;
  fonts: ExternalFontSource[];
};

type LocalFontFamily = {
  key: string;
  name: string;
  encoding: string;
  category: string;
  fonts: LocalFontAsset[];
};

function groupByFamily(items: PublishedFont[]): FontFamily[] {
  const groups = new Map<string, FontFamily>();
  for (const font of items) {
    const name = font.family?.trim() || font.name;
    const key = `${font.encoding}:${name.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      name,
      encoding: font.encoding,
      category: font.category,
      fonts: [],
    };
    group.fonts.push(font);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      fonts: group.fonts.sort((a, b) => a.variant.localeCompare(b.variant)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupSourceFonts(items: ExternalFontSource[]): SourceFontFamily[] {
  const groups = new Map<string, SourceFontFamily>();
  for (const font of items) {
    const name = font.family.trim() || font.name;
    const encoding = fontEncodingLabel(font.encoding);
    const key = `${encoding}:${name.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      name,
      encoding,
      category: font.sourceCategory || 'General',
      fonts: [],
    };
    group.fonts.push(font);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      fonts: group.fonts.sort(
        (a, b) =>
          a.variant.localeCompare(b.variant) ||
          a.name.localeCompare(b.name) ||
          a.sourceNumericId - b.sourceNumericId,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupLocalFonts(items: LocalFontAsset[]): LocalFontFamily[] {
  const groups = new Map<string, LocalFontFamily>();
  for (const font of items) {
    const name = font.family.trim() || font.name;
    const encoding = fontEncodingLabel(font.encoding);
    const key = `${encoding}:${name.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      name,
      encoding,
      category: font.sourceCategory || 'Downloaded',
      fonts: [],
    };
    group.fonts.push(font);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      fonts: group.fonts.sort(
        (a, b) => a.variant.localeCompare(b.variant) || a.filename.localeCompare(b.filename),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function HostedSpecimen({
  font,
  store,
  sample,
}: {
  font: PublishedFont;
  store: LibraryStore;
  sample: string;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void store.load(font).catch(() => {
      if (live) setError('Preview unavailable');
    });
    return () => {
      live = false;
    };
  }, [font.id]);
  const family = store.families[font.id];
  return (
    <p className="catalogue-specimen" lang="ml" style={{ fontFamily: family }}>
      {family ? sample : error || 'Loading preview…'}
    </p>
  );
}

function FontFamilyDetail({
  group,
  store,
  previewSource,
  provider,
  online,
  onDownload,
  downloading,
  downloadNotice,
  onBack,
  onReport,
}: {
  group: FontFamily;
  store: LibraryStore;
  previewSource: string;
  provider: Preferences['provider'];
  online: boolean;
  onDownload(name: string, files: FontDownloadSource[]): void;
  downloading: string;
  downloadNotice: string;
  onBack(): void;
  onReport(font: PublishedFont): void;
}) {
  const [activeId, setActiveId] = useState(group.fonts[0]?.id ?? ''),
    [previewInput, setPreviewInput] = useState(previewSource.trim() || DEFAULT_PREVIEW_INPUT),
    [size, setSize] = useState(42),
    [leading, setLeading] = useState(1.8);
  useEffect(() => {
    setActiveId(group.fonts[0]?.id ?? '');
    setPreviewInput(previewSource.trim() || DEFAULT_PREVIEW_INPUT);
  }, [group.key, previewSource]);
  const active = group.fonts.find((font) => font.id === activeId) ?? group.fonts[0];
  const loadedFamily = active ? store.families[active.id] : undefined;
  const livePreview = useLiveFontPreview(previewInput, provider, online);
  return (
    <section className="font-detail" aria-labelledby="font-detail-title">
      <button className="text-button font-back" onClick={onBack}>
        ← All font families
      </button>
      <header className="font-detail-heading">
        <div>
          <p className="eyebrow">
            {group.encoding} · {group.category}
          </p>
          <h2 id="font-detail-title">{group.name}</h2>
          <p className="muted">
            {group.fonts.length} {group.fonts.length === 1 ? 'style' : 'styles'}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={!!downloading}
          onClick={() =>
            void onDownload(
              group.name,
              group.fonts.map((font) => ({
                filename: `${group.name} - ${font.variant || 'Regular'}.ttf`,
                url: apiUrl(`/api/fonts/${font.id}/file?download=1`),
              })),
            )
          }
        >
          {downloading === group.name ? 'Preparing…' : 'Download family (.zip)'}
        </button>
      </header>
      {downloadNotice ? (
        <p className="font-download-status" role="status">
          {downloadNotice}
        </p>
      ) : null}
      {active ? (
        <>
          <div className="font-detail-info">
            <p>{active.description || 'No description provided.'}</p>
            <div className="font-credit">
              <span>
                {active.authorUrl ? (
                  <a href={active.authorUrl} target="_blank" rel="noreferrer">
                    {active.authorName || 'Font author'} ↗
                  </a>
                ) : (
                  <>By {active.authorName || 'Author not listed'}</>
                )}
              </span>
              {active.uploaderIsAuthor ? (
                <span className="author-mark">Author uploaded</span>
              ) : null}
              <a href={active.licenceUrl} target="_blank" rel="noreferrer">
                {active.licence} ↗
              </a>
            </div>
          </div>
          <div className="font-style-list" aria-label="Available styles">
            {group.fonts.map((font) => (
              <button
                key={font.id}
                className={`style-chip ${font.id === active.id ? 'selected' : ''}`}
                aria-pressed={font.id === active.id}
                onClick={() => setActiveId(font.id)}
              >
                {font.variant}
              </button>
            ))}
          </div>
          <div className="font-preview-controls">
            <label className="preview-text-control">
              Type Manglish
              <textarea
                aria-label="Type Manglish preview text"
                placeholder={DEFAULT_PREVIEW_INPUT}
                value={previewInput}
                rows={2}
                onChange={(event) => setPreviewInput(event.target.value)}
              />
              <span className="font-preview-hint">Live Malayalam · “manassil ninnu thanne”</span>
            </label>
            <label>
              Size · {size}px
              <input
                type="range"
                min={24}
                max={76}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </label>
            <label>
              Line spacing · {leading.toFixed(1)}
              <input
                type="range"
                min={1.3}
                max={2.5}
                step={0.1}
                value={leading}
                onChange={(event) => setLeading(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="font-live-preview">
            <div className="font-source-preview-heading">
              <span>Live preview</span>
              {group.encoding !== 'Unicode' ? (
                <span className="muted small">Unicode preview</span>
              ) : null}
            </div>
            {active && !loadedFamily ? (
              <HostedSpecimen font={active} store={store} sample="Loading preview…" />
            ) : null}
            {loadedFamily ? (
              <p
                className="font-detail-specimen"
                lang="ml"
                style={{
                  fontFamily: `"${loadedFamily}", "Noto Sans Malayalam", sans-serif`,
                  fontSize: size,
                  lineHeight: leading,
                }}
              >
                {livePreview.current ? livePreview.text : 'Converting…'}
              </p>
            ) : null}
          </div>
          <div className="font-detail-actions">
            <button className="text-button" onClick={() => onReport(active)}>
              Report copyright
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function SourceFontSpecimen({
  font,
  store,
  sample,
  size,
  leading,
}: {
  font: ExternalFontSource;
  store: LibraryStore;
  sample: string;
  size: number;
  leading: number;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!font.assetStored) {
      setError('Font preview is unavailable');
      return;
    }
    setError('');
    let live = true;
    void store.loadSource(font).catch((reason) => {
      if (live) setError(reason instanceof Error ? reason.message : 'Font preview unavailable');
    });
    return () => {
      live = false;
    };
  }, [font.sourceId, font.assetStored]);
  const family = store.families[`source:${font.sourceId}`];
  return family ? (
    <p
      className="font-detail-specimen"
      lang="ml"
      style={{ fontFamily: family, fontSize: size, lineHeight: leading }}
    >
      {sample || '…'}
    </p>
  ) : (
    <p className="muted small" role={error ? 'status' : undefined}>
      {error || 'Loading preview…'}
    </p>
  );
}

function SourceFontDetail({
  group,
  selectedSourceId,
  store,
  previewSource,
  provider,
  online,
  onBack,
  onReport,
}: {
  group: SourceFontFamily;
  selectedSourceId: string;
  store: LibraryStore;
  previewSource: string;
  provider: Preferences['provider'];
  online: boolean;
  onBack(): void;
  onReport(font: ExternalFontSource): void;
}) {
  const [activeId, setActiveId] = useState(selectedSourceId);
  const [previewInput, setPreviewInput] = useState(previewSource.trim() || DEFAULT_PREVIEW_INPUT);
  const [size, setSize] = useState(42);
  const [leading, setLeading] = useState(1.8);
  useEffect(() => {
    setActiveId(selectedSourceId);
    setPreviewInput(previewSource.trim() || DEFAULT_PREVIEW_INPUT);
  }, [group.key, selectedSourceId, previewSource]);
  const active = group.fonts.find((font) => font.sourceId === activeId) ?? group.fonts[0];
  const downloadUrl = active.assetStored
    ? apiUrl(`/api/source-fonts/${encodeURIComponent(active.sourceId)}/file?download=1`)
    : externalFontDownloadUrl(active);
  const sourceHref = externalFontDownloadUrl(active) ?? active.sourceUrl;
  const livePreview = useLiveFontPreview(previewInput, provider, online);
  return (
    <section className="font-detail" aria-labelledby="source-font-detail-title">
      <button className="text-button font-back" onClick={onBack}>
        ← All fonts
      </button>
      <header className="font-detail-heading">
        <div>
          <p className="eyebrow">
            <span className="source-badge">Source</span> {fontEncodingLabel(active.encoding)} ·{' '}
            {active.sourceCategory || 'General'}
          </p>
          <h2 id="source-font-detail-title">{active.name}</h2>
          <p className="muted">
            {active.family || group.name} · {active.variant || 'Regular'}
          </p>
        </div>
        {downloadUrl ? (
          <a
            className="button primary"
            href={downloadUrl}
            download={active.assetStored ? true : undefined}
            target={active.assetStored ? undefined : '_blank'}
            rel={active.assetStored ? undefined : 'noopener noreferrer'}
          >
            {active.assetStored ? 'Download font' : 'Download from source'}
          </a>
        ) : null}
      </header>
      {group.fonts.length > 1 ? (
        <div className="font-style-list" aria-label="Font styles">
          {group.fonts.map((font) => (
            <button
              key={font.sourceId}
              className={`style-chip ${font.sourceId === active.sourceId ? 'selected' : ''}`}
              aria-pressed={font.sourceId === active.sourceId}
              onClick={() => setActiveId(font.sourceId)}
            >
              {font.variant || font.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="font-detail-info source-font-info">
        <dl>
          <div>
            <dt>Family</dt>
            <dd>{active.family || 'Not listed'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{active.sourceCategory || 'General'}</dd>
          </div>
          <div>
            <dt>Encoding</dt>
            <dd>{fontEncodingLabel(active.encoding)}</dd>
          </div>
          <div>
            <dt>Licence listed by source</dt>
            <dd>{active.reportedLicence || 'Not listed'}</dd>
          </div>
          {active.copyrightText ? (
            <div className="source-copyright">
              <dt>Copyright note</dt>
              <dd>{active.copyrightText}</dd>
            </div>
          ) : null}
        </dl>
        <div className="font-credit">
          <a href={sourceHref} target="_blank" rel="noreferrer">
            Original font page ↗
          </a>
        </div>
      </div>
      <div className="font-preview-controls">
        <label className="preview-text-control">
          Type Manglish
          <textarea
            aria-label="Type Manglish preview text"
            placeholder={DEFAULT_PREVIEW_INPUT}
            value={previewInput}
            rows={2}
            onChange={(event) => setPreviewInput(event.target.value)}
          />
          <span className="font-preview-hint">Live Malayalam · “manassil ninnu thanne”</span>
        </label>
        <label>
          Size · {size}px
          <input
            type="range"
            min={24}
            max={76}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
        <label>
          Line spacing · {leading.toFixed(1)}
          <input
            type="range"
            min={1.3}
            max={2.5}
            step={0.1}
            value={leading}
            onChange={(event) => setLeading(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="font-live-preview">
        <div className="font-source-preview-heading">
          <span>Live preview</span>
          <span className="muted small">Unicode preview</span>
        </div>
        {active.assetStored ? (
          <SourceFontSpecimen
            font={active}
            store={store}
            sample={livePreview.current ? livePreview.text : 'Converting…'}
            size={size}
            leading={leading}
          />
        ) : (
          <p
            className="font-detail-specimen"
            lang="ml"
            style={{
              fontFamily: '"Noto Sans Malayalam", sans-serif',
              fontSize: size,
              lineHeight: leading,
            }}
          >
            {livePreview.current ? livePreview.text : 'Converting…'}
          </p>
        )}
      </div>
      <div className="font-detail-actions">
        <button className="button secondary" onClick={() => onReport(active)}>
          Report copyright
        </button>
      </div>
    </section>
  );
}

function LocalFontSpecimen({
  font,
  store,
  sample,
  encodedSample,
}: {
  font: LocalFontAsset;
  store: LibraryStore;
  sample: string;
  encodedSample: string;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void store.loadAsset(font).catch((reason) => {
      if (live) setError(reason instanceof Error ? reason.message : 'Font preview unavailable');
    });
    return () => {
      live = false;
    };
  }, [font.id]);
  const family = store.families[`asset:${font.id}`];
  if (!family) return <p className="muted small">{error || 'Loading preview…'}</p>;
  return (
    <p
      className="catalogue-specimen"
      lang={font.mapVersion ? undefined : 'ml'}
      style={{ fontFamily: `"${family}", "Noto Sans Malayalam", sans-serif` }}
    >
      {font.mapVersion ? encodedSample || sample : sample}
    </p>
  );
}

function LocalFontDetail({
  group,
  store,
  previewSource,
  provider,
  online,
  onDownload,
  downloading,
  downloadNotice,
  onBack,
  onReport,
}: {
  group: LocalFontFamily;
  store: LibraryStore;
  previewSource: string;
  provider: Preferences['provider'];
  online: boolean;
  onDownload(name: string, files: FontDownloadSource[]): void;
  downloading: string;
  downloadNotice: string;
  onBack(): void;
  onReport(font: LocalFontAsset): void;
}) {
  const defaultFont = group.fonts.find((font) => font.mapVersion) ?? group.fonts[0];
  const [activeId, setActiveId] = useState(defaultFont?.id ?? ''),
    [previewInput, setPreviewInput] = useState(previewSource.trim() || DEFAULT_PREVIEW_INPUT),
    [size, setSize] = useState(42),
    [leading, setLeading] = useState(1.8),
    [error, setError] = useState('');
  const active = group.fonts.find((font) => font.id === activeId) ?? defaultFont;
  useEffect(() => {
    if (!active) return;
    setPreviewInput(previewSource.trim() || DEFAULT_PREVIEW_INPUT);
    setError('');
  }, [group.key, previewSource]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    void store.loadAsset(active).catch((reason) => {
      if (live) setError(reason instanceof Error ? reason.message : 'Font preview unavailable');
    });
    return () => {
      live = false;
    };
  }, [active?.id]);
  const livePreview = useLiveFontPreview(previewInput, provider, online, active?.mapVersion);
  const family = active ? store.families[`asset:${active.id}`] : undefined;
  return (
    <section className="font-detail" aria-labelledby="asset-font-detail-title">
      <button className="text-button font-back" onClick={onBack}>
        ← All fonts
      </button>
      {active ? (
        <>
          <header className="font-detail-heading">
            <div>
              <p className="eyebrow">
                {fontEncodingLabel(active.encoding)} · {active.sourceCategory}
              </p>
              <h2 id="asset-font-detail-title">{group.name}</h2>
              <p className="muted">
                {group.fonts.length} {group.fonts.length === 1 ? 'style' : 'styles'}
              </p>
            </div>
            <button
              className="button primary"
              disabled={!!downloading}
              onClick={() =>
                void onDownload(
                  group.name,
                  group.fonts.map((font) => ({
                    filename: font.filename,
                    url: apiUrl(`/api/font-assets/${font.id}/file?download=1`),
                  })),
                )
              }
            >
              {downloading === group.name ? 'Preparing…' : 'Download family (.zip)'}
            </button>
          </header>
          {downloadNotice ? (
            <p className="font-download-status" role="status">
              {downloadNotice}
            </p>
          ) : null}
          <div className="font-style-list" aria-label="Available styles">
            {group.fonts.map((font) => (
              <button
                key={font.id}
                className={`style-chip ${font.id === active.id ? 'selected' : ''}`}
                aria-pressed={font.id === active.id}
                onClick={() => setActiveId(font.id)}
              >
                {font.variant || font.filename}
              </button>
            ))}
          </div>
          <div className="font-detail-info source-font-info">
            <dl>
              <div>
                <dt>Family</dt>
                <dd>{active.family || 'Not listed'}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{active.sourceCategory}</dd>
              </div>
              <div>
                <dt>Encoding</dt>
                <dd>{fontEncodingLabel(active.encoding)}</dd>
              </div>
              <div>
                <dt>Licence listed by source</dt>
                <dd>{active.reportedLicence}</dd>
              </div>
              {active.copyrightText ? (
                <div className="source-copyright">
                  <dt>Copyright note</dt>
                  <dd>{active.copyrightText}</dd>
                </div>
              ) : null}
            </dl>
            <div className="font-credit">
              {active.sourceUrl ? (
                <a href={active.sourceUrl} target="_blank" rel="noreferrer">
                  Original font page ↗
                </a>
              ) : (
                <span className="muted">Original source not matched</span>
              )}
            </div>
          </div>
          <div className="font-preview-controls">
            <label className="preview-text-control">
              Type Manglish
              <textarea
                aria-label="Type Manglish preview text"
                placeholder={DEFAULT_PREVIEW_INPUT}
                value={previewInput}
                rows={2}
                onChange={(event) => setPreviewInput(event.target.value)}
              />
              <span className="font-preview-hint">Live Malayalam · “manassil ninnu thanne”</span>
            </label>
            <label>
              Size · {size}px
              <input
                type="range"
                min={24}
                max={76}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </label>
            <label>
              Line spacing · {leading.toFixed(1)}
              <input
                type="range"
                min={1.3}
                max={2.5}
                step={0.1}
                value={leading}
                onChange={(event) => setLeading(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="font-live-preview">
            <div className="font-source-preview-heading">
              <span>Live preview</span>
              {active.mapVersion ? (
                <span className="muted small">
                  Verified {fontEncodingLabel(active.encoding)} map
                </span>
              ) : active.encoding !== 'Unicode' ? (
                <span className="muted small">Unicode preview</span>
              ) : null}
            </div>
            {family ? (
              <p
                className="font-detail-specimen"
                lang={livePreview.mapped ? undefined : 'ml'}
                style={{
                  fontFamily: `"${family}", "Noto Sans Malayalam", sans-serif`,
                  fontSize: size,
                  lineHeight: leading,
                }}
              >
                {livePreview.current ? livePreview.text : 'Converting…'}
              </p>
            ) : (
              <p className="muted small">{error || 'Loading preview…'}</p>
            )}
          </div>
          <div className="font-detail-actions">
            <button className="button secondary" onClick={() => onReport(active)}>
              Report copyright
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function BundledFontDetail({
  font,
  previewSource,
  provider,
  online,
  onDownload,
  downloading,
  downloadNotice,
  onBack,
}: {
  font: (typeof fonts)[number];
  previewSource: string;
  provider: Preferences['provider'];
  online: boolean;
  onDownload(name: string, files: FontDownloadSource[]): void;
  downloading: string;
  downloadNotice: string;
  onBack(): void;
}) {
  const [previewInput, setPreviewInput] = useState(previewSource.trim() || DEFAULT_PREVIEW_INPUT);
  const [size, setSize] = useState(42);
  useEffect(
    () => setPreviewInput(previewSource.trim() || DEFAULT_PREVIEW_INPUT),
    [font.id, previewSource],
  );
  const livePreview = useLiveFontPreview(previewInput, provider, online);
  const archiveFiles: FontDownloadSource[] = [
    { filename: `${font.name}-Regular.woff2`, url: font.assets.regular },
    ...(font.assets.semibold
      ? [{ filename: `${font.name}-Semibold.woff2`, url: font.assets.semibold }]
      : []),
  ];
  return (
    <section className="font-detail" aria-labelledby="bundled-font-detail-title">
      <button className="text-button font-back" onClick={onBack}>
        ← All fonts
      </button>
      <header className="font-detail-heading">
        <div>
          <p className="eyebrow">Unicode · {font.variant}</p>
          <h2 id="bundled-font-detail-title">{font.name}</h2>
        </div>
        <button
          className="button primary"
          disabled={!!downloading}
          onClick={() => void onDownload(font.name, archiveFiles)}
        >
          {downloading === font.name ? 'Preparing…' : 'Download family (.zip)'}
        </button>
      </header>
      {downloadNotice ? (
        <p className="font-download-status" role="status">
          {downloadNotice}
        </p>
      ) : null}
      <div className="font-detail-info">
        <p>{font.description}</p>
        <div className="font-credit">
          <a href={font.source} target="_blank" rel="noreferrer">
            Official font project ↗
          </a>
          <a href={font.licence.notice} target="_blank" rel="noreferrer">
            {font.licence.spdx} licence ↗
          </a>
        </div>
      </div>
      <div className="font-preview-controls">
        <label className="preview-text-control">
          Type Manglish
          <textarea
            aria-label="Type Manglish preview text"
            placeholder={DEFAULT_PREVIEW_INPUT}
            value={previewInput}
            rows={2}
            onChange={(event) => setPreviewInput(event.target.value)}
          />
          <span className="font-preview-hint">Live Malayalam · “manassil ninnu thanne”</span>
        </label>
        <label>
          Size · {size}px
          <input
            type="range"
            min={24}
            max={76}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="font-live-preview">
        <p
          className="font-detail-specimen"
          lang="ml"
          style={{ fontFamily: `"${font.cssFamily}", sans-serif`, fontSize: size }}
        >
          {livePreview.current ? livePreview.text : 'Converting…'}
        </p>
      </div>
    </section>
  );
}

export function Fonts({
  sample,
  encodedSample,
  previewSource,
  provider,
  online,
  store,
}: {
  sample: string;
  encodedSample: string;
  previewSource: string;
  provider: Preferences['provider'];
  online: boolean;
  store: LibraryStore;
}) {
  const [query, setQuery] = useState(''),
    [encoding, setEncoding] = useState('All'),
    [category, setCategory] = useState('All'),
    [size, setSize] = useState(32),
    [detailKey, setDetailKey] = useState(''),
    [assetDetailId, setAssetDetailId] = useState(''),
    [sourceDetailId, setSourceDetailId] = useState(''),
    [bundledDetailId, setBundledDetailId] = useState(''),
    [report, setReport] = useState<PublishedFont | null>(null),
    [sourceReport, setSourceReport] = useState<ExternalFontSource | LocalFontAsset | null>(null);
  const familyDownload = useFamilyDownload();
  const preview = sample.trim() || DEFAULT_PREVIEW_TEXT;
  const match = (name: string, type: string, group: string) =>
    name.toLowerCase().includes(query.toLowerCase()) &&
    (encoding === 'All' || encoding === fontEncodingLabel(type)) &&
    (category === 'All' || category === group);
  const bundled = fonts.filter((font) =>
    match(font.name, 'Unicode', font.id.includes('serif-') ? 'Serif' : 'Sans serif'),
  );
  const remote = store.library.filter((font) =>
    match(`${font.name} ${font.family} ${font.authorName}`, font.encoding, font.category),
  );
  const sourceFonts = store.sourceFonts.filter(
    (font) =>
      !store.fontAssets.some((asset) => asset.sourceId === font.sourceId) &&
      match(
        `${font.name} ${font.family} ${font.variant} ${font.reportedLicence} ${font.sourceNumericId}`,
        font.encoding,
        font.sourceCategory || 'General',
      ),
  );
  const localAssets = store.fontAssets.filter((font) =>
    match(
      `${font.name} ${font.family} ${font.variant} ${font.filename} ${font.reportedLicence}`,
      font.encoding,
      font.sourceCategory || 'Downloaded',
    ),
  );
  const remoteFamilies = groupByFamily(remote);
  const sourceFamilies = groupSourceFonts(sourceFonts);
  const localFamilies = groupLocalFonts(localAssets);
  const allFamilies = groupByFamily(store.library);
  const detail = allFamilies.find((group) => group.key === detailKey);
  const assetDetail = store.fontAssets.find((font) => font.id === assetDetailId);
  const assetDetailGroup = assetDetail
    ? localFamilies.find((group) => group.fonts.some((font) => font.id === assetDetailId))
    : undefined;
  const sourceDetail = store.sourceFonts.find((font) => font.sourceId === sourceDetailId);
  const sourceDetailGroup = sourceDetail
    ? groupSourceFonts(
        store.sourceFonts.filter(
          (font) =>
            `${fontEncodingLabel(font.encoding)}:${(font.family.trim() || font.name).toLocaleLowerCase()}` ===
            `${fontEncodingLabel(sourceDetail.encoding)}:${(sourceDetail.family.trim() || sourceDetail.name).toLocaleLowerCase()}`,
        ),
      ).find((group) => group.fonts.some((font) => font.sourceId === sourceDetailId))
    : undefined;
  const bundledDetail = fonts.find((font) => font.id === bundledDetailId);
  const encodingOptions = [
    ...new Set([
      ...encodings,
      'Other',
      ...store.sourceFonts.map((font) => fontEncodingLabel(font.encoding)),
      ...store.fontAssets.map((font) => fontEncodingLabel(font.encoding)),
    ]),
  ];
  const categoryOptions = [
    ...new Set([
      ...categories,
      ...store.sourceFonts.map((font) => font.sourceCategory).filter(Boolean),
      ...store.fontAssets.map((font) => font.sourceCategory).filter(Boolean),
    ]),
  ];
  return (
    <section
      className="font-library"
      style={{ '--specimen-size': `${size}px` } as React.CSSProperties}
    >
      <div className="page-heading section-heading">
        <h1>Fonts</h1>
        <span className="muted small">
          {bundled.length + remote.length + sourceFonts.length + localAssets.length} fonts
        </span>
      </div>
      {bundledDetail ? (
        <BundledFontDetail
          font={bundledDetail}
          previewSource={previewSource}
          provider={provider}
          online={online}
          onDownload={familyDownload.download}
          downloading={familyDownload.downloading}
          downloadNotice={familyDownload.notice}
          onBack={() => setBundledDetailId('')}
        />
      ) : assetDetail && assetDetailGroup ? (
        <LocalFontDetail
          group={assetDetailGroup}
          store={store}
          previewSource={previewSource}
          provider={provider}
          online={online}
          onDownload={familyDownload.download}
          downloading={familyDownload.downloading}
          downloadNotice={familyDownload.notice}
          onBack={() => setAssetDetailId('')}
          onReport={(font) => setSourceReport(font)}
        />
      ) : sourceDetail && sourceDetailGroup ? (
        <SourceFontDetail
          group={sourceDetailGroup}
          selectedSourceId={sourceDetail.sourceId}
          store={store}
          previewSource={previewSource}
          provider={provider}
          online={online}
          onBack={() => setSourceDetailId('')}
          onReport={(font) => setSourceReport(font)}
        />
      ) : detail ? (
        <FontFamilyDetail
          group={detail}
          store={store}
          previewSource={previewSource}
          provider={provider}
          online={online}
          onDownload={familyDownload.download}
          downloading={familyDownload.downloading}
          downloadNotice={familyDownload.notice}
          onBack={() => setDetailKey('')}
          onReport={setReport}
        />
      ) : (
        <>
          {familyDownload.notice ? (
            <p className="font-download-status" role="status">
              {familyDownload.notice}
            </p>
          ) : null}
          <div className="catalogue-tools">
            <input
              type="search"
              className="search"
              aria-label="Search fonts and families"
              placeholder="Search fonts or families"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="encoding-filter" role="group" aria-label="Filter by encoding">
              {['All', ...encodingOptions].map((value) => (
                <button
                  key={value}
                  className={`filter-chip ${encoding === value ? 'selected' : ''}`}
                  aria-pressed={encoding === value}
                  onClick={() => setEncoding(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <select
              aria-label="Font category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="All">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label className="specimen-size">
              Aa
              <input
                type="range"
                aria-label="Font preview size"
                min={24}
                max={56}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="catalogue-list">
            {bundled.map((font) => (
              <article className="catalogue-row" key={font.id}>
                <div className="catalogue-meta">
                  <h2>{font.name}</h2>
                  <span className="muted small">
                    Unicode · {font.variant} · {font.licence.spdx}
                  </span>
                </div>
                <p className="catalogue-specimen" lang="ml" style={{ fontFamily: font.cssFamily }}>
                  {preview}
                </p>
                <div className="catalogue-actions">
                  <button
                    className="button secondary"
                    disabled={!!familyDownload.downloading}
                    onClick={() =>
                      void familyDownload.download(font.name, [
                        { filename: `${font.name}-Regular.woff2`, url: font.assets.regular },
                        ...(font.assets.semibold
                          ? [
                              {
                                filename: `${font.name}-Semibold.woff2`,
                                url: font.assets.semibold,
                              },
                            ]
                          : []),
                      ])
                    }
                  >
                    {familyDownload.downloading === font.name ? 'Preparing…' : 'Download family'}
                  </button>
                  <button className="button secondary" onClick={() => setBundledDetailId(font.id)}>
                    Details
                  </button>
                </div>
              </article>
            ))}
            {remoteFamilies.map((group) => (
              <article className="font-family-row" key={group.key}>
                <div className="family-row-heading">
                  <div>
                    <h2>{group.name}</h2>
                    <p className="muted small">
                      {group.encoding} · {group.category}
                    </p>
                  </div>
                  <span className="family-style-count">
                    {group.fonts.length} {group.fonts.length === 1 ? 'style' : 'styles'}
                  </span>
                </div>
                <div className="family-specimen">
                  <HostedSpecimen font={group.fonts[0]} store={store} sample={preview} />
                </div>
                <div className="family-row-footer">
                  <div className="family-variants" aria-label={`${group.name} styles`}>
                    {group.fonts.map((font) => (
                      <span className="style-label" key={font.id}>
                        {font.variant}
                      </span>
                    ))}
                  </div>
                  <button
                    className="button secondary"
                    disabled={!!familyDownload.downloading}
                    onClick={() =>
                      void familyDownload.download(
                        group.name,
                        group.fonts.map((font) => ({
                          filename: `${group.name} - ${font.variant || 'Regular'}.ttf`,
                          url: apiUrl(`/api/fonts/${font.id}/file?download=1`),
                        })),
                      )
                    }
                  >
                    {familyDownload.downloading === group.name ? 'Preparing…' : 'Download family'}
                  </button>
                  <button className="button secondary" onClick={() => setDetailKey(group.key)}>
                    Details
                  </button>
                </div>
              </article>
            ))}
            {localFamilies.map((group) => {
              const specimen =
                group.fonts.find((font) => font.encoding === 'Unicode' || font.mapVersion) ??
                group.fonts[0];
              return (
                <article className="font-family-row local-font-family-row" key={group.key}>
                  <div className="family-row-heading">
                    <div>
                      <h2>
                        {group.name}{' '}
                        {group.fonts.some((font) => font.sourceId) ? (
                          <span className="source-badge">Source</span>
                        ) : null}
                      </h2>
                      <p className="muted small">
                        {group.encoding} · {group.category}
                      </p>
                    </div>
                    <span className="family-style-count">
                      {group.fonts.length} {group.fonts.length === 1 ? 'font' : 'fonts'}
                    </span>
                  </div>
                  <div className="family-specimen">
                    <LocalFontSpecimen
                      font={specimen}
                      store={store}
                      sample={preview}
                      encodedSample={encodedSample}
                    />
                  </div>
                  <div className="family-row-footer">
                    <div className="family-variants" aria-label={`${group.name} styles`}>
                      {group.fonts.map((font) => (
                        <span className="style-label" key={font.id}>
                          {font.variant || font.filename}
                        </span>
                      ))}
                    </div>
                    <button
                      className="button secondary"
                      disabled={!!familyDownload.downloading}
                      onClick={() =>
                        void familyDownload.download(
                          group.name,
                          group.fonts.map((font) => ({
                            filename: font.filename,
                            url: apiUrl(`/api/font-assets/${font.id}/file?download=1`),
                          })),
                        )
                      }
                    >
                      {familyDownload.downloading === group.name ? 'Preparing…' : 'Download family'}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setAssetDetailId(specimen.id)}
                    >
                      Details
                    </button>
                  </div>
                </article>
              );
            })}
            {sourceFonts.length ? (
              <section className="external-font-index" aria-label="Source fonts">
                {sourceFamilies.map((group) => (
                  <details className="external-font-family" key={group.key}>
                    <summary className="family-row-heading">
                      <div>
                        <h3>{group.name}</h3>
                        <p className="muted small">
                          {group.encoding} · {group.category}
                        </p>
                      </div>
                      <span className="family-style-count">
                        {group.fonts.length} {group.fonts.length === 1 ? 'font' : 'fonts'}
                      </span>
                    </summary>
                    <div className="family-specimen">
                      <SourceFontSpecimen
                        font={group.fonts[0]}
                        store={store}
                        sample={preview}
                        size={size}
                        leading={1.8}
                      />
                    </div>
                    <div className="external-font-items">
                      {group.fonts.map((font) => {
                        const downloadUrl = externalFontDownloadUrl(font);
                        return (
                          <article className="external-font-item" key={font.sourceId}>
                            <div className="external-font-copy">
                              <h4>
                                {font.name} <span className="source-badge">Source</span>
                              </h4>
                              <p className="muted small">
                                {fontEncodingLabel(font.encoding)} ·{' '}
                                {font.variant || 'Style not listed'}
                              </p>
                            </div>
                            <div className="external-font-actions">
                              {font.assetStored ? (
                                <a
                                  className="button secondary"
                                  href={apiUrl(
                                    `/api/source-fonts/${encodeURIComponent(font.sourceId)}/file?download=1`,
                                  )}
                                  download
                                >
                                  Download
                                </a>
                              ) : !downloadUrl ? (
                                <span className="muted small">Download unavailable</span>
                              ) : (
                                <a
                                  className="button secondary"
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Download
                                </a>
                              )}
                              <button
                                className="button secondary"
                                onClick={() => setSourceDetailId(font.sourceId)}
                              >
                                Details
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </section>
            ) : null}
            {!bundled.length &&
            !remoteFamilies.length &&
            !sourceFonts.length &&
            !localFamilies.length ? (
              <p className="empty-state">No fonts match. Try another name or category.</p>
            ) : null}
          </div>
        </>
      )}
      {report ? <ReportFont font={report} onClose={() => setReport(null)} /> : null}
      {sourceReport ? (
        <ReportSourceFont
          font={sourceReport}
          onClose={() => setSourceReport(null)}
          onReported={store.refresh}
        />
      ) : null}
    </section>
  );
}
