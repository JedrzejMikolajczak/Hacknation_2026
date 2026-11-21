import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  BenefitParams,
  LeavePartRequest,
  MaternityCalculationResult,
  ParentalSplitResult,
  ParentalWithWorkResult,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { fetchParentalSplit, fetchParentalWithWork } from '../plan/planApi';
import {
  addDaysIso,
  buildPresetParentalParts,
  computeReturnToWorkDates,
  DAYS_IN_WEEK,
  formatIsoPl,
  formatParentLeaveSummary,
  formatShortDeadlineLabel,
  getAnchorDate,
  getAnchorJumpLabel,
  getScenarioDataIssues,
  hasFatherInPlan,
  isParentInsured,
  isSensitiveSituation,
  isSingleChildLoss,
  sortPartsWithWork,
  type LeavePlanPresetId,
} from './leavePlanHelpers';
import { LeaveSplitPlanner } from './LeaveSplitPlanner';
import { LeaveTimeline, type TimelineLeavePeriod } from './LeaveTimeline';
import {
  buildMilestones,
  validateMaternityOptions,
  validateParentalParts,
  validatePaternityPlan,
  validateSupplementaryLeave,
  type MaternityPlanOptions,
  type PaternityPartPlan,
} from './leavePlanValidation';
import { type CalendarQuickJump, MonthlyCalendar } from './MonthlyCalendar';
import './LeavePlanView.css';

export interface LeavePlanViewProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  usingApi?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Nie udało się przeliczyć planu urlopów. Spróbuj ponownie.';
}

