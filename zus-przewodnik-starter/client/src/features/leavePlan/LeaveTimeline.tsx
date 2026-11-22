import { useState } from 'react';
import type { ApplicantRole, CasePeriod } from '@shared/types';
import { benefitLabels, parentLabels } from '../plan/caseLabels';
import {
  formatDaysPl,
  formatPln,
  formatPolishDate,
  formatRatePercent,
  formatWeeksPl,
  formatWorkFraction,
  getPlainParentLabel,
  getShortLeaveLabel,
} from './leavePlanHelpers';

interface LeaveTimelineProps {
  periods: CasePeriod[];
  rolesToShow: ApplicantRole[];
  onSelectDate: (isoDate: string, openDayDetails?: boolean) => void;
}

function toEpochDays(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getPeriodKind(period: CasePeriod): string {
  if (period.leave_type === 'PARENTAL_WORK_EXTENSION') return 'extension';
  if (period.work_fraction > 0) return 'with-work';
  if (period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION') {
    return 'parental';
  }
  if (period.leave_type === 'PATERNITY') return 'paternity';
  if (period.leave_type === 'SUPPLEMENTARY_MATERNITY') return 'supplementary';
  return 'maternity';
}

function getPeriodShortTitle(period: CasePeriod): string {
  const base = getShortLeaveLabel(period.leave_type);
  if (period.work_fraction > 0 && period.leave_type !== 'PARENTAL_WORK_EXTENSION') {
    return `${base} + praca`;
  }
  return base;
}

export function LeaveTimeline({ periods, rolesToShow, onSelectDate }: LeaveTimelineProps) {
  const [periodsOpen, setPeriodsOpen] = useState(
    () => window.matchMedia?.('(max-width: 639px)').matches ?? false,
  );

  if (periods.length === 0) {
    return (
      <section className="lp-card" aria-labelledby="timeline-heading">
        <h3 id="timeline-heading" className="lp-card__title">
          Oś czasu urlopów
        </h3>
        <p className="lp-card__empty">
          Brak zaplanowanych okresów urlopu. Wybierz gotowy podział poniżej lub sprawdź komunikaty
          walidacji.
        </p>
      </section>
    );
  }

  const allStarts = periods.map((p) => toEpochDays(p.start_date));
  const allEnds = periods.map((p) => toEpochDays(p.end_date));
  const minDay = Math.min(...allStarts);
  const maxDay = Math.max(...allEnds);
  const totalSpan = Math.max(1, maxDay - minDay + 1);
  const minIso = periods.reduce(
    (acc, p) => (p.start_date < acc ? p.start_date : acc),
    periods[0].start_date,
  );
  const maxIso = periods.reduce(
    (acc, p) => (p.end_date > acc ? p.end_date : acc),
    periods[0].end_date,
  );

  // Zawsze pokazujemy każdego rodzica obecnego w okresach + role z rolesToShow (data-driven)
  const roles: ApplicantRole[] = [];
  for (const candidate of ['MOTHER', 'FATHER'] as const) {
    if (
      rolesToShow.includes(candidate) ||
      periods.some((period) => period.parent_role === candidate)
    ) {
      roles.push(candidate);
    }
  }

  return (
    <section className="lp-card" aria-labelledby="timeline-heading">
      <div className="lp-timeline-header">
        <h3 id="timeline-heading" className="lp-card__title">
          Oś czasu urlopów
        </h3>
        <p className="lp-timeline-range">
          {formatPolishDate(minIso)} – {formatPolishDate(maxIso)}
        </p>
      </div>

      <div className="lp-rails">
        {roles.map((role) => {
          const rolePeriods = periods
            .filter((p) => p.parent_role === role)
            .sort((x, y) => x.start_date.localeCompare(y.start_date));
          const totalWeeks = rolePeriods.reduce((sum, p) => sum + p.weeks, 0);
          const laneAriaLabel =
            role === 'MOTHER' ? 'Oś czasu urlopów mamy' : 'Oś czasu urlopów taty';

          return (
            <div key={role} className={`lp-rail lp-rail--${role === 'MOTHER' ? 'mother' : 'father'}`}>
              <div className="lp-rail__head">
                <span className="lp-rail__who">{getPlainParentLabel(role)}</span>
                {rolePeriods.length > 0 && (
                  <span className="lp-rail__total">
                    {formatWeeksPl(Math.round(totalWeeks))} łącznie
                  </span>
                )}
              </div>
              {rolePeriods.length === 0 ? (
                <p className="lp-rail__empty">Brak zaplanowanych okresów</p>
              ) : (
                <ol className="lp-rail__list" aria-label={laneAriaLabel}>
                  {rolePeriods.map((period, idx) => {
                    const startOffset =
                      ((toEpochDays(period.start_date) - minDay) / totalSpan) * 100;
                    const rawWidth =
                      ((toEpochDays(period.end_date) - toEpochDays(period.start_date) + 1) /
                        totalSpan) *
                      100;
                    const widthPct = Math.min(100 - startOffset, Math.max(2, rawWidth));
                    const fullName = benefitLabels[period.leave_type];
                    const label = `${fullName} (${parentLabels[role]}), ${formatPolishDate(period.start_date)} – ${formatPolishDate(period.end_date)}, ${formatWeeksPl(period.weeks)} (${formatDaysPl(period.days)}), stawka ${formatRatePercent(period.rate_percent)}`;

                    return (
                      <li key={`${period.parent_role}-${period.leave_type}-${period.start_date}-${idx}`}>
                        <button
                          type="button"
                          className={`lp-stage lp-stage--${getPeriodKind(period)}`}
                          onClick={() => onSelectDate(period.start_date, true)}
                          aria-label={label}
                          title={label}
                        >
                          <span className="lp-stage__dot" aria-hidden="true" />
                          <span className="lp-stage__body">
                            <span className="lp-stage__top">
                              <span className="lp-stage__title">{getPeriodShortTitle(period)}</span>
                              <span className="lp-stage__rate">
                                {formatRatePercent(period.rate_percent)}
                              </span>
                            </span>
                            <span className="lp-stage__weeks">{formatWeeksPl(period.weeks)}</span>
                            <span className="lp-stage__dates">
                              {formatPolishDate(period.start_date)} –{' '}
                              {formatPolishDate(period.end_date)}
                            </span>
                            <span className="lp-stage__span" aria-hidden="true">
                              <span
                                className="lp-stage__span-fill"
                                style={{ left: `${startOffset}%`, width: `${widthPct}%` }}
                              />
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      <details
        className="lp-details"
        open={periodsOpen}
        onToggle={(event) => setPeriodsOpen(event.currentTarget.open)}
      >
        <summary className="lp-details__summary">Zobacz okresy i kwoty</summary>
        <div className="lp-details__body">
          <ul className="lp-period-list" aria-label="Szczegółowa lista okresów urlopu">
            {periods.map((period, idx) => {
              const isExtension = period.leave_type === 'PARENTAL_WORK_EXTENSION';
              const hasWork = period.work_fraction > 0;
              return (
                <li key={`${period.leave_type}-${period.parent_role}-${period.start_date}-${idx}`}>
                  <button
                    type="button"
                    className={[
                      'lp-period-item',
                      hasWork && !isExtension ? 'lp-period-item--with-work' : '',
                      isExtension ? 'lp-period-item--extension' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onSelectDate(period.start_date, true)}
                  >
                    <span
                      className={
                        period.parent_role === 'FATHER'
                          ? 'lp-period-item__role lp-period-item__role--father'
                          : 'lp-period-item__role'
                      }
                    >
                      {parentLabels[period.parent_role]}
                    </span>
                    <span className="lp-period-item__name">
                      {benefitLabels[period.leave_type]}
                      {hasWork && !isExtension && (
                        <span className="lp-period-item__work-badge">
                          + praca ({formatWorkFraction(period.work_fraction)})
                        </span>
                      )}
                      {isExtension && (
                        <span className="lp-period-item__ext-badge">
                          wydłużenie po pracy
                          {hasWork ? ` (${formatWorkFraction(period.work_fraction)})` : ''}
                        </span>
                      )}
                    </span>
                    <span className="lp-period-item__dates">
                      {formatPolishDate(period.start_date)} – {formatPolishDate(period.end_date)} (
                      {formatWeeksPl(period.weeks)} / {formatDaysPl(period.days)})
                    </span>
                    <span className="lp-period-item__rate">
                      Stawka: <strong>{formatRatePercent(period.rate_percent)}</strong>
                      {period.monthly_amount_pln === null ? (
                        <> · kwota po podaniu podstawy</>
                      ) : (
                        <>
                          {' '}
                          · {formatPln(period.monthly_amount_pln)}/30 dni
                          {period.total_amount_pln !== null && (
                            <> (łącznie {formatPln(period.total_amount_pln)})</>
                          )}
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </section>
  );
}
