import { useEffect, useState } from 'react';
import { categories, encodings, type Draft, type LibraryFont } from '@lipiflow/library';
import { api } from '@lipiflow/library/client';
import type { LibraryStore } from '../hosted';
import {
  auth,
  createEmailAccount,
  firebaseConfigured,
  readDrafts,
  removeDraft,
  resetEmailPassword,
  saveDraft,
  signInEmail,
  signInGoogle,
  signOut as firebaseSignOut,
} from '@lipiflow/firebase';

function UploadFontPreview({
  file,
  encoding,
  sample,
  onSample,
}: {
  file: File | null;
  encoding: (typeof encodings)[number];
  sample: string;
  onSample(value: string): void;
}) {
  const [family, setFamily] = useState(''),
    [error, setError] = useState(''),
    [size, setSize] = useState(36);
  useEffect(() => {
    if (!file) {
      setFamily('');
      setError('');
      return;
    }
    let live = true;
    let face: FontFace | undefined;
    void file
      .arrayBuffer()
      .then((bytes) => new FontFace(`UploadPreview-${crypto.randomUUID()}`, bytes).load())
      .then((loaded) => {
        if (!live) return;
        face = loaded;
        document.fonts.add(loaded);
        setFamily(loaded.family);
        setError('');
      })
      .catch(() => {
        if (live) setError('This file could not be previewed in the browser.');
      });
    return () => {
      live = false;
      if (face) document.fonts.delete(face);
    };
  }, [file]);
  if (!file) return null;
  return (
    <div className="upload-preview full-width">
      <div className="upload-preview-tools">
        <label>
          {encoding === 'Unicode'
            ? 'Preview text · Unicode'
            : `Preview text · ${encoding} characters`}
          <input
            value={sample}
            placeholder={
              encoding === 'Unicode' ? 'Type Malayalam text' : 'Type text in this legacy encoding'
            }
            onChange={(event) => onSample(event.target.value)}
          />
        </label>
        <label>
          Size · {size}px
          <input
            type="range"
            min={24}
            max={64}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="upload-preview-sample" lang="ml" style={{ fontFamily: family, fontSize: size }}>
        {family
          ? sample ||
            (encoding === 'Unicode' ? 'മലയാളം, മനസ്സിൽ നിന്ന്.' : 'Enter a sample to preview')
          : error || 'Preparing preview…'}
      </p>
      {error ? <span className="muted small">{error}</span> : null}
    </div>
  );
}

