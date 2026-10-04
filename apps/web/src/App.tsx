import { useEffect, useRef, useState } from 'react';
import { fonts } from './catalogue';
import { Fonts } from './components/Fonts';
import { AccountPanel } from './components/Account';
import { hostedEdition, useLibrary } from './hosted';
import {
  fontEncodingLabel,
  type ExternalFontSource,
  type LocalFontAsset,
  type PublishedFont,
} from '@lipiflow/library';
import { Icon } from './components/Icon';
import { Settings } from './components/Settings';
import { useTransliteration } from './engine/useTransliteration';
import { useEngine } from './engine/useEngine';
import { legacyFonts, useLegacyFonts, type OutputMode } from './legacy';
import {
  keys,
  persistPreferences,
  readInitialText,
  readPreferences,
  type Preferences,
} from './preferences';
import { useOffline } from './useOffline';
import { InlineEditor } from './editor/InlineEditor';
import { FontSearchPicker, type FontChoice } from './components/FontSearchPicker';
import {
  mapOffset,
  readDocument,
  renderDocument,
  saveDocument,
  type Selection,
} from './editor/document';

type View = 'type' | 'fonts' | 'settings' | 'account';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const EXAMPLE = 'namaskaaram!\nmalayaaLam, manassil ninn.\n{Made with LipiFlow}';
// Consume the transient update relay once, including under React Strict Mode.
const initialPrefs = readPreferences();
const initialText = readInitialText(initialPrefs);

