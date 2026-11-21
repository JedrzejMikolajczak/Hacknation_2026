import type { IsoDate, LeavePeriod, ParentRole } from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import {
  formatIsoPl,
  formatPlnAmount,
  formatWorkFraction,
  getLeaveTypeLabel,
  getParentRoleLabel,
  getShortParentRoleLabel,
} from './leavePlanHelpers';
import type { TimelineMilestone } from './leavePlanValidation';

export interface TimelineLeavePeriod extends LeavePeriod {
  workTimeFraction?: number;
  isWorkExtension?: boolean;
  missingBase?: boolean;
}

interface LeaveTimelineProps {
  periods: TimelineLeavePeriod[];
  milestones: TimelineMilestone[];
  referenceDate: IsoDate;
  hasFather: boolean;
  onSelectDate: (isoDate: string, openDayDetails?: boolean) => void;
}

function toEpochDays(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getPeriodKindClass(period: TimelineLeavePeriod): string {
  if (period.workTimeFraction) return 'lp-timeline-bar--with-work';
  if (period.isWorkExtension) return 'lp-timeline-bar--extension';
  if (period.leaveType === 'parentalLeave') return 'lp-timeline-bar--parental';
  if (period.leaveType === 'paternityLeave') return 'lp-timeline-bar--paternity';
  if (period.leaveType === 'supplementaryMaternityLeave') return 'lp-timeline-bar--supplementary';
  return 'lp-timeline-bar--maternity';
}

function getPeriodDisplayName(period: TimelineLeavePeriod): string {
  const base = getLeaveTypeLabel(period.leaveType);
  if (period.workTimeFraction) {
    return `${base} + praca (${formatWorkFraction(period.workTimeFraction)})`;
  }
  if (period.isWorkExtension) {
    return `${base} (wydłużenie po pracy)`;
  }
  return base;
}

export function LeaveTimeline({
  periods,
  milestones,
  referenceDate,
  hasFather,
  onSelectDate,
}: LeaveTimelineProps) {
  if (periods.length === 0) {
    return (
      <section className="lp-card" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="lp-card__title">
          Oś czasu urlopów obojga rodziców
        </h2>
        <p className="lp-card__empty">
          Brak zaplanowanych okresów urlopu. Dodaj część urlopu poniżej lub uzupełnij dane w
          kreatorze, aby zobaczyć oś czasu.
        </p>
      </section>
    );
  }

  const allStarts = periods.map((p) => toEpochDays(p.startDate));
  const allEnds = periods.map((p) => toEpochDays(p.endDate));
  const minDay = Math.min(...allStarts);
  const maxDay = Math.max(...allEnds);
  const totalSpan = Math.max(1, maxDay - minDay + 1);

  const roles: ParentRole[] = ['mother', 'father'];

  return (
    <section className="lp-card" aria-labelledby="timeline-heading">
      <div className="lp-card__header">
        <div>
          <h2 id="timeline-heading" className="lp-card__title">
            Oś czasu urlopów obojga rodziców
          </h2>
          <p className="lp-card__lead">
            Kliknij wybrany okres lub termin złożenia wniosku, aby przejść do niego w kalendarzu
            miesięcznym. Data odniesienia dla terminów: {formatIsoPl(referenceDate)}.
          </p>
        </div>

        {milestones.length > 0 && (
          <div className="lp-milestones" aria-label="Ważne daty i terminy wniosków">
            {milestones.map((milestone) => (
              <button
                key={`${milestone.date}-${milestone.label}`}
                type="button"
                className={[
                  'lp-milestone-chip',
                  milestone.kind === 'deadline' ? 'lp-milestone-chip--deadline' : '',
                  milestone.isPast ? 'lp-milestone-chip--past' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={milestone.description}
                onClick={() => onSelectDate(milestone.date, true)}
              >
                {milestone.isPast ? (
                  <span className="lp-milestone-chip__past">Termin minął</span>
                ) : (
                  milestone.kind === 'deadline' && (
                    <span className="lp-milestone-chip__kind">Termin wniosku</span>
                  )
                )}
                <span className="lp-milestone-chip__date">{formatIsoPl(milestone.date)}</span>
                <span className="lp-milestone-chip__text">{milestone.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Widok osi poziomej z bezpiecznym przewijaniem na mniejszych ekranach */}
      <div className="lp-timeline-tracks-wrap">
        <div
          className="lp-timeline-tracks"
          role="region"
          aria-label="Oś czasu w podziale na rodziców"
        >
          {roles.map((role) => {
            const rolePeriods = periods.filter((p) => p.parentRole === role);
            const laneAriaLabel =
              role === 'mother' ? 'Oś czasu urlopów matki' : 'Oś czasu urlopów drugiego rodzica';
            return (
              <div key={role} className="lp-timeline-track">
                <div className="lp-timeline-track__label">{getShortParentRoleLabel(role)}</div>
                <div className="lp-timeline-track__lane" aria-label={laneAriaLabel}>
                  {rolePeriods.length === 0 ? (
                    <span className="lp-timeline-track__empty">
                      {role === 'father' && !hasFather
                        ? 'Drugi rodzic nie jest uwzględniony w planie'
                        : 'Brak zaplanowanych okresów'}
                    </span>
                  ) : (
                    rolePeriods.map((period, idx) => {
                      const startOffset =
                        ((toEpochDays(period.startDate) - minDay) / totalSpan) * 100;
                      const rawWidth =
                        ((toEpochDays(period.endDate) - toEpochDays(period.startDate) + 1) /
                          totalSpan) *
                        100;
                      const widthPct = Math.min(100 - startOffset, Math.max(5, rawWidth));
                      const label = getPeriodDisplayName(period);
                      return (
                        <button
                          key={`${period.leaveType}-${period.startDate}-${period.isWorkExtension ? 'ext' : 'base'}-${idx}`}
                          type="button"
                          className={`lp-timeline-bar ${getPeriodKindClass(period)}`}
                          style={{ left: `${startOffset}%`, width: `${widthPct}%` }}
                          onClick={() => onSelectDate(period.startDate, true)}
                          title={`${label} (${getParentRoleLabel(role)}): ${formatIsoPl(period.startDate)} – ${formatIsoPl(period.endDate)}, ${period.weeks} tyg. (${period.days} dni), stawka ${formatRate(period.rate)}`}
                        >
                          <span className="lp-timeline-bar__title">{label}</span>
                          <span className="lp-timeline-bar__meta">
                            {period.weeks} tyg. · {formatRate(period.rate)}
                            {period.workTimeFraction ? ' · Praca' : ''}
                            {period.isWorkExtension ? ' · Wydłużenie' : ''}
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

      {/* Czytelna lista okresów ze stawkami i kwotami z API (podstawowy widok na mobile) */}
      <ul className="lp-period-list" aria-label="Szczegółowa lista okresów urlopu">
        {periods.map((period, idx) => (
          <li
            key={`${period.leaveType}-${period.parentRole}-${period.startDate}-${period.isWorkExtension ? 'ext' : 'base'}-${idx}`}
          >
            <button
              type="button"
              className={[
                'lp-period-item',
                period.workTimeFraction ? 'lp-period-item--with-work' : '',
                period.isWorkExtension ? 'lp-period-item--extension' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(period.startDate, true)}
            >
              <span
                className={
                  period.parentRole === 'father'
                    ? 'lp-period-item__role lp-period-item__role--father'
                    : 'lp-period-item__role'
                }
              >
                {getShortParentRoleLabel(period.parentRole)}
              </span>
              <span className="lp-period-item__name">
                {getLeaveTypeLabel(period.leaveType)}
                {period.workTimeFraction && (
                  <span className="lp-period-item__work-badge">
                    + praca ({formatWorkFraction(period.workTimeFraction)})
                  </span>
                )}
                {period.isWorkExtension && (
                  <span className="lp-period-item__ext-badge">wydłużenie po pracy</span>
                )}
              </span>
              <span className="lp-period-item__dates">
                {formatIsoPl(period.startDate)} – {formatIsoPl(period.endDate)} ({period.weeks} tyg.
                / {period.days} dni)
              </span>
              <span className="lp-period-item__rate">
                Stawka: <strong>{formatRate(period.rate)}</strong>
                {period.missingBase ? (
                  <> · uzupełnij podstawę, aby wyliczyć kwotę</>
                ) : (
                  <>
                    {' '}
                    · {formatPlnAmount(period.monthlyAmount)}/mies. (łącznie{' '}
                    {formatPlnAmount(period.totalAmount)})
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