export function LeavePlanView({ scenario, params, maternity, usingApi }: LeavePlanViewProps) {
  const location = useLocation();
  const dataIssues = useMemo(() => getScenarioDataIssues(scenario), [scenario]);
  const anchorDate = getAnchorDate(scenario);
  const sensitive = isSensitiveSituation(scenario);
  const singleChildLoss = isSingleChildLoss(scenario);
  const fatherAvailable = hasFatherInPlan(scenario) && isParentInsured(scenario.father);

  const defaultPreset: LeavePlanPresetId | null = singleChildLoss
    ? null
    : fatherAvailable
      ? 'classic'
      : 'onlyMother';

  const scenarioSyncKey = useMemo(
    () =>
      JSON.stringify({
        situation: scenario.situation,
        anchorDate,
        childrenCount: scenario.childrenCount,
        zaZyciem: scenario.special.zaZyciemCertificate,
        stillbirth: scenario.special.stillbirth,
        childDeathDate: scenario.special.childDeathDate,
        fatherPresent: fatherAvailable,
        motherInsured: isParentInsured(scenario.mother),
        motherDeceased: scenario.special.motherDeceased,
        maternityEnd: maternity.periods
          .filter((p) => p.leaveType !== 'parentalLeave' && p.leaveType !== 'paternityLeave')
          .map((p) => p.endDate)
          .sort()
          .at(-1),
      }),
    [scenario, anchorDate, fatherAvailable, maternity.periods],
  );

  const defaultPartsForSync = useMemo(
    () =>
      defaultPreset
        ? sortPartsWithWork(
            buildPresetParentalParts(defaultPreset, scenario, maternity, params),
            {},
          ).sortedParts
        : [],
    [defaultPreset, scenario, maternity, params],
  );

  const [planOverride, setPlanOverride] = useState<{
    syncKey: string;
    activePreset: LeavePlanPresetId | null;
    parts: LeavePartRequest[];
    workByPartIndex: Record<number, number>;
    customPaternityParts: PaternityPartPlan[] | null;
  } | null>(null);

  const hasMatchingOverride = planOverride !== null && planOverride.syncKey === scenarioSyncKey;
  const activePreset = hasMatchingOverride ? planOverride.activePreset : defaultPreset;
  const parts = hasMatchingOverride ? planOverride.parts : defaultPartsForSync;
  const workByPartIndex = useMemo(
    () => (hasMatchingOverride ? planOverride.workByPartIndex : {}),
    [hasMatchingOverride, planOverride],
  );
  const customPaternityParts = hasMatchingOverride ? planOverride.customPaternityParts : null;

  const [splitResult, setSplitResult] = useState<ParentalSplitResult | null>(null);
  const [withWorkResults, setWithWorkResults] = useState<Record<number, ParentalWithWorkResult>>(
    {},
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const calendarDetailsRef = useRef<HTMLDetailsElement>(null);

  const [maternityOptions, setMaternityOptions] = useState<MaternityPlanOptions>({
    weeksBeforeBirth: 0,
    transferToFather: false,
    motherWeeksAfterBirth: params.maternityLeave.motherMandatoryWeeksAfterBirth,
    supplementaryParent: 'mother',
  });

  const enginePaternityParts: PaternityPartPlan[] = useMemo(
    () =>
      maternity.periods
        .filter((p) => p.leaveType === 'paternityLeave')
        .map((p) => ({ startDate: p.startDate, weeks: p.weeks })),
    [maternity.periods],
  );
  const activePaternityParts = customPaternityParts ?? enginePaternityParts;

  const currentAnchorKey = anchorDate ?? scenario.referenceDate;
  const [monthState, setMonthState] = useState<{
    anchorKey: string;
    focusedMonth: string;
    selectedDay: string | null;
  }>({
    anchorKey: currentAnchorKey,
    focusedMonth: currentAnchorKey.slice(0, 7),
    selectedDay: null,
  });

  const focusedMonth =
    monthState.anchorKey === currentAnchorKey
      ? monthState.focusedMonth
      : currentAnchorKey.slice(0, 7);
  const selectedDay = monthState.anchorKey === currentAnchorKey ? monthState.selectedDay : null;

  const requestSeqRef = useRef(0);

  const computeSplitAndWork = useCallback(
    async (targetParts: LeavePartRequest[], targetWorkMap: Record<number, number>, seq: number) => {
      if (dataIssues.blockingMessages.length > 0) {
        setLoading(false);
        setApiError(null);
        setSplitResult(null);
        setWithWorkResults({});
        return;
      }

      setLoading(true);
      setApiError(null);

      try {
        const parentalOnly = targetParts.filter((part) => part.leaveType === 'parentalLeave');
        const workEntries = Object.entries(targetWorkMap).filter(([idxStr]) => {
          const part = parentalOnly[Number(idxStr)];
          return Boolean(part && part.leaveType === 'parentalLeave');
        });

        const [splitData, workPairs] = await Promise.all([
          fetchParentalSplit({ scenario, parts: parentalOnly }, params),
          Promise.all(
            workEntries.map(async ([idxStr, fraction]) => {
              const idx = Number(idxStr);
              const part = parentalOnly[idx];
              const res = await fetchParentalWithWork(
                {
                  scenario,
                  parentRole: part.parentRole,
                  workTimeFraction: fraction,
                  startDate: part.startDate,
                  weeks: part.weeks,
                },
                params,
              );
              return [idx, res] as const;
            }),
          ),
        ]);

        if (requestSeqRef.current !== seq) return;

        const nextWorkResults: Record<number, ParentalWithWorkResult> = {};
        for (const [idx, res] of workPairs) {
          nextWorkResults[idx] = res;
        }
        setSplitResult(splitData);
        setWithWorkResults(nextWorkResults);
      } catch (error) {
        if (requestSeqRef.current !== seq) return;
        setApiError(getErrorMessage(error));
      } finally {
        if (requestSeqRef.current === seq) {
          setLoading(false);
        }
      }
    },
    [scenario, params, dataIssues.blockingMessages.length],
  );

  useEffect(() => {
    const seq = ++requestSeqRef.current;
    void computeSplitAndWork(parts, workByPartIndex, seq);
    return () => {
      // Unieważnienie starszego żądania przy odmontowaniu lub nowej zmianie
      requestSeqRef.current += 1;
    };
  }, [parts, workByPartIndex, computeSplitAndWork, retryCounter]);

  function handleRetry() {
    setRetryCounter((count) => count + 1);
  }

  function handleChangeMonth(monthIso: string) {
    setMonthState({
      anchorKey: currentAnchorKey,
      focusedMonth: monthIso,
      selectedDay: null,
    });
  }

  function handleSelectDay(isoDate: string | null) {
    setMonthState({
      anchorKey: currentAnchorKey,
      focusedMonth,
      selectedDay: isoDate,
    });
  }

  function handleSelectTimelineDate(dateIso: string, openDayDetails = false) {
    setMonthState({
      anchorKey: currentAnchorKey,
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

  function handleUpdateParts(
    rawNextParts: LeavePartRequest[],
    presetId: LeavePlanPresetId | null = null,
    rawNextWorkMap: Record<number, number> = workByPartIndex,
  ) {
    const { sortedParts, sortedWorkMap } = sortPartsWithWork(rawNextParts, rawNextWorkMap);
    setPlanOverride({
      syncKey: scenarioSyncKey,
      activePreset: presetId,
      parts: sortedParts,
      workByPartIndex: sortedWorkMap,
      customPaternityParts,
    });
  }

  function handleSelectPreset(presetId: LeavePlanPresetId) {
    const presetParts = buildPresetParentalParts(presetId, scenario, maternity, params);
    handleUpdateParts(presetParts, presetId, {});
  }

  function handleChangeWorkForPart(partIndex: number, workTimeFraction: number | null) {
    const nextWorkMap = { ...workByPartIndex };
    if (workTimeFraction === null) {
      delete nextWorkMap[partIndex];
    } else {
      nextWorkMap[partIndex] = workTimeFraction;
    }
    setPlanOverride({
      syncKey: scenarioSyncKey,
      activePreset,
      parts,
      workByPartIndex: nextWorkMap,
      customPaternityParts,
    });
  }

  function handleChangePaternityParts(next: PaternityPartPlan[] | null) {
    setPlanOverride({
      syncKey: scenarioSyncKey,
      activePreset,
      parts,
      workByPartIndex,
      customPaternityParts: next,
    });
  }

  // Złączenie okresów BEZ podwójnego liczenia:
  // – z `maternity.periods` bierzemy wyłącznie okresy NIE-rodzicielskie (macierzyński / na warunkach, uzupełniający, ojcowski);
  // – okresy urlopu rodzicielskiego bierzemy WYŁĄCZNIE z `splitResult.periods` (z rozwinięciem obu części przy pracy).
  const combinedPeriods: TimelineLeavePeriod[] = useMemo(() => {
    const motherMissingBase = scenario.mother.benefitBase === null;
    const fatherMissingBase = (scenario.father?.benefitBase ?? null) === null;

    const nonParentalBase: TimelineLeavePeriod[] = [];
    const enginePaternityPeriod = maternity.periods.find((p) => p.leaveType === 'paternityLeave');

    for (const period of maternity.periods) {
      if (period.leaveType === 'parentalLeave') {
        continue; // Rodzicielski pochodzi WYŁĄCZNIE ze splitResult!
      }
      if (period.leaveType === 'paternityLeave' && customPaternityParts !== null) {
        continue; // Zostanie zastąpiony spersonalizowanym planem ojcowskiego bez duplikacji
      }

      const displayRole =
        period.leaveType === 'supplementaryMaternityLeave' && scenario.father
          ? maternityOptions.supplementaryParent
          : period.parentRole;

      nonParentalBase.push({
        ...period,
        parentRole: displayRole,
        missingBase: displayRole === 'mother' ? motherMissingBase : fatherMissingBase,
      });
    }

    // Jeśli użytkownik zmodyfikował termin/podział urlopu ojcowskiego, budujemy jego okresy bez wymyślania kwot.
    if (customPaternityParts !== null && scenario.father) {
      const dailyFromEngine =
        enginePaternityPeriod && enginePaternityPeriod.days > 0
          ? enginePaternityPeriod.totalAmount / enginePaternityPeriod.days
          : null;
      const monthlyFromEngine = enginePaternityPeriod?.monthlyAmount ?? 0;

      for (const pPart of customPaternityParts) {
        const days = pPart.weeks * DAYS_IN_WEEK;
        const endDate = addDaysIso(pPart.startDate, days - 1);
        const totalAmount =
          dailyFromEngine !== null ? Math.round(dailyFromEngine * days * 100) / 100 : 0;
        nonParentalBase.push({
          leaveType: 'paternityLeave',
          parentRole: 'father',
          startDate: pPart.startDate,
          endDate,
          weeks: pPart.weeks,
          days,
          rate: enginePaternityPeriod?.rate ?? params.rates.paternity,
          monthlyAmount: monthlyFromEngine,
          totalAmount,
          missingBase: fatherMissingBase || dailyFromEngine === null,
        });
      }
    }

    const parentalFromSplit: TimelineLeavePeriod[] = [];
    const splitPeriods = splitResult?.periods ?? [];

    splitPeriods.forEach((period, idx) => {
      const isMissing = period.parentRole === 'mother' ? motherMissingBase : fatherMissingBase;
      const workFraction = workByPartIndex[idx];
      const workRes = withWorkResults[idx];

      if (workFraction && workRes && workRes.periods.length > 0) {
        workRes.periods.forEach((wPeriod, wIdx) => {
          parentalFromSplit.push({
            ...wPeriod,
            workTimeFraction: wIdx === 0 ? workFraction : undefined,
            isWorkExtension: wIdx > 0,
            missingBase: isMissing,
          });
        });
      } else {
        parentalFromSplit.push({
          ...period,
          missingBase: isMissing,
        });
      }
    });

    return [...nonParentalBase, ...parentalFromSplit].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
  }, [
    maternity.periods,
    customPaternityParts,
    maternityOptions.supplementaryParent,
    scenario.father,
    scenario.mother.benefitBase,
    params.rates.paternity,
    splitResult,
    workByPartIndex,
    withWorkResults,
  ]);

  const validationIssues = useMemo(() => {
    if (dataIssues.blockingMessages.length > 0) return [];
    const suppPeriods = maternity.periods.filter(
      (p) => p.leaveType === 'supplementaryMaternityLeave',
    );
    const matPeriods = maternity.periods.filter(
      (p) => p.leaveType === 'maternityLeave' || p.leaveType === 'adoptionMaternityLeave',
    );
    const matEnd =
      matPeriods
        .map((p) => p.endDate)
        .sort()
        .at(-1) ?? null;
    const suppHasGap =
      suppPeriods.length > 0 && matEnd !== null
        ? suppPeriods[0].startDate !== addDaysIso(matEnd, 1)
        : false;
    const suppRoles = new Set(suppPeriods.map((p) => p.parentRole));

    return [
      ...validateMaternityOptions(scenario, maternity, maternityOptions, params),
      ...validateSupplementaryLeave(
        {
          partsCount: suppPeriods.length,
          hasGapAfterMaternity: suppHasGap,
          usedByBothParents: suppRoles.size > 1,
        },
        scenario,
      ),
      ...validatePaternityPlan(scenario, activePaternityParts, params),
      ...validateParentalParts(scenario, parts, workByPartIndex, withWorkResults, params),
    ];
  }, [
    dataIssues.blockingMessages.length,
    scenario,
    maternity,
    maternityOptions,
    params,
    activePaternityParts,
    parts,
    workByPartIndex,
    withWorkResults,
  ]);

  const milestones = useMemo(
    () => buildMilestones(scenario, combinedPeriods, maternityOptions, params),
    [scenario, combinedPeriods, maternityOptions, params],
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

  const returnToWorkDates = useMemo(
    () => computeReturnToWorkDates(combinedPeriods),
    [combinedPeriods],
  );

  const motherSummary = useMemo(
    () =>
      formatParentLeaveSummary(
        'mother',
        combinedPeriods,
        returnToWorkDates.mother,
        singleChildLoss ? null : (splitResult?.remainingWeeks.mother ?? null),
      ),
    [combinedPeriods, returnToWorkDates.mother, singleChildLoss, splitResult],
  );

  const fatherSummary = useMemo(
    () =>
      fatherAvailable
        ? formatParentLeaveSummary(
            'father',
            combinedPeriods,
            returnToWorkDates.father,
            singleChildLoss ? null : (splitResult?.remainingWeeks.father ?? null),
          )
        : null,
    [fatherAvailable, combinedPeriods, returnToWorkDates.father, singleChildLoss, splitResult],
  );

  const quickJumps: CalendarQuickJump[] = useMemo(() => {
    const jumps: CalendarQuickJump[] = [];
    if (anchorDate) {
      jumps.push({ label: getAnchorJumpLabel(scenario), monthIso: anchorDate.slice(0, 7) });
    }
    const firstParental = combinedPeriods.find((p) => p.leaveType === 'parentalLeave');
    if (firstParental) {
      jumps.push({ label: 'Start rodzicielskiego', monthIso: firstParental.startDate.slice(0, 7) });
    }
    const firstFather = combinedPeriods.find((p) => p.parentRole === 'father');
    if (firstFather) {
      jumps.push({ label: 'Start urlopu Ojca', monthIso: firstFather.startDate.slice(0, 7) });
    }
    if (returnToWorkDates.mother) {
      jumps.push({
        label: 'Powrót do pracy (Mama)',
        monthIso: returnToWorkDates.mother.slice(0, 7),
      });
    }
    return jumps;
  }, [anchorDate, scenario, combinedPeriods, returnToWorkDates.mother]);

  const wizardLink = `/wizard?situation=${scenario.situation}`;
  const nextTabHref = `/plan/documents${location.search}`;

  // Stan brakujących krytycznych danych (brak daty lub brak ubezpieczenia obojga rodziców)
  if (dataIssues.blockingMessages.length > 0) {
    return (
      <div className="lp-view">
        <section className="lp-answer lp-answer--missing" aria-labelledby="missing-data-heading">
          <h2 id="missing-data-heading" className="lp-answer__title">
            Uzupełnij dane do planu urlopów
          </h2>
          <p className="lp-answer__lead">
            Nie przyjmujemy fikcyjnych dat ani kwot. Aby przygotować plan urlopów, uzupełnij:
          </p>
          <ul className="lp-missing-data__list">
            {dataIssues.blockingMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
          <div className="lp-missing-data__actions">
            <Link to={wizardLink} className="plan-btn plan-btn--primary lp-missing-data__btn">
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
      {usingApi === false && (
        <div className="lp-notice" role="status">
          Obliczenia działają w trybie lokalnym (na podstawie parametrów ZUS).
        </div>
      )}

      {dataIssues.warningMessages.length > 0 && (
        <div className="lp-missing-banner" role="status">
          <div>
            <strong>Brakuje części danych do wyliczenia kwot:</strong>
            <ul>
              {dataIssues.warningMessages.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
          <Link to={wizardLink} className="plan-btn plan-btn--secondary">
            Uzupełnij dane ›
          </Link>
        </div>
      )}

      {apiError && (
        <div className="lp-api-error" role="alert">
          <div>
            <strong>Nie udało się pobrać obliczeń z serwera:</strong> {apiError}
          </div>
          <button type="button" className="plan-btn plan-btn--secondary" onClick={handleRetry}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Kluczowa odpowiedź na górze w prostych słowach */}
      <section className="lp-answer" aria-labelledby="leave-answer-heading">
        <h2 id="leave-answer-heading" className="lp-answer__title">
          Plan urlopów w skrócie
        </h2>

        <div className="lp-answer__lines">
          {motherSummary && <p className="lp-answer__line">{motherSummary}</p>}
          {fatherSummary && <p className="lp-answer__line">{fatherSummary}</p>}
          {!motherSummary && !fatherSummary && (
            <p className="lp-answer__line">
              Dla podanych danych nie zaplanowano okresów urlopu – sprawdź komunikaty poniżej.
            </p>
          )}
        </div>

        {nextDeadline && (
          <p className="lp-answer__deadline">
            <strong>Najbliższy termin:</strong>{' '}
            <button
              type="button"
              className="lp-inline-date-btn"
              onClick={() => handleSelectTimelineDate(nextDeadline.date, true)}
            >
              {formatShortDeadlineLabel(nextDeadline.label)} do {formatIsoPl(nextDeadline.date)}
            </button>
          </p>
        )}

        {pastDeadlines.length > 0 && (
          <div className="lp-past-deadlines" aria-label="Minione terminy wniosków">
            <div className="lp-past-deadlines__list">
              {pastDeadlines.map((milestone) => (
                <button
                  key={`${milestone.date}-${milestone.label}`}
                  type="button"
                  className="lp-past-chip"
                  title={milestone.description}
                  onClick={() => handleSelectTimelineDate(milestone.date, true)}
                >
                  <span className="lp-past-chip__badge">Termin minął</span>
                  <span>
                    {formatShortDeadlineLabel(milestone.label)} ({formatIsoPl(milestone.date)})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {sensitive && (
          <p className="lp-sensitive-note" role="status">
            {singleChildLoss
              ? 'Urlop rodzicielski nie przysługuje. W zakładce „Wsparcie” znajdziesz bezpłatną pomoc organizacji specjalistycznych.'
              : 'Przedstawiamy informacje o przysługujących okresach urlopu i terminach dokumentów. W zakładce „Wsparcie” znajdziesz bezpłatną pomoc.'}
          </p>
        )}

        {/* Zwięzłe fakty (maks. 2–3) włączone w podsumowanie */}
        <dl className="lp-answer__facts" aria-label="Podsumowanie planu urlopów">
          <div className="lp-answer__fact">
            <dt>Wariant stawki</dt>
            <dd>
              <strong>
                {scenario.rateVariant === 'combined'
                  ? formatRate(params.rates.combined)
                  : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`}
              </strong>
              {scenario.rateVariant === 'combined' && !singleChildLoss && (
                <span className="lp-answer__fact-hint">
                  {' '}
                  ({params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica:{' '}
                  {formatRate(params.rates.secondParentNonTransferableInCombined)})
                </span>
              )}
            </dd>
          </div>

          {!singleChildLoss && (
            <div className="lp-answer__fact">
              <dt>Pozostały rodzicielski</dt>
              <dd>
                {splitResult ? (
                  <>
                    Mama: <strong>{splitResult.remainingWeeks.mother} tyg.</strong>
                    {fatherAvailable && (
                      <>
                        {' '}
                        · Tata: <strong>{splitResult.remainingWeeks.father} tyg.</strong>
                      </>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          )}
        </dl>

        {loading && (
          <p className="lp-loading" role="status" aria-live="polite">
            Przeliczanie planu urlopów…
          </p>
        )}
      </section>

      <div className="lp-sections">
        {/* Uproszczona oś czasu (widoczna od razu) + lista okresów w <details> */}
        <LeaveTimeline
          periods={combinedPeriods}
          hasFather={fatherAvailable}
          onSelectDate={handleSelectTimelineDate}
        />

        {/* Kalendarz miesięczny zwinięty domyślnie w <details> */}
        <details
          ref={calendarDetailsRef}
          className="lp-details lp-details--card"
          open={calendarOpen}
          onToggle={(e) => setCalendarOpen(e.currentTarget.open)}
        >
          <summary className="lp-details__summary lp-details__summary--card">
            Pokaż kalendarz dzień po dniu
          </summary>
          <div className="lp-details__body">
            <MonthlyCalendar
              periods={combinedPeriods}
              milestones={milestones}
              quickJumps={quickJumps}
              focusedMonth={focusedMonth}
              selectedDay={selectedDay}
              referenceDate={scenario.referenceDate}
              onSelectDay={handleSelectDay}
              onChangeMonth={handleChangeMonth}
              onSelectMilestoneDate={(dateIso) => handleSelectTimelineDate(dateIso, true)}
            />
          </div>
        </details>

        {/* Planer: prosty wybór gotowego scenariusza + ręczna edycja i łączenie z pracą w <details> */}
        {(!singleChildLoss || validationIssues.length > 0) && (
          <LeaveSplitPlanner
            scenario={scenario}
            params={params}
            maternity={maternity}
            parts={parts}
            activePreset={activePreset}
            splitResult={splitResult}
            workByPartIndex={workByPartIndex}
            withWorkResults={withWorkResults}
            maternityOptions={maternityOptions}
            paternityParts={activePaternityParts}
            isPaternityCustom={customPaternityParts !== null}
            validationIssues={validationIssues}
            onSelectPreset={handleSelectPreset}
            onAddPart={(part) => handleUpdateParts([...parts, part], null)}
            onUpdatePart={(idx, updatedPart) =>
              handleUpdateParts(
                parts.map((item, index) => (index === idx ? updatedPart : item)),
                null,
              )
            }
            onRemovePart={(idx) => {
              const nextParts = parts.filter((_, index) => index !== idx);
              const nextWorkMap: Record<number, number> = {};
              Object.entries(workByPartIndex).forEach(([kStr, val]) => {
                const k = Number(kStr);
                if (k < idx) nextWorkMap[k] = val;
                else if (k > idx) nextWorkMap[k - 1] = val;
              });
              handleUpdateParts(nextParts, null, nextWorkMap);
            }}
            onResetParts={() => {
              const preset: LeavePlanPresetId = fatherAvailable ? 'classic' : 'onlyMother';
              handleUpdateParts(
                buildPresetParentalParts(preset, scenario, maternity, params),
                preset,
                {},
              );
            }}
            onChangeWorkForPart={handleChangeWorkForPart}
            onChangeMaternityOptions={setMaternityOptions}
            onChangePaternityParts={handleChangePaternityParts}
            onResetPaternity={() => handleChangePaternityParts(null)}
          />
        )}
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
