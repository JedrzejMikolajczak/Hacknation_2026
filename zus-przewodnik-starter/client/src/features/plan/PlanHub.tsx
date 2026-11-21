import { Link } from 'react-router-dom';
import { PLAN_TABS, type PlanTabId } from './planScenario';

/** Krótki opis każdej sekcji planu – treść kafelka na ekranie /plan. */
const TILE_DESCRIPTIONS: Record<PlanTabId, string> = {
  entitlements: 'Sprawdź, które świadczenia Ci przysługują w ciąży i po porodzie – i dlaczego.',
  calculator: 'Policz okres i wysokość zasiłku macierzyńskiego. Porównaj 81,5% ze 100% + 70%.',
  'leave-plan': 'Ułóż urlopy na osi czasu, podziel urlop rodzicielski i połącz go z pracą.',
  documents: 'Jakie dokumenty, do kiedy i gdzie złożyć – u pracodawcy albo w ZUS.',
  applications: 'Wypełnij i wyślij wnioski o urlopy i zasiłek (symulacja).',
  support: 'Organizacje pomocowe, przydatne linki i odpowiedzi na pytania.',
};

/** Ikony liniowe (inline SVG, bez bibliotek) – dekoracyjne, ukryte przed czytnikami. */
const TILE_ICONS: Record<PlanTabId, JSX.Element> = {
  // tarcza z ptaszkiem
  entitlements: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // kalkulator
  calculator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </>
  ),
  // kalendarz z osią
  'leave-plan': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M7 14h6M10 17h7" />
    </>
  ),
  // dokument z listą
  documents: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 12h6M10 15h6M10 18h4" />
    </>
  ),
  // koperta ze strzałką (wysyłka)
  applications: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </>
  ),
  // dłonie / serce wsparcia
  support: (
    <>
      <path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z" />
      <path d="M9.5 12.5h5M12 10v5" />
    </>
  ),
};

interface PlanHubProps {
  /** Zachowany query string scenariusza, np. „?dzieci=2&wariant=combined”. */
  querySuffix: string;
}

/** Ekran /plan: 6 kafelków – każdy prowadzi do jednej sekcji planu (/plan/:tab). */
export function PlanHub({ querySuffix }: PlanHubProps) {
  return (
    <section className="plan-hub" aria-labelledby="plan-hub-heading">
      <h2 id="plan-hub-heading" className="plan-hub__title">
        Czym chcesz się teraz zająć?
      </h2>
      <p className="plan-hub__lead">
        Wybierz sekcję. Każda korzysta z danych z formularza, a do listy sekcji możesz wrócić w
        każdej chwili.
      </p>
      <ul className="plan-hub__grid">
        {PLAN_TABS.map((item) => (
          <li key={item.id} className="plan-hub__item">
            <Link
              to={`/plan/${item.id}${querySuffix}`}
              className="plan-hub__tile"
              aria-describedby={`plan-hub-desc-${item.id}`}
            >
              <svg
                className="plan-hub__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                {TILE_ICONS[item.id]}
              </svg>
              <span className="plan-hub__tile-title">{item.label}</span>
              <span id={`plan-hub-desc-${item.id}`} className="plan-hub__tile-desc">
                {TILE_DESCRIPTIONS[item.id]}
              </span>
              <span className="plan-hub__tile-cta" aria-hidden="true">
                Przejdź
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
