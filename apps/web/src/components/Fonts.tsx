import { useEffect, useState } from 'react';
import { apiUrl } from '@lipiflow/library/client';
import {
  categories,
  encodings,
  externalFontDownloadUrl,
  type ExternalFontSource,
  type PublishedFont,
} from '@lipiflow/library';
import { fonts } from '../catalogue';
import { legacyFonts, type OutputMode } from '../legacy';
import { hostedEdition, type LibraryStore } from '../hosted';
import { LocalFonts } from './LocalFonts';
import { ReportFont } from './ReportFont';
import { ReportSourceFont } from './ReportSourceFont';
import './source-fonts.css';

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
    const key = `${font.encoding}:${name.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      name,
      encoding: font.encoding,
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
  sample,
  encodedSample,
  onBack,
  onSelect,
  onFavourite,
  onReport,
}: {
  group: FontFamily;
  store: LibraryStore;
  sample: string;
  encodedSample: string;
  onBack(): void;
  onSelect(font: PublishedFont, family: string): void;
  onFavourite(id: string): void;
  onReport(font: PublishedFont): void;
}) {
  const [activeId, setActiveId] = useState(group.fonts[0]?.id ?? ''),
    [preview, setPreview] = useState(
      group.encoding === 'Unicode' ? sample.trim() || 'മലയാളം, മനസ്സിൽ നിന്ന്.' : encodedSample,
    ),
    [size, setSize] = useState(42),
    [leading, setLeading] = useState(1.8);
  useEffect(() => {
    setActiveId(group.fonts[0]?.id ?? '');
    setPreview(
      group.encoding === 'Unicode' ? sample.trim() || 'മലയാളം, മനസ്സിൽ നിന്ന്.' : encodedSample,
    );
  }, [group.key, sample, encodedSample]);
  const active = group.fonts.find((font) => font.id === activeId) ?? group.fonts[0];
  const loadedFamily = active ? store.families[active.id] : undefined;
  const renderText = preview || '…';
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
        {active ? (
          <a
            className="button secondary"
            href={apiUrl(`/api/fonts/${active.id}/file?download=1`)}
            download
          >
            Download {active.variant}
          </a>
        ) : null}
      </header>
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
              Preview text
              <textarea
                value={preview}
                rows={2}
                onChange={(event) => setPreview(event.target.value)}
              />
            </label>
            {active.encoding !== 'Unicode' ? (
              <p className="muted small legacy-preview-note">
                For {active.encoding}, enter text already encoded for this font. A conversion map is
                only available when verified.
              </p>
            ) : null}
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
            {active && !loadedFamily ? (
              <HostedSpecimen font={active} store={store} sample="Loading preview…" />
            ) : null}
            {loadedFamily ? (
              <p
                className="font-detail-specimen"
                lang="ml"
                style={{ fontFamily: loadedFamily, fontSize: size, lineHeight: leading }}
              >
                {renderText}
              </p>
            ) : null}
          </div>
          <div className="font-detail-actions">
            <button
              className="button primary"
              onClick={() => onSelect(active, loadedFamily ?? '')}
              disabled={!loadedFamily}
            >
              Use this font
            </button>
            <button
              className="button secondary"
              aria-pressed={store.favourites.includes(active.id)}
              onClick={() => onFavourite(active.id)}
            >
              {store.favourites.includes(active.id) ? 'Saved' : 'Save font'}
            </button>
            <button className="text-button" onClick={() => onReport(active)}>
              Report copyright
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function Fonts({
  selected,
  onSelect,
  sample,
  encodedSample,
  legacyLoaded,
  onLegacyLoad,
  onLegacySelect,
  store,
  onHostedSelect,
  onSignIn,
}: {
  selected: string;
  onSelect(id: string): void;
  sample: string;
  encodedSample: string;
  legacyLoaded: Record<string, string>;
  onLegacyLoad(file: File | undefined, mode: OutputMode): void;
  onLegacySelect(mode: OutputMode): void;
  store: LibraryStore;
  onHostedSelect(font: PublishedFont, family: string): void;
  onSignIn(): void;
}) {
  const [query, setQuery] = useState(''),
    [encoding, setEncoding] = useState('All'),
    [category, setCategory] = useState('All'),
    [saved, setSaved] = useState(false),
    [size, setSize] = useState(32),
    [detailKey, setDetailKey] = useState(''),
    [report, setReport] = useState<PublishedFont | null>(null),
    [sourceReport, setSourceReport] = useState<ExternalFontSource | null>(null),
    [notice, setNotice] = useState('');
  const preview = sample.trim() || 'മലയാളം, മനസ്സിൽ നിന്ന്.';
  const match = (name: string, type: string, group: string, id: string) =>
    name.toLowerCase().includes(query.toLowerCase()) &&
    (encoding === 'All' || encoding === type) &&
    (category === 'All' || category === group) &&
    (!saved || store.favourites.includes(id));
  const bundled = fonts.filter((font) =>
    match(font.name, 'Unicode', font.id.includes('serif-') ? 'Serif' : 'Sans serif', font.id),
  );
  const legacy = legacyFonts.filter((font) =>
    match(font.family, font.mode, 'Traditional', font.id),
  );
  const remote = store.library.filter((font) =>
    match(`${font.name} ${font.family} ${font.authorName}`, font.encoding, font.category, font.id),
  );
  const sourceFonts = store.sourceFonts.filter((font) =>
    match(
      `${font.name} ${font.family} ${font.variant} ${font.reportedLicence} ${font.sourceNumericId}`,
      font.encoding,
      font.sourceCategory || 'General',
      font.sourceId,
    ),
  );
  const remoteFamilies = groupByFamily(remote);
  const sourceFamilies = groupSourceFonts(sourceFonts);
  const allFamilies = groupByFamily(store.library);
  const detail = allFamilies.find((group) => group.key === detailKey);
  const encodingOptions = [
    ...new Set([...encodings, ...store.sourceFonts.map((font) => font.encoding)]),
  ];
  const categoryOptions = [
    ...new Set([
      ...categories,
      ...store.sourceFonts.map((font) => font.sourceCategory).filter(Boolean),
    ]),
  ];
  function favourite(id: string) {
    if (!store.user) {
      onSignIn();
      return;
    }
    void store.favourite(id).catch((error) => setNotice(error.message));
  }
  return (
    <section
      className="font-library"
      style={{ '--specimen-size': `${size}px` } as React.CSSProperties}
    >
      <div className="page-heading section-heading">
        <h1>Fonts</h1>
        <span className="muted small">
          {bundled.length + legacy.length + remote.length + sourceFonts.length} fonts
        </span>
      </div>
      {detail ? (
        <FontFamilyDetail
          group={detail}
          store={store}
          sample={sample}
          encodedSample={encodedSample}
          onBack={() => setDetailKey('')}
          onSelect={onHostedSelect}
          onFavourite={favourite}
          onReport={setReport}
        />
      ) : (
        <>
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
                  {value === 'ML-TT' ? 'ML-TT' : value}
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
            {hostedEdition ? (
              <button
                className={`button secondary ${saved ? 'selected' : ''}`}
                aria-pressed={saved}
                onClick={() => setSaved(!saved)}
              >
                Saved
              </button>
            ) : null}
          </div>
          {notice ? (
            <p className="banner" role="status">
              {notice}
            </p>
          ) : null}
          <div className="catalogue-list">
            {bundled.map((font) => (
              <article className="catalogue-row" key={font.id}>
                <div className="catalogue-meta">
                  <h2>{font.name}</h2>
                  <span className="muted small">
                    Unicode · {font.variant} · {font.licence.spdx}
                  </span>
                  <details className="font-downloads">
                    <summary>License &amp; downloads</summary>
                    <div className="font-download-links">
                      <a href={font.assets.regular} download={`${font.id}-regular.woff2`}>
                        Download Regular WOFF2
                      </a>
                      {font.assets.semibold ? (
                        <a href={font.assets.semibold} download={`${font.id}-semibold.woff2`}>
                          Download Semibold WOFF2
                        </a>
                      ) : null}
                      <a href={font.licence.notice} target="_blank" rel="noreferrer">
                        SIL OFL 1.1 license notice
                      </a>
                      <a
                        href="https://github.com/notofonts/malayalam/releases"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official full font releases ↗
                      </a>
                    </div>
                  </details>
                </div>
                <p className="catalogue-specimen" lang="ml" style={{ fontFamily: font.cssFamily }}>
                  {preview}
                </p>
                <div className="catalogue-actions">
                  {hostedEdition ? (
                    <button
                      className="text-button"
                      aria-label={`Save ${font.name}`}
                      aria-pressed={store.favourites.includes(font.id)}
                      onClick={() => favourite(font.id)}
                    >
                      {store.favourites.includes(font.id) ? 'Saved' : 'Save'}
                    </button>
                  ) : null}
                  <button
                    className="button secondary"
                    disabled={selected === font.id}
                    onClick={() => onSelect(font.id)}
                  >
                    {selected === font.id ? 'Selected font' : 'Use this font'}
                  </button>
                </div>
              </article>
            ))}
            {legacy.map((font) => (
              <article className="catalogue-row" key={font.id}>
                <div className="catalogue-meta">
                  <h2>{font.family}</h2>
                  <span className="muted small">{font.mode} · Regular</span>
                </div>
                {legacyLoaded[font.mode] ? (
                  <p
                    className="catalogue-specimen"
                    lang="ml"
                    style={{ fontFamily: legacyLoaded[font.mode] }}
                  >
                    {encodedSample || '…'}
                  </p>
                ) : (
                  <label className="catalogue-empty">
                    Choose your font file
                    <input
                      type="file"
                      accept=".ttf"
                      aria-label={`Load ${font.family}`}
                      onChange={(event) => {
                        onLegacyLoad(event.target.files?.[0], font.mode as OutputMode);
                        event.target.value = '';
                      }}
                    />
                  </label>
                )}
                <button
                  className="button secondary"
                  onClick={() => onLegacySelect(font.mode as OutputMode)}
                >
                  Use this font
                </button>
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
                  <HostedSpecimen
                    font={group.fonts[0]}
                    store={store}
                    sample={group.encoding === 'Unicode' ? preview : encodedSample || '…'}
                  />
                </div>
                <div className="family-row-footer">
                  <div className="family-variants" aria-label={`${group.name} styles`}>
                    {group.fonts.map((font) => (
                      <span className="style-label" key={font.id}>
                        {font.variant}
                      </span>
                    ))}
                  </div>
                  <button className="button secondary" onClick={() => setDetailKey(group.key)}>
                    Get info
                  </button>
                </div>
              </article>
            ))}
            {sourceFonts.length ? (
              <section className="external-font-index" aria-labelledby="external-font-index-title">
                <header className="external-font-index-heading">
                  <div>
                    <p className="eyebrow">Original source</p>
                    <h2 id="external-font-index-title">Malayalamfont.com</h2>
                  </div>
                  <span className="family-style-count">
                    {sourceFonts.length} {sourceFonts.length === 1 ? 'listing' : 'listings'}
                  </span>
                </header>
                <p className="external-font-index-note">
                  Source downloads open on Malayalamfont.com and may require its CAPTCHA. Review the
                  source rights details before use. A copyright report disables that listing in
                  LipiFlow while it is reviewed.
                </p>
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
                    <div className="external-font-items">
                      {group.fonts.map((font) => {
                        const downloadUrl = externalFontDownloadUrl(font);
                        return (
                          <article className="external-font-item" key={font.sourceId}>
                            <div className="external-font-copy">
                              <h4>{font.name}</h4>
                              <p className="muted small">
                                {font.variant || 'Style not listed'} · {font.reportedLicence}
                              </p>
                              {font.copyrightText ? (
                                <details className="external-font-rights">
                                  <summary>Rights note</summary>
                                  <p>{font.copyrightText}</p>
                                </details>
                              ) : null}
                            </div>
                            <div className="external-font-actions">
                              {downloadUrl ? (
                                <a
                                  className="button secondary external-font-download"
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open ${font.name} source details and download`}
                                >
                                  Details &amp; download ↗
                                </a>
                              ) : (
                                <span className="muted small">
                                  {font.rightsStatus === 'rights-review'
                                    ? 'Download paused while reported'
                                    : font.rightsStatus === 'restricted'
                                      ? 'Download blocked after review'
                                      : 'Download unavailable'}
                                </span>
                              )}
                              <button
                                type="button"
                                className="text-button external-font-report"
                                onClick={() => setSourceReport(font)}
                                aria-label={`Report copyright concern for ${font.name}`}
                              >
                                Report copyright
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
            {!bundled.length && !legacy.length && !remoteFamilies.length && !sourceFonts.length ? (
              <p className="empty-state">No fonts match. Try another name or category.</p>
            ) : null}
          </div>
          {!saved && category === 'All' ? (
            <LocalFonts
              sample={preview}
              encodedSample={encodedSample}
              query={query}
              encoding={encoding}
            />
          ) : null}
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
