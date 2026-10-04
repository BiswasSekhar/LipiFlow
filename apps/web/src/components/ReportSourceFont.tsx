import { useEffect, useRef, useState } from 'react';
import type { ExternalFontSource, LocalFontAsset } from '@lipiflow/library';
import { api } from '@lipiflow/library/client';

export function ReportSourceFont({
  font,
  onClose,
  onReported,
}: {
  font: ExternalFontSource | LocalFontAsset;
  onClose(): void;
  onReported(): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  return (
    <dialog ref={dialog} className="report-dialog" onCancel={onClose}>
      <div className="section-heading">
        <h2>Report copyright</h2>
        <button className="text-button" onClick={onClose} aria-label="Close report">
          Close
        </button>
      </div>
      <p>{font.name}</p>
      {sent ? (
        <p role="status">
          {notice} This font is removed from public listings while it is reviewed.
        </p>
      ) : (
        <form
          className="upload-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            const localAsset = 'id' in font;
            const reportId = localAsset ? font.id : font.sourceId;
            void api<{ id: string }>(
              localAsset
                ? `/api/font-assets/${reportId}/reports`
                : `/api/source-fonts/${reportId}/reports`,
              {
                method: 'POST',
                body: JSON.stringify({
                  ...(localAsset ? { assetId: reportId } : { sourceId: reportId }),
                  name: form.get('name'),
                  email: form.get('email'),
                  details: form.get('details'),
                  evidenceUrl: form.get('evidenceUrl'),
                  goodFaith: form.get('goodFaith') === 'on',
                }),
              },
            )
              .then((result) => {
                setNotice('Report received. Reference: ' + result.id + '.');
                setSent(true);
                void onReported().catch(() =>
                  setNotice(
                    'Report received. Reference: ' +
                      result.id +
                      '. Refresh to see the paused link.',
                  ),
                );
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
            <input name="email" type="email" maxLength={254} required />
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
            A report immediately removes this font from public listings and downloads while an
            administrator reviews it. Your contact details and evidence are shared with this
            instance’s administrators.
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
