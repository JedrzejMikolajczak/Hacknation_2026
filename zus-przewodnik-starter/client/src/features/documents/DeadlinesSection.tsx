import { Link } from 'react-router-dom';
import type { BenefitParams, IsoDate, ScenarioInput } from '@shared/types';
import { formatPolishDate } from '../plan/planScenario';
import {
  buildPlanAssumptionInfo,
  isDatePast,
  partitionDeadlines,
  type DeadlineItem,
} from './documentModel';

interface DeadlinesSectionProps {
  deadlines: DeadlineItem[];
  referenceDate: IsoDate | null;
  scenario?: ScenarioInput;
  params: BenefitParams;
  search: string;
}

export function DeadlinesSection({
  deadlines,
  referenceDate,
  scenario,
  params,
  search,
}: DeadlinesSectionProps) {
  const { sorted, overdue, featured, featuredIsOverdue, remaining } = partitionDeadlines(
    deadlines,
    referenceDate,
  );
  const assumption = buildPlanAssumptionInfo(scenario, params);

  return (
    <section className="plan-section" aria-labelledby="docs-deadlines-heading">
      <h2 id="docs-deadlines-heading" className="plan-section__title">
        Kluczowe terminy
      </h2>

      {!featured ? (
        <div className="plan-callout plan-callout--info">
          Dla bieżącej sytuacji nie występują odrębne terminy na urlop rodzicielski ani ojcowski.
          Złóż wymagane dokumenty w dogodnym momencie.
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="plan-callout plan-callout--warning docs-overdue-alert" role="alert">
              <p className="plan-callout__title">
                {overdue.length === 1
                  ? 'Jeden z terminów już minął'
                  : `Minęły ${overdue.length} terminy`}
                {referenceDate ? ` (względem ${formatPolishDate(referenceDate)})` : ''}
              </p>
              <ul className="docs-overdue-alert__list">
                {overdue.map((item) => (
                  <li key={`overdue-${item.date}-${item.label}`}>
                    <strong>{formatPolishDate(item.date)}</strong> – {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={
              featuredIsOverdue
                ? 'docs-next-deadline docs-next-deadline--overdue'
                : 'docs-next-deadline'
            }
          >
            <div className="docs-next-deadline__top">
              <span
                className={
                  featuredIsOverdue ? 'plan-badge plan-badge--no' : 'plan-badge plan-badge--yes'
                }
              >
                {featuredIsOverdue ? 'Termin minął' : 'Najbliższy termin'}
              </span>
              <span className="docs-next-deadline__date">{formatPolishDate(featured.date)}</span>
            </div>
            <p className="docs-next-deadline__label">{featured.label}</p>
          </div>

          {remaining.length > 0 && (
            <ul className="docs-deadlines-list" role="list">
              {remaining.map((item) => {
                const itemOverdue = isDatePast(item.date, referenceDate);
                return (
                  <li
                    key={`${item.date}-${item.label}`}
                    className={
                      itemOverdue
                        ? 'docs-deadlines-list__item docs-deadlines-list__item--overdue'
                        : 'docs-deadlines-list__item'
                    }
                  >
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

          <div className="docs-plan-assumption" role="note">
            <p className="docs-plan-assumption__text">
              Terminy zakładają <strong>domyślny, ciągły plan urlopów</strong> od{' '}
              {assumption.eventLabel}
              {assumption.eventDateFormatted ? ` (${assumption.eventDateFormatted})` : ''}. Jeśli
              ułożysz własny podział lub przerwę, licz terminy wniosków (
              {assumption.parentalAdvanceDays} dni przed urlopem rodzicielskim i{' '}
              {assumption.paternityAdvanceDays} dni przed ojcowskim) od swoich dat.
            </p>
            <Link to={`/plan/leave-plan${search}`} className="docs-plan-assumption__link">
              Zmień podział w sekcji Plan urlopów ›
            </Link>
          </div>

          {sorted.some((item) => Boolean(item.legalBasis)) && (
            <details className="docs-details docs-legal-details">
              <summary className="docs-details__summary">Podstawa prawna terminów</summary>
              <div className="docs-details__body">
                <ul className="docs-legal-list">
                  {sorted.map((item) => (
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
  );
}
