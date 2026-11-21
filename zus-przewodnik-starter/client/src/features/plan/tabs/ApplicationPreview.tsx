import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ApplicationPreview.css';

interface ApplicationPreviewProps {
  title: string;
  recipient: string;
  code?: string;
  fields: { label: string; value: string }[];
  attachments?: string[];
  legalNote?: string;
  verificationNote?: string;
  onClose: () => void;
}

export function ApplicationPreview({
  title,
  recipient,
  code,
  fields,
  attachments,
  legalNote,
  verificationNote,
  onClose,
}: ApplicationPreviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="application-preview"
      aria-labelledby={headingId}
      onClose={onClose}
    >
      <header>
        <p className="application-preview__notice">
          Podgląd demonstracyjny · dane osobowe nie są wysyłane na serwer
        </p>
        {code && <p className="application-preview__code">{code}</p>}
        <h2 id={headingId}>{title}</h2>
        <p className="application-preview__recipient">Adresat: {recipient}</p>
      </header>
      <dl>
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.trim() || 'Do uzupełnienia'}</dd>
          </div>
        ))}
      </dl>
      {attachments && (
        <section>
          <h3>Załączniki</h3>
          {attachments.length > 0 ? (
            <ul>
              {attachments.map((attachment) => (
                <li key={attachment}>{attachment}</li>
              ))}
            </ul>
          ) : (
            <p>Brak wymaganych załączników.</p>
          )}
        </section>
      )}
      {(legalNote || verificationNote) && (
        <div className="application-preview__notes">
          {legalNote && (
            <p className="application-preview__legal">
              <strong>Podstawa prawna:</strong> {legalNote}
            </p>
          )}
          {verificationNote && <p className="application-preview__verify">{verificationNote}</p>}
        </div>
      )}
      <footer>
        <button type="button" className="plan-btn plan-btn--primary" onClick={() => window.print()}>
          Drukuj lub zapisz PDF
        </button>
        <button
          type="button"
          className="plan-btn plan-btn--secondary"
          onClick={() => {
            if (typeof dialog.current?.close === 'function') dialog.current.close();
            else onClose();
          }}
        >
          Zamknij podgląd
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
