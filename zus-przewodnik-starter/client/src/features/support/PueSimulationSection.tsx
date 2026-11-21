import { useState, type FormEvent } from 'react';
import type { ScenarioInput, SicknessInsurance } from '@shared/types';
import { formatInsuranceTitle, formatPln, formatPolishDate } from '../plan/planScenario';
import { OFFICIAL_LINKS } from './supportData';

interface PueSimulationDetailsProps {
  scenario: ScenarioInput;
  hasMotherInPlan: boolean;
  motherInsuranceKnown: boolean;
  usePrimarySubmit: boolean;
}

function formatSicknessStatus(status: SicknessInsurance): string {
  switch (status) {
    case 'mandatory':
      return 'Obowiązkowe';
    case 'voluntary':
      return 'Dobrowolne';
    case 'none':
      return 'Brak ubezpieczenia chorobowego';
  }
}

export function PueSimulationDetails({
  scenario,
  hasMotherInPlan,
  motherInsuranceKnown,
  usePrimarySubmit,
}: PueSimulationDetailsProps) {
  const [accountChecked, setAccountChecked] = useState(false);

  const [pueTopic, setPueTopic] = useState('Zasiłek macierzyński – ustalenie uprawnień');
  const [pueMessage, setPueMessage] = useState('');
  const [pueError, setPueError] = useState<string | null>(null);
  const [pueTicket, setPueTicket] = useState<string | null>(null);

  const parentToInspect = hasMotherInPlan ? scenario.mother : scenario.father;
  const insuranceKnown = hasMotherInPlan
    ? motherInsuranceKnown
    : Boolean(scenario.father && scenario.father.insuranceTitle !== 'none');

  function handleSendPue(event: FormEvent) {
    event.preventDefault();
    if (!pueMessage.trim()) {
      setPueError('Wpisz treść pytania przed wysłaniem do doradcy ZUS.');
      setPueTicket(null);
      return;
    }
    const year = scenario.referenceDate.slice(0, 4);
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
          <h3 className="support-subheading">Dane na koncie ubezpieczonego (symulacja PUE/eZUS)</h3>
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
                  <dd>
                    {parentToInspect && insuranceKnown
                      ? formatInsuranceTitle(parentToInspect.insuranceTitle)
                      : 'Brak danych'}
                  </dd>
                </div>
                <div className="support-account-dl__row">
                  <dt>Ubezpieczenie chorobowe</dt>
                  <dd>
                    {parentToInspect && insuranceKnown
                      ? formatSicknessStatus(parentToInspect.sicknessInsurance)
                      : 'Brak danych'}
                  </dd>
                </div>
                <div className="support-account-dl__row">
                  <dt>Początek ubezpieczenia</dt>
                  <dd>
                    {parentToInspect?.insuredSince
                      ? formatPolishDate(parentToInspect.insuredSince)
                      : 'Brak danych'}
                  </dd>
                </div>
                {parentToInspect?.insuranceEndDate && (
                  <div className="support-account-dl__row">
                    <dt>Koniec ubezpieczenia</dt>
                    <dd>{formatPolishDate(parentToInspect.insuranceEndDate)}</dd>
                  </div>
                )}
                {parentToInspect?.insuranceTitle === 'selfEmployed' && (
                  <div className="support-account-dl__row">
                    <dt>Stan zadłużenia składkowego (JDG)</dt>
                    <dd>
                      {parentToInspect.contributionDebt !== null
                        ? formatPln(parentToInspect.contributionDebt)
                        : 'Brak danych'}
                    </dd>
                  </div>
                )}
                {parentToInspect &&
                  parentToInspect.insuranceTitle !== 'selfEmployed' &&
                  parentToInspect.insuranceTitle !== 'none' && (
                    <div className="support-account-dl__row">
                      <dt>Liczba ubezpieczonych u płatnika</dt>
                      <dd>
                        {parentToInspect.employerInsuredCount !== null
                          ? `${parentToInspect.employerInsuredCount} osób`
                          : 'Brak danych'}
                      </dd>
                    </div>
                  )}
              </dl>
            </div>
          )}
        </div>

        <div className="support-pue-divider">
          <h3 className="support-subheading">Zapytanie do doradcy ZUS (POG – symulacja)</h3>
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
}

export function OfficialLinksAndUscDetails({ referenceDate }: OfficialLinksAndUscDetailsProps) {
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
          {OFFICIAL_LINKS.map((link) => (
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
          <h3 className="support-subheading">
            Wniosek o odpis aktu urodzenia dziecka (symulacja USC)
          </h3>
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
