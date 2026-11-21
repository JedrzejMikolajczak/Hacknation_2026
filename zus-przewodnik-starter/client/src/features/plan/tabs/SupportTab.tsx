import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { BenefitParams, ScenarioInput } from '@shared/types';
import { askGuideAssistant, type AssistantAnswer } from '../planApi';
import { isDifficultSituation } from '../planScenario';
import './SupportTab.css';

interface SupportTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
}

const SUPPORT_ORGANIZATIONS = [
  {
    id: 'nagle-sami',
    name: 'Fundacja Nagle Sami / wsparcie po stracie dziecka',
    description:
      'Bezpłatna linia wsparcia psychologicznego dla rodziców po poronieniu, martwym urodzeniu lub stracie dziecka.',
    url: 'https://naglesami.org.pl',
    tag: 'Wsparcie po stracie',
    priorityInDifficult: true,
  },
  {
    id: 'wczesniak',
    name: 'Fundacja Wcześniak Rodzice-Rodzicom',
    description:
      'Pomoc rodzicom wcześniaków i dzieci hospitalizowanych, informacje o opiece i urlopie uzupełniającym.',
    url: 'https://wczesniak.pl',
    tag: 'Wcześniactwo',
    priorityInDifficult: false,
  },
  {
    id: 'za-zyciem',
    name: 'Koalicja „Za życiem” / wsparcie dla rodzin dzieci z niepełnosprawnością',
    description: 'Informacje o uprawnieniach z ustawy „Za życiem” oraz koordynacji opieki.',
    url: 'https://www.gov.pl/web/rodzina/za-zyciem',
    tag: 'Ustawa „Za życiem”',
    priorityInDifficult: false,
  },
  {
    id: 'rodzic-po-ludzku',
    name: 'Fundacja Rodzić po Ludzku',
    description: 'Bezpłatne wsparcie prawne i okołoporodowe dla kobiet w ciąży i młodych rodziców.',
    url: 'https://rodzicpoludzku.pl',
    tag: 'Okołoporodowe i prawne',
    priorityInDifficult: false,
  },
];

const OFFICIAL_LINKS = [
  {
    label: 'ZUS – Platforma Usług Elektronicznych (PUE / eZUS)',
    href: 'https://www.zus.pl/ezus',
  },
  {
    label: 'ZUS – Wzory formularzy zasiłkowych (ZAM, Z-3, Z-3a, ZAS-53)',
    href: 'https://www.zus.pl',
  },
  {
    label: 'Ministerstwo Rodziny – Urlop rodzicielski',
    href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
  },
  {
    label: 'Państwowa Inspekcja Pracy – Uprawnienia rodzicielskie',
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
  },
  {
    label: 'Rejestr Stanu Cywilnego – Odpis aktu urodzenia online',
    href: 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego',
  },
];

const FAQ_QUESTIONS = [
  'Kiedy opłaca się wariant 81,5% i jaki jest termin?',
  'Jak zadłużenie w JDG wpływa na zasiłek macierzyński?',
  'Ile trwa urlop ojcowski i 9 tygodni dla drugiego rodzica?',
  'Komu przysługuje uzupełniający urlop macierzyński dla wcześniaka?',
];

