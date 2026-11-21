import { useState, type FormEvent } from 'react';
import type { CaseDocument } from '@shared/types';
import { parentLabels, payerLabel, roles } from '../caseLabels';
import { formatPolishDate } from '../planScenario';
import { ApplicationPreview } from './ApplicationPreview';

const documentKey = (doc: CaseDocument) => `${doc.parent_role}-${doc.id}-${doc.start_date ?? ''}`;

export function CaseDocuments({ documents }: { documents: CaseDocument[] }) {
  const [checked, setChecked] = useState<string[]>([]);
  return <>
    <h2>Dokumenty i terminy</h2>
    <p>Terminy wynikają z aktualnego planu. ZAM jest aktualnym formularzem od 24.10.2026.</p>
    {roles.map((role) => <section key={role} className="case-plan-card">
      <h3>{parentLabels[role]}</h3>
      {documents.some((doc) => doc.parent_role === role) ? <ul className="case-document-list">{documents.filter((doc) => doc.parent_role === role).map((doc) => {
        const key = documentKey(doc);
        return <li key={key}>
          <label><input type="checkbox" checked={checked.includes(key)} onChange={(event) =>
            setChecked((previous) => event.target.checked ? [...previous, key] : previous.filter((item) => item !== key))} /> <strong>{doc.name_pl}</strong></label>
          <div>Gdzie złożyć: {payerLabel(doc.submit_to)}{doc.deadline && <> · Do <time dateTime={doc.deadline}>{formatPolishDate(doc.deadline)}</time></>}
            {doc.is_overdue && <strong className="case-overdue"> · Termin minął</strong>}
          </div><small>{doc.legal_basis}</small>
        </li>;
      })}</ul> : <p>W planie brak dokumentów dla tego rodzica.</p>}
    </section>)}
  </>;
}

const example = { name: 'Anna Przykładowa', pesel: '00000000000', bank: 'PL00 0000 0000 0000 0000 0000 0000' };

export function CaseApplications({ documents }: { documents: CaseDocument[] }) {
  const [selection, setSelection] = useState('');
  const [draft, setDraft] = useState(example);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const forms = documents.filter((doc) => doc.id === 'ZAM' ||
    doc.id.endsWith('_REQUEST') || ['USC_COPY', 'COMBINED_RATE', 'TAKEOVER', 'ADOPTION_LEAVE'].includes(doc.id));
  const selected = forms.find((doc) => documentKey(doc) === selection) ?? forms[0];
  const fields = selected ? [
    { label: 'Wnioskodawca', value: parentLabels[selected.parent_role] },
    { label: 'Imię i nazwisko', value: draft.name },
    { label: 'PESEL', value: draft.pesel },
    { label: 'Numer rachunku', value: draft.bank },
    { label: 'Początek okresu', value: formatPolishDate(selected.start_date) },
    { label: 'Koniec okresu', value: formatPolishDate(selected.end_date) },
    { label: 'Termin złożenia', value: formatPolishDate(selected.deadline) },
  ] : [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) setStatus(`Zakończono symulację złożenia wniosku do: ${payerLabel(selected.submit_to)}.`);
  }
  return <>
    <h2>Wnioski</h2>
    {!selected ? <p>Ustal okresy w planie, aby przygotować wzory wniosków.</p> :
      <form onSubmit={submit} className="case-plan-card">
        <p><strong>DANE PRZYKŁADOWE</strong> · Używaj danych testowych. Edycja jest dostępna w tej zakładce.</p>
        <label>Wzór wniosku <select className="plan-field__input" value={documentKey(selected)} onChange={(event) => {
          setSelection(event.target.value);
          setStatus('');
        }}>{forms.map((doc) => <option key={documentKey(doc)} value={documentKey(doc)}>
          {parentLabels[doc.parent_role]} · {doc.name_pl}{doc.start_date ? ` · ${formatPolishDate(doc.start_date)}` : ''}
        </option>)}</select></label>
        <p>Adresat: <strong>{payerLabel(selected.submit_to)}</strong>{selected.start_date && <>
          {' · '}Okres {formatPolishDate(selected.start_date)}–{formatPolishDate(selected.end_date)}
        </>}</p>
        <div className="case-plan-fields">
          <label>Imię i nazwisko <input className="plan-field__input" autoComplete="off" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>PESEL <input className="plan-field__input" autoComplete="off" inputMode="numeric" value={draft.pesel} onChange={(event) => setDraft({ ...draft, pesel: event.target.value })} /></label>
          <label>Numer rachunku <input className="plan-field__input" autoComplete="off" value={draft.bank} onChange={(event) => setDraft({ ...draft, bank: event.target.value })} /></label>
        </div>
        <button type="button" className="plan-btn plan-btn--secondary" onClick={() => setOpen(true)}>Podgląd wniosku</button>{' '}
        <button type="submit" className="plan-btn plan-btn--primary" disabled={!selected.submit_to}>Symuluj złożenie wniosku</button>
        {status && <p role="status">{status}</p>}
        {open && <ApplicationPreview title={selected.name_pl} recipient={payerLabel(selected.submit_to)}
          fields={fields} onClose={() => setOpen(false)} />}
      </form>}
  </>;
}
