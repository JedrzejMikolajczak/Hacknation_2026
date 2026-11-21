import { Link } from 'react-router-dom';
import type { BenefitParams, IsoDate, RequiredDocument, ScenarioInput } from '@shared/types';
import { formatPolishDate } from '../plan/planScenario';
import {
  formatSubmissionMethod,
  formatSubmitTarget,
  groupDocuments,
  isDatePast,
} from './documentModel';

interface DocumentChecklistSectionProps {
  documents: RequiredDocument[];
  zamPreviewHref?: string;
  checkedMap: Record<string, boolean>;
  onToggleDocument: (id: string) => void;
  onResetChecked: () => void;
  referenceDate: IsoDate | null;
  scenario?: ScenarioInput;
  params: BenefitParams;
}

function getBadgeClassName(doc: RequiredDocument): string {
  if (doc.id === 'eZlaCodeB') return 'plan-badge plan-badge--yes';
  return doc.submitTo === 'employer'
    ? 'plan-badge plan-badge--navy'
    : 'plan-badge plan-badge--code';
}

export function DocumentChecklistSection({
  documents,
  zamPreviewHref,
  checkedMap,
  onToggleDocument,
  onResetChecked,
  referenceDate,
  scenario,
  params,
}: DocumentChecklistSectionProps) {
  const totalCount = documents.length;
  const completedCount = documents.filter((doc) => checkedMap[doc.id]).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const groups = groupDocuments(documents, scenario, params);
  const showGroupHeadings = groups.length > 1 || groups[0]?.id === 'pregnancySickness';

  return (
    <section className="plan-section" aria-labelledby="docs-checklist-heading">
      <div className="docs-checklist-header">
        <h2 id="docs-checklist-heading" className="plan-section__title">
          Lista dokumentów
        </h2>
        <span className="plan-badge plan-badge--navy" aria-live="polite">
          Skompletowano: {completedCount} z {totalCount} ({progressPercent}%)
        </span>
      </div>

      <div className="docs-progress" aria-label="Postęp kompletowania dokumentów">
        <div
          className="docs-progress__track"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Skompletowano ${completedCount} z ${totalCount} dokumentów (${progressPercent}%)`}
        >
          <div className="docs-progress__fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="docs-groups">
        {groups.map((group) => (
          <div key={group.id} className="docs-group">
            {showGroupHeadings && (
              <div className="docs-group__header">
                <h3 className="docs-group__title">{group.title}</h3>
                {group.description && <p className="docs-group__desc">{group.description}</p>}
              </div>
            )}

            <ul className="docs-compact-list" role="list">
              {group.documents.map((doc) => {
                const isChecked = Boolean(checkedMap[doc.id]);
                const isOverdue = !isChecked && isDatePast(doc.deadline, referenceDate);

                return (
                  <li
                    key={doc.id}
                    className={
                      isChecked
                        ? 'docs-compact-item docs-compact-item--checked'
                        : isOverdue
                          ? 'docs-compact-item docs-compact-item--overdue'
                          : 'docs-compact-item'
                    }
                  >
                    <label className="docs-compact-item__main">
                      <input
                        type="checkbox"
                        className="docs-compact-item__checkbox"
                        checked={isChecked}
                        onChange={() => onToggleDocument(doc.id)}
                      />
                      <span className="docs-compact-item__content">
                        <span className="docs-compact-item__top">
                          <span className="docs-compact-item__name">{doc.name}</span>
                          <span className={getBadgeClassName(doc)}>{formatSubmitTarget(doc)}</span>
                        </span>

                        {doc.deadline && (
                          <span className="docs-compact-item__meta">
                            <span>
                              Do kiedy: <strong>{formatPolishDate(doc.deadline)}</strong>
                              {isOverdue && (
                                <span className="docs-compact-item__overdue"> (po terminie)</span>
                              )}
                            </span>
                          </span>
                        )}

                        <span className="docs-compact-item__method">
                          {formatSubmissionMethod(doc)}
                        </span>
                      </span>
                    </label>
                    {doc.id === 'formZAM' && zamPreviewHref && (
                      <Link className="plan-btn plan-btn--secondary" to={zamPreviewHref}>
                        Otwórz podgląd ZUS ZAM
                      </Link>
                    )}

                    {doc.note && (
                      <div className="docs-compact-item__details-wrap">
                        <details className="docs-details">
                          <summary className="docs-details__summary">Szczegóły i wskazówki</summary>
                          <div className="docs-details__body">{doc.note}</div>
                        </details>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="docs-checklist-actions">
        <button
          type="button"
          className="plan-btn plan-btn--secondary"
          onClick={() => window.print()}
        >
          Drukuj checklistę
        </button>
        <button
          type="button"
          className="plan-btn plan-btn--ghost"
          onClick={onResetChecked}
          disabled={completedCount === 0}
        >
          Wyczyść zaznaczenia
        </button>
      </div>

      <details className="docs-details docs-reform-details">
        <summary className="docs-details__summary">
          Zmiany w formularzach ZUS (od 24.10.2026)
        </summary>
        <div className="docs-details__body">
          <p>
            Od 24.10.2026 r. formularze ZUR i ZAO zostały włączone do jednego wniosku ZUS ZAM, a
            druk Z-3b został zlikwidowany.
          </p>
          <p className="docs-details__sub">
            Gdy zasiłek wypłaca ZUS: pracodawca składa Z-3 (i ZAS-12 na dalszy okres zasiłku
            chorobowego), zleceniodawca składa Z-3a, a osoba na JDG składa ZAS-53 (zasiłek
            chorobowy) lub ZUS ZAM (zasiłek macierzyński). Postęp odhaczania zapisuje się wyłącznie
            w Twojej przeglądarce.
          </p>
        </div>
      </details>
    </section>
  );
}
