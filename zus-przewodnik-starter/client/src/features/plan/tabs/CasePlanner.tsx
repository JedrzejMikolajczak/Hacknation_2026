import { useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ApplicantRole, BenefitParams, CaseInputs, CasePlan } from '@shared/types';
import { formatRate } from '../../../app/benefitParams';
import {
  buildPresetParentalParts,
  computeParentalUsage,
  computeReturnToWorkDates,
  detectActivePreset,
  formatParentLeaveSummary,
  formatPolishDate,
  formatShortDeadlineLabel,
  getEditableParentalParts,
  getEventDate,
  getEventJumpLabel,
  getLeavePeriods,
  getParentAvailability,
  isChildLossNoParental,
  isSensitiveSituation,
  type LeavePlanPresetId,
} from '../../leavePlan/leavePlanHelpers';
import { LeaveSplitPlanner } from '../../leavePlan/LeaveSplitPlanner';
import { LeaveTimeline } from '../../leavePlan/LeaveTimeline';
import { buildCalendarMilestones, validateLeavePlan } from '../../leavePlan/leavePlanValidation';
import { type CalendarQuickJump, MonthlyCalendar } from '../../leavePlan/MonthlyCalendar';
import { todayIsoDate } from '../planScenario';
import './CasePlanner.css';

const STAGE_TO_SITUATION: Record<CaseInputs['stage'], string> = {
  PLANNING: 'planning',
  PREGNANCY: 'pregnant',
  POST_BIRTH: 'afterBirth',
  ADOPTION: 'adoption',
};

