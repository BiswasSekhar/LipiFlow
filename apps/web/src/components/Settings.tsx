import type { Preferences } from '../preferences';
import { Icon } from './Icon';
export function Settings({
  prefs,
  onChange,
  onForget,
  version,
  offlineReady,
  install,
}: {
  prefs: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onForget: () => void;
  version: string;
  offlineReady: boolean;
  install?: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
        <p className="muted">Reading preferences and what this browser remembers.</p>
      </div>
      <div className="settings-grid">
        <section className="settings-card card">
          <h2>Appearance</h2>
          <fieldset>
            <legend>Theme</legend>
            <div className="choice-row">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <label className="radio-choice" key={theme}>
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={prefs.theme === theme}
                    onChange={() => onChange({ theme })}
                  />
                  <span>
                    {theme === 'system'
                      ? 'Device theme'
                      : `${theme[0].toUpperCase()}${theme.slice(1)}`}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Malayalam preview size</legend>
            <div className="choice-row">
              {[28, 36, 44].map((size) => (
                <label className="radio-choice" key={size}>
                  <input
                    type="radio"
                    name="size"
                    value={size}
                    checked={prefs.size === size}
                    onChange={() => onChange({ size })}
                  />
                  <span>{size === 28 ? 'Small' : size === 36 ? 'Medium' : 'Large'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="settings-card card">
          <h2>Your text, your choice</h2>
          <label className="toggle-row">
            <span>
              <strong>Remember draft on this device</strong>
              <span className="muted small">Save one draft in this browser. No cloud storage.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={prefs.rememberDraft}
              onChange={(event) => onChange({ rememberDraft: event.target.checked })}
            />
          </label>
          <p className="muted small">
            Off by default. Turning this off deletes the saved draft and keeps your open editor
            text.
          </p>
          <button className="button secondary" onClick={onForget}>
            Forget saved draft
          </button>
        </section>
        <section className="settings-card card">
          <h2>Take LipiFlow with you</h2>
          <p className="muted">
            {offlineReady
              ? 'LipiFlow is available without a connection on this device.'
              : 'Open LipiFlow online once to prepare it for use without a connection.'}
          </p>
          {install ? (
            <button className="button primary" onClick={install}>
              <Icon name="download" />
              Install LipiFlow
            </button>
          ) : (
            <p className="muted small">
              Use your browser’s install option. On iPhone or iPad, open Safari’s Share menu and
              choose “Add to Home Screen”.
            </p>
          )}
        </section>
        <section className="settings-card privacy-card card">
          <Icon name="lock" size={26} />
          <h2>Your text and privacy</h2>
          <p className="muted">
            Mozhi converts on this device. Google typing is experimental and sends Manglish phrases
            to Google for online suggestions. LipiFlow has no analytics or typing diagnostics.
            Drafts are stored only when you choose.
          </p>
          <a className="text-link" href="/licenses/mozhi.txt" target="_blank" rel="noreferrer">
            Mozhi attribution and licence ↗
          </a>
          <p className="version muted small">{version || 'Engine loading…'}</p>
        </section>
      </div>
    </>
  );
}
