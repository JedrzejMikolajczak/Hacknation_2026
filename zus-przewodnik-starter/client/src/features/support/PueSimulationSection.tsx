import { useState, type FormEvent } from 'react';
import type { CaseInputs, EmploymentType, OfficialLink } from '@shared/types';
import { formatPln, formatPolishDate, todayIsoDate } from '../plan/planScenario';

const titleLabels: Record<EmploymentType, string> = {
  UOP: 'Umowa o pracę',
  B2B: 'Działalność gospodarcza (JDG)',
  ZLECENIE: 'Umowa zlecenie',
  NONE: 'Brak tytułu ubezpieczenia',
};

interface PueSimulationDetailsProps {
  input: CaseInputs;
  usePrimarySubmit?: boolean;
}

export function PueSimulationDetails({
  input,
  usePrimarySubmit = true,
}: PueSimulationDetailsProps) {
  const [accountChecked, setAccountChecked] = useState(false);

  const [pueTopic, setPueTopic] = useState('Zasiłek macierzyński – ustalenie uprawnień');
  const [pueMessage, setPueMessage] = useState('');
  const [pueError, setPueError] = useState<string | null>(null);
  const [pueTicket, setPueTicket] = useState<string | null>(null);

  const sicknessStatus =
    input.employment_type === 'UOP'
      ? 'Obowiązkowe'
      : input.voluntary_sickness_insured === true
        ? 'Dobrowolne'
        : input.employment_type === 'NONE' || input.voluntary_sickness_insured === false
          ? 'Brak ubezpieczenia chorobowego'
          : 'Brak danych';

  const debtDisplay =
    input.debt_amount_pln !== undefined
      ? formatPln(input.debt_amount_pln)
      : input.has_b2b_arrears === true
        ? 'Wskazano zaległość składkową'
        : input.has_b2b_arrears === false
          ? 'Brak zaległości'
          : 'Brak danych';

  function handleSendPue(event: FormEvent) {
    event.preventDefault();
    if (!pueMessage.trim()) {
      setPueError('Wpisz treść pytania przed wysłaniem do doradcy ZUS.');
      setPueTicket(null);
      return;
    }
    const year = (input.reference_date ?? todayIsoDate()).slice(0, 4);
    const ticket = `PUE-ZAP-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setPueError(null);
    setPueTicket(ticket);
    setPueMessage('');
  }

  return (
    <details className="support-accordion">
      <summary className="support-accordion__summary">
        Kontakt z ZUS i podgląd konta (symulacja PUE / eZUS)
      </summary>
      <div className="support-accordion__body">
        <div className="support-pue-account">
          <h4 className="support-subheading">Dane na koncie ubezpieczonego (symulacja PUE/eZUS)</h4>
          <p className="support-accordion__intro">
            Sprawdź zestawienie danych zgłoszonych w planie przed złożeniem wniosku w PUE/eZUS.
            Brakujące pola nie są uzupełniane domyślnie.
          </p>
          <button
            type="button"
            className="plan-btn plan-btn--secondary support-action-btn"
            aria-expanded={accountChecked}
            onClick={() => setAccountChecked((prev) => !prev)}
          >
            {accountChecked
              ? 'Ukryj podgląd konta PUE / eZUS'
              : 'Sprawdź dane na koncie (symulacja PUE / eZUS)'}
          </button>

          {accountChecked && (
            <div
              className="support-account-box"
              role="region"
              aria-label="Symulacja podglądu konta PUE/eZUS"
            >
              <p className="support-account-box__badge">
                Połączenie z PUE / eZUS jest symulowane – wyświetlane są wyłącznie Twoje podane
                dane.
              </p>
              <dl className="support-account-dl">
                <div className="support-account-dl__row">
                  <dt>Tytuł ubezpieczenia</dt>
                  <dd>{titleLabels[input.employment_type]}</dd>
                </div>
                <div className="support-account-dl__row">
                  <dt>Ubezpieczenie chorobowe</dt>
                  <dd>{sicknessStatus}</dd>
                </div>
                <div className="support-account-dl__row">
                  <dt>Początek ubezpieczenia</dt>
                  <dd>
                    {input.title_start_date
                      ? formatPolishDate(input.title_start_date)
                      : 'Brak danych'}
                  </dd>
                </div>
                {input.contract_end_date && (
                  <div className="support-account-dl__row">
                    <dt>Koniec ubezpieczenia</dt>
                    <dd>{formatPolishDate(input.contract_end_date)}</dd>
                  </div>
                )}
                {input.employment_type === 'B2B' && (
                  <div className="support-account-dl__row">
                    <dt>Stan zadłużenia składkowego (JDG)</dt>
                    <dd>{debtDisplay}</dd>
                  </div>
                )}
                {(input.employment_type === 'UOP' || input.employment_type === 'ZLECENIE') && (
                  <div className="support-account-dl__row">
                    <dt>Liczba ubezpieczonych u płatnika</dt>
                    <dd>{input.payer_insured_count_nov_30 ?? 'Brak danych'}</dd>
                  </div>
                )}
                {input.sickness_leave_start_date && (
                  <div className="support-account-dl__row">
                    <dt>Zwolnienie lekarskie e-ZLA</dt>
                    <dd>
                      {formatPolishDate(input.sickness_leave_start_date)}
                      {input.sickness_leave_end_date
                        ? ` – ${formatPolishDate(input.sickness_leave_end_date)}`
                        : ''}
                      {input.special_circumstances.has_code_b_on_ezla ? ' (kod „B”)' : ''}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        <div className="support-pue-divider">
          <h4 className="support-subheading">Zapytanie do doradcy ZUS (POG – symulacja)</h4>
          <p className="support-accordion__intro">
            W razie wątpliwości wyślij pismo ogólne (POG) na koncie PUE/eZUS (symulacja).
          </p>

          <form className="support-form" onSubmit={handleSendPue}>
            <label className="plan-field">
              <span className="plan-field__label">Temat zapytania (POG)</span>
              <select
                className="plan-field__input"
                value={pueTopic}
                onChange={(e) => setPueTopic(e.target.value)}
              >
                <option value="Zasiłek macierzyński – ustalenie uprawnień">
                  Zasiłek macierzyński – ustalenie uprawnień
                </option>
                <option value="Podstawa wymiaru zasiłku i okres wyczekiwania">
                  Podstawa wymiaru zasiłku i okres wyczekiwania
                </option>
                <option value="Dobrowolne ubezpieczenie chorobowe (JDG)">
                  Dobrowolne ubezpieczenie chorobowe (JDG)
                </option>
                <option value="Uzupełniający urlop macierzyński (wcześniak / szpital)">
                  Uzupełniający urlop macierzyński (wcześniak / szpital)
                </option>
              </select>
            </label>

            <label className="plan-field">
              <span className="plan-field__label">Treść pytania do doradcy ZUS</span>
              <textarea
                rows={3}
                className="plan-field__input"
                placeholder="Opisz krótko swoją sytuację lub wątpliwość"
                aria-invalid={Boolean(pueError) || undefined}
                value={pueMessage}
                onChange={(e) => {
                  setPueMessage(e.target.value);
                  if (pueError) setPueError(null);
                }}
              />
            </label>

            <button
              type="submit"
              className={
                usePrimarySubmit
                  ? 'plan-btn plan-btn--primary support-action-btn'
                  : 'plan-btn plan-btn--secondary support-action-btn'
              }
            >
              Wyślij pytanie do PUE / eZUS ›
            </button>
          </form>

          {pueError && (
            <div className="plan-callout plan-callout--warning support-pue-feedback" role="alert">
              {pueError}
            </div>
          )}

          {pueTicket && (
            <div className="plan-callout plan-callout--success support-pue-feedback" role="status">
              <strong>Zapytanie zostało wysłane (symulacja PUE / eZUS).</strong> Numer zgłoszenia:{' '}
              <strong>{pueTicket}</strong>. Odpowiedź pojawi się w skrzynce odbiorczej PUE/eZUS.
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

interface OfficialLinksAndUscDetailsProps {
  referenceDate: string;
  links: OfficialLink[];
}

export function OfficialLinksAndUscDetails({
  referenceDate,
  links,
}: OfficialLinksAndUscDetailsProps) {
  const [copyType, setCopyType] = useState<'short' | 'full'>('short');
  const [uscTicket, setUscTicket] = useState<string | null>(null);

  function handleUscSubmit(event: FormEvent) {
    event.preventDefault();
    const year = referenceDate.slice(0, 4);
    const code = copyType === 'short' ? 'SKR' : 'ZUP';
    setUscTicket(`USC-${code}-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`);
  }

  return (
    <details className="support-accordion">
      <summary className="support-accordion__summary">
        Oficjalne strony urzędowe i wniosek o odpis aktu urodzenia (USC)
      </summary>
      <div className="support-accordion__body">
        <ul className="support-official-list" role="list">
          {links.map((link) => (
            <li key={link.id} className="support-official-list__item">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="support-official-list__link"
              >
                {link.label}
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
              <p className="support-official-list__desc">{link.description}</p>
            </li>
          ))}
        </ul>

        <div className="support-pue-divider">
          <h4 className="support-subheading">
            Wniosek o odpis aktu urodzenia dziecka (symulacja USC)
          </h4>
          <p className="support-accordion__intro">
            Do wniosku o zasiłek macierzyński potrzebny jest skrócony odpis aktu urodzenia. Możesz
            zasymulować złożenie wniosku poniżej lub przejść bezpośrednio do oficjalnego Rejestru
            Stanu Cywilnego na gov.pl.
          </p>

          <form className="support-form" onSubmit={handleUscSubmit}>
            <label className="plan-field">
              <span className="plan-field__label">Rodzaj odpisu aktu stanu cywilnego</span>
              <select
                className="plan-field__input"
                value={copyType}
                onChange={(e) => {
                  setCopyType(e.target.value as 'short' | 'full');
                  setUscTicket(null);
                }}
              >
                <option value="short">Odpis skrócony aktu urodzenia</option>
                <option value="full">Odpis zupełny aktu urodzenia</option>
              </select>
            </label>

            <button type="submit" className="plan-btn plan-btn--secondary support-action-btn">
              Złóż wniosek o odpis (symulacja USC) ›
            </button>
          </form>

          {uscTicket && (
            <div className="plan-callout plan-callout--success support-pue-feedback" role="status">
              <strong>
                Wniosek o {copyType === 'short' ? 'odpis skrócony' : 'odpis zupełny'} został złożony
                (symulacja USC).
              </strong>{' '}
              Numer potwierdzenia: <strong>{uscTicket}</strong>. Prawdziwy wniosek złożysz przez{' '}
              <a
                href="https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rejestr Stanu Cywilnego na gov.pl
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
              .
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