export function CasePlanner({
  input,
  plan,
  params,
  update,
}: {
  plan: CasePlan;
  input: CaseInputs;
  params: BenefitParams;
  update: (patch: Partial<CaseInputs>) => void;
}) {
  const location = useLocation();
  const eventDate = getEventDate(input);
  const leavePeriods = useMemo(() => getLeavePeriods(plan), [plan]);
  const parts = useMemo(() => getEditableParentalParts(input, plan), [input, plan]);
  const availability = useMemo(() => getParentAvailability(input, plan), [input, plan]);
  const sensitive = isSensitiveSituation(input);
  const childLossNoParental = isChildLossNoParental(input, plan);

  const usage = useMemo(
    () => computeParentalUsage(parts, input, plan, params),
    [parts, input, plan, params],
  );
  const activePreset = useMemo(
    () => detectActivePreset(parts, input, plan, params),
    [parts, input, plan, params],
  );
  const validationIssues = useMemo(
    () => validateLeavePlan(input, plan, parts, params),
    [input, plan, parts, params],
  );
  const returnDates = useMemo(() => computeReturnToWorkDates(leavePeriods), [leavePeriods]);
  const milestones = useMemo(
    () => buildCalendarMilestones(input, plan, returnDates),
    [input, plan, returnDates],
  );

  const upcomingDeadlines = useMemo(
    () => milestones.filter((m) => m.kind === 'deadline' && !m.isPast),
    [milestones],
  );
  const nextDeadline = upcomingDeadlines[0] ?? null;
  const pastDeadlines = useMemo(
    () => milestones.filter((m) => m.kind === 'deadline' && m.isPast),
    [milestones],
  );

  const rolesToShow: ApplicantRole[] = useMemo(() => {
    const list: ApplicantRole[] = [];
    const hasMother = leavePeriods.some((p) => p.parent_role === 'MOTHER');
    const hasFather = leavePeriods.some((p) => p.parent_role === 'FATHER');
    if (
      hasMother ||
      availability.motherAvailable ||
      (!hasFather && input.applicant_role === 'MOTHER')
    ) {
      list.push('MOTHER');
    }
    if (
      hasFather ||
      availability.fatherAvailable ||
      (!hasMother && input.applicant_role === 'FATHER')
    ) {
      list.push('FATHER');
    }
    return list;
  }, [
    leavePeriods,
    availability.motherAvailable,
    availability.fatherAvailable,
    input.applicant_role,
  ]);

  const parentSummaries = useMemo(
    () =>
      rolesToShow
        .map((role) => ({
          role,
          text: formatParentLeaveSummary(
            role,
            leavePeriods,
            returnDates[role],
            childLossNoParental ? null : usage.remainingByRole[role],
          ),
        }))
        .filter((item): item is { role: ApplicantRole; text: string } => item.text !== null),
    [rolesToShow, leavePeriods, returnDates, childLossNoParental, usage.remainingByRole],
  );

  const anchorMonthKey =
    eventDate ?? leavePeriods[0]?.start_date ?? input.reference_date ?? todayIsoDate();

  const [monthState, setMonthState] = useState<{
    anchorKey: string;
    focusedMonth: string;
    selectedDay: string | null;
  }>({
    anchorKey: anchorMonthKey,
    focusedMonth: anchorMonthKey.slice(0, 7),
    selectedDay: null,
  });

  const focusedMonth =
    monthState.anchorKey === anchorMonthKey ? monthState.focusedMonth : anchorMonthKey.slice(0, 7);
  const selectedDay = monthState.anchorKey === anchorMonthKey ? monthState.selectedDay : null;

  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarDetailsRef = useRef<HTMLDetailsElement>(null);

  function handleChangeMonth(monthIso: string) {
    setMonthState({
      anchorKey: anchorMonthKey,
      focusedMonth: monthIso,
      selectedDay: null,
    });
  }

  function handleSelectDay(isoDate: string | null) {
    setMonthState({
      anchorKey: anchorMonthKey,
      focusedMonth,
      selectedDay: isoDate,
    });
  }

  function handleJumpToDate(dateIso: string, openDayDetails = true) {
    setMonthState({
      anchorKey: anchorMonthKey,
      focusedMonth: dateIso.slice(0, 7),
      selectedDay: openDayDetails ? dateIso : null,
    });
    setCalendarOpen(true);
    const detailsEl = calendarDetailsRef.current;
    if (detailsEl && typeof detailsEl.scrollIntoView === 'function') {
      const reducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      detailsEl.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function handleSelectPreset(presetId: LeavePlanPresetId) {
    const presetParts = buildPresetParentalParts(presetId, input, plan, params);
    if (presetParts.length > 0) {
      update({ parental_leave_parts: presetParts });
    }
  }

  const quickJumps: CalendarQuickJump[] = useMemo(() => {
    const jumps: CalendarQuickJump[] = [];
    if (eventDate) {
      jumps.push({ label: getEventJumpLabel(input), monthIso: eventDate.slice(0, 7) });
    }
    const firstParental = leavePeriods.find(
      (p) => p.leave_type === 'PARENTAL' || p.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION',
    );
    if (firstParental) {
      jumps.push({
        label: 'Start rodzicielskiego',
        monthIso: firstParental.start_date.slice(0, 7),
      });
    }
    const firstFather = leavePeriods.find((p) => p.parent_role === 'FATHER');
    if (firstFather) {
      jumps.push({ label: 'Start urlopu taty', monthIso: firstFather.start_date.slice(0, 7) });
    }
    if (returnDates.MOTHER) {
      jumps.push({
        label: 'Powrót do pracy (Mama)',
        monthIso: returnDates.MOTHER.slice(0, 7),
      });
    } else if (returnDates.FATHER) {
      jumps.push({
        label: 'Powrót do pracy (Tata)',
        monthIso: returnDates.FATHER.slice(0, 7),
      });
    }
    return jumps;
  }, [eventDate, input, leavePeriods, returnDates.MOTHER, returnDates.FATHER]);

  const wizardHref = `/wizard?situation=${STAGE_TO_SITUATION[input.stage]}`;
  const nextTabHref = `/plan/documents${location.search}`;

  if (!eventDate && leavePeriods.length === 0) {
    return (
      <div className="lp-view">
        <h2 className="lp-section-heading">Plan urlopów</h2>
        <section className="lp-answer lp-answer--missing" aria-labelledby="missing-data-heading">
          <h3 id="missing-data-heading" className="lp-answer__title">
            Uzupełnij dane do planu urlopów
          </h3>
          <p className="lp-answer__lead">
            Nie przyjmujemy fikcyjnych dat ani kwot. Aby przygotować oś czasu, gotowe scenariusze i
            kalendarz urlopów, uzupełnij:
          </p>
          <ul className="lp-missing-data__list">
            <li>
              {input.stage === 'ADOPTION'
                ? 'Datę przyjęcia dziecka na wychowanie.'
                : input.stage === 'POST_BIRTH'
                  ? 'Datę porodu.'
                  : 'Przewidywaną datę porodu.'}
            </li>
          </ul>
          <div className="lp-missing-data__actions">
            <Link to={wizardHref} className="plan-btn plan-btn--primary lp-missing-data__btn">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="lp-next-step lp-next-step--subtle" aria-label="Następny krok">
          <Link to={nextTabHref} className="lp-next-link">
            Dalej: Dokumenty i terminy ›
          </Link>
        </nav>
      </div>
    );
  }

  return (
    <div className="lp-view">
      {/* Kluczowa odpowiedź na górze (Answer first) */}
      <section className="lp-answer" aria-labelledby="leave-answer-heading">
        <h2 className="lp-section-heading">Plan urlopów</h2>
        <h3 id="leave-answer-heading" className="lp-answer__title">
          Plan urlopów w skrócie
        </h3>

        <div className="lp-answer__lines">
          {parentSummaries.length > 0 ? (
            parentSummaries.map((item) => (
              <p key={item.role} className="lp-answer__line">
                {item.text}
              </p>
            ))
          ) : (
            <p className="lp-answer__line">
              {plan.outcome.denial_or_reduction_reason_pl ??
                'Dla podanych danych nie zaplanowano okresów urlopu – sprawdź komunikaty poniżej.'}
            </p>
          )}
        </div>

        {nextDeadline && (
          <p className="lp-answer__deadline">
            <strong>Najbliższy termin:</strong>{' '}
            <button
              type="button"
              className="lp-inline-date-btn"
              onClick={() => handleJumpToDate(nextDeadline.date, true)}
            >
              {formatShortDeadlineLabel(nextDeadline.label)} do{' '}
              {formatPolishDate(nextDeadline.date)}
            </button>
          </p>
        )}

        {pastDeadlines.length > 0 && (
          <div className="lp-past-deadlines" aria-label="Minione terminy wniosków">
            <p className="lp-past-deadlines__summary">
              Termin minął. Sprawdź pozycje w zakładce Dokumenty i terminy.
            </p>
            <div className="lp-past-deadlines__list">
              {pastDeadlines.map((milestone, idx) => (
                <button
                  key={`${milestone.date}-${milestone.label}-${idx}`}
                  type="button"
                  className="lp-past-chip"
                  title={milestone.description}
                  onClick={() => handleJumpToDate(milestone.date, true)}
                >
                  <span className="lp-past-chip__badge">Termin minął</span>
                  <span>
                    {formatShortDeadlineLabel(milestone.label)} ({formatPolishDate(milestone.date)})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {sensitive && (
          <p className="lp-sensitive-note" role="status">
            {childLossNoParental
              ? 'Urlop rodzicielski nie przysługuje. W zakładce „Wsparcie” znajdziesz bezpłatną pomoc organizacji specjalistycznych.'
              : 'Przedstawiamy informacje o przysługujących okresach urlopu i terminach dokumentów. W zakładce „Wsparcie” znajdziesz bezpłatną pomoc.'}
          </p>
        )}

        <dl className="lp-answer__facts" aria-label="Podsumowanie planu urlopów">
          {!childLossNoParental && usage.poolWeeks > 0 && (
            <div className="lp-answer__fact">
              <dt>Wspólna pula rodzicielskiego</dt>
              <dd>
                <strong>{usage.poolWeeks} tyg.</strong>
                {plan.outcome.parental_deadline && (
                  <span className="lp-answer__fact-hint">
                    {' '}
                    (do {formatPolishDate(plan.outcome.parental_deadline)})
                  </span>
                )}
              </dd>
            </div>
          )}

          <div className="lp-answer__fact">
            <dt>Wariant stawki</dt>
            <dd>
              <strong>
                {plan.outcome.applied_payment_variant === 'COMBINED_81_5'
                  ? formatRate(params.rates.combined)
                  : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`}
              </strong>
              {plan.outcome.applied_payment_variant === 'COMBINED_81_5' && !childLossNoParental && (
                <span className="lp-answer__fact-hint">
                  {' '}
                  ({params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica:{' '}
                  {formatRate(params.rates.secondParentNonTransferableInCombined)})
                </span>
              )}
            </dd>
          </div>

          {!childLossNoParental && usage.poolWeeks > 0 && (
            <div className="lp-answer__fact">
              <dt>Pozostały rodzicielski</dt>
              <dd>
                Mama: <strong>{usage.remainingByRole.MOTHER} tyg.</strong>
                {availability.fatherAvailable && (
                  <>
                    {' '}
                    · Tata: <strong>{usage.remainingByRole.FATHER} tyg.</strong>
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div className="lp-sections">
        {/* Oś czasu obojga rodziców (widoczna na pierwszym ekranie) + lista okresów w <details> */}
        <LeaveTimeline
          periods={leavePeriods}
          rolesToShow={rolesToShow}
          onSelectDate={handleJumpToDate}
        />

        {/* Gotowe scenariusze podziału + ręczna edycja i łączenie z pracą w <details> */}
        <LeaveSplitPlanner
          input={input}
          plan={plan}
          params={params}
          parts={parts}
          activePreset={activePreset}
          motherAvailable={availability.motherAvailable}
          fatherAvailable={availability.fatherAvailable}
          validationIssues={validationIssues}
          onSelectPreset={handleSelectPreset}
          onUpdate={update}
        />

        {/* Kalendarz miesięczny zwinięty domyślnie w <details> */}
        <details
          ref={calendarDetailsRef}
          className="lp-details lp-details--card"
          open={calendarOpen}
          onToggle={(event) => setCalendarOpen(event.currentTarget.open)}
        >
          <summary className="lp-details__summary lp-details__summary--card">
            Pokaż kalendarz dzień po dniu
          </summary>
          <div className="lp-details__body">
            <MonthlyCalendar
              periods={leavePeriods}
              milestones={milestones}
              quickJumps={quickJumps}
              focusedMonth={focusedMonth}
              selectedDay={selectedDay}
              referenceDate={input.reference_date ?? null}
              onSelectDay={handleSelectDay}
              onChangeMonth={handleChangeMonth}
              onSelectMilestoneDate={(dateIso) => handleJumpToDate(dateIso, true)}
            />
          </div>
        </details>
      </div>

      {/* Jedno główne CTA prowadzące do kolejnej sekcji */}
      <nav className="lp-next-step" aria-label="Następny krok">
        <Link to={nextTabHref} className="plan-btn plan-btn--primary lp-next-step__btn">
          Dalej: Dokumenty i terminy ›
        </Link>
      </nav>
    </div>
  );
}
