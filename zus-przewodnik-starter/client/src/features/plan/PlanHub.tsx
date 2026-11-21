import { Link } from 'react-router-dom';
import { PLAN_TABS, type PlanTabId } from './planScenario';

const RECOMMENDED_FIRST_TAB: PlanTabId = 'entitlements';

/** Krótki jednozdaniowy opis każdej sekcji planu – treść kafelka na ekranie /plan. */
const TILE_DESCRIPTIONS: Record<PlanTabId, string> = {
  entitlements: 'Jakie świadczenia Ci przysługują i kto je wypłaca.',
  calculator: 'Wysokość zasiłku i porównanie wariantów stawki.',
  'leave-plan': 'Oś czasu, podział urlopu i łączenie z pracą.',
  documents: 'Lista dokumentów, terminy i miejsce złożenia.',
  applications: 'Gotowe wnioski do wysłania (symulacja).',
  support: 'Organizacje pomocowe, linki i asystent.',
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

/** Ekran /plan: wskazówka kolejności i 6 kafelków – każdy prowadzi do jednej sekcji planu (/plan/:tab). */
export function PlanHub({ querySuffix }: PlanHubProps) {
  return (
    <section className="plan-hub" aria-labelledby="plan-hub-heading">
      <h2 id="plan-hub-heading" className="plan-hub__title">
        Czym chcesz się teraz zająć?
      </h2>
      <p className="plan-hub__hint">
        <strong>Od czego zacząć?</strong> Najlepiej po kolei: Uprawnienia → Kalkulator → Plan
        urlopów → Dokumenty i terminy → Wnioski → Wsparcie.
      </p>
      <ul className="plan-hub__grid">
        {PLAN_TABS.map((item, index) => {
          const isRecommended = item.id === RECOMMENDED_FIRST_TAB;
          return (
            <li key={item.id} className="plan-hub__item" style={{ ['--i' as string]: index }}>
              <Link
                to={`/plan/${item.id}${querySuffix}`}
                className={
                  isRecommended ? 'plan-hub__tile plan-hub__tile--recommended' : 'plan-hub__tile'
                }
                aria-describedby={`plan-hub-desc-${item.id}`}
              >
                <div className="plan-hub__tile-top">
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
                  {isRecommended && <span className="plan-hub__badge">Zacznij tutaj</span>}
                </div>
                <span id={`plan-hub-desc-${item.id}`} className="plan-hub__tile-desc">
                  {TILE_DESCRIPTIONS[item.id]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
