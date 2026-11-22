import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { formatPolishDate } from '../planScenario';
import { attachmentSource, buildMailto, type DeliveryGuide, type FilingKind } from './filingGuide';
import { documentKey } from './documentKey';
import type { CaseDocument } from '@shared/types';
import './FilingMap.css';
import { SuperText } from '../../../components/SuperText';

export interface FilingStep {
  doc: CaseDocument;
  title: string;
  /** „Mama”/„Tata” – tylko gdy w planie są dwoje rodziców. */
  who: string | null;
  kind: FilingKind;
  guide: DeliveryGuide;
  /** Wyjaśnienie „co to za dokument”. */
  details: string;
  /** Link do zakładki Wnioski z otwartym tym wnioskiem; null, gdy nie ma wniosku do pobrania. */
  applicationHref: string | null;
}

interface FilingMapProps {
  steps: FilingStep[];
  /** Klucz w localStorage – osobny dla każdej sprawy/scenariusza, żeby stan się nie mieszał. */
  storageKey: string;
}

function loadDone(storageKey: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, value]) => value === true),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

const KIND_LABEL: Record<FilingKind, string> = {
  auto: 'Dzieje się automatycznie',
  attachment: 'Zdobądź dokument',
  application: 'Wypełnij i złóż',
};

/** Kolejność na mapie: najpierw rzeczy „same”, potem załączniki, potem wnioski wg terminu. */
export function orderFilingSteps(steps: FilingStep[]): FilingStep[] {
  const rank = (step: FilingStep) => {
    if (step.kind === 'auto') return 0;
    if (step.kind === 'attachment') return 1;
    return step.doc.deadline ? 2 : 3;
  };
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const byRank = rank(a.step) - rank(b.step);
      if (byRank !== 0) return byRank;
      if (rank(a.step) === 2) {
        const byDeadline = (a.step.doc.deadline ?? '').localeCompare(b.step.doc.deadline ?? '');
        if (byDeadline !== 0) return byDeadline;
      }
      return a.index - b.index;
    })
    .map(({ step }) => step);
}

function StepDetail({
  step,
  done,
  onToggleDone,
  panelId,
}: {
  step: FilingStep;
  done: boolean;
  onToggleDone: () => void;
  panelId: string;
}) {
  const { doc, guide } = step;
  const source = step.kind === 'attachment' ? attachmentSource(doc) : null;
  const mailto = guide.mail
    ? buildMailto({
        title: step.title,
        who: step.who,
        deadline: doc.deadline ? formatPolishDate(doc.deadline) : null,
      })
    : null;

  return (
    <div
      className="fmap__detail"
      id={panelId}
      role="region"
      aria-label={`Szczegóły: ${step.title}`}
    >
      <p className="fmap__detail-kicker">{KIND_LABEL[step.kind]}</p>
      <h4 className="fmap__detail-title">{step.title}</h4>

      <dl className="fmap__facts">
        <div>
          <dt>Gdzie</dt>
          <dd>{guide.where}</dd>
        </div>
        <div>
          <dt>Do kiedy</dt>
          <dd className={doc.is_overdue && !done ? 'fmap__overdue' : undefined}>
            {doc.deadline ? (
              <>
                <time dateTime={doc.deadline}>{formatPolishDate(doc.deadline)}</time>
                {doc.is_overdue && !done ? ' · termin minął' : ''}
              </>
            ) : (
              'Bez sztywnego terminu'
            )}
          </dd>
        </div>
        {step.who && (
          <div>
            <dt>Kto</dt>
            <dd>{step.who}</dd>
          </div>
        )}
      </dl>

      {step.kind === 'application' && (
        <ol className="fmap__todo">
          <li>
            <strong>Przygotuj wniosek.</strong> Wypełnimy go danymi z Twojego formularza – dopytamy
            tylko o to, czego brakuje. Pobierzesz wniosek wstępnie wypełniony – przed wysłaniem
            trzeba go jeszcze uzupełnić i podpisać.
            {step.applicationHref && (
              <Link to={step.applicationHref} className="plan-btn plan-btn--primary fmap__cta">
                Wypełnij i pobierz wniosek ›
              </Link>
            )}
          </li>
          <li>
            <strong>Wyślij go.</strong> {guide.how}
            <span className="fmap__actions">
              {guide.links.map((link, index) => (
                <a
                  key={link.href}
                  className={
                    index === 0 ? 'plan-btn plan-btn--primary' : 'plan-btn plan-btn--secondary'
                  }
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label} ↗
                  <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
                </a>
              ))}
              {mailto && (
                <a className="plan-btn plan-btn--secondary" href={mailto}>
                  Napisz e-mail do kadr ✉
                </a>
              )}
            </span>
            {guide.alternative && <small className="fmap__alt">{guide.alternative}</small>}
          </li>
        </ol>
      )}

      {step.kind === 'attachment' && source && (
        <ol className="fmap__todo">
          <li>
            <strong>Zdobądź dokument.</strong> {source.how}
            {source.link && (
              <span className="fmap__actions">
                <a
                  className="plan-btn plan-btn--secondary"
                  href={source.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.link.label} ↗
                  <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
                </a>
              </span>
            )}
          </li>
          <li>
            <strong>Dołącz go do wniosku.</strong> {guide.how}
          </li>
        </ol>
      )}

      {step.kind === 'auto' && <p className="fmap__auto">{guide.how}</p>}

      <details className="docs-details">
        <summary className="docs-details__summary">Co to za dokument i podstawa prawna</summary>
        <div className="docs-details__body">
          <p>{step.details}</p>
          <p className="docs-details__sub">
            <strong>Podstawa prawna:</strong> <SuperText text={doc.legal_basis} />
          </p>
        </div>
      </details>

      {step.kind !== 'auto' && (
        <label className="fmap__done">
          <input type="checkbox" checked={done} onChange={onToggleDone} />
          <span>Mam to załatwione</span>
        </label>
      )}
    </div>
  );
}