export default function App() {
  const [view, setView] = useState<View>('type');
  const library = useLibrary();
  const [cloudFont, setCloudFont] = useState<{ font: PublishedFont; family: string } | null>(null);
  const [sourceFont, setSourceFont] = useState<{ font: ExternalFontSource; family: string } | null>(
    null,
  );
  const [assetFont, setAssetFont] = useState<{ font: LocalFontAsset; family: string } | null>(null);
  const [documentModel, setDocumentModel] = useState(() => readDocument(initialText));
  const source = saveDocument(documentModel);
  const [outputMode, setOutputMode] = useState<OutputMode>('Unicode');
  const [prefs, setPrefs] = useState(initialPrefs);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const offline = useOffline();
  const engine = useTransliteration(
    documentModel.active?.roman ?? '',
    composing,
    prefs.provider,
    offline.online,
  );
  const unicodeText = renderDocument(documentModel, engine.preview);
  const isLegacy = outputMode !== 'Unicode';
  const encoder = useEngine(
    unicodeText,
    (!isLegacy && view !== 'fonts') || !engine.current || composing,
    'encode',
  );
  const localFonts = useLegacyFonts();
  const legacyFont = legacyFonts.find((font) => font.mode === outputMode);
  const outputText = isLegacy ? encoder.output : unicodeText;
  const legacyFamily =
    assetFont?.font.encoding === outputMode
      ? assetFont.family
      : sourceFont?.font.encoding === outputMode
        ? sourceFont.family
        : cloudFont?.font.encoding === outputMode
          ? cloudFont.family
          : localFonts.loaded[outputMode];
  const renderedLegacy = isLegacy && !!legacyFamily && encoder.current;
  const editorText = renderedLegacy ? encoder.output : unicodeText;
  const outputCurrent = engine.current && (!isLegacy || encoder.current);
  const outputError = engine.status === 'error' || (isLegacy && encoder.status === 'error');
  const legacyFontName =
    assetFont?.font.encoding === outputMode
      ? assetFont.font.family || assetFont.font.name
      : sourceFont?.font.encoding === outputMode
        ? sourceFont.font.family || sourceFont.font.name
        : cloudFont?.font.encoding === outputMode
          ? cloudFont.font.family || cloudFont.font.name
          : legacyFont?.family;
  const activeFont =
    assetFont?.font.encoding === 'Unicode'
      ? { name: assetFont.font.name, cssFamily: assetFont.family }
      : sourceFont?.font.encoding === 'Unicode'
        ? { name: sourceFont.font.name, cssFamily: sourceFont.family }
        : cloudFont?.font.encoding === 'Unicode'
          ? { name: cloudFont.font.name, cssFamily: cloudFont.family }
          : (fonts.find((font) => font.id === prefs.fontId) ?? fonts[0]);
  const fontChoices: FontChoice[] = [
    ...(outputMode === 'Unicode'
      ? fonts.map((font) => ({ id: font.id, name: font.name, detail: `Unicode · ${font.variant}` }))
      : []),
    ...library.library
      .filter((font) => fontEncodingLabel(font.encoding) === outputMode)
      .map((font) => ({
        id: `published:${font.id}`,
        name: font.family || font.name,
        detail: `${font.variant} · user font`,
        disabled: font.encoding !== 'Unicode',
      })),
    ...library.fontAssets
      .filter((font) => fontEncodingLabel(font.encoding) === outputMode)
      .map((font) => ({
        id: `asset:${font.id}`,
        name: font.family || font.name,
        detail: `${font.sourceCategory} · ${font.variant || 'Regular'}${font.mapVersion ? ' · verified' : ''}`,
        disabled: font.encoding !== 'Unicode' && !font.mapVersion,
      })),
    ...(isLegacy && localFonts.loaded[outputMode]
      ? [
          {
            id: `local:${outputMode}`,
            name: legacyFont?.family || 'Local font',
            detail: `${outputMode} · this device`,
          },
        ]
      : []),
  ];
  const selectedFontChoice =
    assetFont && fontEncodingLabel(assetFont.font.encoding) === outputMode
      ? `asset:${assetFont.font.id}`
      : sourceFont && fontEncodingLabel(sourceFont.font.encoding) === outputMode
        ? `source:${sourceFont.font.sourceId}`
        : cloudFont?.font.encoding === outputMode
          ? `published:${cloudFont.font.id}`
          : isLegacy && localFonts.loaded[outputMode]
            ? `local:${outputMode}`
            : outputMode === 'Unicode'
              ? prefs.fontId
              : '';
  const exportReady =
    outputCurrent && outputText.length > 0 && (!isLegacy || !encoder.unsupported.length);
  const chars = Array.from(unicodeText).length;

  useEffect(() => {
    if (cloudFont && !library.library.some((font) => font.id === cloudFont.font.id))
      setCloudFont(null);
  }, [cloudFont, library.library]);

  useEffect(() => {
    if (assetFont && !library.fontAssets.some((font) => font.id === assetFont.font.id))
      setAssetFont(null);
  }, [assetFont, library.fontAssets]);

  useEffect(() => {
    if (
      sourceFont &&
      !library.sourceFonts.some((font) => font.sourceId === sourceFont.font.sourceId)
    )
      setSourceFont(null);
  }, [sourceFont, library.sourceFonts]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = prefs.theme === 'system' ? (media.matches ? 'dark' : 'light') : prefs.theme;
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#171717' : '#fafafa');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [prefs.theme]);

  useEffect(() => {
    try {
      persistPreferences(prefs, source);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [prefs, source]);

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const installed = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', listener);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', listener);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  function changePreferences(patch: Partial<Preferences>) {
    if (patch.rememberDraft === false) {
      try {
        localStorage.removeItem(keys.draft);
      } catch {
        setStorageError(true);
      }
    }
    if (patch.fontId) {
      setCloudFont(null);
      setSourceFont(null);
    }
    setPrefs((previous) => ({ ...previous, ...patch }));
  }
  async function selectTypeFont(id: string) {
    const assetMatch = id.startsWith('asset:')
      ? library.fontAssets.find((font) => `asset:${font.id}` === id)
      : undefined;
    if (assetMatch) {
      try {
        const family = await library.loadAsset(assetMatch);
        setAssetFont({ font: assetMatch, family });
        setCloudFont(null);
        setSourceFont(null);
        setNotice('Font preview changed');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'This font could not be loaded.');
      }
      return;
    }
    const sourceMatch = id.startsWith('source:')
      ? library.sourceFonts.find((font) => `source:${font.sourceId}` === id)
      : undefined;
    if (sourceMatch) {
      try {
        const family = await library.loadSource(sourceMatch);
        setSourceFont({ font: sourceMatch, family });
        setAssetFont(null);
        setCloudFont(null);
        setNotice('Font preview changed');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'This font could not be loaded.');
      }
      return;
    }
    const publishedMatch = id.startsWith('published:')
      ? library.library.find((font) => `published:${font.id}` === id)
      : undefined;
    if (publishedMatch) {
      try {
        const family = await library.load(publishedMatch);
        setCloudFont({ font: publishedMatch, family });
        setAssetFont(null);
        setSourceFont(null);
        setNotice('Font preview changed');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'This font could not be loaded.');
      }
      return;
    }
    if (id.startsWith('local:')) {
      setCloudFont(null);
      setSourceFont(null);
      setAssetFont(null);
      return;
    }
    changePreferences({ fontId: id });
    setCloudFont(null);
    setSourceFont(null);
    setAssetFont(null);
  }
  function edit(text: string) {
    setDocumentModel(readDocument(text));
    setManualCopy(false);
  }
  async function copy() {
    if (!exportReady) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setNotice(
        isLegacy
          ? `${outputMode} encoded text copied. Apply ${legacyFontName} where you paste.`
          : 'Malayalam copied',
      );
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.select();
      });
    }
  }
  function copySelection(event: React.ClipboardEvent<HTMLTextAreaElement>, selection: Selection) {
    event.preventDefault();
    if (!exportReady) {
      setNotice('Wait for conversion to finish before copying.');
      return false;
    }
    const from = isLegacy
      ? mapOffset(selection.start, encoder.spans, 'encoded', 'start')
      : selection.start;
    const end = isLegacy
      ? mapOffset(selection.end, encoder.spans, 'encoded', 'end')
      : selection.end;
    event.clipboardData.setData('text/plain', outputText.slice(from, end));
    return true;
  }
  function download() {
    if (!exportReady) return;
    const url = URL.createObjectURL(new Blob([outputText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = isLegacy
      ? `lipiflow-${outputMode === 'FML' ? 'fml' : 'mltt'}-karthika.txt`
      : 'lipiflow-malayalam.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Malayalam text downloaded');
  }
  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      setNotice('Use your browser’s install menu to add LipiFlow.');
    } finally {
      setInstallEvent(null);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to editor
      </a>
      <header className="header">
        <a
          className="brand"
          href="#type"
          onClick={() => setView('type')}
          aria-label="LipiFlow home"
        >
          <span className="brand-glyph" lang="ml" aria-hidden="true">
            ലി
          </span>
          <span>LipiFlow</span>
        </a>
        {hostedEdition ? (
          <button className="button secondary account-trigger" onClick={() => setView('account')}>
            {library.user ? 'My library' : 'Sign in'}
          </button>
        ) : null}
      </header>
      <aside className="sidebar">
        <nav className="nav" aria-label="Main navigation">
          {(['type', 'fonts', 'settings'] as const).map((item) => (
            <button
              key={item}
              className={view === item ? 'nav-item active' : 'nav-item'}
              aria-current={view === item ? 'page' : undefined}
              onClick={() => setView(item)}
            >
              <Icon name={item} size={18} />
              <span>
                {item[0].toUpperCase()}
                {item.slice(1)}
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <main id="main" tabIndex={-1}>
        {offline.needRefresh ? (
          <div className="banner" role="status">
            <span>A new LipiFlow version is ready. Your open text will be preserved.</span>
            <button
              className="button secondary"
              disabled={offline.updating}
              onClick={() => void offline.update(source)}
            >
              {offline.updating ? 'Updating…' : 'Update app'}
            </button>
          </div>
        ) : null}
        {offline.error ? (
          <p className="banner" role="alert">
            {offline.error}
          </p>
        ) : null}
        {storageError ? (
          <p className="banner" role="alert">
            This browser could not save your preferences or draft. Keep a copy before closing.
          </p>
        ) : null}
        {view === 'type' ? (
          <>
            <div className="editor-controls">
              <span className="engine-indicator" role="status">
                <span className="tiny-dot" />
                {engine.offlineFallback || prefs.provider === 'mozhi' ? 'Mozhi 2' : 'Google'}
              </span>
            </div>
            <section
              className="workspace single-workspace"
              aria-label="Malayalam transliteration editor"
            >
              <div className="workspace-toolbar">
                <div className="mode-group" role="group" aria-label="Output mode">
                  <span className="mode-label">Output</span>
                  {(['Unicode', 'FML', 'ML-TT'] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`mode-chip ${mode === outputMode ? 'selected' : ''}`}
                      aria-pressed={mode === outputMode}
                      onClick={() => {
                        setOutputMode(mode);
                        setManualCopy(false);
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="preview-choice">
                  <label className="control-label">Font</label>
                  <FontSearchPicker
                    value={selectedFontChoice}
                    choices={fontChoices}
                    searchLabel={`Search ${outputMode} fonts`}
                    onChoose={(id) => void selectTypeFont(id)}
                  />
                  {isLegacy ? (
                    <p className="font-map-note muted small">
                      Only fonts with a verified {outputMode} map can be selected.
                    </p>
                  ) : null}
                  {isLegacy ? (
                    <>
                      <label htmlFor="legacy-font" className="button secondary font-picker">
                        {localFonts.loading ? 'Opening…' : 'Open from device'}
                      </label>
                      <input
                        id="legacy-font"
                        className="sr-only"
                        type="file"
                        accept=".ttf"
                        disabled={localFonts.loading}
                        aria-label="Load matching legacy font"
                        onChange={(event) => {
                          void localFonts.load(event.target.files?.[0], outputMode);
                          event.target.value = '';
                        }}
                      />
                      {localFonts.notice ? (
                        <p className="small" role="status">
                          {localFonts.notice}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="editor-panel output-panel inline-panel">
                <div className="panel-heading">
                  <label htmlFor="editor">Malayalam</label>
                  <span className="live-tag">
                    <span className="tiny-dot" />
                    {outputError
                      ? 'Unavailable'
                      : engine.status === 'loading'
                        ? 'Loading'
                        : composing
                          ? 'Composing'
                          : outputCurrent
                            ? 'Ready'
                            : 'Converting'}
                  </span>
                </div>
                <InlineEditor
                  model={documentModel}
                  unicode={unicodeText}
                  display={editorText}
                  encoded={renderedLegacy}
                  spans={encoder.spans}
                  conversionCurrent={engine.current}
                  onChange={(model) => {
                    setDocumentModel(model);
                    setManualCopy(false);
                  }}
                  composing={composing}
                  onComposition={setComposing}
                  readOnly={offline.updating}
                  editorRef={editorRef}
                  size={prefs.size}
                  fontFamily={
                    renderedLegacy ? legacyFamily : `"${activeFont.cssFamily}", sans-serif`
                  }
                  onCopy={copySelection}
                />
                <div className="panel-footer">
                  <span>
                    {chars.toLocaleString()} {chars === 1 ? 'character' : 'characters'}
                  </span>
                  <button
                    className="text-button"
                    disabled={offline.updating}
                    onClick={() => {
                      edit(EXAMPLE);
                      editorRef.current?.focus();
                    }}
                  >
                    Load example <Icon name="arrow" size={15} />
                  </button>
                </div>
              </div>
              <div className="workspace-actions">
                <span className="sr-only" id="editor-help">
                  Type Manglish or paste Malayalam. Copy uses the selected encoding.
                </span>
                <div className="action-buttons">
                  <button
                    className="text-button clear-button"
                    disabled={!unicodeText || offline.updating}
                    onClick={() => {
                      edit('');
                      editorRef.current?.focus();
                    }}
                  >
                    Clear
                  </button>
                  <button className="button secondary" disabled={!exportReady} onClick={download}>
                    <Icon name="download" size={18} />
                    Download .txt
                  </button>
                  <button
                    className="button primary"
                    disabled={!exportReady}
                    onClick={() => void copy()}
                  >
                    <Icon name="copy" size={18} />
                    {isLegacy ? `Copy ${outputMode}` : 'Copy Malayalam'}
                  </button>
                </div>
              </div>
            </section>
            {isLegacy ? (
              <>
                <details className="encoding-details">
                  <summary>Font details</summary>
                  <p>
                    {legacyFont?.family} uses legacy character positions. Apply this font where you
                    paste. Text files use UTF-8.
                  </p>
                  <p>
                    Matching file: {legacyFont?.fileName}. Other variants need their own verified
                    conversion table.
                  </p>
                </details>
                {encoder.unsupported.length && outputCurrent ? (
                  <p className="banner" role="alert">
                    The Karthika map cannot represent:{' '}
                    {encoder.unsupported
                      .flatMap((value) =>
                        Array.from(value).map(
                          (char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase()}`,
                        ),
                      )
                      .join(', ')}
                    . Those characters are preserved in the editor. Use Unicode to export this text.
                  </p>
                ) : null}
              </>
            ) : null}
            {engine.segments.some((segment) => segment.candidates.length > 1) ? (
              <details className="google-spellings card">
                <summary>Choose another spelling · Google suggestions</summary>
                {engine.segments.map((segment, index) =>
                  segment.candidates.length > 1 ? (
                    <label className="spelling-choice" key={index}>
                      <span>{segment.source}</span>
                      <select
                        lang="ml"
                        aria-label={`Spelling for ${segment.source}`}
                        value={segment.text}
                        onChange={(event) => {
                          const chosen = engine.segments
                            .map((part, i) => (i === index ? event.target.value : part.text))
                            .join('');
                          setDocumentModel({
                            document: renderDocument(documentModel, chosen),
                            active: null,
                          });
                        }}
                        style={{ fontFamily: activeFont.cssFamily }}
                      >
                        {segment.candidates.map((candidate) => (
                          <option key={candidate} value={candidate}>
                            {candidate}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null,
                )}
              </details>
            ) : null}
            {outputError ? (
              <div className="banner error-banner" role="alert">
                <span>
                  {engine.error ||
                    'Conversion could not start. Your Manglish is still here. Retry, or reopen LipiFlow online if offline setup was incomplete.'}
                </span>
                <button
                  className="button secondary"
                  onClick={() => {
                    engine.retry();
                    encoder.retry();
                  }}
                >
                  Retry conversion
                </button>
              </div>
            ) : null}
            {manualCopy ? (
              <p className="banner" role="status">
                Clipboard access is unavailable. The text is selected: press Ctrl+C or ⌘C, or use
                your device’s Copy action.
              </p>
            ) : null}
          </>
        ) : view === 'fonts' ? (
          <Fonts
            store={library}
            sample={unicodeText}
            encodedSample={encoder.current ? encoder.output : ''}
            previewSource={documentModel.active?.roman ?? ''}
            provider={prefs.provider}
            online={offline.online}
          />
        ) : view === 'account' ? (
          <AccountPanel
            store={library}
            text={source}
            onOpen={(text) => {
              edit(text);
              setView('type');
            }}
          />
        ) : (
          <Settings
            prefs={prefs}
            onChange={changePreferences}
            onForget={() => {
              changePreferences({ rememberDraft: false });
              setNotice('Saved draft forgotten. Open text is still here.');
            }}
            version={engine.version}
            offlineReady={offline.ready}
            install={installEvent ? () => void install() : undefined}
          />
        )}
        <div className="toast" role="status" aria-live="polite">
          {notice ? (
            <>
              <Icon name="check" size={18} />
              {notice}
            </>
          ) : null}
        </div>
      </main>
      <footer className="footer">
        <a href="/licenses/lipiflow.txt" target="_blank" rel="noreferrer">
          Open source · MIT
        </a>
      </footer>
    </div>
  );
}
