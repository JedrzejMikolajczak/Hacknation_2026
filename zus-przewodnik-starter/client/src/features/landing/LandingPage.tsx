import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SituationType } from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import { AppBar } from '../../components/AppBar';
import { AppFooter, type FooterLink } from '../../components/AppFooter';
import {
  ArrowIcon,
  CheckIcon,
  CoinIcon,
  DocumentIcon,
  CalendarIcon,
} from '../../components/icons';
import { CountUp, usePointerParallax } from '../../components/motion';
import { SITUATION_OPTIONS } from './situationOptions';
import { SituationTiles } from './SituationTiles';
import './LandingPage.css';

const SITUATION_QUERY_KEY = 'situation';

const FOOTER_LINKS: FooterLink[] = [
  { to: '/guide', label: 'Przewodnik' },
  { to: '/cases', label: 'Przykładowe sprawy' },
  { href: 'https://www.zus.pl', label: 'Zakład Ubezpieczeń Społecznych (zus.pl)' },
  { href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski', label: 'Urlop rodzicielski (gov.pl)' },
  {
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
    label: 'Rodzicielstwo – Państwowa Inspekcja Pracy',
  },
];

/** Nagłówek rozbity na słowa – każde „wynurza się” po kolei; wyróżnione słowa dostają zakreślenie. */
const TITLE_WORDS: { text: string; mark?: boolean }[] = [
  { text: 'Dowiedz' },
  { text: 'się,' },
  { text: 'co' },
  { text: 'Ci' },
  { text: 'przysługuje', mark: true },
  { text: 'i' },
  { text: 'co' },
  { text: 'musisz' },
  { text: 'złożyć', mark: true },
];

const REASSURANCES = [
  'Zajmie kilka minut',
  'Dane zostają w Twojej przeglądarce',
  'Możesz zacząć bez logowania',
];

interface Step {
  title: string;
  text: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Odpowiedz na pytania',
    text: 'Kilka prostych pytań o Twoją sytuację. Zapisujemy na bieżąco, więc możesz wrócić później.',
    icon: <CheckIcon className="home__step-icon" />,
  },
  {
    title: 'Zobacz swój plan',
    text: 'Co Ci przysługuje, ile dostaniesz i jak rozłożyć urlopy w czasie.',
    icon: <CalendarIcon className="home__step-icon" />,
  },
  {
    title: 'Pobierz gotowe wnioski',
    text: 'Lista dokumentów z terminami oraz wnioski wypełnione Twoimi danymi.',
    icon: <DocumentIcon className="home__step-icon" />,
  },
];

/** Podstawowe wymiary urlopów dla jednego dziecka – szczegóły zależą od sytuacji. */
const QUICK_FACTS = [
  { value: 20, unit: 'tygodni', label: 'urlopu macierzyńskiego' },
  { value: 2, unit: 'tygodnie', label: 'urlopu ojcowskiego' },
  { value: 41, unit: 'tygodni', label: 'urlopu rodzicielskiego' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scenario, setSituation } = useScenario();
  const [selectionRequested, setSelectionRequested] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
    <div className="home" ref={rootRef}>
      <header>
        <AppBar brandLink={false} />
      </header>

      <main id="main" tabIndex={-1} className="home__main">
        <div className="ui-container home__hero">
          <div className="home__intro">
            <p className="ui-eyebrow ui-rise">Zasiłki i urlopy rodzicielskie</p>
            <h1 className="home__title">
              {TITLE_WORDS.map((word, index) => (
                <Fragment key={`${word.text}-${index}`}>
                  <span className="home__word" style={{ ['--i' as string]: index }}>
                    <span
                      className={
                        word.mark ? 'home__word-inner home__word-inner--mark' : 'home__word-inner'
                      }
                    >
                      {word.text}
                    </span>
                  </span>{' '}
                </Fragment>
              ))}
            </h1>
            <p className="home__lead ui-rise" style={{ ['--i' as string]: 5 }}>
              Odpowiedz na kilka prostych pytań. My policzymy zasiłek, ułożymy urlopy i
              przygotujemy gotowe wnioski – krok po kroku.
            </p>
            <ul className="home__reassurances">
              {REASSURANCES.map((item, index) => (
                <li
                  key={item}
                  className="home__reassurance ui-rise"
                  style={{ ['--i' as string]: index + 6 }}
                >
                  <CheckIcon className="home__reassurance-icon" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <section className="home__choose" aria-labelledby="situation-heading">
            <span className="home__pulse home__pulse--a" aria-hidden="true" />
            <span className="home__pulse home__pulse--b" aria-hidden="true" />
            <div className="home__card ui-rise" style={{ ['--i' as string]: 3 }}>
              <p className="home__card-step" aria-hidden="true">
                Pierwszy krok
              </p>
              <h2 id="situation-heading" className="home__card-title">
                W jakiej jesteś sytuacji?
              </h2>
              <p className="home__card-lead">Wybierz jedną opcję, aby przejść dalej.</p>

              <SituationTiles
                options={SITUATION_OPTIONS}
                value={selected}
                onChange={handleSelect}
                labelledBy="situation-heading"
                describedBy={showSelectionError ? 'situation-error' : undefined}
              />

              {showSelectionError && (
                <p id="situation-error" className="home__error" role="alert">
                  Wybierz swoją sytuację, aby przejść dalej
                </p>
              )}

              <div className="home__actions">
                <div className="home__action">
                  <button
                    type="button"
                    className={
                      selected
                        ? 'ui-btn ui-btn--primary ui-btn--lg home__cta home__cta--ready'
                        : 'ui-btn ui-btn--primary ui-btn--lg home__cta'
                    }
                    aria-describedby="login-hint"
                    onClick={() => goTo('/login')}
                  >
                    Zaloguj się przez mObywatela
                    <ArrowIcon />
                  </button>
                  <p id="login-hint" className="home__action-hint">
                    Pobierzemy Twoje dane z ZUS – symulacja
                  </p>
                </div>
                <div className="home__action">
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--lg home__cta"
                    onClick={() => goTo('/wizard')}
                  >
                    Kontynuuj bez logowania
                    <ArrowIcon />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="ui-container home__how" aria-labelledby="how-heading">
          <h2 id="how-heading" className="home__section-title" data-reveal>
            Jak to działa
          </h2>
          <ol className="home__steps">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="home__step"
                style={{ ['--i' as string]: index }}
                data-reveal
              >
                <span className="home__step-badge">
                  <span className="home__step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  {step.icon}
                </span>
                <h3 className="home__step-title">{step.title}</h3>
                <p className="home__step-text">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ui-container home__facts" aria-labelledby="facts-heading" data-reveal>
          <div className="home__facts-card">
            <div className="home__facts-head">
              <CoinIcon className="home__facts-icon" />
              <div>
                <h2 id="facts-heading" className="home__facts-title">
                  W skrócie
                </h2>
                <p className="home__facts-note">
                  Dotyczy jednego dziecka. Dokładny wymiar zależy od Twojej sytuacji – sprawdzisz go
                  w planie.
                </p>
              </div>
            </div>
            <ul className="home__facts-list">
              {QUICK_FACTS.map((fact) => (
                <li key={fact.label} className="home__fact">
                  <span className="home__fact-number">
                    <CountUp className="home__fact-value" value={fact.value} />
                    <span className="home__fact-unit">{fact.unit}</span>
                  </span>
                  <span className="home__fact-label">{fact.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <AppFooter
        links={FOOTER_LINKS}
        navLabel="Przydatne linki"
        note="Odpowiedzi z formularza zapisujemy tylko w tej przeglądarce, aby można było do nich wrócić."
      />
    </div>
  );
}
