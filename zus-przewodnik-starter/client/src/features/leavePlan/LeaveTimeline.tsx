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

function getPeriodKindClass(period: CasePeriod): string {
  if (period.leave_type === 'PARENTAL_WORK_EXTENSION') return 'lp-timeline-bar--extension';
  if (period.work_fraction > 0) return 'lp-timeline-bar--with-work';
  if (period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION') {
    return 'lp-timeline-bar--parental';
  }
  if (period.leave_type === 'PATERNITY') return 'lp-timeline-bar--paternity';
  if (period.leave_type === 'SUPPLEMENTARY_MATERNITY') return 'lp-timeline-bar--supplementary';
  return 'lp-timeline-bar--maternity';
}

function getPeriodShortTitle(period: CasePeriod): string {
  const base = getShortLeaveLabel(period.leave_type);
  if (period.work_fraction > 0 && period.leave_type !== 'PARENTAL_WORK_EXTENSION') {
    return `${base} + praca`;
  }
  return base;
}

function assignSubRows(rolePeriods: CasePeriod[]): { period: CasePeriod; row: number }[] {
  const sorted = [...rolePeriods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const rowEnds: string[] = [];
  return sorted.map((period) => {
    let row = rowEnds.findIndex((end) => period.start_date > end);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(period.end_date);
    } else {
      rowEnds[row] = period.end_date;
    }
    return { period, row };
  });
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

  // Legenda: jeden wpis na rodzaj urlopu obecny na osi (kolor/obrys paska → nazwa)
  const legend: { kind: string; label: string }[] = [];
  for (const period of periods) {
    const kind = getPeriodKindClass(period);
    if (!legend.some((item) => item.kind === kind)) {
      legend.push({ kind, label: getPeriodShortTitle(period) });
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

      <div className="lp-timeline-tracks-wrap">
        <div
          className="lp-timeline-tracks"
          role="region"
          aria-label="Oś czasu w podziale na rodziców"
        >
          {roles.map((role) => {
            const rolePeriods = periods.filter((p) => p.parent_role === role);
            const positioned = assignSubRows(rolePeriods);
            const rowCount = Math.max(1, ...positioned.map((item) => item.row + 1));
            const laneAriaLabel =
              role === 'MOTHER' ? 'Oś czasu urlopów mamy' : 'Oś czasu urlopów taty';

            return (
              <div key={role} className="lp-timeline-track">
                <div className="lp-timeline-track__label">{getPlainParentLabel(role)}</div>
                <div
                  className="lp-timeline-track__lane"
                  aria-label={laneAriaLabel}
                  style={{ minHeight: `${rowCount * 4.5}rem` }}
                >
                  {positioned.length === 0 ? (
                    <span className="lp-timeline-track__empty">Brak zaplanowanych okresów</span>
                  ) : (
                    positioned.map(({ period, row }, idx) => {
                      const startOffset =
                        ((toEpochDays(period.start_date) - minDay) / totalSpan) * 100;
                      const rawWidth =
                        ((toEpochDays(period.end_date) - toEpochDays(period.start_date) + 1) /
                          totalSpan) *
                        100;
                      const widthPct = Math.min(100 - startOffset, Math.max(6, rawWidth));
                      const shortTitle = getPeriodShortTitle(period);
                      const fullName = benefitLabels[period.leave_type];
                      const label = `${fullName} (${parentLabels[role]}), ${formatPolishDate(period.start_date)} – ${formatPolishDate(period.end_date)}, ${formatWeeksPl(period.weeks)} (${formatDaysPl(period.days)}), stawka ${formatRatePercent(period.rate_percent)}`;
                      const topPct = (row / rowCount) * 100;
                      const heightPct = 100 / rowCount;

                      return (
                        <button
                          key={`${period.parent_role}-${period.leave_type}-${period.start_date}-${idx}`}
                          type="button"
                          className={`lp-timeline-bar ${getPeriodKindClass(period)}`}
                          style={{
                            left: `${startOffset}%`,
                            width: `${widthPct}%`,
                            top: rowCount > 1 ? `calc(${topPct}% + 2px)` : undefined,
                            height: rowCount > 1 ? `calc(${heightPct}% - 4px)` : undefined,
                            bottom: rowCount > 1 ? 'auto' : undefined,
                          }}
                          onClick={() => onSelectDate(period.start_date, true)}
                          aria-label={label}
                          title={label}
                        >
                          <span className="lp-timeline-bar__title">{shortTitle}</span>
                          <span className="lp-timeline-bar__meta">
                            <span className="lp-timeline-bar__weeks">{formatWeeksPl(period.weeks)}</span>
                            <span className="lp-timeline-bar__rate">
                              {' · '}
                              {formatRatePercent(period.rate_percent)}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="lp-timeline-legend" aria-hidden="true">
        {legend.map((item) => (
          <li key={item.kind} className="lp-timeline-legend__item">
            <span className={`lp-timeline-legend__swatch ${item.kind}`} />
            {item.label}
          </li>
        ))}
      </ul>

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
