import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SituationType } from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import { SITUATION_OPTIONS } from './situationOptions';
import { SituationTiles } from './SituationTiles';
import './LandingPage.css';

const SITUATION_QUERY_KEY = 'situation';

/** Strzałka „›” w przyciskach – jak w przyciskach nagłówka zus.pl. */
function ButtonChevron() {
  return (
    <svg
      className="button__chevron"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

const EXTERNAL_LINKS = [
  { href: 'https://www.zus.pl', label: 'Zakład Ubezpieczeń Społecznych (zus.pl)' },
  {
    href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
    label: 'Urlop rodzicielski (gov.pl)',
  },
  {
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
    label: 'Rodzicielstwo – Państwowa Inspekcja Pracy',
  },
];

const BENEFITS = [
  'Sprawdzisz, jakie świadczenia Ci przysługują – i dlaczego.',
  'Policzysz, jak długo i w jakiej wysokości otrzymasz zasiłek.',
  'Dowiesz się, jakie dokumenty, gdzie i do kiedy złożyć.',
];

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scenario, setSituation } = useScenario();
  const [selectionRequested, setSelectionRequested] = useState(false);

  // Query string ma pierwszeństwo; bez parametru pokazujemy wybór zapamiętany w kontekście.
  const rawSituation = searchParams.get(SITUATION_QUERY_KEY);
  const urlSituation = parseSituation(rawSituation);
  const selected = rawSituation === null ? scenario.situation : urlSituation;
  const showSelectionError = selectionRequested && selected === null;

  // Synchronizacja URL ↔ ScenarioContext.
  useEffect(() => {
    if (rawSituation === null) {
      if (scenario.situation !== null) {
        setSearchParams({ [SITUATION_QUERY_KEY]: scenario.situation }, { replace: true });
      }
      return;
    }
    setSituation(urlSituation);
  }, [rawSituation, urlSituation, scenario.situation, setSearchParams, setSituation]);

  function handleSelect(situation: SituationType) {
    setSituation(situation);
    setSearchParams({ [SITUATION_QUERY_KEY]: situation }, { replace: true });
  }

  function goTo(path: '/login' | '/wizard') {
    if (selected === null) {
      setSelectionRequested(true);
      return;
    }
    navigate(`${path}?${SITUATION_QUERY_KEY}=${selected}`);
  }

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__container">
          <p className="landing__demo-label">
            Wersja demonstracyjna – dane i logowanie są symulowane
          </p>
          <h1 className="landing__title">Przewodnik Przyszłego Rodzica</h1>
          <p className="landing__subtitle">
            Sprawdź, jakie świadczenia z ZUS Ci przysługują – w kilka minut
          </p>
        </div>
      </header>

      <main className="landing__main">
        <div className="landing__container">
          <section className="landing__section landing__card" aria-labelledby="situation-heading">
            <h2 id="situation-heading" className="landing__section-title">
              W jakiej jesteś sytuacji?
            </h2>
            <p className="landing__section-lead">
              Wybierz jedną odpowiedź – dopasujemy do niej kolejne pytania.
            </p>

            <SituationTiles
              options={SITUATION_OPTIONS}
              value={selected}
              onChange={handleSelect}
              labelledBy="situation-heading"
              describedBy={showSelectionError ? 'situation-error' : undefined}
            />

            {showSelectionError && (
              <p id="situation-error" className="landing__error" role="alert">
                Wybierz swoją sytuację, aby przejść dalej
              </p>
            )}

            <div className="landing__actions">
              <div className="landing__action">
                <button
                  type="button"
                  className="button button--primary"
                  aria-describedby="login-hint"
                  onClick={() => goTo('/login')}
                >
                  Zaloguj się przez mObywatela
                  <ButtonChevron />
                </button>
                <p id="login-hint" className="landing__action-hint">
                  Pobierzemy Twoje dane z ZUS – symulacja
                </p>
              </div>
              <div className="landing__action">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => goTo('/wizard')}
                >
                  Kontynuuj bez logowania
                  <ButtonChevron />
                </button>
              </div>
            </div>
          </section>

          <section className="landing__section" aria-labelledby="benefits-heading">
            <h2 id="benefits-heading" className="landing__section-title">
              Co tu zrobisz
            </h2>
            <ol className="landing__benefits">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="landing__benefit">
                  {benefit}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="landing__footer">
        <div className="landing__container">
          <nav aria-label="Przydatne linki" className="landing__footer-nav">
            <ul className="landing__footer-links">
              <li>
                <Link to="/guide">Przewodnik</Link>
              </li>
              <li>
                <Link to="/cases">Przykładowe sprawy</Link>
              </li>
              {EXTERNAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                    <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="landing__privacy-note">
            Nie zapisujemy Twoich danych – wyliczenia działają w Twojej sesji.
          </p>
        </div>
      </footer>
    </div>
  );
}
