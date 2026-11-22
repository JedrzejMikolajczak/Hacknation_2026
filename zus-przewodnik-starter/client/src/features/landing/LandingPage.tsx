import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SituationType } from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import { SITUATION_OPTIONS } from './situationOptions';
import { SituationTiles } from './SituationTiles';
import { HeroEmblem } from './HeroEmblem';
import { CountUp, usePointerParallax, useScrollReveal } from './useLandingMotion';
import './LandingPage.css';
import './LandingMotion.css';

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

const TITLE_WORDS = ['Przewodnik', 'Przyszłego', 'Rodzica'];

/** Podstawowe wymiary urlopów dla jednego dziecka – szczegóły zależą od sytuacji. */
const QUICK_FACTS = [
  { value: 20, unit: 'tygodni', label: 'urlopu macierzyńskiego' },
  { value: 2, unit: 'tygodnie', label: 'urlopu ojcowskiego' },
  { value: 41, unit: 'tygodni', label: 'urlopu rodzicielskiego' },
];

const REASSURANCES = [
  'Zajmie kilka minut',
  'Dane zostają w Twojej przeglądarce',
  'Możesz zacząć bez logowania',
];

const BENEFITS = [
  'Sprawdzisz, jakie świadczenia Ci przysługują.',
  'Policzysz okres i wysokość zasiłku.',
  'Dostaniesz listę dokumentów i terminów.',
];

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scenario, setSituation } = useScenario();
  const [selectionRequested, setSelectionRequested] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);
  usePointerParallax(rootRef);

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
    <div className="landing" ref={rootRef}>
      <div className="landing__progress" aria-hidden="true" />
      <div className="landing__demo-strip">
        <div className="landing__container">
          <p className="landing__demo-label">
            Wersja demonstracyjna – dane i logowanie są symulowane
          </p>
        </div>
      </div>

      <header className="landing__header">
        <div className="landing__aurora" aria-hidden="true">
          <span className="landing__blob landing__blob--1" />
          <span className="landing__blob landing__blob--2" />
          <span className="landing__blob landing__blob--3" />
          <span className="landing__spark landing__spark--1" />
          <span className="landing__spark landing__spark--2" />
          <span className="landing__spark landing__spark--3" />
          <span className="landing__spark landing__spark--4" />
        </div>
        <div className="landing__container">
          <div className="landing__hero">
            <div className="landing__hero-text">
              <h1 className="landing__title">
                {TITLE_WORDS.map((word, index) => (
                  <Fragment key={word}>
                    <span className="landing__word" style={{ ['--i' as string]: index }}>
                      <span className="landing__word-inner">{word}</span>
                    </span>{' '}
                  </Fragment>
                ))}
              </h1>
              <p className="landing__subtitle">
                Sprawdź, jakie świadczenia z ZUS Ci przysługują – w kilka minut.
              </p>
              <ul className="landing__reassurances">
                {REASSURANCES.map((item, index) => (
                  <li
                    key={item}
                    className="landing__reassurance"
                    style={{ ['--i' as string]: index }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroEmblem />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="landing__main">
        <div className="landing__container">
          <section
            className="landing__section landing__card"
            aria-labelledby="situation-heading"
            data-reveal
          >
            <h2 id="situation-heading" className="landing__section-title">
              W jakiej jesteś sytuacji?
            </h2>
            <p className="landing__section-lead">Wybierz jedną opcję, aby przejść dalej.</p>

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

          <section
            className="landing__section landing__facts"
            aria-labelledby="facts-heading"
            data-reveal
          >
            <h2 id="facts-heading" className="landing__facts-title">
              W skrócie
            </h2>
            <ul className="landing__facts-list">
              {QUICK_FACTS.map((fact, index) => (
                <li key={fact.label} className="landing__fact" style={{ ['--i' as string]: index }}>
                  <CountUp className="landing__fact-value" value={fact.value} />
                  <span className="landing__fact-unit">{fact.unit}</span>
                  <span className="landing__fact-label">{fact.label}</span>
                </li>
              ))}
            </ul>
            <p className="landing__facts-note">
              Dotyczy jednego dziecka. Dokładny wymiar zależy od Twojej sytuacji – sprawdzisz go w
              planie.
            </p>
          </section>

          <section
            className="landing__section landing__benefits-section"
            aria-labelledby="benefits-heading"
            data-reveal
          >
            <h2 id="benefits-heading" className="landing__benefits-title">
              Co tu zrobisz
            </h2>
            <ol className="landing__benefits">
              {BENEFITS.map((benefit, index) => (
                <li key={benefit} className="landing__benefit" style={{ ['--i' as string]: index }}>
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
            Odpowiedzi z formularza zapisujemy tylko w tej przeglądarce, aby można było do nich
            wrócić.
          </p>
        </div>
      </footer>
    </div>
  );
}