export function AccountPanel({
  store,
  text,
  onOpen,
}: {
  store: LibraryStore;
  text: string;
  onOpen(text: string): void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [uploads, setUploads] = useState<LibraryFont[]>([]),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(''),
    [uploadFile, setUploadFile] = useState<File | null>(null),
    [uploadSample, setUploadSample] = useState('മലയാളം, മനസ്സിൽ നിന്ന്.'),
    [uploadEncoding, setUploadEncoding] = useState<(typeof encodings)[number]>('Unicode');
  async function refresh() {
    const saved =
      firebaseConfigured && store.user
        ? await readDrafts(store.user.id)
        : (await api<{ drafts: Draft[] }>('/api/drafts')).drafts;
    const own = await api<{ fonts: LibraryFont[] }>('/api/me/fonts');
    setDrafts(saved);
    setUploads(own.fonts);
  }
  useEffect(() => {
    let live = true;
    if (store.user)
      void refresh().catch((error) => {
        if (live) setNotice(error.message);
      });
    return () => {
      live = false;
    };
  }, [store.user?.id]);
  async function action(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setNotice('');
    try {
      await task();
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!store.user)
    return (
      <section className="account-page">
        <h1>Your library</h1>
        <p className="muted">Save favourite fonts, keep drafts and submit fonts for review.</p>
        {store.config.loginAvailable && firebaseConfigured ? (
          <>
            <button
              className="button primary"
              onClick={() => void action(() => signInGoogle(), 'Signed in')}
            >
              Continue with Google
            </button>
            <form
              className="account-login-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget),
                  address = String(data.get('email') ?? '').trim(),
                  password = String(data.get('password') ?? '');
                void action(
                  () =>
                    register
                      ? createEmailAccount(address, password)
                      : signInEmail(address, password),
                  register ? 'Account created' : 'Signed in',
                );
              }}
            >
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                />
              </label>
              <button className="button secondary" disabled={busy}>
                {register ? 'Create account' : 'Sign in with email'}
              </button>
            </form>
            <div className="inline-actions">
              <button className="text-button" onClick={() => setRegister(!register)}>
                {register ? 'Already have an account? Sign in' : 'Create an account'}
              </button>
              {!register ? (
                <button
                  className="text-button"
                  disabled={!email}
                  onClick={() => void action(() => resetEmailPassword(email), 'Reset email sent')}
                >
                  Reset password
                </button>
              ) : null}
            </div>
          </>
        ) : null}
        {store.config.local ? (
          <div className="local-signin">
            <p className="muted small">Local development accounts</p>
            {(['user', 'admin'] as const).map((role) => (
              <button
                className="button secondary"
                key={role}
                onClick={() =>
                  void action(async () => {
                    await api('/api/dev/sign-in', {
                      method: 'POST',
                      body: JSON.stringify({ role }),
                    });
                    await store.refresh();
                  }, 'Signed in')
                }
              >
                Sign in as {role === 'user' ? 'member' : 'admin'}
              </button>
            ))}
          </div>
        ) : null}
        {!store.config.local && (!store.config.loginAvailable || !firebaseConfigured) ? (
          <p>Sign-in has not been configured by this instance’s operator.</p>
        ) : null}
        {notice || store.error ? <p role="status">{notice || store.error}</p> : null}
      </section>
    );
  return (
    <section className="account-page">
      <div className="page-heading section-heading">
        <h1>{store.user.name}</h1>
        <div className="inline-actions">
          {store.user.role === 'admin' ? (
            <a className="button secondary" href="/admin/">
              Admin site
            </a>
          ) : null}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                if (firebaseConfigured && auth) await firebaseSignOut(auth);
                else await api('/api/auth/sign-out', { method: 'POST' }, store.csrf);
                await store.refresh();
              }, 'Signed out')
            }
          >
            Sign out
          </button>
        </div>
      </div>
      {notice ? (
        <p className="banner" role="status">
          {notice}
        </p>
      ) : null}
      <section className="account-section">
        <h2>Drafts</h2>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action(async () => {
              if (firebaseConfigured && store.user)
                await saveDraft(store.user.id, String(form.get('title') ?? ''), text);
              else
                await api(
                  '/api/drafts',
                  { method: 'POST', body: JSON.stringify({ title: form.get('title'), text }) },
                  store.csrf,
                );
              await refresh();
            }, 'Draft saved');
          }}
        >
          <input
            name="title"
            aria-label="Draft title"
            placeholder="Draft title"
            maxLength={100}
            required
          />
          <button className="button primary" disabled={busy}>
            Save current text
          </button>
        </form>
        <p className="muted small">
          Saved only when you choose. Your drafts are private to your account.
        </p>
        {drafts.map((draft) => (
          <article className="saved-row" key={draft.id}>
            <div>
              <strong>{draft.title}</strong>
              <p className="muted small">{new Date(draft.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="inline-actions">
              <button className="button secondary" onClick={() => onOpen(draft.text)}>
                Open draft
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    if (firebaseConfigured && store.user)
                      await removeDraft(store.user.id, draft.id);
                    else await api('/api/drafts/' + draft.id, { method: 'DELETE' }, store.csrf);
                    await refresh();
                  }, 'Draft deleted')
                }
              >
                Delete draft
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="account-section">
        <h2>Upload a font</h2>
        <form
          className="upload-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget),
              file = form.get('file');
            const metadata = {
              name: form.get('name'),
              family: form.get('family'),
              description: form.get('description'),
              variant: form.get('variant'),
              category: form.get('category'),
              encoding: form.get('encoding'),
              authorName:
                form.get('uploaderIsAuthor') === 'on'
                  ? (store.user?.name ?? form.get('authorName'))
                  : form.get('authorName'),
              authorUrl: form.get('authorUrl') || '',
              uploaderIsAuthor: form.get('uploaderIsAuthor') === 'on',
              licence: form.get('licence'),
              licenceUrl: form.get('licenceUrl'),
              permission: form.get('permission'),
              rightsConfirmed: form.get('rights') === 'on',
            };
            const upload = new FormData();
            upload.set('file', file!);
            upload.set('metadata', JSON.stringify(metadata));
            void action(async () => {
              await api('/api/fonts', { method: 'POST', body: upload }, store.csrf);
              await refresh();
            }, 'Uploaded privately. Waiting for admin review.');
          }}
        >
          <label>
            Font file
            <input
              name="file"
              type="file"
              accept=".ttf,.otf"
              required
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Font or style name
            <input name="name" minLength={2} maxLength={100} placeholder="Karthika Bold" required />
          </label>
          <label>
            Family
            <input name="family" minLength={2} maxLength={100} placeholder="Karthika" required />
          </label>
          <label>
            Style
            <input name="variant" defaultValue="Regular" maxLength={60} required />
          </label>
          <label>
            Category
            <select name="category">
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Encoding
            <select
              name="encoding"
              value={uploadEncoding}
              onChange={(event) => {
                const next = event.target.value as (typeof encodings)[number];
                setUploadEncoding(next);
                setUploadSample(next === 'Unicode' ? 'മലയാളം, മനസ്സിൽ നിന്ന്.' : '');
              }}
            >
              {encodings.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Author name
            <input
              name="authorName"
              defaultValue={store.user.name}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            Author or foundry link <span className="muted small">Optional</span>
            <input name="authorUrl" type="url" placeholder="https://" />
          </label>
          <label className="checkbox-label full-width">
            <input name="uploaderIsAuthor" type="checkbox" />I am the font’s author
            <span className="muted small">The published family will credit you as its author.</span>
          </label>
          <label className="full-width">
            About this font
            <textarea
              name="description"
              minLength={10}
              maxLength={1200}
              required
              placeholder="A short description of the design, script support, and intended use."
            />
          </label>
          <UploadFontPreview
            file={uploadFile}
            encoding={uploadEncoding}
            sample={uploadSample}
            onSample={setUploadSample}
          />
          <label>
            Licence
            <input name="licence" placeholder="e.g. OFL-1.1" maxLength={100} required />
          </label>
          <label>
            Licence or permission link
            <input name="licenceUrl" type="url" placeholder="https://" required />
          </label>
          <label className="full-width">
            Redistribution permission
            <textarea
              name="permission"
              minLength={20}
              maxLength={5000}
              required
              placeholder="Describe the permission to host and distribute this font."
            />
          </label>
          <label className="checkbox-label full-width">
            <input name="rights" type="checkbox" required />I have permission to upload this font
            for review and redistribution.
          </label>
          <div className="full-width">
            <button className="button primary" disabled={busy}>
              Submit font
            </button>
            <span className="muted small"> TTF/OTF · up to 10 MB · private until approved</span>
          </div>
        </form>
        <div className="upload-list">
          {uploads.map((font) => (
            <article className="saved-row" key={font.id}>
              <div>
                <strong>{font.family || font.name}</strong>
                <p className="muted small">
                  {font.variant} · {font.encoding} ·{' '}
                  {font.uploaderIsAuthor
                    ? 'Author upload'
                    : `By ${font.authorName || 'unknown author'}`}
                </p>
                <p className="muted small">{font.reviewNote || font.description}</p>
              </div>
              <span className="tag">{font.status}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
