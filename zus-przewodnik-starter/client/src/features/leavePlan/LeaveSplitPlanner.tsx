import { useMemo, useState, type FormEvent } from 'react';
import type {
  BenefitParams,
  LeavePartRequest,
  MaternityCalculationResult,
  ParentalSplitResult,
  ParentalWithWorkResult,
  ParentRole,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import {
  addDaysIso,
  DAYS_IN_WEEK,
  formatIsoPl,
  formatPlnAmount,
  formatWorkFraction,
  getAnchorDate,
  getDefaultParentalStartDate,
  getLeavePlanPresets,
  getLeaveTypeLabel,
  getMaternityBlockEndDate,
  getParentalPoolSummary,
  getPartLimitInfo,
  getShortParentRoleLabel,
  getWorkFractionOptions,
  hasFatherInPlan,
  isParentInsured,
  isSingleChildLoss,
  type LeavePlanPresetId,
} from './leavePlanHelpers';
import {
  getAdoptionMaxChildAgeYears,
  getParentalDeadlineDate,
  getPaternityDeadlineDate,
  type MaternityPlanOptions,
  type PaternityPartPlan,
  type ValidationIssue,
} from './leavePlanValidation';

interface LeaveSplitPlannerProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  parts: LeavePartRequest[];
  activePreset: LeavePlanPresetId | null;
  splitResult: ParentalSplitResult | null;
  workByPartIndex: Record<number, number>;
  withWorkResults: Record<number, ParentalWithWorkResult>;
  maternityOptions: MaternityPlanOptions;
  paternityParts: PaternityPartPlan[];
  isPaternityCustom: boolean;
  validationIssues: ValidationIssue[];
  onSelectPreset: (presetId: LeavePlanPresetId) => void;
  onAddPart: (part: LeavePartRequest) => void;
  onUpdatePart: (index: number, part: LeavePartRequest) => void;
  onRemovePart: (index: number) => void;
  onResetParts: () => void;
  onChangeWorkForPart: (partIndex: number, workTimeFraction: number | null) => void;
  onChangeMaternityOptions: (next: MaternityPlanOptions) => void;
  onChangePaternityParts: (next: PaternityPartPlan[]) => void;
  onResetPaternity: () => void;
}

