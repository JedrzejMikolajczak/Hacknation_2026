import type { IsoDate } from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import {
  formatIsoPl,
  formatPlnAmount,
  formatWorkFraction,
  getLeaveTypeLabel,
  getParentRoleLabel,
} from './leavePlanHelpers';
import type { TimelineLeavePeriod } from './LeaveTimeline';
import type { TimelineMilestone } from './leavePlanValidation';

export interface CalendarQuickJump {
  label: string;
  monthIso: string; // 'YYYY-MM'
}

interface MonthlyCalendarProps {
  periods: TimelineLeavePeriod[];
  milestones: TimelineMilestone[];
  quickJumps: CalendarQuickJump[];
  focusedMonth: string; // 'YYYY-MM'
  selectedDay: string | null; // 'YYYY-MM-DD'
  referenceDate: IsoDate;
  onSelectDay: (isoDate: string | null) => void;
  onChangeMonth: (monthIso: string) => void;
  onSelectMilestoneDate?: (isoDate: string) => void;
}

const WEEKDAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

const monthTitleFormatter = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const fullDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function shiftMonth(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getMondayBasedWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function MonthlyCalendar({
  periods,
  milestones,
  quickJumps,
  focusedMonth,
  selectedDay,
  referenceDate,
  onSelectDay,
  onChangeMonth,
  onSelectMilestoneDate,
}: MonthlyCalendarProps) {
  const [year, month] = focusedMonth.split('-').map(Number);
  const daysCount = getDaysInMonth(year, month);
  const leadingEmpty = getMondayBasedWeekday(year, month, 1);

  const monthTitle = monthTitleFormatter.format(new Date(Date.UTC(year, month - 1, 1)));

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingEmpty }, () => null),
    ...Array.from({ length: daysCount }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  function getIsoForDay(day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function getActivePeriods(isoDate: string): TimelineLeavePeriod[] {
    return periods.filter((p) => isoDate >= p.startDate && isoDate <= p.endDate);
  }

  function getMilestonesForDay(isoDate: string): TimelineMilestone[] {
    return milestones.filter((m) => m.date === isoDate);
  }

  const activeDayPeriods = selectedDay ? getActivePeriods(selectedDay) : [];
  const activeDayMilestones = selectedDay ? getMilestonesForDay(selectedDay) : [];

  return (
    <div className="lp-calendar-inner" aria-labelledby="monthly-calendar-heading">
      <div className="lp-calendar-header">
        <div>
          <h3 id="monthly-calendar-heading" className="lp-calendar-inner__title">
            Kalendarz miesięczny
          </h3>
          <p className="lp-card__lead">
            Wybierz dzień, aby sprawdzić świadczenia, stawkę i terminy wniosków (stan na{' '}
            {formatIsoPl(referenceDate)}).
          </p>
        </div>

        <div className="lp-calendar-nav">
          <button
            type="button"
            className="lp-calendar-nav__btn"
            onClick={() => onChangeMonth(shiftMonth(focusedMonth, -1))}
            aria-label="Poprzedni miesiąc"
          >
            ‹ Poprzedni
          </button>
          <span className="lp-calendar-nav__title" aria-live="polite">
            {monthTitle}
          </span>
          <button
            type="button"
            className="lp-calendar-nav__btn"
            onClick={() => onChangeMonth(shiftMonth(focusedMonth, 1))}
            aria-label="Następny miesiąc"
          >
            Następny ›
          </button>
        </div>
      </div>

      {quickJumps.length > 0 && (
        <div className="lp-calendar-jumps" aria-label="Szybkie przejście do ważnych momentów">
          <span className="lp-calendar-jumps__label">Skocz do:</span>
          {quickJumps.map((jump) => (
            <button
              key={`${jump.monthIso}-${jump.label}`}
              type="button"
              className={
                focusedMonth === jump.monthIso
                  ? 'lp-calendar-jump-btn lp-calendar-jump-btn--active'
                  : 'lp-calendar-jump-btn'
              }
              onClick={() => onChangeMonth(jump.monthIso)}
            >
              {jump.label}
            </button>
          ))}
        </div>
      )}

      <div className="lp-calendar-grid-wrap">
        <div className="lp-calendar-grid" role="grid" aria-label={`Kalendarz: ${monthTitle}`}>
          {WEEKDAYS_PL.map((dayName) => (
            <div key={dayName} className="lp-calendar-weekday" role="columnheader">
              {dayName}
            </div>
          ))}

          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div key={`empty-${idx}`} className="lp-calendar-day lp-calendar-day--empty" />
              );
            }

            const isoDate = getIsoForDay(day);
            const dayPeriods = getActivePeriods(isoDate);
            const dayMilestones = getMilestonesForDay(isoDate);
            const hasMother = dayPeriods.some((p) => p.parentRole === 'mother');
            const hasFather = dayPeriods.some((p) => p.parentRole === 'father');
            const hasWork = dayPeriods.some((p) => Boolean(p.workTimeFraction));
            const hasDeadline = dayMilestones.some((m) => m.kind === 'deadline');
            const hasPastDeadline = dayMilestones.some((m) => m.kind === 'deadline' && m.isPast);
            const isSelected = selectedDay === isoDate;

            const roleBadge =
              hasMother && hasFather ? 'M+O' : hasMother ? 'M' : hasFather ? 'O' : '';

            const dayClasses = [
              'lp-calendar-day',
              hasMother ? 'lp-calendar-day--mother' : '',
              hasFather ? 'lp-calendar-day--father' : '',
              hasWork ? 'lp-calendar-day--work' : '',
              dayMilestones.length > 0 ? 'lp-calendar-day--milestone' : '',
              hasDeadline ? 'lp-calendar-day--deadline' : '',
              hasPastDeadline ? 'lp-calendar-day--past-deadline' : '',
              isSelected ? 'lp-calendar-day--selected' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const formattedFull = fullDateFormatter.format(
              new Date(Date.UTC(year, month - 1, day)),
            );
            const ariaParts = [formattedFull];
            if (dayPeriods.length > 0) {
              ariaParts.push(
                dayPeriods
                  .map((p) => {
                    const base = `${getLeaveTypeLabel(p.leaveType)} (${getParentRoleLabel(p.parentRole)})`;
                    if (p.workTimeFraction) return `${base} + praca`;
                    if (p.isWorkExtension) return `${base} (wydłużenie)`;
                    return base;
                  })
                  .join(', '),
              );
            }
            if (dayMilestones.length > 0) {
              ariaParts.push(
                dayMilestones
                  .map((m) =>
                    m.kind === 'deadline'
                      ? `${m.isPast ? 'Termin minął' : 'Termin złożenia wniosku'}: ${m.label}`
                      : m.label,
                  )
                  .join(', '),
              );
            }

            return (
              <button
                key={isoDate}
                type="button"
                className={dayClasses}
                aria-label={ariaParts.join(' – ')}
                aria-pressed={isSelected}
                onClick={() => onSelectDay(isSelected ? null : isoDate)}
              >
                <span className="lp-calendar-day__num">{day}</span>
                <span className="lp-calendar-day__badges" aria-hidden="true">
                  {roleBadge && <span className="lp-calendar-day__role">{roleBadge}</span>}
                  {hasWork && <span className="lp-calendar-day__work">+P</span>}
                  {hasPastDeadline ? (
                    <span className="lp-calendar-day__past-badge">Min.</span>
                  ) : hasDeadline ? (
                    <span className="lp-calendar-day__deadline-badge">Wn.</span>
                  ) : (
                    dayMilestones.length > 0 && <span className="lp-calendar-day__star">★</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lp-calendar-legend" aria-label="Legenda kalendarza">
        <span className="lp-legend-item">
          <span className="lp-legend-swatch lp-legend-swatch--mother" aria-hidden="true">
            M
          </span>
          Urlop Matki
        </span>
        <span className="lp-legend-item">
          <span className="lp-legend-swatch lp-legend-swatch--father" aria-hidden="true">
            O
          </span>
          Urlop Ojca
        </span>
        <span className="lp-legend-item">
          <span className="lp-legend-swatch lp-legend-swatch--work" aria-hidden="true">
            +P
          </span>
          Praca w trakcie urlopu
        </span>
        <span className="lp-legend-item">
          <span className="lp-legend-swatch lp-legend-swatch--deadline" aria-hidden="true">
            Wn.
          </span>
          Termin złożenia wniosku
        </span>
        <span className="lp-legend-item">
          <span className="lp-legend-swatch lp-legend-swatch--past" aria-hidden="true">
            Min.
          </span>
          Termin już minął
        </span>
      </div>

      {selectedDay && (
        <div className="lp-calendar-day-details" aria-live="polite">
          <div className="lp-calendar-day-details__header">
            <h4 className="lp-calendar-day-details__title">
              Szczegóły dla dnia:{' '}
              {fullDateFormatter.format(
                new Date(
                  Date.UTC(
                    Number(selectedDay.slice(0, 4)),
                    Number(selectedDay.slice(5, 7)) - 1,
                    Number(selectedDay.slice(8, 10)),
                  ),
                ),
              )}
            </h4>
            <button
              type="button"
              className="lp-calendar-day-details__close"
              onClick={() => onSelectDay(null)}
            >
              Zamknij
            </button>
          </div>

          {activeDayMilestones.length > 0 && (
            <div className="lp-calendar-day-details__milestones">
              {activeDayMilestones.map((m) => (
                <div
                  key={`${m.date}-${m.label}`}
                  className={[
                    'lp-deadline-callout',
                    m.kind === 'event' ? 'lp-deadline-callout--event' : '',
                    m.isPast ? 'lp-deadline-callout--past' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <strong>
                    {m.isPast
                      ? 'Termin minął: '
                      : m.kind === 'deadline'
                        ? 'Termin złożenia wniosku: '
                        : 'Wydarzenie: '}
                    {m.label}
                  </strong>
                  {m.isPast && (
                    <p className="lp-deadline-callout__past-note">
                      Ten termin ({formatIsoPl(m.date)}) przypadł przed datą odniesienia (
                      {formatIsoPl(referenceDate)}).
                    </p>
                  )}
                  <p className="lp-deadline-callout__desc">
                    {m.description}
                    {m.legalBasis && <span className="lp-legal"> ({m.legalBasis})</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeDayPeriods.length > 0 ? (
            <ul className="lp-calendar-day-details__list">
              {activeDayPeriods.map((p, idx) => (
                <li key={`${p.leaveType}-${p.parentRole}-${idx}`}>
                  <strong>{getParentRoleLabel(p.parentRole)}</strong> –{' '}
                  {getLeaveTypeLabel(p.leaveType)} (stawka {formatRate(p.rate)}
                  {p.missingBase
                    ? ', uzupełnij podstawę dla kwoty'
                    : `, ${formatPlnAmount(p.monthlyAmount)}/mies.`}
                  )
                  {p.workTimeFraction
                    ? ` · praca ${formatWorkFraction(p.workTimeFraction)}`
                    : p.isWorkExtension
                      ? ' · wydłużenie po pracy'
                      : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="lp-calendar-day-details__empty">Brak aktywnego urlopu w tym dniu.</p>
          )}
        </div>
      )}

      {milestones.length > 0 && onSelectMilestoneDate && (
        <div className="lp-calendar-milestones" aria-label="Wszystkie terminy i ważne daty">
          <h4 className="lp-calendar-milestones__title">Wszystkie terminy i ważne daty</h4>
          <div className="lp-milestones">
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
                onClick={() => onSelectMilestoneDate(milestone.date)}
              >
                {milestone.isPast ? (
                  <span className="lp-milestone-chip__past">Termin minął</span>
                ) : (
                  milestone.kind === 'deadline' && (
                    <span className="lp-milestone-chip__kind">Termin</span>
                  )
                )}
                <span className="lp-milestone-chip__date">{formatIsoPl(milestone.date)}</span>
                <span className="lp-milestone-chip__text">{milestone.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
