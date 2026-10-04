import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, authHeaders } from '@lipiflow/library/client';
import {
  auth,
  currentAccount,
  firebaseConfigured,
  onAuthStateChanged,
  signInGoogle,
} from '@lipiflow/firebase';
import type {
  Account,
  CopyrightReport,
  ExternalFontSource,
  FontAssetReport,
  LibraryFont,
  SourceFontReport,
} from '@lipiflow/library';
import '@lipiflow/design-tokens/tokens.css';
import './styles.css';

function FontReview({
  font,
  csrf,
  onUpdate,
}: {
  font: LibraryFont;
  csrf: string;
  onUpdate(): Promise<void>;
}) {
  const [note, setNote] = useState(''),
    [rights, setRights] = useState(false),
    [family, setFamily] = useState(''),
    [sample, setSample] = useState('മലയാളം, മനസ്സിൽ നിന്ന്.'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let face: FontFace | undefined;
    let live = true;
    void fetch(`/api/fonts/${font.id}/file`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const loaded = await new FontFace(`Admin-${font.id}`, await response.arrayBuffer()).load();
        if (!live) return;
        face = loaded;
        document.fonts.add(loaded);
        setFamily(loaded.family);
      })
      .catch(() => {
        if (live) setError('Font preview unavailable');
      });
    return () => {
      live = false;
      if (face) document.fonts.delete(face);
    };
  }, [font.id]);
  async function review(status: string) {
    setBusy(true);
    setError('');
    try {
      await api(
        `/api/admin/fonts/${font.id}`,
        { method: 'PATCH', body: JSON.stringify({ status, note, rightsReviewed: rights }) },
        csrf,
      );
      await onUpdate();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="review-row">
      <div className="row-heading">
        <h2>
          {font.family || font.name} · {font.variant}
        </h2>
        <span>{font.status}</span>
      </div>
      <p className="muted">
        {font.encoding} · {font.category} · {font.variant}
      </p>
      {font.description ? <p>{font.description}</p> : null}
      {font.authorName ? (
        <p className="muted">
          Author:{' '}
          {font.authorUrl ? (
            <a href={font.authorUrl} target="_blank" rel="noreferrer">
              {font.authorName} ↗
            </a>
          ) : (
            font.authorName
          )}
          {font.uploaderIsAuthor ? ' · Uploaded by author' : ''}
        </p>
      ) : null}
      <details>
        <summary>Permission and file details</summary>
        <p>{font.permission}</p>
        <a href={font.licenceUrl} target="_blank" rel="noreferrer">
          {font.licence} ↗
        </a>
        <p>{font.filename}</p>
        <code>{font.sha256}</code>
        <p>Uploader: {font.ownerId}</p>
      </details>
      {font.encoding === 'Unicode' ? (
        <>
          <input
            aria-label={`Preview text for ${font.name}`}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
          />
          <p className="review-specimen" lang="ml" style={{ fontFamily: family }}>
            {sample}
          </p>
        </>
      ) : (
        <p className="muted">
          Check the matching Karthika projection in the Type editor before approving this legacy
          font.
        </p>
      )}
      <label>
        Review note
        <textarea
          aria-label={`Review note for ${font.name}`}
          value={note}
          minLength={10}
          maxLength={5000}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={rights}
          onChange={(event) => setRights(event.target.checked)}
        />
        I reviewed the permission to host and redistribute this font.
      </label>
      <div className="actions">
        <button
          disabled={busy || !rights || note.trim().length < 10}
          onClick={() => void review('approved')}
        >
          Publish font
        </button>
        <button
          className="secondary"
          disabled={busy || note.trim().length < 10}
          onClick={() => void review('rejected')}
        >
          Reject upload
        </button>
        <button
          className="secondary"
          disabled={busy || note.trim().length < 10}
          onClick={() => void review('hidden')}
        >
          Hide font
        </button>
      </div>
      {font.reviewNote ? <p className="muted">Previous review: {font.reviewNote}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}
function ReportReview({
  report,
  csrf,
  onUpdate,
}: {
  report: CopyrightReport;
  csrf: string;
  onUpdate(): Promise<void>;
}) {
  const [resolution, setResolution] = useState(''),
    [hide, setHide] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <article className="review-row">
      <div className="row-heading">
        <h2>Copyright report</h2>
        <span>{report.status}</span>
      </div>
      <p>
        {report.name} · {report.email}
      </p>
      <p>{report.details}</p>
      <a href={report.evidenceUrl} target="_blank" rel="noreferrer">
        Ownership evidence ↗
      </a>
      <p className="muted">
        Font: {report.fontId} · Report: {report.id}
      </p>
      {report.status === 'open' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void api(
              '/api/admin/reports/' + report.id,
              { method: 'PATCH', body: JSON.stringify({ resolution, hideFont: hide }) },
              csrf,
            )
              .then(onUpdate)
              .catch((error) => setError(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Resolution note
            <textarea
              aria-label="Resolution note"
              minLength={10}
              maxLength={5000}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              required
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={hide}
              onChange={(event) => setHide(event.target.checked)}
            />
            Remove the font from public previews and downloads
          </label>
          <button disabled={busy}>Resolve report</button>
        </form>
      ) : (
        <p>{report.resolution}</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}

function SourceReportReview({
  report,
  csrf,
  onUpdate,
}: {
  report: SourceFontReport | FontAssetReport;
  csrf: string;
  onUpdate(): Promise<void>;
}) {
  const [resolution, setResolution] = useState(''),
    [restoreDownload, setRestoreDownload] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <article className="review-row">
      <div className="row-heading">
        <h2>{report.sourceName}</h2>
        <span>
          {report.status} · {report.rightsStatus}
        </span>
      </div>
      <p>
        {report.name} · {report.email}
      </p>
      <p>{report.details}</p>
      <p className="muted">Reported source licence: {report.reportedLicence}</p>
      {report.sourceUrl ? (
        <a href={report.sourceUrl} target="_blank" rel="noreferrer">
          Review source details ↗
        </a>
      ) : (
        <p className="muted">
          This report is for a locally stored font with no matched source page.
        </p>
      )}
      <p>
        <a href={report.evidenceUrl} target="_blank" rel="noreferrer">
          Ownership evidence ↗
        </a>
      </p>
      <p className="muted">
        {'assetId' in report ? 'Downloaded asset' : 'Source'}: {report.sourceId} · Report:{' '}
        {report.id}
      </p>
      {report.status === 'open' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void api(
              '/api/admin/source-font-reports/' + report.id,
              { method: 'PATCH', body: JSON.stringify({ resolution, restoreDownload }) },
              csrf,
            )
              .then(onUpdate)
              .catch((error) => setError(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Resolution note
            <textarea
              aria-label="Source report resolution note"
              minLength={10}
              maxLength={5000}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              required
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={restoreDownload}
              onChange={(event) => setRestoreDownload(event.target.checked)}
            />
            Restore the source link after review
          </label>
          <button disabled={busy}>Resolve report</button>
        </form>
      ) : (
        <p>{report.resolution}</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}

function makeSourceCsv(fonts: ExternalFontSource[]) {
  const columns: (keyof ExternalFontSource)[] = [
    'sourceId',
    'name',
    'family',
    'variant',
    'sourceCategory',
    'encoding',
    'sourceUrl',
    'reportedLicence',
    'copyrightText',
    'rightsStatus',
    'assetStored',
    'importedAt',
  ];
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    columns.map(escape).join(','),
    ...fonts.map((font) => columns.map((key) => escape(font[key])).join(',')),
  ].join('\r\n');
}

function Admin() {
  const [user, setUser] = useState<Account | null>(null),
    [csrf, setCsrf] = useState(''),
    [fonts, setFonts] = useState<LibraryFont[]>([]),
    [reports, setReports] = useState<CopyrightReport[]>([]),
    [sourceFonts, setSourceFonts] = useState<ExternalFontSource[]>([]),
    [sourceReports, setSourceReports] = useState<SourceFontReport[]>([]),
    [assetReports, setAssetReports] = useState<FontAssetReport[]>([]),
    [tab, setTab] = useState('fonts'),
    [targetUid, setTargetUid] = useState(''),
    [targetRole, setTargetRole] = useState<'user' | 'admin'>('user'),
    [roleNotice, setRoleNotice] = useState(''),
    [status, setStatus] = useState('pending'),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [config, setConfig] = useState({ local: false, loginAvailable: false });
  async function refresh() {
    try {
      const localUser = auth?.currentUser ? await currentAccount(auth.currentUser) : null;
      const me = localUser
        ? { user: localUser, csrf: '' }
        : await api<{ user: Account | null; csrf: string }>('/api/me');
      setUser(me.user);
      setCsrf(me.csrf);
      if (me.user?.role === 'admin') {
        const data = await api<{ fonts: LibraryFont[]; reports: CopyrightReport[] }>(
          '/api/admin/library',
        );
        setFonts(data.fonts);
        setReports(data.reports);
        const sources = await api<{ fonts: ExternalFontSource[] }>('/api/admin/source-fonts');
        setSourceFonts(sources.fonts);
        const sourceReportData = await api<{ reports: SourceFontReport[] }>(
          '/api/admin/source-font-reports',
        );
        setSourceReports(sourceReportData.reports);
        const assetReportData = await api<{ reports: FontAssetReport[] }>(
          '/api/admin/font-asset-reports',
        );
        setAssetReports(assetReportData.reports);
      }
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open the admin site.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let saved: { theme?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem('lipiflow.preferences.v1') ?? '{}');
    } catch {
      /* Use device theme when preferences are unavailable. */
    }
    document.documentElement.dataset.theme =
      saved.theme === 'dark' ||
      (saved.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
    void api<typeof config>('/api/config')
      .then(setConfig)
      .catch(() => {});
    const unsubscribe = auth ? onAuthStateChanged(auth, () => void refresh()) : undefined;
    void refresh();
    return () => unsubscribe?.();
  }, []);
  return (
    <div className="admin-shell">
      <header>
        <a href="/">LipiFlow</a>
        <span>Admin</span>
        <button
          className="secondary theme-toggle"
          onClick={() => {
            document.documentElement.dataset.theme =
              document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
          }}
        >
          Change theme
        </button>
      </header>
      {loading ? (
        <p>Loading…</p>
      ) : user?.role !== 'admin' ? (
        <main>
          <h1>Admin access</h1>
          <p>This site is available to instance administrators.</p>
          {config.loginAvailable && firebaseConfigured ? (
            <button
              className="button"
              onClick={() =>
                void signInGoogle()
                  .then(refresh)
                  .catch((e) => setError(e.message))
              }
            >
              Continue with Google
            </button>
          ) : null}
          {config.local ? (
            <button
              onClick={() =>
                void api('/api/dev/sign-in', {
                  method: 'POST',
                  body: JSON.stringify({ role: 'admin' }),
                })
                  .then(refresh)
                  .catch((error) => setError(error.message))
              }
            >
              Sign in as local admin
            </button>
          ) : null}
          {firebaseConfigured && auth?.currentUser ? (
            <button
              className="secondary"
              onClick={() => {
                const firebaseUser = auth?.currentUser;
                if (!firebaseUser) return;
                const uid = firebaseUser.uid;
                void authHeaders()
                  .then((headers) => {
                    headers.set('Content-Type', 'application/json');
                    return fetch('/api/admin-role', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ uid, role: 'admin' }),
                    });
                  })
                  .then(async (response) => {
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error ?? 'Admin setup failed.');
                    await firebaseUser.getIdToken(true);
                    await refresh();
                  })
                  .catch((error) =>
                    setError(error instanceof Error ? error.message : 'Admin setup failed.'),
                  );
              }}
            >
              Set up first administrator
            </button>
          ) : null}
          {user ? <p>Signed in as {user.name}. This account has no admin access.</p> : null}
        </main>
      ) : (
        <>
          <nav>
            <button
              className={tab === 'fonts' ? 'active' : 'secondary'}
              onClick={() => setTab('fonts')}
            >
              Font review
            </button>
            <button
              className={tab === 'reports' ? 'active' : 'secondary'}
              onClick={() => setTab('reports')}
            >
              Copyright reports ({reports.filter((x) => x.status === 'open').length})
            </button>
            <button
              className={tab === 'source-reports' ? 'active' : 'secondary'}
              onClick={() => setTab('source-reports')}
            >
              Source reports (
              {sourceReports.filter((x) => x.status === 'open').length +
                assetReports.filter((x) => x.status === 'open').length}
              )
            </button>
            <button
              className={tab === 'sources' ? 'active' : 'secondary'}
              onClick={() => setTab('sources')}
            >
              Source catalogue ({sourceFonts.length})
            </button>
            <button
              className={tab === 'members' ? 'active' : 'secondary'}
              onClick={() => setTab('members')}
            >
              User roles
            </button>
            <button className="secondary" onClick={() => void refresh()}>
              Refresh
            </button>
          </nav>
          <main>
            {tab === 'fonts' ? (
              <>
                <div className="page-title">
                  <h1>Review fonts</h1>
                  <input
                    type="search"
                    aria-label="Search uploads"
                    placeholder="Search uploads"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <select
                    aria-label="Review status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {['pending', 'approved', 'rejected', 'hidden', 'all'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                {fonts
                  .filter(
                    (font) =>
                      (status === 'all' || font.status === status) &&
                      font.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((font) => (
                    <FontReview
                      key={font.id + font.status}
                      font={font}
                      csrf={csrf}
                      onUpdate={refresh}
                    />
                  ))}
                {!fonts.some((font) => status === 'all' || font.status === status) ? (
                  <p className="empty">No fonts in this queue.</p>
                ) : null}
              </>
            ) : tab === 'reports' ? (
              <>
                <h1>Copyright reports</h1>
                {reports.map((report) => (
                  <ReportReview
                    key={report.id + report.status}
                    report={report}
                    csrf={csrf}
                    onUpdate={refresh}
                  />
                ))}
                {!reports.length ? <p className="empty">No reports received.</p> : null}
              </>
            ) : tab === 'source-reports' ? (
              <>
                <h1>Source font reports</h1>
                <p className="muted">
                  A report temporarily removes the affected font from public downloads. Review its
                  source and evidence before restoring access.
                </p>
                {[...sourceReports, ...assetReports]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((report) => (
                    <SourceReportReview
                      key={report.id + report.status}
                      report={report}
                      csrf={csrf}
                      onUpdate={refresh}
                    />
                  ))}
                {!sourceReports.length && !assetReports.length ? (
                  <p className="empty">No source reports received.</p>
                ) : null}
              </>
            ) : tab === 'members' ? (
              <>
                <h1>User roles</h1>
                <p>Enter a user ID from Firebase Authentication to change account access.</p>
                <form
                  className="role-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setRoleNotice('');
                    void (async () => {
                      const headers = await authHeaders();
                      headers.set('Content-Type', 'application/json');
                      const result = await fetch('/api/admin-role', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ uid: targetUid.trim(), role: targetRole }),
                      });
                      const data = await result.json();
                      if (!result.ok) throw new Error(data.error ?? 'Role update failed.');
                      setRoleNotice(`User role updated to ${targetRole}.`);
                      setTargetUid('');
                    })().catch((error) =>
                      setRoleNotice(error instanceof Error ? error.message : 'Role update failed.'),
                    );
                  }}
                >
                  <label>
                    Firebase user ID
                    <input
                      value={targetUid}
                      onChange={(event) => setTargetUid(event.target.value)}
                      maxLength={128}
                      required
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={targetRole}
                      onChange={(event) => setTargetRole(event.target.value as 'user' | 'admin')}
                    >
                      <option value="user">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button className="button" type="submit">
                    Update role
                  </button>
                </form>
                {roleNotice ? <p role="status">{roleNotice}</p> : null}
                <p className="muted small">
                  The change is recorded privately in Firebase. The user signs in again to receive
                  the updated access; previously issued ID tokens expire within an hour.
                </p>
              </>
            ) : (
              <>
                <div className="page-title">
                  <h1>External font sources</h1>
                  <input
                    type="search"
                    aria-label="Search source fonts"
                    placeholder="Search fonts"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <button
                    className="secondary"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([makeSourceCsv(sourceFonts)], { type: 'text/csv;charset=utf-8' }),
                      );
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'malayalamfont.com-font-catalog.csv';
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download CSV
                  </button>
                </div>
                <p className="muted">
                  Font details and source links only; binaries are not stored in R2. Unreported
                  listings link to the source site. Reports pause a link until reviewed.
                </p>
                {sourceFonts
                  .filter((font) =>
                    `${font.name} ${font.family} ${font.sourceCategory} ${font.encoding}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((font) => (
                    <article className="review-row source-row" key={font.sourceId}>
                      <div className="row-heading">
                        <h2>{font.name}</h2>
                        <span>
                          {font.rightsStatus === 'rights-review'
                            ? 'Download paused · report open'
                            : font.rightsStatus === 'restricted'
                              ? 'Download blocked'
                              : 'Source link available · rights unverified'}
                        </span>
                      </div>
                      <p className="muted">
                        {font.encoding} · {font.sourceCategory} ·{' '}
                        {font.variant || 'Variant not listed'}
                      </p>
                      <p>Reported licence: {font.reportedLicence}</p>
                      {font.copyrightText ? <p className="muted">{font.copyrightText}</p> : null}
                      <a href={font.sourceUrl} target="_blank" rel="noreferrer">
                        View source details ↗
                      </a>
                    </article>
                  ))}
                {!sourceFonts.length ? (
                  <p className="empty">No source records imported yet.</p>
                ) : null}
              </>
            )}
          </main>
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Admin />);
