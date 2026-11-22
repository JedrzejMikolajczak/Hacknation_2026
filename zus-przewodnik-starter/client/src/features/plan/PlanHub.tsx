import { Link } from 'react-router-dom';
import type { CasePlan } from '@shared/types';
import { ArrowIcon, CheckIcon } from '../../components/icons';
import { firstUnvisitedStep } from './planProgress';
import { PLAN_TABS, formatPolishDate, todayIsoDate, type PlanTabId } from './planScenario';
import { deliveryItems, relativeDeadline, type DeliveryItem } from './planSummary';

/** Krótki opis każdego kroku – prostym językiem, bez żargonu. */
const STEP_DESCRIPTIONS: Record<PlanTabId, string> = {
  entitlements: 'Sprawdź, jakie świadczenia Ci przysługują i kto je wypłaca.',
  calculator: 'Zobacz, ile dostaniesz i przez jaki czas.',
  'leave-plan': 'Ułóż urlopy w czasie – także z pracą w trakcie.',
  documents: 'Co złożyć, gdzie i do kiedy – z listą do odhaczania.',
  applications: 'Pobierz gotowe wnioski wypełnione Twoimi danymi.',
  support: 'Organizacje pomocowe i asystent, gdy masz pytanie.',
};

/** Ikony liniowe (inline SVG, bez bibliotek) – dekoracyjne, ukryte przed czytnikami. */
const STEP_ICONS: Record<PlanTabId, JSX.Element> = {
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
  // koperta
  applications: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </>
  ),
  // serce wsparcia
  support: (
    <>
      <path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z" />
      <path d="M9.5 12.5h5M12 10v5" />
    </>
  ),
};

const DAY_MONTH = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function dayAndMonth(iso: string): { day: string; month: string } {
  const parts = DAY_MONTH.formatToParts(new Date(iso));
  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: (parts.find((part) => part.type === 'month')?.value ?? '').replace('.', ''),
  };
}

interface PlanHubProps {
  /** Zachowany query string scenariusza, np. „?dzieci=2&wariant=combined”. */
  querySuffix: string;
  /** Obejrzane kroki – dostają „ptaszek”; pierwszy nieobejrzany jest polecany jako start. */
  visited: ReadonlySet<PlanTabId>;
  /** Wyliczony plan (null, gdy się liczy albo brakuje danych). */
  plan: CasePlan | null;
  /** Czy trwa liczenie planu – pokazujemy szkielet zamiast pustego miejsca. */
  waiting: boolean;
  /** Czy mamy komplet danych do policzenia planu. */
  hasData: boolean;
  wizardUrl: string;
}

/**
 * Ekran /plan – mapa: co zrobić teraz, jakie 6 kroków czekają i co trzeba dostarczyć.
 * Układ: u góry „Najbliższy krok”, poniżej ścieżka (lewo) i lista „Co dostarczyć” (prawo).
 */
