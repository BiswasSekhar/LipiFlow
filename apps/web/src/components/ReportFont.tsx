import { useEffect, useRef, useState } from 'react';
import type { PublishedFont } from '@lipiflow/library';
import { api } from '@lipiflow/library/client';
export function ReportFont({ font, onClose }: { font: PublishedFont; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="report-dialog" onCancel={onClose}>
      <div className="section-heading">
        <h2>Report a font</h2>
        <button className="text-button" onClick={onClose} aria-label="Close report">
          Close
        </button>
      </div>
      <p>{font.name}</p>
      {sent ? (
        <p role="status">{notice}</p>
      ) : (
        <form
          className="upload-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            void api<{ id: string }>('/api/reports', {
              method: 'POST',
              body: JSON.stringify({
                fontId: font.id,
                name: form.get('name'),
                email: form.get('email'),
                details: form.get('details'),
                evidenceUrl: form.get('evidenceUrl'),
                goodFaith: form.get('goodFaith') === 'on',
              }),
            })
              .then((result) => {
                setNotice('Report received. Reference: ' + result.id);
                setSent(true);
              })
              .catch((error) => setNotice(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Your name
            <input name="name" autoFocus minLength={2} maxLength={100} required />
          </label>
          <label>
            Contact email
            <input name="email" type="email" required />
          </label>
          <label className="full-width">
            Ownership or permission evidence
            <input name="evidenceUrl" type="url" placeholder="https://" required />
          </label>
          <label className="full-width">
            Describe the copyright concern
            <textarea name="details" minLength={20} maxLength={5000} required />
          </label>
          <label className="checkbox-label full-width">
            <input name="goodFaith" type="checkbox" required />I believe this report is accurate and
            made in good faith.
          </label>
          <p className="muted small full-width">
            Your contact details and evidence are shared with this instance’s administrators.
          </p>
          <button className="button primary" disabled={busy}>
            Send report
          </button>
          {notice ? <p role="alert">{notice}</p> : null}
        </form>
      )}
    </dialog>
  );
}