/**
 * „Mapa składania dokumentów”: oś kroków (co → gdzie → kiedy) i panel ze szczegółami wybranego
 * kroku. Na laptopie oś jest po lewej, panel po prawej; na telefonie panel rozwija się pod krokiem.
 */
/** Ile kroków widać na start – reszta jest pod przyciskiem „Pokaż pozostałe kroki”. */
const COLLAPSED_STEPS = 6;

export function FilingMap({ steps, storageKey }: FilingMapProps) {
  const ordered = orderFilingSteps(steps);
  const idPrefix = useId();
  const [done, setDone] = useState<Record<string, boolean>>(() => loadDone(storageKey));

  // Zapamiętujemy zaznaczenia w tej przeglądarce (nic nie trafia na serwer).
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      // brak dostępu do localStorage (tryb prywatny) – stan zostaje tylko w pamięci
    }
  }, [done, storageKey]);
  const [selected, setSelected] = useState<string | null>(null);

  const actionable = ordered.filter((step) => step.kind !== 'auto');
  const doneCount = actionable.filter((step) => done[documentKey(step.doc)]).length;
  const firstOpen = ordered.find((step) => step.kind !== 'auto' && !done[documentKey(step.doc)]);
  const fallback = firstOpen ?? ordered[0];
  const activeKey = selected ?? (fallback ? documentKey(fallback.doc) : null);
  const [showAll, setShowAll] = useState(false);
  const listId = `${idPrefix}-list`;
  // Wybrany krok zawsze zostaje widoczny, nawet gdy leży poza pierwszą szóstką
  const hiddenCount = showAll
    ? 0
    : ordered.filter((step, index) => index >= COLLAPSED_STEPS && documentKey(step.doc) !== activeKey)
        .length;

  return (
    <div className="fmap">
      <div className="fmap__head">
        <p className="fmap__progress" aria-live="polite">
          Załatwione: <strong>{doneCount}</strong> z {actionable.length}
        </p>
        <p className="fmap__hint">Wybierz krok, aby zobaczyć, co zrobić, gdzie i do kiedy.</p>
      </div>
      <div className="fmap__bar" aria-hidden="true">
        <span
          className="fmap__bar-fill"
          style={{ '--p': actionable.length > 0 ? doneCount / actionable.length : 0 } as CSSProperties}
        />
      </div>

      <ol
        id={listId}
        className="fmap__list"
        role="list"
        style={{ '--n': ordered.length } as CSSProperties}
      >
        {ordered.map((step, index) => {
          const key = documentKey(step.doc);
          const isActive = key === activeKey;
          const isDone = Boolean(done[key]);
          const overdue = step.doc.is_overdue && !isDone;
          const panelId = `${idPrefix}-${index}`;
          const isExtra = !showAll && index >= COLLAPSED_STEPS && !isActive;
          const stateClass = [
            'fmap__step',
            isExtra ? 'fmap__step--extra' : '',
            isActive ? 'fmap__step--active' : '',
            isDone ? 'fmap__step--done' : '',
            overdue ? 'fmap__step--overdue' : '',
            step.kind === 'auto' ? 'fmap__step--auto' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={key}
              role="listitem"
              className={stateClass}
              style={{ '--i': index } as CSSProperties}
            >
              <button
                type="button"
                className="fmap__node"
                aria-expanded={isActive}
                aria-controls={isActive ? panelId : undefined}
                onClick={() => setSelected(key)}
              >
                <span className="fmap__dot" aria-hidden="true">
                  {isDone ? '✓' : step.kind === 'auto' ? '•' : index + 1}
                </span>
                <span className="fmap__node-body">
                  <span className="fmap__node-kind">{KIND_LABEL[step.kind]}</span>
                  <span className="fmap__node-title">{step.title}</span>
                  <span className="fmap__node-meta">
                    <span className="fmap__chip">{step.guide.where}</span>
                    {step.who && <span className="fmap__chip fmap__chip--soft">{step.who}</span>}
                    {step.doc.deadline && (
                      <span
                        className={
                          overdue ? 'fmap__chip fmap__chip--alert' : 'fmap__chip fmap__chip--date'
                        }
                      >
                        do{' '}
                        <time dateTime={step.doc.deadline}>
                          {formatPolishDate(step.doc.deadline)}
                        </time>
                        {overdue ? ' · minął' : ''}
                      </span>
                    )}
                  </span>
                </span>
              </button>

              {isActive && (
                <StepDetail
                  step={step}
                  done={isDone}
                  panelId={panelId}
                  onToggleDone={() => setDone((current) => ({ ...current, [key]: !current[key] }))}
                />
              )}
            </li>
          );
        })}
      </ol>

      {(showAll || hiddenCount > 0) && (
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm fmap__more"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Pokaż mniej kroków' : `Pokaż pozostałe kroki (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}