export function PlanHub({ querySuffix, visited, plan, waiting, hasData, wizardUrl }: PlanHubProps) {
  const recommended = firstUnvisitedStep(visited);
  const items = plan ? deliveryItems(plan.documents, todayIsoDate()) : [];
  const [next, ...later] = items;
  const upcoming = later.slice(0, 3);
  const doneCount = PLAN_TABS.filter((tab) => visited.has(tab.id)).length;

  return (
    <div className="hub">
      <section className="hub-next" aria-labelledby="hub-next-title">
        {waiting ? (
          <div role="status" className="hub-next__loading">
            <span className="visually-hidden">Przygotowujemy Twój plan…</span>
            <span className="ui-skeleton hub-next__skeleton hub-next__skeleton--short" aria-hidden="true" />
            <span className="ui-skeleton hub-next__skeleton" aria-hidden="true" />
            <span className="ui-skeleton hub-next__skeleton hub-next__skeleton--short" aria-hidden="true" />
          </div>
        ) : !hasData ? (
          <>
            <p className="hub-next__eyebrow">Najpierw kilka pytań</p>
            <h2 id="hub-next-title" className="hub-next__title">
              Uzupełnij dane, a przygotujemy Twój plan
            </h2>
            <p className="hub-next__meta">
              Nie zgadujemy – plan liczymy z Twoich odpowiedzi. To zajmie kilka minut.
            </p>
            <div className="hub-next__actions">
              <Link to={wizardUrl} className="ui-btn ui-btn--cta ui-btn--lg">
                Uzupełnij dane
                <ArrowIcon />
              </Link>
            </div>
          </>
        ) : next ? (
          <NextStep item={next} querySuffix={querySuffix} total={items.length} />
        ) : (
          <>
            <p className="hub-next__eyebrow">Twój plan jest gotowy</p>
            <h2 id="hub-next-title" className="hub-next__title">
              Zacznij od sprawdzenia, co Ci przysługuje
            </h2>
            <div className="hub-next__actions">
              <Link
                to={`/plan/entitlements${querySuffix}`}
                className="ui-btn ui-btn--cta ui-btn--lg"
              >
                Zobacz uprawnienia
                <ArrowIcon />
              </Link>
            </div>
          </>
        )}
      </section>

      <div className="hub__columns">
        <section className="hub-path" aria-labelledby="hub-path-title">
          <div className="hub-path__head">
            <h2 id="hub-path-title" className="hub__title">
              Twoja ścieżka
            </h2>
            <p className="hub__hint">
              <strong>Od czego zacząć?</strong>{' '}
              {recommended
                ? 'Idź po kolei – oznaczyliśmy najbliższy krok.'
                : 'Wszystkie kroki obejrzane – możesz wracać do każdego.'}
            </p>
            <div
              className="hub-path__progress"
              role="img"
              aria-label={`Obejrzane kroki: ${doneCount} z ${PLAN_TABS.length}`}
            >
              <span
                className="hub-path__progress-fill"
                style={{ ['--p' as string]: doneCount / PLAN_TABS.length }}
              />
            </div>
            <p className="hub-path__count" aria-hidden="true">
              {doneCount} z {PLAN_TABS.length} kroków obejrzanych
            </p>
          </div>

          <ol className="hub-steps">
            {PLAN_TABS.map((item, index) => {
              const isDone = visited.has(item.id);
              const isNext = item.id === recommended;
              const state = isNext ? 'next' : isDone ? 'done' : 'todo';
              return (
                <li
                  key={item.id}
                  className={`hub-step hub-step--${state}`}
                  style={{ ['--i' as string]: index }}
                >
                  <span className="hub-step__num" aria-hidden="true">
                    {isDone && !isNext ? <CheckIcon className="hub-step__check" /> : index + 1}
                  </span>
                  <Link
                    to={`/plan/${item.id}${querySuffix}`}
                    className="hub-step__link"
                    aria-describedby={`hub-step-desc-${item.id}`}
                  >
                    <svg
                      className="hub-step__icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      {STEP_ICONS[item.id]}
                    </svg>
                    <span className="hub-step__text">
                      <span className="hub-step__title">{item.label}</span>
                      <span id={`hub-step-desc-${item.id}`} className="hub-step__desc">
                        {STEP_DESCRIPTIONS[item.id]}
                      </span>
                    </span>
                    {isNext && <span className="hub-step__badge">Zacznij tutaj</span>}
                    <ArrowIcon className="hub-step__arrow" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        {upcoming.length > 0 && (
          <section className="hub-deliver" aria-labelledby="hub-deliver-title">
            <h2 id="hub-deliver-title" className="hub__title">
              Co dostarczyć dalej
            </h2>
            <p className="hub__hint">Kolejne dokumenty i wnioski – od najpilniejszego.</p>
            <ul className="hub-deliver__list">
              {upcoming.map((item, index) => (
                <li
                  key={item.key}
                  className="hub-deliver__item"
                  style={{ ['--i' as string]: index }}
                >
                  <DateLeaf item={item} />
                  <span className="hub-deliver__text">
                    <span className="hub-deliver__title">{item.title}</span>
                    <span className="hub-deliver__meta">
                      {item.who} · {item.where}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link to={`/plan/documents${querySuffix}`} className="hub-deliver__all">
              Zobacz pełną listę ({items.length})
              <ArrowIcon className="hub-deliver__all-icon" />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

function DateLeaf({ item }: { item: DeliveryItem }) {
  if (!item.deadline) {
    return (
      <span className="date-leaf date-leaf--none" aria-hidden="true">
        <span className="date-leaf__day">–</span>
        <span className="date-leaf__month">bez daty</span>
      </span>
    );
  }
  const { day, month } = dayAndMonth(item.deadline);
  return (
    <span
      className={item.overdue ? 'date-leaf date-leaf--overdue' : 'date-leaf'}
      aria-label={`Termin: ${formatPolishDate(item.deadline)}`}
    >
      <span className="date-leaf__month">{month}</span>
      <span className="date-leaf__day">{day}</span>
    </span>
  );
}

function NextStep({
  item,
  querySuffix,
  total,
}: {
  item: DeliveryItem;
  querySuffix: string;
  total: number;
}) {
  const relative = relativeDeadline(item);
  return (
    <>
      <p className="hub-next__eyebrow">{item.overdue ? 'Pilne – termin minął' : 'Najbliższy krok'}</p>
      <h2 id="hub-next-title" className="hub-next__title">
        {item.title}
      </h2>
      <ul className="hub-next__chips">
        <li className="hub-next__chip">{item.who}</li>
        <li className="hub-next__chip">{item.where}</li>
        {item.deadline && (
          <li className="hub-next__chip hub-next__chip--date">
            do {formatPolishDate(item.deadline)}
            {relative && <> · {relative}</>}
          </li>
        )}
      </ul>
      <div className="hub-next__actions">
        <Link to={`/plan/documents${querySuffix}`} className="ui-btn ui-btn--cta ui-btn--lg">
          Zobacz, jak to zrobić
          <ArrowIcon />
        </Link>
        {total > 1 && (
          <span className="hub-next__more">Razem do załatwienia: {total}</span>
        )}
      </div>
    </>
  );
}
