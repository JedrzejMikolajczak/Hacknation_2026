import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ApplicationPreview.css';

interface ApplicationPreviewProps {
  title: string;
  recipient: string;
  fields: { label: string; value: string }[];
  attachments: string[];
  legalBasis: string;
  onClose: () => void;
}

export function ApplicationPreview({
  title,
  recipient,
  fields,
  attachments,
  legalBasis,
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
        <h2 id={headingId}>{title}</h2>
        <p>Adresat: {recipient}</p>
      </header>
      <dl>
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.trim() || 'Do uzupełnienia'}</dd>
          </div>
        ))}
      </dl>
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
      <p>{legalBasis}</p>
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
