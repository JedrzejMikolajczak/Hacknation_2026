import { useState, type FormEvent } from 'react';
import type { BenefitParams, ScenarioInput } from '@shared/types';
import { AiBadge } from '../../../components/AiBadge';
import { askGuideAssistant, type AssistantAnswer } from '../planApi';
import { isDifficultSituation } from '../planScenario';

interface SupportTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
}

const SUPPORT_ORGANIZATIONS = [
  {
    name: 'Fundacja Rodzić po Ludzku',
    description: 'Bezpłatne wsparcie prawne i okołoporodowe dla kobiet w ciąży i młodych rodziców.',
    url: 'https://rodzicpoludzku.pl',
    tag: 'Okołoporodowe i prawne',
  },
  {
    name: 'Fundacja Wcześniak Rodzice-Rodzicom',
    description:
      'Pomoc rodzicom wcześniaków i dzieci hospitalizowanych, informacje o opiece i urlopie uzupełniającym.',
    url: 'https://wczesniak.pl',
    tag: 'Wcześniactwo',
  },
  {
    name: 'Koalicja „Za życiem” / wsparcie dla rodzin dzieci z niepełnosprawnością',
    description: 'Informacje o uprawnieniach z ustawy „Za życiem” oraz koordynacji opieki.',
    url: 'https://www.gov.pl/web/rodzina/za-zyciem',
    tag: 'Ustawa „Za życiem”',
  },
  {
    name: 'Fundacja Nagle Sami / wsparcie po stracie dziecka',
    description:
      'Bezpłatna linia wsparcia psychologicznego dla rodziców po poronieniu, martwym urodzeniu lub stracie dziecka.',
    url: 'https://naglesami.org.pl',
    tag: 'Wsparcie po stracie',
  },
];

