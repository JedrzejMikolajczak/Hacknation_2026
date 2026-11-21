import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DeliveryGuide } from './filingGuide';
import './ApplicationPreview.css';

interface ApplicationPreviewProps {
  title: string;
  recipient: string;
  code?: string;
  fields: { label: string; value: string }[];
  attachments?: string[];
  legalNote?: string;
  verificationNote?: string;
  delivery?: DeliveryGuide;
  mailto?: string;
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
  delivery,
  mailto,
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
      {delivery && (
        <section className="application-preview__delivery">
          <h3>Co dalej? Gdzie to wysłać</h3>
          <p>
            <strong>{delivery.where}.</strong> {delivery.how}
          </p>
          <p className="application-preview__delivery-actions">
            {delivery.links.map((link, index) => (
              <a
                key={link.href}
                className={
                  index === 0 ? 'plan-btn plan-btn--primary' : 'plan-btn plan-btn--secondary'
                }
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label} ↗<span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            ))}
            {delivery.mail && mailto && (
              <a className="plan-btn plan-btn--secondary" href={mailto}>
                Napisz e-mail do kadr ✉
              </a>
            )}
          </p>
          {delivery.alternative && <small>{delivery.alternative}</small>}
        </section>
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
