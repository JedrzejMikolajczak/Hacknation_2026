import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  BenefitParams,
  DocumentChecklist,
  Payer,
  RequiredDocument,
  ScenarioInput,
} from '@shared/types';
import { resolveParentPayer } from '@shared/engine';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import { formatPolishDate } from '../planScenario';
import './DocumentsTab.css';

interface DocumentsTabProps {
  checklist: DocumentChecklist;
  scenario?: ScenarioInput;
  params?: BenefitParams;
  missingFields?: string[];
  wizardHref?: string;
}

const CHECKLIST_STORAGE_KEY = 'zus-plan-documents-checked-v1';

function loadCheckedIds(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

function formatSubmitTarget(submitTo: Payer): string {
  return submitTo === 'employer' ? 'Pracodawca' : 'ZUS (PUE/eZUS)';
}

function formatPayerSummary(payer: Payer | null): string {
  if (payer === 'employer') return 'U pracodawcy (wypłaca zasiłek)';
  if (payer === 'zus') return 'W ZUS (najwygodniej przez PUE/eZUS)';
  return 'Brak ubezpieczenia chorobowego';
}

function isApplicationDoc(doc: RequiredDocument): boolean {
  return doc.id !== 'birthCertificateShort' && doc.id !== 'deathCertificate';
}

export function DocumentsTab({
  checklist,
  scenario,
  params = DEFAULT_PARAMS,
  missingFields = [],
  wizardHref = '/wizard',
}: DocumentsTabProps) {
  const { search } = useLocation();
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(loadCheckedIds);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedMap));
    } catch {
      // ignore storage errors
    }
  }, [checkedMap]);

  if (missingFields.length > 0) {
    return (
      <div className="plan-tab-content">
        <section className="plan-section" aria-labelledby="docs-missing-heading">
          <div className="plan-missing-data" role="status">
            <h2 id="docs-missing-heading" className="plan-section__title">
              Uzupełnij dane do listy dokumentów
            </h2>
            <p className="plan-section__lead">
              Aby ustalić, gdzie złożyć dokumenty i jakie obowiązują terminy, uzupełnij brakujące
              pola:
            </p>
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="docs-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/applications${search}`} className="docs-next-link">
            Dalej: Wnioski ›
          </Link>
        </nav>
      </div>
    );
  }

  function toggleDocument(id: string) {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const referenceDate = scenario?.referenceDate ?? null;
  const completedCount = checklist.documents.filter((doc) => checkedMap[doc.id]).length;

  const motherInsured = scenario
    ? scenario.mother.insuranceTitle !== 'none' &&
      scenario.mother.sicknessInsurance !== 'none' &&
      !scenario.special.motherDeceased
    : true;
  const motherPayer: Payer | null = scenario
    ? motherInsured
      ? scenario.special.employerBankruptcyOrLiquidation
        ? 'zus'
        : (resolveParentPayer(scenario.mother, params) ?? 'zus')
      : null
    : checklist.payer;

  const fatherInsured = Boolean(
    scenario?.father &&
    scenario.father.insuranceTitle !== 'none' &&
    scenario.father.sicknessInsurance !== 'none',
  );
  const fatherPayer: Payer | null =
    scenario?.father && fatherInsured
      ? (resolveParentPayer(scenario.father, params) ?? 'zus')
      : null;

  // Sortuj terminy chronologicznie, żeby zawsze pokazać najbliższy jako pierwszy
  const sortedDeadlines = [...checklist.deadlines].sort((a, b) => a.date.localeCompare(b.date));
  const upcomingDeadlines = referenceDate
    ? sortedDeadlines.filter((item) => item.date >= referenceDate)
    : sortedDeadlines;
  const nextDeadline = upcomingDeadlines[0] ?? sortedDeadlines[0] ?? null;
  const otherDeadlines = nextDeadline
    ? sortedDeadlines.filter((item) => item !== nextDeadline)
    : [];
  const nextDeadlineOverdue = Boolean(
    nextDeadline && referenceDate && nextDeadline.date < referenceDate,
  );

  // Wybierz jeden najbliższy nieodhaczony krok
  const uncheckedDocs = checklist.documents.filter((doc) => !checkedMap[doc.id]);
  const uncheckedWithDeadline = uncheckedDocs
    .filter((doc): doc is RequiredDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => {
      const dateCmp = a.deadline.localeCompare(b.deadline);
      if (dateCmp !== 0) return dateCmp;
      // Przy tej samej dacie priorytet dla głównego wniosku przed załącznikiem
      return Number(isApplicationDoc(b)) - Number(isApplicationDoc(a));
    });

  const nextDoc = uncheckedWithDeadline[0] ?? uncheckedDocs[0] ?? null;

  let nextStepText: string;
  if (nextDoc) {
    const targetPhrase = nextDoc.submitTo === 'employer' ? 'u pracodawcy' : 'w ZUS (PUE/eZUS)';
    const deadlinePhrase = nextDoc.deadline ? ` (do ${formatPolishDate(nextDoc.deadline)})` : '';
    nextStepText = `Następny krok: złóż „${nextDoc.name}” ${targetPhrase}${deadlinePhrase}.`;
  } else if (nextDeadline) {
    nextStepText = `Wszystkie dokumenty z listy masz odhaczone. Najbliższy termin: ${nextDeadline.label} (${formatPolishDate(nextDeadline.date)}).`;
  } else {
    nextStepText = 'Wszystkie dokumenty z listy masz odhaczone.';
  }

  return (
    <div className="plan-tab-content">
      <section className="docs-answer" aria-labelledby="docs-next-step-heading">
        <h2 id="docs-next-step-heading" className="docs-answer__eyebrow">
          Co zrobić teraz
        </h2>
        <p className="docs-answer__step">{nextStepText}</p>

        <dl className="docs-answer__payers">
          {scenario?.father ? (
            <>
              <div className="docs-answer__payer-row">
                <dt>Matka składa dokumenty</dt>
                <dd>{formatPayerSummary(motherPayer)}</dd>
              </div>
              <div className="docs-answer__payer-row">
                <dt>Ojciec składa dokumenty</dt>
                <dd>{formatPayerSummary(fatherPayer)}</dd>
              </div>
            </>
          ) : (
            <div className="docs-answer__payer-row">
              <dt>Gdzie składasz dokumenty</dt>
              <dd>{formatPayerSummary(motherPayer)}</dd>
            </div>
          )}
        </dl>

        <details className="docs-details">
          <summary className="docs-details__summary">Dlaczego ten płatnik?</summary>
          <div className="docs-details__body">
            Zasiłek wypłaca pracodawca, jeśli zgłasza do ubezpieczenia chorobowego powyżej{' '}
            {params.payerThresholdInsuredCount} osób. W pozostałych przypadkach dokumenty trafiają
            do ZUS. Płatnik ustalany jest osobno dla każdego rodzica.
          </div>
        </details>
      </section>

      <section className="plan-section" aria-labelledby="docs-checklist-heading">
        <div className="docs-checklist-header">
          <h2 id="docs-checklist-heading" className="plan-section__title">
            Lista dokumentów
          </h2>
          <span className="plan-badge plan-badge--navy" aria-live="polite">
            Skompletowano: {completedCount} z {checklist.documents.length}
          </span>
        </div>

        <ul className="docs-compact-list" role="list">
          {checklist.documents.map((doc) => {
            const isChecked = Boolean(checkedMap[doc.id]);
            const isOverdue = Boolean(
              !isChecked && doc.deadline && referenceDate && doc.deadline < referenceDate,
            );
            return (
              <li
                key={doc.id}
                className={
                  isChecked ? 'docs-compact-item docs-compact-item--checked' : 'docs-compact-item'
                }
              >
                <label className="docs-compact-item__main">
                  <input
                    type="checkbox"
                    className="docs-compact-item__checkbox"
                    checked={isChecked}
                    onChange={() => toggleDocument(doc.id)}
                  />
                  <span className="docs-compact-item__content">
                    <span className="docs-compact-item__name">{doc.name}</span>
                    <span className="docs-compact-item__meta">
                      <span>
                        Gdzie: <strong>{formatSubmitTarget(doc.submitTo)}</strong>
                      </span>
                      {doc.deadline && (
                        <span>
                          Do kiedy: <strong>{formatPolishDate(doc.deadline)}</strong>
                          {isOverdue && (
                            <span className="docs-compact-item__overdue"> (po terminie)</span>
                          )}
                        </span>
                      )}
                    </span>
                  </span>
                </label>

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

        <details className="docs-details docs-reform-details">
          <summary className="docs-details__summary">
            Zmiany w formularzach ZUS (od 24.10.2026)
          </summary>
          <div className="docs-details__body">
            Od 24.10.2026 r. formularze ZUR i ZAO zostały włączone do druku ZUS ZAM, a druk Z-3b
            został zlikwidowany. Postęp odhaczania zapisuje się wyłącznie w Twojej przeglądarce.
          </div>
        </details>
      </section>

      <section className="plan-section" aria-labelledby="docs-deadlines-heading">
        <h2 id="docs-deadlines-heading" className="plan-section__title">
          Kluczowe terminy
        </h2>

        {!nextDeadline ? (
          <div className="plan-callout plan-callout--info">
            Dla bieżącej sytuacji nie występują odrębne terminy na urlop rodzicielski ani ojcowski.
            Złóż wymagane dokumenty w dogodnym momencie.
          </div>
        ) : (
          <>
            <div
              className={
                nextDeadlineOverdue
                  ? 'docs-next-deadline docs-next-deadline--overdue'
                  : 'docs-next-deadline'
              }
            >
              <div className="docs-next-deadline__top">
                <span
                  className={
                    nextDeadlineOverdue ? 'plan-badge plan-badge--no' : 'plan-badge plan-badge--yes'
                  }
                >
                  {nextDeadlineOverdue ? 'Termin minął' : 'Najbliższy termin'}
                </span>
                <span className="docs-next-deadline__date">
                  {formatPolishDate(nextDeadline.date)}
                </span>
              </div>
              <p className="docs-next-deadline__label">{nextDeadline.label}</p>
            </div>

            {otherDeadlines.length > 0 && (
              <ul className="docs-deadlines-list" role="list">
                {otherDeadlines.map((item) => {
                  const itemOverdue = Boolean(referenceDate && item.date < referenceDate);
                  return (
                    <li key={`${item.date}-${item.label}`} className="docs-deadlines-list__item">
                      <span className="docs-deadlines-list__date">
                        {formatPolishDate(item.date)}
                        {itemOverdue && (
                          <span className="docs-compact-item__overdue"> (po terminie)</span>
                        )}
                      </span>
                      <span className="docs-deadlines-list__label">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {sortedDeadlines.some((item) => Boolean(item.legalBasis)) && (
              <details className="docs-details docs-legal-details">
                <summary className="docs-details__summary">Podstawa prawna terminów</summary>
                <div className="docs-details__body">
                  <ul className="docs-legal-list">
                    {sortedDeadlines.map((item) => (
                      <li key={`legal-${item.date}-${item.label}`}>
                        <strong>{formatPolishDate(item.date)}</strong> – {item.label}:{' '}
                        {item.legalBasis ?? 'brak wskazanej podstawy'}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <nav className="docs-next-nav" aria-label="Następny krok planu">
        <Link to={`/plan/applications${search}`} className="docs-next-link">
          Dalej: Wnioski ›
        </Link>
      </nav>
    </div>
  );
}