const OFFICIAL_LINKS = [
  { label: 'ZUS – Platforma Usług Elektronicznych (PUE / eZUS)', href: 'https://www.zus.pl/ezus' },
  { label: 'ZUS – Wzory formularzy zasiłkowych (ZAM, Z-3, Z-3a, ZAS-53)', href: 'https://www.zus.pl' },
  { label: 'Ministerstwo Rodziny – Urlop rodzicielski', href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski' },
  { label: 'Państwowa Inspekcja Pracy – Uprawnienia rodzicielskie', href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo' },
  { label: 'Rejestr Stanu Cywilnego – Odpis aktu urodzenia online', href: 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego' },
];

const SAMPLE_AI_QUESTIONS = [
  'Kiedy opłaca się wariant 81,5% i jaki jest termin?',
  'Jak zadłużenie w JDG wpływa na zasiłek macierzyński?',
  'Ile trwa urlop ojcowski i 9 tygodni dla drugiego rodzica?',
  'Komu przysługuje uzupełniający urlop macierzyński dla wcześniaka?',
];

export function SupportTab({ scenario, params }: SupportTabProps) {
  const difficult = isDifficultSituation(scenario);

  // Formularz pytania do PUE / eZUS
  const [pueTopic, setPueTopic] = useState('Zasiłek macierzyński – ustalenie uprawnień');
  const [pueMessage, setPueMessage] = useState('');
  const [pueTicket, setPueTicket] = useState<string | null>(null);

  // Asystent AI
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<
    { question: string; response: AssistantAnswer }[]
  >([]);

  function handleSendPue(event: FormEvent) {
    event.preventDefault();
    if (!pueMessage.trim()) return;
    const ticket = `PUE-ZAP-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setPueTicket(ticket);
    setPueMessage('');
  }

  async function submitAiQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    setAiLoading(true);
    try {
      const response = await askGuideAssistant(trimmed, params);
      setAiHistory((prev) => [{ question: trimmed, response }, ...prev]);
      setAiQuestion('');
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiSubmit(event: FormEvent) {
    event.preventDefault();
    void submitAiQuestion(aiQuestion);
  }

  return (
    <div className="plan-tab-content">
      {difficult && (
        <section className="plan-callout plan-callout--info" aria-label="Informacja o wsparciu">
          <strong>Jesteśmy tu, aby ułatwić formalności.</strong> W trudnej sytuacji możesz
          skorzystać ze wsparcia bezpłatnych organizacji pomocowych poniżej oraz złożyć dokumenty
          elektronicznie, bez wizyty w placówce.
        </section>
      )}

      <section className="plan-section" aria-labelledby="ai-assistant-heading">
        <div className="support-ai-header">
          <h2 id="ai-assistant-heading" className="plan-section__title">
            Asystent pytań na podstawie poradnika ZUS
          </h2>
          <AiBadge />
        </div>
        <p className="plan-section__lead">
          Zadaj pytanie własnymi słowami. Odpowiedzi powstają na podstawie Poradnika dla rodziców
          ZUS 2026 oraz przepisów ustawy zasiłkowej (funkcja wspierana przez AI ma charakter
          informacyjny i nie zastępuje decyzji ZUS).
        </p>

        <div className="support-ai-chips" aria-label="Przykładowe pytania do asystenta AI">
          {SAMPLE_AI_QUESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="support-chip"
              onClick={() => void submitAiQuestion(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        <form className="support-form" onSubmit={handleAiSubmit}>
          <label className="plan-field">
            <span className="plan-field__label">Twoje pytanie do asystenta AI</span>
            <input
              type="text"
              className="plan-field__input"
              placeholder="Np. Do kiedy złożyć wniosek o 81,5%?"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
            />
          </label>
          <button type="submit" className="plan-btn plan-btn--primary" disabled={aiLoading}>
            {aiLoading ? 'Szukam odpowiedzi w poradniku ZUS…' : 'Zapytaj asystenta AI ›'}
          </button>
        </form>

        {aiHistory.length > 0 && (
          <div className="support-ai-history" aria-live="polite">
            {aiHistory.map((item, idx) => (
              <article key={`${item.question}-${idx}`} className="support-ai-answer">
                <p className="support-ai-answer__q">
                  <strong>Pytanie:</strong> {item.question}
                </p>
                <p className="support-ai-answer__a">{item.response.answer}</p>
                <p className="plan-legal">
                  Źródła:{' '}
                  {item.response.sources.map((s) => `${s.title} (${s.legalBasis})`).join(' · ')}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="plan-section" aria-labelledby="pue-question-heading">
        <h2 id="pue-question-heading" className="plan-section__title">
          Wyślij oficjalne pytanie do ZUS przez PUE / eZUS (symulacja)
        </h2>
        <p className="plan-section__lead">
          Jeśli Twoja sprawa wymaga indywidualnego potwierdzenia doradcy ds. zasiłków, możesz wysłać
          wiadomość ogólną (POG) na swoim koncie PUE/eZUS lub umówić e-wizytę.
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
              placeholder="Opisz krótko swoją sytuację lub wątpliwość..."
              value={pueMessage}
              onChange={(e) => setPueMessage(e.target.value)}
            />
          </label>

          <button type="submit" className="plan-btn plan-btn--secondary">
            Wyślij pytanie do PUE / eZUS ›
          </button>
        </form>

        {pueTicket && (
          <div className="plan-callout plan-callout--success" role="status">
            <strong>Zapytanie zostało wysłane (symulacja PUE / eZUS).</strong> Numer zgłoszenia:{' '}
            <strong>{pueTicket}</strong>. Odpowiedź pojawi się w skrzynce odbiorczej PUE/eZUS.
          </div>
        )}
      </section>

      <section className="plan-section" aria-labelledby="orgs-heading">
        <h2 id="orgs-heading" className="plan-section__title">
          Organizacje pomocowe i bezpłatne wsparcie
        </h2>
        <div className="plan-cards-grid">
          {SUPPORT_ORGANIZATIONS.map((org) => (
            <article key={org.name} className="support-org-card">
              <span className="plan-badge plan-badge--navy">{org.tag}</span>
              <h3 className="support-org-card__title">{org.name}</h3>
              <p className="support-org-card__desc">{org.description}</p>
              <a href={org.url} target="_blank" rel="noopener noreferrer">
                Przejdź do strony organizacji
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="links-heading">
        <h2 id="links-heading" className="plan-section__title">
          Przydatne linki urzędowe
        </h2>
        <ul className="support-links-list">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