export function SupportTab({ scenario, params }: SupportTabProps) {
  const { search } = useLocation();
  const difficult = isDifficultSituation(scenario);

  // Formularz pytania do PUE / eZUS (symulacja)
  const [pueTopic, setPueTopic] = useState('Zasiłek macierzyński – ustalenie uprawnień');
  const [pueMessage, setPueMessage] = useState('');
  const [pueError, setPueError] = useState<string | null>(null);
  const [pueTicket, setPueTicket] = useState<string | null>(null);

  // Najczęstsze pytania (odpowiedzi z bazy wiedzy poradnika ZUS)
  const [faqQuery, setFaqQuery] = useState('');
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqHistory, setFaqHistory] = useState<{ question: string; response: AssistantAnswer }[]>(
    [],
  );

  const organizations = difficult
    ? SUPPORT_ORGANIZATIONS
    : [
        ...SUPPORT_ORGANIZATIONS.filter((org) => !org.priorityInDifficult),
        ...SUPPORT_ORGANIZATIONS.filter((org) => org.priorityInDifficult),
      ];

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

  async function submitFaqQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    setFaqLoading(true);
    try {
      const response = await askGuideAssistant(trimmed, params);
      setFaqHistory((prev) => [{ question: trimmed, response }, ...prev]);
      setFaqQuery('');
    } finally {
      setFaqLoading(false);
    }
  }

  function handleFaqSubmit(event: FormEvent) {
    event.preventDefault();
    void submitFaqQuestion(faqQuery);
  }

  return (
    <div className="plan-tab-content">
      <div
        className={difficult ? 'support-answer support-answer--empathetic' : 'support-answer'}
        role="region"
        aria-label="Podsumowanie wsparcia"
      >
        <p className="support-answer__title">
          <strong>
            {difficult ? 'Bezpłatne wsparcie i formalności online' : 'Pomoc i oficjalne źródła'}
          </strong>
        </p>
        <p className="support-answer__text">
          {difficult
            ? 'W trudnej sytuacji możesz skorzystać z bezpłatnej pomocy organizacji poniżej oraz złożyć dokumenty elektronicznie, bez wizyty w placówce.'
            : 'Znajdziesz tu bezpłatne organizacje pomocowe, oficjalne strony urzędów oraz kontakt z doradcą ZUS.'}
        </p>
      </div>

      <section className="plan-section" aria-labelledby="orgs-heading">
        <h2 id="orgs-heading" className="plan-section__title">
          Organizacje pomocowe
        </h2>
        <div className="support-orgs-grid">
          {organizations.map((org) => (
            <article key={org.id} className="support-org-tile">
              <span className="plan-badge plan-badge--navy support-org-tile__tag">{org.tag}</span>
              <h3 className="support-org-tile__title">{org.name}</h3>
              <p className="support-org-tile__desc">{org.description}</p>
              <a
                href={org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="support-org-tile__link"
              >
                Przejdź do strony organizacji ›
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="links-heading">
        <h2 id="links-heading" className="plan-section__title">
          Oficjalne strony urzędowe
        </h2>
        <ul className="support-official-list" role="list">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.href} className="support-official-list__item">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="support-official-list__link"
              >
                {link.label}
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="plan-section" aria-labelledby="pue-question-heading">
        <h2 id="pue-question-heading" className="plan-section__title">
          Kontakt z ZUS przez PUE / eZUS
        </h2>
        <p className="plan-section__lead">
          Jeśli sprawa wymaga indywidualnego potwierdzenia doradcy ds. zasiłków, wyślij wiadomość
          ogólną (POG) na koncie PUE/eZUS (symulacja).
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

          <button type="submit" className="plan-btn plan-btn--primary support-action-btn">
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
      </section>

      <section className="plan-section" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="plan-section__title">
          Najczęstsze pytania
        </h2>
        <p className="plan-section__lead">
          Wybierz temat albo wpisz słowo kluczowe, aby zobaczyć gotową odpowiedź na podstawie
          Poradnika dla rodziców ZUS 2026 (charakter informacyjny, nie zastępuje decyzji ZUS).
        </p>

        <div className="support-faq-chips" aria-label="Najczęstsze pytania o zasiłki">
          {FAQ_QUESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="support-faq-chip"
              onClick={() => void submitFaqQuestion(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        <form className="support-form" onSubmit={handleFaqSubmit}>
          <label className="plan-field">
            <span className="plan-field__label">Wyszukaj odpowiedź w bazie pytań</span>
            <input
              type="text"
              className="plan-field__input"
              placeholder="Np. Do kiedy złożyć wniosek o 81,5%?"
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="plan-btn plan-btn--secondary support-action-btn"
            disabled={faqLoading}
          >
            {faqLoading ? 'Szukam odpowiedzi…' : 'Sprawdź odpowiedź ›'}
          </button>
        </form>

        {faqHistory.length > 0 && (
          <div className="support-faq-history" aria-live="polite">
            {faqHistory.map((item, idx) => (
              <article key={`${item.question}-${idx}`} className="support-faq-answer">
                <p>
                  <strong>Pytanie:</strong> {item.question}
                </p>
                <p>{item.response.answer}</p>
                <details className="support-faq-sources">
                  <summary className="support-faq-sources__summary">
                    Podstawa prawna i źródła
                  </summary>
                  <div className="support-faq-sources__body">
                    {item.response.sources.map((s) => `${s.title} (${s.legalBasis})`).join(' · ')}
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <nav className="support-next-nav" aria-label="Powrót do planu">
        <Link to={`/plan${search}`} className="support-next-link">
          Wróć do planu ›
        </Link>
      </nav>
    </div>
  );
}
