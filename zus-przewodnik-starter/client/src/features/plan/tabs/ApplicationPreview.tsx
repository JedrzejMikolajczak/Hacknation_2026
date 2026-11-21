import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DeliveryGuide } from './filingGuide';
import type { ApplicationPdfData } from './pdf/types';
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
  pdf?: ApplicationPdfData;
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
  pdf,
  onClose,
}: ApplicationPreviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download() {
    if (!pdf) {
      window.print();
      return;
    }
    setBusy(true);
    setDownloadError(null);
    try {
      // Generator ładujemy dopiero przy pobieraniu – pdf-lib i czcionki nie obciążają reszty aplikacji.
      const { generateApplicationPdf, downloadPdf, pdfFileName } = await import('./pdf/generate');
      downloadPdf(await generateApplicationPdf(pdf), pdfFileName(pdf.title));
    } catch {
      setDownloadError('Nie udało się wygenerować pliku PDF. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

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
        <button
          type="button"
          className="plan-btn plan-btn--primary"
          onClick={() => void download()}
          disabled={busy}
        >
          {busy
            ? 'Generowanie…'
            : pdf
              ? 'Pobierz wniosek do uzupełnienia (PDF)'
              : 'Drukuj lub zapisz PDF'}
        </button>
        {pdf && (
          <div className="application-preview__pdfnote" role="note">
            <strong>To nie jest wniosek gotowy do wysłania.</strong>{' '}
            {pdf.kind === 'letter'
              ? 'Pobierzesz pismo wypełnione tym, co podałeś(-aś). Przed wysłaniem dopisz odręcznie miejscowość i adres do korespondencji, sprawdź dane i podpisz.'
              : 'Pobierzesz oficjalny formularz ZUS wypełniony tylko częścią danych. Przed wysłaniem trzeba jeszcze dopisać: adres, numer telefonu i dane dokumentu tożsamości (jeśli wymagane), dane dziecka (imię, miejsce urodzenia) oraz pozostałe pola specyficzne dla Twojej sytuacji – a na końcu podpisać.'}
            {downloadError && <strong> {downloadError}</strong>}
          </div>
        )}
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
