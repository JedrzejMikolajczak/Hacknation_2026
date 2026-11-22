import type { Ref } from 'react';
import { NavLink } from 'react-router-dom';
import { PLAN_TABS, type PlanTabId } from './planScenario';

/** Jednozdaniowe „co tu robię” każdego kroku – pokazywane nad treścią kroku. */
export const STEP_HINTS: Record<PlanTabId, string> = {
  entitlements: 'Sprawdź, co Ci przysługuje',
  calculator: 'Zobacz, ile dostaniesz',
  'leave-plan': 'Ułóż urlopy w czasie',
  documents: 'Zbierz dokumenty i pilnuj terminów',
  applications: 'Pobierz gotowe wnioski',
  support: 'Znajdź pomoc, gdy jej potrzebujesz',
};

interface PlanJourneyProps {
  tab: PlanTabId;
  /** Zachowany query string scenariusza, np. „?dzieci=2”. */
  search: string;
  /** Zachowane dla zgodności z wywołaniem; stan kroków wynika z kolejności, nie z historii. */
  visited?: ReadonlySet<PlanTabId>;
  activeRef?: Ref<HTMLAnchorElement>;
}

/**
 * Ścieżka planu: 6 kroków jako przyklejony pasek z postępem. Zielona linia „dopływa” do bieżącego
 * kroku, kroki przed bieżącym są wypełnione zielenią, wszystkie mają numer – rodzic zawsze widzi, gdzie jest, co zrobił i co dalej.
 */
export function PlanJourney({ tab, search, activeRef }: PlanJourneyProps) {
  const activeIndex = Math.max(0, PLAN_TABS.findIndex((item) => item.id === tab));
  const progress = activeIndex / (PLAN_TABS.length - 1);

  return (
    <nav className="journey" aria-label="Zakładki Twojego planu">
      <div className="ui-container journey__inner">
        <div className="journey__rail" style={{ ['--p' as string]: progress }}>
          <div className="journey__track" aria-hidden="true">
            <span className="journey__fill" />
          </div>
          <ol className="journey__list">
            {PLAN_TABS.map((item, index) => {
              const state = index === activeIndex ? 'current' : index < activeIndex ? 'done' : 'todo';
              return (
                <li key={item.id} className={`journey__item journey__item--${state}`}>
                  <NavLink
                    ref={item.id === tab ? activeRef : undefined}
                    to={`/plan/${item.id}${search}`}
                    className="journey__link"
                  >
                    <span className="journey__dot" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="journey__label">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}

interface StepEyebrowProps {
  tab: PlanTabId;
}

/** „Krok 4 z 6 · Zbierz dokumenty i pilnuj terminów” – jedna linia orientacji nad tytułem kroku. */
export function StepEyebrow({ tab }: StepEyebrowProps) {
  const index = PLAN_TABS.findIndex((item) => item.id === tab);
  return (
    <p className="step-eyebrow">
      <span className="step-eyebrow__count">
        Krok {index + 1} z {PLAN_TABS.length}
      </span>
      <span className="step-eyebrow__hint">{STEP_HINTS[tab]}</span>
    </p>
  );
}