export function LeaveSplitPlanner({
  scenario,
  params,
  maternity,
  parts,
  activePreset,
  splitResult,
  workByPartIndex,
  withWorkResults,
  maternityOptions,
  paternityParts,
  isPaternityCustom,
  validationIssues,
  onSelectPreset,
  onAddPart,
  onUpdatePart,
  onRemovePart,
  onResetParts,
  onChangeWorkForPart,
  onChangeMaternityOptions,
  onChangePaternityParts,
  onResetPaternity,
}: LeaveSplitPlannerProps) {
  const pool = useMemo(() => getParentalPoolSummary(scenario, params), [scenario, params]);
  const presets = useMemo(() => getLeavePlanPresets(params), [params]);
  const workOptions = useMemo(() => getWorkFractionOptions(params), [params]);
  const singleChildLoss = isSingleChildLoss(scenario);
  const fatherAvailable = hasFatherInPlan(scenario) && isParentInsured(scenario.father);
  const motherAvailable = isParentInsured(scenario.mother) && !scenario.special.motherDeceased;
  const anchorDate = getAnchorDate(scenario);
  const parentalDeadline = useMemo(
    () => getParentalDeadlineDate(scenario, params),
    [scenario, params],
  );
  const paternityDeadline = useMemo(
    () => getPaternityDeadlineDate(scenario, params),
    [scenario, params],
  );

  const suggestedNextStartDate = useMemo(() => {
    const defaultStart = getDefaultParentalStartDate(scenario, maternity) ?? scenario.referenceDate;
    const preEnd = getMaternityBlockEndDate(scenario, maternity);
    const parentalEnds = parts
      .filter((p) => p.leaveType === 'parentalLeave')
      .map((p, idx) => {
        const workRes = withWorkResults[idx];
        if (workRes && workRes.periods.length > 0) {
          return workRes.periods[workRes.periods.length - 1].endDate;
        }
        return addDaysIso(p.startDate, p.weeks * DAYS_IN_WEEK - 1);
      });
    const allEnds = [...(preEnd ? [preEnd] : []), ...parentalEnds].sort();
    const latestEnd = allEnds.at(-1);
    return latestEnd ? addDaysIso(latestEnd, 1) : defaultStart;
  }, [parts, withWorkResults, scenario, maternity]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<LeavePartRequest | null>(null);

  const [parentRole, setParentRole] = useState<ParentRole>(fatherAvailable ? 'father' : 'mother');
  const [dateMode, setDateMode] = useState<'auto' | 'parallel' | 'custom'>('auto');
  const [customStartDate, setCustomStartDate] = useState<string>(suggestedNextStartDate);
  const [weeks, setWeeks] = useState<number>(params.parentalLeave.nonTransferableWeeksPerParent);

  const effectiveAddRole: ParentRole = !fatherAvailable
    ? 'mother'
    : !motherAvailable
      ? 'father'
      : parentRole;

  const addLimit = useMemo(
    () => getPartLimitInfo(parts, effectiveAddRole, scenario, params, null),
    [parts, effectiveAddRole, scenario, params],
  );

  const editLimit = useMemo(() => {
    if (editingIndex === null || !editDraft) return null;
    return getPartLimitInfo(parts, editDraft.parentRole, scenario, params, editingIndex);
  }, [parts, editingIndex, editDraft, scenario, params]);

  const clampedAddWeeks = addLimit.maxWeeks > 0 ? Math.min(weeks, addLimit.maxWeeks) : 0;
  const parallelStartDate =
    parts[0]?.startDate ??
    getDefaultParentalStartDate(scenario, maternity) ??
    suggestedNextStartDate;
  const effectiveStartDate =
    dateMode === 'auto'
      ? suggestedNextStartDate
      : dateMode === 'parallel'
        ? parallelStartDate
        : customStartDate;
  const previewEndDate =
    effectiveStartDate && clampedAddWeeks > 0
      ? addDaysIso(effectiveStartDate, clampedAddWeeks * DAYS_IN_WEEK - 1)
      : null;

  const parentalPartEntries = parts
    .map((part, index) => ({ part, index }))
    .filter((entry) => entry.part.leaveType === 'parentalLeave');

  const motherUsedWeeks = parentalPartEntries
    .filter((entry) => entry.part.parentRole === 'mother')
    .reduce((sum, entry) => sum + entry.part.weeks, 0);
  const fatherUsedWeeks = parentalPartEntries
    .filter((entry) => entry.part.parentRole === 'father')
    .reduce((sum, entry) => sum + entry.part.weeks, 0);
  const totalUsedWeeks = motherUsedWeeks + fatherUsedWeeks;
  const poolPct =
    pool.totalWeeks > 0 ? Math.min(100, Math.round((totalUsedWeeks / pool.totalWeeks) * 100)) : 0;

  const errorMessages = useMemo(() => {
    const items: { message: string; legalBasis: string | null }[] = [];
    const seen = new Set<string>();
    const pushUnique = (message: string, legalBasis: string | null) => {
      if (seen.has(message)) return;
      seen.add(message);
      items.push({ message, legalBasis });
    };

    for (const issue of validationIssues) {
      if (issue.severity === 'error') {
        pushUnique(issue.message, issue.legalBasis);
      }
    }
    if (splitResult && !splitResult.valid) {
      for (const err of splitResult.errors) {
        pushUnique(err.message, err.legalBasis);
      }
    }
    return items;
  }, [validationIssues, splitResult]);

  const warningMessages = useMemo(
    () => validationIssues.filter((issue) => issue.severity === 'warning'),
    [validationIssues],
  );

  const hasSupplementaryPeriod = maternity.periods.some(
    (period) => period.leaveType === 'supplementaryMaternityLeave',
  );
  const maternityPeriod = maternity.periods.find(
    (period) =>
      period.leaveType === 'maternityLeave' || period.leaveType === 'adoptionMaternityLeave',
  );

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditDraft({ ...parts[index] });
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft(null);
  }

  function saveEditing(event: FormEvent) {
    event.preventDefault();
    if (editingIndex === null || !editDraft) return;
    if (editDraft.weeks < 1) return;
    onUpdatePart(editingIndex, {
      ...editDraft,
      leaveType: 'parentalLeave',
    });
    setEditingIndex(null);
    setEditDraft(null);
  }

  function handleAddSubmit(event: FormEvent) {
    event.preventDefault();
    if (addLimit.maxPartsReached || addLimit.maxWeeks === 0) return;
    if (!effectiveStartDate || clampedAddWeeks < 1) return;
    onAddPart({
      parentRole: effectiveAddRole,
      leaveType: 'parentalLeave',
      startDate: effectiveStartDate,
      weeks: clampedAddWeeks,
    });
  }

  function handlePaternityModeChange(mode: 'none' | 'single' | 'split') {
    const startBase = anchorDate ?? scenario.referenceDate;
    if (mode === 'none') {
      onChangePaternityParts([]);
      return;
    }
    if (mode === 'single') {
      onChangePaternityParts([
        {
          startDate: paternityParts[0]?.startDate ?? addDaysIso(startBase, DAYS_IN_WEEK),
          weeks: params.paternityLeave.weeks,
        },
      ]);
      return;
    }
    const firstStart = paternityParts[0]?.startDate ?? addDaysIso(startBase, DAYS_IN_WEEK);
    const secondStart = paternityParts[1]?.startDate ?? addDaysIso(firstStart, DAYS_IN_WEEK * 4);
    onChangePaternityParts([
      { startDate: firstStart, weeks: params.paternityLeave.minPartWeeks },
      {
        startDate: secondStart,
        weeks: Math.max(
          params.paternityLeave.minPartWeeks,
          params.paternityLeave.weeks - params.paternityLeave.minPartWeeks,
        ),
      },
    ]);
  }

  const paternityMode: 'none' | 'single' | 'split' =
    paternityParts.length === 0 ? 'none' : paternityParts.length === 1 ? 'single' : 'split';

  const addBlocked = addLimit.maxPartsReached || addLimit.maxWeeks === 0;

  return (
    <section className="lp-card" aria-labelledby="planner-heading">
      <div className="lp-card__header">
        <div>
          <h2 id="planner-heading" className="lp-card__title">
            Zaplanuj podział urlopów i powrót do pracy
          </h2>
          {singleChildLoss ? (
            <p className="lp-card__lead">
              W tej sytuacji przysługuje skrócony urlop macierzyński zgodnie z wyliczeniem silnika.
              Urlop rodzicielski nie przysługuje.
            </p>
          ) : (
            <p className="lp-card__lead">
              Wybierz gotowy scenariusz albo dostosuj części ręcznie. Urlop rodzicielski możesz
              podzielić na maksymalnie {params.parentalLeave.maxParts} części i wykorzystać
              jednocześnie lub naprzemiennie
              {parentalDeadline ? ` do ${formatIsoPl(parentalDeadline)}` : ''}. Po{' '}
              {pool.nonTransferable} tyg. przysługuje wyłącznie każdemu z rodziców.
            </p>
          )}
        </div>
        {!singleChildLoss && (
          <button
            type="button"
            className="plan-btn plan-btn--secondary"
            onClick={() => {
              cancelEditing();
              onResetParts();
            }}
          >
            Przywróć propozycję startową
          </button>
        )}
      </div>

      {/* Komunikaty walidacji ustawowej */}
      {errorMessages.length > 0 && (
        <div className="lp-planner-errors" role="alert">
          <h3 className="lp-planner-errors__title">Sprawdź ograniczenia ustawowe:</h3>
          <ul>
            {errorMessages.map((err, idx) => (
              <li key={`${err.message}-${idx}`}>
                {err.message}
                {err.legalBasis && <span className="lp-legal"> ({err.legalBasis})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warningMessages.length > 0 && (
        <div className="lp-planner-warnings" role="status">
          <ul>
            {warningMessages.map((warn, idx) => (
              <li key={`${warn.code}-${idx}`}>
                {warn.message}
                {warn.legalBasis && <span className="lp-legal"> ({warn.legalBasis})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!singleChildLoss && splitResult && splitResult.valid && errorMessages.length === 0 && (
        <div className="lp-planner-success" role="status">
          <strong>Podział zgodny z Kodeksem pracy.</strong> Pozostało do wykorzystania: Matka{' '}
          <strong>{splitResult.remainingWeeks.mother} tyg.</strong>
          {fatherAvailable && (
            <>
              , Ojciec <strong>{splitResult.remainingWeeks.father} tyg.</strong>
            </>
          )}
          .
        </div>
      )}

      {!singleChildLoss && (
        <>
          {/* 1. Gotowe scenariusze */}
          <div className="lp-presets-section" aria-labelledby="presets-heading">
            <h3 id="presets-heading" className="lp-planner-subtitle">
              1. Wybierz gotowy scenariusz podziału urlopu rodzicielskiego
            </h3>
            <div className="lp-presets-grid">
              {presets.map((preset) => {
                const isSelected = activePreset === preset.id;
                const disabled =
                  (preset.requiresFather && !fatherAvailable) ||
                  (preset.id === 'onlyMother' && !motherAvailable);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    className={
                      isSelected ? 'lp-preset-card lp-preset-card--active' : 'lp-preset-card'
                    }
                    aria-pressed={isSelected}
                    onClick={() => {
                      cancelEditing();
                      onSelectPreset(preset.id);
                    }}
                  >
                    <span className="lp-preset-card__title">{preset.title}</span>
                    <span className="lp-preset-card__desc">
                      {disabled && preset.requiresFather
                        ? 'Wymaga uwzględnienia ubezpieczonego drugiego rodzica w planie.'
                        : preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizualny pasek wykorzystanej puli tygodni */}
          <div className="lp-pool-progress" aria-label="Wykorzystanie puli urlopu rodzicielskiego">
            <div className="lp-pool-progress__top">
              <strong>
                Wykorzystano {totalUsedWeeks} z {pool.totalWeeks} tygodni urlopu rodzicielskiego
              </strong>
              <span className="lp-pool-progress__breakdown">
                Mama: {motherUsedWeeks} tyg. · Tata: {fatherUsedWeeks} tyg.
              </span>
            </div>
            <div
              className="lp-pool-progress__track"
              role="progressbar"
              aria-valuenow={totalUsedWeeks}
              aria-valuemin={0}
              aria-valuemax={pool.totalWeeks}
            >
              <div className="lp-pool-progress__fill" style={{ width: `${poolPct}%` }} />
            </div>
            {scenario.situation === 'adoption' && (
              <p className="lp-pool-progress__note">
                Limit wieku dziecka w tej sytuacji: do{' '}
                {getAdoptionMaxChildAgeYears(scenario, params)} lat (minimalny wymiar urlopu na
                warunkach macierzyńskiego: {params.adoptionMaternityLeave.minWeeks} tyg.).
              </p>
            )}
          </div>

          <div className="lp-planner-grid">
            {/* 2. Części urlopu rodzicielskiego */}
            <div className="lp-planner-col">
              <h3 className="lp-planner-subtitle">
                2. Części urlopu rodzicielskiego ({parentalPartEntries.length}/
                {params.parentalLeave.maxParts} części)
              </h3>

              {parts.length === 0 ? (
                <p className="lp-card__empty">
                  Brak zaplanowanych części urlopu rodzicielskiego. Wybierz scenariusz powyżej lub
                  dodaj część poniżej.
                </p>
              ) : (
                <ul className="lp-parts-list">
                  {parts.map((part, index) => {
                    const partEndDate = addDaysIso(part.startDate, part.weeks * DAYS_IN_WEEK - 1);
                    const isEditing = editingIndex === index && editDraft !== null;
                    const workFrac = workByPartIndex[index];
                    const workRes = withWorkResults[index];
                    const isCombinedWithWork = Boolean(workFrac && workRes);
                    const splitPeriod = splitResult?.periods[index];

                    if (isEditing && editDraft && editLimit) {
                      const editExceeds = editDraft.weeks > editLimit.maxWeeks;
                      return (
                        <li
                          key={`edit-${part.startDate}-${index}`}
                          className="lp-parts-item lp-parts-item--editing"
                        >
                          <form className="lp-parts-edit-form" onSubmit={saveEditing}>
                            <div className="lp-planner-form__fields">
                              <label className="lp-field">
                                <span>Kto bierze urlop</span>
                                <select
                                  value={editDraft.parentRole}
                                  onChange={(e) =>
                                    setEditDraft({
                                      ...editDraft,
                                      parentRole: e.target.value as ParentRole,
                                    })
                                  }
                                >
                                  {motherAvailable && <option value="mother">Matka</option>}
                                  {fatherAvailable && <option value="father">Ojciec</option>}
                                </select>
                              </label>

                              <label className="lp-field">
                                <span>Data rozpoczęcia</span>
                                <input
                                  type="date"
                                  value={editDraft.startDate}
                                  onChange={(e) =>
                                    setEditDraft({ ...editDraft, startDate: e.target.value })
                                  }
                                  required
                                />
                              </label>

                              <div className="lp-field lp-field--full">
                                <label htmlFor={`edit-weeks-${index}`}>Liczba tygodni</label>
                                <div className="lp-stepper-row">
                                  <button
                                    type="button"
                                    className="lp-stepper-btn"
                                    aria-label="Zmniejsz liczbę tygodni"
                                    onClick={() =>
                                      setEditDraft({
                                        ...editDraft,
                                        weeks: Math.max(1, editDraft.weeks - 1),
                                      })
                                    }
                                  >
                                    −1
                                  </button>
                                  <input
                                    id={`edit-weeks-${index}`}
                                    type="number"
                                    min={1}
                                    max={Math.max(1, editLimit.maxWeeks)}
                                    value={editDraft.weeks}
                                    onChange={(e) => {
                                      const raw = Number(e.target.value);
                                      if (!Number.isNaN(raw)) {
                                        setEditDraft({
                                          ...editDraft,
                                          weeks: Math.max(1, raw),
                                        });
                                      }
                                    }}
                                    required
                                  />
                                  <button
                                    type="button"
                                    className="lp-stepper-btn"
                                    aria-label="Zwiększ liczbę tygodni"
                                    disabled={editDraft.weeks >= editLimit.maxWeeks}
                                    onClick={() =>
                                      setEditDraft({
                                        ...editDraft,
                                        weeks: Math.min(editLimit.maxWeeks, editDraft.weeks + 1),
                                      })
                                    }
                                  >
                                    +1
                                  </button>
                                </div>
                              </div>
                            </div>

                            {editLimit.limitReason && (
                              <p
                                className={
                                  editDraft.weeks >= editLimit.maxWeeks || editExceeds
                                    ? 'lp-limit-notice lp-limit-notice--warn'
                                    : 'lp-limit-notice'
                                }
                                role={editExceeds ? 'alert' : undefined}
                              >
                                {editDraft.weeks >= editLimit.maxWeeks
                                  ? `Limit: ${editLimit.limitReason}`
                                  : editLimit.limitReason}
                              </p>
                            )}

                            <div className="lp-parts-edit-form__actions">
                              <button
                                type="submit"
                                className="plan-btn plan-btn--primary"
                                disabled={editExceeds || editLimit.maxWeeks === 0}
                              >
                                Zapisz zmiany
                              </button>
                              <button
                                type="button"
                                className="plan-btn plan-btn--secondary"
                                onClick={cancelEditing}
                              >
                                Anuluj
                              </button>
                            </div>
                          </form>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={`${part.parentRole}-${part.startDate}-${index}`}
                        className="lp-parts-item"
                      >
                        <div className="lp-parts-item__info">
                          <strong>{getShortParentRoleLabel(part.parentRole)}</strong> –{' '}
                          {getLeaveTypeLabel(part.leaveType)}
                          {isCombinedWithWork && workFrac && (
                            <span className="lp-parts-item__work-tag">
                              + praca ({formatWorkFraction(workFrac)})
                            </span>
                          )}
                          <div className="lp-parts-item__meta">
                            {formatIsoPl(part.startDate)} – {formatIsoPl(partEndDate)} ·{' '}
                            {part.weeks} tyg.
                            {splitPeriod && <> · stawka {formatRate(splitPeriod.rate)}</>}
                            {isCombinedWithWork && workRes && (
                              <> → wydłużenie +{workRes.extendedWeeks} tyg.</>
                            )}
                          </div>
                        </div>
                        <div className="lp-parts-item__actions">
                          <button
                            type="button"
                            className="lp-parts-item__edit"
                            onClick={() => startEditing(index)}
                            aria-label={`Edytuj część: ${getShortParentRoleLabel(part.parentRole)}, ${getLeaveTypeLabel(part.leaveType)}`}
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            className="lp-parts-item__remove"
                            onClick={() => {
                              if (editingIndex === index) cancelEditing();
                              onRemovePart(index);
                            }}
                            aria-label={`Usuń część: ${getShortParentRoleLabel(part.parentRole)}, ${getLeaveTypeLabel(part.leaveType)}`}
                          >
                            Usuń
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <form className="lp-planner-form" onSubmit={handleAddSubmit}>
                <h4 className="lp-planner-form__title">
                  Dodaj kolejną część urlopu rodzicielskiego
                </h4>
                <div className="lp-planner-form__fields">
                  <label className="lp-field">
                    <span>Kto bierze urlop</span>
                    <select
                      value={effectiveAddRole}
                      disabled={!fatherAvailable || !motherAvailable}
                      onChange={(e) => setParentRole(e.target.value as ParentRole)}
                    >
                      {motherAvailable && <option value="mother">Matka</option>}
                      {fatherAvailable && <option value="father">Ojciec</option>}
                    </select>
                  </label>

                  <div className="lp-field lp-field--full">
                    <span>Kiedy ma się zacząć?</span>
                    <div className="lp-date-mode-group">
                      <label className="lp-radio-inline">
                        <input
                          type="radio"
                          name="partDateMode"
                          checked={dateMode === 'auto'}
                          onChange={() => setDateMode('auto')}
                        />
                        <span>
                          Zaraz po poprzednim urlopie ({formatIsoPl(suggestedNextStartDate)})
                        </span>
                      </label>
                      {parts.length > 0 && fatherAvailable && (
                        <label className="lp-radio-inline">
                          <input
                            type="radio"
                            name="partDateMode"
                            checked={dateMode === 'parallel'}
                            onChange={() => setDateMode('parallel')}
                          />
                          <span>
                            Jednocześnie z drugim rodzicem ({formatIsoPl(parallelStartDate)})
                          </span>
                        </label>
                      )}
                      <label className="lp-radio-inline">
                        <input
                          type="radio"
                          name="partDateMode"
                          checked={dateMode === 'custom'}
                          onChange={() => {
                            setCustomStartDate(suggestedNextStartDate);
                            setDateMode('custom');
                          }}
                        />
                        <span>Wybieram własną datę</span>
                      </label>
                    </div>
                    {dateMode === 'custom' && (
                      <input
                        type="date"
                        aria-label="Własna data rozpoczęcia"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        required
                      />
                    )}
                  </div>

                  <div className="lp-field lp-field--full">
                    <label htmlFor="part-weeks-input">Liczba tygodni</label>
                    <div className="lp-stepper-row">
                      <button
                        type="button"
                        className="lp-stepper-btn"
                        aria-label="Zmniejsz o 1 tydzień"
                        disabled={addBlocked || clampedAddWeeks <= 1}
                        onClick={() => setWeeks(Math.max(1, clampedAddWeeks - 1))}
                      >
                        −1
                      </button>
                      <input
                        id="part-weeks-input"
                        type="number"
                        min={addBlocked ? 0 : 1}
                        max={Math.max(1, addLimit.maxWeeks)}
                        disabled={addBlocked}
                        value={clampedAddWeeks}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isNaN(raw)) {
                            setWeeks(Math.min(Math.max(1, raw), Math.max(1, addLimit.maxWeeks)));
                          }
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="lp-stepper-btn"
                        aria-label="Zwiększ o 1 tydzień"
                        disabled={addBlocked || clampedAddWeeks >= addLimit.maxWeeks}
                        onClick={() => setWeeks(Math.min(addLimit.maxWeeks, clampedAddWeeks + 1))}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>

                {addLimit.limitReason && (
                  <p
                    className={
                      addBlocked || clampedAddWeeks >= addLimit.maxWeeks
                        ? 'lp-limit-notice lp-limit-notice--warn'
                        : 'lp-limit-notice'
                    }
                    role={addBlocked ? 'status' : undefined}
                  >
                    {addBlocked
                      ? `Nie można dodać więcej: ${addLimit.limitReason}`
                      : clampedAddWeeks >= addLimit.maxWeeks
                        ? `Maksimum dla tej części: ${addLimit.limitReason}`
                        : addLimit.limitReason}
                  </p>
                )}

                {previewEndDate && !addBlocked && (
                  <p className="lp-planner-preview">
                    Ten urlop potrwa od <strong>{formatIsoPl(effectiveStartDate)}</strong> do{' '}
                    <strong>{formatIsoPl(previewEndDate)}</strong> ({clampedAddWeeks} tyg.).
                  </p>
                )}

                <button type="submit" className="plan-btn plan-btn--primary" disabled={addBlocked}>
                  Dodaj część do planu
                </button>
              </form>
            </div>

            {/* 3. Łączenie urlopu rodzicielskiego z pracą */}
            <div className="lp-work-combine-box">
              <h3 className="lp-planner-subtitle">
                3. Łączenie urlopu rodzicielskiego z pracą (do{' '}
                {formatWorkFraction(params.parentalLeave.maxWorkTimeFraction)})
              </h3>
              <p className="lp-work-combine-box__lead">
                Urlop rodzicielski można łączyć z pracą u pracodawcy maksymalnie do{' '}
                {formatWorkFraction(params.parentalLeave.maxWorkTimeFraction)}. Urlop ulega
                proporcjonalnemu wydłużeniu (KP art. 182¹f) – pokazujemy obie części oraz datę
                powrotu do pracy.
              </p>

              {parentalPartEntries.length === 0 ? (
                <p className="lp-work-combine-box__empty">
                  Dodaj najpierw część urlopu rodzicielskiego, aby zasymulować łączenie z pracą.
                </p>
              ) : (
                <div className="lp-work-parts-list">
                  {parentalPartEntries.map(({ part, index }) => {
                    const selectedFraction = workByPartIndex[index] ?? null;
                    const workRes = withWorkResults[index];
                    const lastWorkPeriod =
                      workRes && workRes.periods.length > 0
                        ? workRes.periods[workRes.periods.length - 1]
                        : null;
                    const returnToWorkDate = lastWorkPeriod
                      ? addDaysIso(lastWorkPeriod.endDate, 1)
                      : null;
                    const parentBaseMissing =
                      part.parentRole === 'mother'
                        ? scenario.mother.benefitBase === null
                        : (scenario.father?.benefitBase ?? null) === null;

                    return (
                      <div key={`work-card-${index}`} className="lp-planner-form lp-work-part-card">
                        <label className="lp-field">
                          <span>
                            {getShortParentRoleLabel(part.parentRole)} · od{' '}
                            {formatIsoPl(part.startDate)} ({part.weeks} tyg.)
                          </span>
                          <select
                            aria-label={`Praca w trakcie urlopu: ${getShortParentRoleLabel(part.parentRole)} od ${formatIsoPl(part.startDate)}`}
                            value={selectedFraction === null ? '' : String(selectedFraction)}
                            onChange={(e) => {
                              const val = e.target.value;
                              onChangeWorkForPart(index, val === '' ? null : Number(val));
                            }}
                          >
                            <option value="">Pełny urlop (nie pracuję)</option>
                            {workOptions.map((opt) => (
                              <option key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {selectedFraction !== null && workRes && (
                          <div className="lp-work-result" aria-live="polite">
                            <p className="lp-work-result__headline">
                              <strong>Wydłużenie urlopu rodzicielskiego:</strong> +
                              {workRes.extendedWeeks} tyg. ({workRes.extendedDays} dni)
                            </p>

                            <ul className="lp-work-result__periods">
                              {workRes.periods.map((period, pIdx) => (
                                <li key={`${period.startDate}-${pIdx}`}>
                                  <strong>
                                    {pIdx === 0
                                      ? `Część 1 – praca ${formatWorkFraction(selectedFraction)} + obniżony zasiłek:`
                                      : 'Część 2 – proporcjonalne wydłużenie (pełny zasiłek):'}
                                  </strong>{' '}
                                  {formatIsoPl(period.startDate)} – {formatIsoPl(period.endDate)} (
                                  {period.weeks} tyg. / {period.days} dni, stawka{' '}
                                  {formatRate(period.rate)}
                                  {!parentBaseMissing && (
                                    <>
                                      , {formatPlnAmount(period.monthlyAmount)}/mies., łącznie{' '}
                                      {formatPlnAmount(period.totalAmount)}
                                    </>
                                  )}
                                  )
                                </li>
                              ))}
                            </ul>

                            {returnToWorkDate && (
                              <p className="lp-work-result__return">
                                <strong>Powrót do pracy po tej części:</strong>{' '}
                                {formatIsoPl(returnToWorkDate)}
                              </p>
                            )}

                            {workRes.explanations.map((exp, eIdx) => (
                              <p key={`${exp.message}-${eIdx}`} className="lp-work-result__note">
                                {exp.message}
                                {exp.legalBasis && (
                                  <span className="lp-legal"> ({exp.legalBasis})</span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 4. Opcje urlopu macierzyńskiego, uzupełniającego i ojcowskiego */}
      {!singleChildLoss && (
        <div className="lp-extra-leaves" aria-labelledby="extra-leaves-heading">
          <h3 id="extra-leaves-heading" className="lp-planner-subtitle">
            4. Urlop macierzyński, uzupełniający i ojcowski – zasady i terminy
          </h3>

          <div className="lp-extra-grid">
            {/* Macierzyński przed porodem i przejęcie przez ojca */}
            {scenario.situation !== 'adoption' && (
              <div className="lp-extra-card">
                <h4 className="lp-extra-card__title">Urlop macierzyński</h4>
                <p className="lp-extra-card__hint">
                  Przed przewidywaną datą porodu można wykorzystać do{' '}
                  {params.maternityLeave.maxWeeksBeforeBirth} tyg. Pierwsze{' '}
                  {params.maternityLeave.motherMandatoryWeeksAfterBirth} tyg. po porodzie
                  przysługuje wyłącznie matce (wcześniejsze przejęcie przez ojca tylko w sytuacjach
                  szczególnych).
                </p>

                {(scenario.situation === 'planning' || scenario.situation === 'pregnant') && (
                  <label className="lp-field">
                    <span>
                      Tygodnie urlopu macierzyńskiego przed porodem (maks.{' '}
                      {params.maternityLeave.maxWeeksBeforeBirth})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={params.maternityLeave.maxWeeksBeforeBirth + 4}
                      value={maternityOptions.weeksBeforeBirth}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        onChangeMaternityOptions({
                          ...maternityOptions,
                          weeksBeforeBirth: Number.isNaN(val) ? 0 : val,
                        });
                      }}
                    />
                  </label>
                )}

                {scenario.father && (
                  <div className="lp-extra-card__group">
                    <label className="lp-checkbox-inline">
                      <input
                        type="checkbox"
                        checked={maternityOptions.transferToFather}
                        onChange={(e) =>
                          onChangeMaternityOptions({
                            ...maternityOptions,
                            transferToFather: e.target.checked,
                          })
                        }
                      />
                      <span>Ojciec przejmuje pozostałą część urlopu macierzyńskiego</span>
                    </label>

                    {maternityOptions.transferToFather && (
                      <label className="lp-field">
                        <span>
                          Liczba tygodni wykorzystanych przez matkę po porodzie (min.{' '}
                          {scenario.special.motherDeceased
                            ? 0
                            : scenario.special.motherIncapableOfIndependentLiving
                              ? params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate
                              : params.maternityLeave.motherMandatoryWeeksAfterBirth}{' '}
                          tyg.)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={
                            maternityPeriod?.weeks ??
                            params.maternityLeave.weeksByChildrenCount['5']
                          }
                          value={maternityOptions.motherWeeksAfterBirth}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            onChangeMaternityOptions({
                              ...maternityOptions,
                              motherWeeksAfterBirth: Number.isNaN(val) ? 0 : val,
                            });
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Uzupełniający urlop macierzyński */}
            {hasSupplementaryPeriod && (
              <div className="lp-extra-card">
                <h4 className="lp-extra-card__title">Uzupełniający urlop macierzyński</h4>
                <p className="lp-extra-card__hint">
                  Udzielany w jednej części bezpośrednio po urlopie macierzyńskim. Może z niego
                  skorzystać matka albo ojciec (stawka{' '}
                  {formatRate(params.rates.supplementaryMaternity)}).
                </p>
                <label className="lp-field">
                  <span>Kto korzysta z uzupełniającego urlopu macierzyńskiego?</span>
                  <select
                    value={maternityOptions.supplementaryParent}
                    disabled={!scenario.father}
                    onChange={(e) =>
                      onChangeMaternityOptions({
                        ...maternityOptions,
                        supplementaryParent: e.target.value as ParentRole,
                      })
                    }
                  >
                    <option value="mother">Matka</option>
                    {scenario.father && <option value="father">Ojciec / drugi rodzic</option>}
                  </select>
                </label>
              </div>
            )}

            {/* Urlop ojcowski */}
            {scenario.father && (
              <div className="lp-extra-card">
                <div className="lp-extra-card__header">
                  <h4 className="lp-extra-card__title">
                    Urlop ojcowski ({params.paternityLeave.weeks} tyg.,{' '}
                    {formatRate(params.rates.paternity)})
                  </h4>
                  {isPaternityCustom && (
                    <button type="button" className="lp-link-btn" onClick={onResetPaternity}>
                      Przywróć domyślny
                    </button>
                  )}
                </div>
                <p className="lp-extra-card__hint">
                  W całości lub w {params.paternityLeave.maxParts} częściach po min.{' '}
                  {params.paternityLeave.minPartWeeks} tyg.
                  {paternityDeadline && (
                    <> Do wykorzystania do {formatIsoPl(paternityDeadline)}.</>
                  )}{' '}
                  Wniosek najpóźniej {params.applicationDeadlinesDays.paternityLeave} dni przed
                  startem.
                </p>

                <label className="lp-field">
                  <span>Sposób wykorzystania urlopu ojcowskiego</span>
                  <select
                    value={paternityMode}
                    onChange={(e) =>
                      handlePaternityModeChange(e.target.value as 'none' | 'single' | 'split')
                    }
                  >
                    <option value="single">
                      W całości ({params.paternityLeave.weeks} tyg. w 1 części)
                    </option>
                    <option value="split">
                      W {params.paternityLeave.maxParts} częściach po{' '}
                      {params.paternityLeave.minPartWeeks} tyg.
                    </option>
                    <option value="none">Nie planuję urlopu ojcowskiego</option>
                  </select>
                </label>

                {paternityParts.map((pPart, pIdx) => (
                  <label key={`pat-${pIdx}`} className="lp-field">
                    <span>
                      Data startu {paternityParts.length > 1 ? `części ${pIdx + 1}` : 'urlopu'} (
                      {pPart.weeks} tyg.)
                    </span>
                    <input
                      type="date"
                      value={pPart.startDate}
                      onChange={(e) => {
                        const next = paternityParts.map((item, idx) =>
                          idx === pIdx ? { ...item, startDate: e.target.value } : item,
                        );
                        onChangePaternityParts(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
