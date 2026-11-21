import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

    // Jeśli użytkownik zmodyfikował termin/podział urlopu ojcowskiego, budujemy jego okresy bez wymyślania kwot:
    // używamy stawki i proporcji dziennej z okresu ojcowskiego silnika (gdy dostępny) albo oznaczamy brak kwoty.
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

  const returnToWorkDates = useMemo(
    () => computeReturnToWorkDates(combinedPeriods),
    [combinedPeriods],
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

  // Stan brakujących krytycznych danych (brak daty lub brak ubezpieczenia obojga rodziców)
  if (dataIssues.blockingMessages.length > 0) {
    return (
      <div className="lp-view">
        <section className="lp-card lp-missing-data" aria-labelledby="missing-data-heading">
          <h2 id="missing-data-heading" className="lp-card__title">
            Uzupełnij dane, aby przygotować plan urlopów
          </h2>
          <p className="lp-card__lead">
            Nie przyjmujemy fikcyjnych dat ani podstaw wymiaru. Aby wyświetlić oś czasu, kalendarz i
            dokładne terminy wniosków, uzupełnij brakujące informacje:
          </p>
          <ul className="lp-missing-data__list">
            {dataIssues.blockingMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
          <div className="lp-missing-data__actions">
            <Link to={wizardLink} className="plan-btn plan-btn--primary">
              Uzupełnij dane w kreatorze ›
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="lp-view">
      {usingApi === false && (
        <div className="lp-notice" role="status">
          Obliczenia działają w trybie lokalnym (fallback z parametrów ZUS) – po uruchomieniu
          endpointów obliczeń w API przełączą się automatycznie na dane z serwera.
        </div>
      )}

      {dataIssues.warningMessages.length > 0 && (
        <div className="lp-missing-banner" role="status">
          <div>
            <strong>Uzupełnij dane, aby zobaczyć pełne wyliczenie kwot:</strong>
            <ul>
              {dataIssues.warningMessages.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
          <Link to={wizardLink} className="plan-btn plan-btn--secondary">
            Uzupełnij dane w kreatorze ›
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

      {/* Podsumowanie puli i dat powrotu do pracy */}
      <section className="lp-summary-grid" aria-label="Podsumowanie planu urlopów">
        {!singleChildLoss && (
          <>
            <div className="lp-summary-tile">
              <span className="lp-summary-tile__label">Pozostały rodzicielski – Matka</span>
              <strong className="lp-summary-tile__value">
                {splitResult ? `${splitResult.remainingWeeks.mother} tyg.` : '—'}
              </strong>
            </div>
            <div className="lp-summary-tile">
              <span className="lp-summary-tile__label">Pozostały rodzicielski – Ojciec</span>
              <strong className="lp-summary-tile__value">
                {!fatherAvailable
                  ? 'Nie dotyczy'
                  : splitResult
                    ? `${splitResult.remainingWeeks.father} tyg.`
                    : '—'}
              </strong>
            </div>
            <div className="lp-summary-tile">
              <span className="lp-summary-tile__label">Nieprzenoszalne na rodzica</span>
              <strong className="lp-summary-tile__value">
                po {params.parentalLeave.nonTransferableWeeksPerParent} tyg.
              </strong>
            </div>
          </>
        )}

        <div className="lp-summary-tile">
          <span className="lp-summary-tile__label">Aktywny wariant stawki</span>
          <strong className="lp-summary-tile__value">
            {scenario.rateVariant === 'combined'
              ? `${formatRate(params.rates.combined)} (wniosek do ${params.combinedRateApplicationDeadlineDays} dni)`
              : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`}
          </strong>
          {scenario.rateVariant === 'combined' && !singleChildLoss && (
            <span className="lp-summary-tile__hint">
              {params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica zawsze{' '}
              {formatRate(params.rates.secondParentNonTransferableInCombined)}
            </span>
          )}
        </div>

        <div className="lp-summary-tile">
          <span className="lp-summary-tile__label">Powrót do pracy – Matka</span>
          <strong className="lp-summary-tile__value">
            {returnToWorkDates.mother ? formatIsoPl(returnToWorkDates.mother) : '—'}
          </strong>
        </div>

        {fatherAvailable && (
          <div className="lp-summary-tile">
            <span className="lp-summary-tile__label">Powrót do pracy – Ojciec</span>
            <strong className="lp-summary-tile__value">
              {returnToWorkDates.father ? formatIsoPl(returnToWorkDates.father) : '—'}
            </strong>
          </div>
        )}
      </section>

      {sensitive && (
        <div className="lp-sensitive-note" role="status">
          Przedstawiamy wyłącznie informacje o przysługujących okresach urlopu i terminach złożenia
          dokumentów. W zakładce „Wsparcie” znajdziesz bezpłatną pomoc organizacji
          specjalistycznych.
        </div>
      )}

      {loading && (
        <p className="lp-loading" role="status" aria-live="polite">
          Przeliczanie planu urlopów…
        </p>
      )}

      <div className="lp-sections">
        <LeaveTimeline
          periods={combinedPeriods}
          milestones={milestones}
          referenceDate={scenario.referenceDate}
          hasFather={fatherAvailable}
          onSelectDate={handleSelectTimelineDate}
        />

        <MonthlyCalendar
          periods={combinedPeriods}
          milestones={milestones}
          quickJumps={quickJumps}
          focusedMonth={focusedMonth}
          selectedDay={selectedDay}
          referenceDate={scenario.referenceDate}
          onSelectDay={handleSelectDay}
          onChangeMonth={handleChangeMonth}
        />

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
      </div>
    </div>
  );
}
