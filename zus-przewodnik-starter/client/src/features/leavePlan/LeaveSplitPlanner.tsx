import { useMemo, useState } from 'react';
import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CasePeriod,
  CasePlan,
  PlannedParentalPart,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { roles } from '../plan/caseLabels';
import {
  addDaysIso,
  computeParentalUsage,
  formatDaysPl,
  formatPolishDate,
  formatWeeksPl,
  formatWorkFraction,
  getEventDate,
  getLeavePlanPresets,
  getParentalStartDate,
  getPartDays,
  getWorkFractionQuickOptions,
  isChildLossNoParental,
  type LeavePlanPresetId,
} from './leavePlanHelpers';
import { getPaternityDeadline, type LeaveValidationIssue } from './leavePlanValidation';
import { SuperText } from '../../components/SuperText';

interface LeaveSplitPlannerProps {
  input: CaseInputs;
  plan: CasePlan;
  params: BenefitParams;
  parts: PlannedParentalPart[];
  activePreset: LeavePlanPresetId | null;
  motherAvailable: boolean;
  fatherAvailable: boolean;
  validationIssues: LeaveValidationIssue[];
  onSelectPreset: (presetId: LeavePlanPresetId) => void;
  onUpdate: (patch: Partial<CaseInputs>) => void;
}

export function LeaveSplitPlanner({
  input,
  plan,
  params,
  parts,
  activePreset,
  motherAvailable,
  fatherAvailable,
  validationIssues,
  onSelectPreset,
  onUpdate,
}: LeaveSplitPlannerProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const presets = useMemo(() => getLeavePlanPresets(params), [params]);
  const workQuickOptions = useMemo(() => getWorkFractionQuickOptions(params), [params]);
  const usage = useMemo(
    () => computeParentalUsage(parts, input, plan, params),
    [parts, input, plan, params],
  );
  const childLossNoParental = isChildLossNoParental(input, plan);
  const parentalDeadline = plan.outcome.parental_deadline;
  const paternityDeadline = useMemo(() => getPaternityDeadline(input, params), [input, params]);

  const errors = validationIssues.filter((item) => item.severity === 'error');
  const warnings = validationIssues.filter((item) => item.severity === 'warning');

  const poolPct =
    usage.poolWeeks > 0 ? Math.min(100, Math.round((usage.totalWeeks / usage.poolWeeks) * 100)) : 0;

  const workExtensionByParentStart = useMemo(() => {
    const map = new Map<string, CasePeriod>();
    const periods = plan.outcome.periods.filter((p) => !p.denied);
    for (let i = 0; i < periods.length; i += 1) {
      const current = periods[i];
      const next = periods[i + 1];
      if (
        (current.leave_type === 'PARENTAL' ||
          current.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION') &&
        next?.leave_type === 'PARENTAL_WORK_EXTENSION' &&
        next.parent_role === current.parent_role
      ) {
        map.set(`${current.parent_role}:${current.start_date}`, next);
      }
    }
    return map;
  }, [plan.outcome.periods]);

  const nextStartBase = useMemo(() => {
    if (parts.length > 0) {
      const lastEnd = parts
        .map((p) => p.end_date)
        .filter(Boolean)
        .sort()
        .at(-1);
      if (lastEnd) return addDaysIso(lastEnd, 1);
    }
    return (
      plan.default_father_parental_start_date ??
      getParentalStartDate(input, plan) ??
      getEventDate(input)
    );
  }, [parts, plan, input]);

  function editPart(index: number, patch: Partial<PlannedParentalPart>) {
    onUpdate({
      parental_leave_parts: parts.map((part, i) => (index === i ? { ...part, ...patch } : part)),
    });
  }

  function handleAddPart() {
    if (!nextStartBase) return;
    const defaultRole: ApplicantRole =
      usage.remainingByRole.FATHER > 0 && fatherAvailable && usage.remainingByRole.MOTHER === 0
        ? 'FATHER'
        : usage.remainingByRole.MOTHER > 0 && motherAvailable
          ? 'MOTHER'
          : input.applicant_role;
    const availableWeeks = Math.max(
      1,
      Math.min(
        usage.remainingByRole[defaultRole] || 1,
        params.parentalLeave.nonTransferableWeeksPerParent,
      ),
    );
    const newPart: PlannedParentalPart = {
      parent_role: defaultRole,
      start_date: nextStartBase,
      end_date: addDaysIso(nextStartBase, availableWeeks * params.calendar.daysPerWeek - 1),
      work_fraction: 0,
    };
    onUpdate({ parental_leave_parts: [...parts, newPart] });
  }

  const maxPartsReached = parts.length >= params.parentalLeave.maxParts;
  const mandatoryMotherWeeks = input.special_circumstances.mother_hospitalized_or_incapable
    ? params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate
    : params.maternityLeave.motherMandatoryWeeksAfterBirth;

  return (
    <section className="lp-card" aria-labelledby="planner-heading">
      <div className="lp-card__header">
        <div>
          <h3 id="planner-heading" className="lp-card__title">
            Jak chcecie podzielić urlop?
          </h3>
          {childLossNoParental ? (
            <p className="lp-card__lead">
              W tej sytuacji przysługuje skrócony urlop macierzyński. Urlop rodzicielski nie
              przysługuje.
            </p>
          ) : (
            <p className="lp-card__lead">
              Wybierz gotowy scenariusz podziału – oś czasu, terminy wniosków i daty powrotu
              przeliczą się od razu.
            </p>
          )}
        </div>
      </div>

      {/* Komunikaty walidacji – zawsze widoczne poza <details> */}
      {errors.length > 0 && (
        <div className="lp-planner-errors" role="alert">
          <h4 className="lp-planner-errors__title">Sprawdź ograniczenia ustawowe:</h4>
          <ul>
            {errors.map((err, idx) => (
              <li key={`${err.code}-${idx}`}>
                {err.message}
                {err.legalBasis && <span className="lp-legal"> (<SuperText text={err.legalBasis} />)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="lp-planner-warnings" role="status">
          <ul>
            {warnings.map((warn, idx) => (
              <li key={`${warn.code}-${idx}`}>
                {warn.message}
                {warn.legalBasis && <span className="lp-legal"> (<SuperText text={warn.legalBasis} />)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!childLossNoParental && usage.poolWeeks > 0 && errors.length === 0 && parts.length > 0 && (
        <div className="lp-planner-success" role="status">
          <strong>Podział zgodny z Kodeksem pracy.</strong> Wykorzystano{' '}
          {formatWeeksPl(usage.totalWeeks)} z {usage.poolWeeks} tyg. urlopu rodzicielskiego (Mama:{' '}
          {formatWeeksPl(usage.motherWeeks)}
          {fatherAvailable && <>, Tata: {formatWeeksPl(usage.fatherWeeks)}</>}).
        </div>
      )}

      {!childLossNoParental && usage.poolWeeks > 0 && (
        <>
          {/* Gotowe scenariusze podziału */}
          <div className="lp-presets-section" aria-label="Gotowe scenariusze podziału urlopu">
            <div className="lp-presets-grid">
              {presets.map((preset) => {
                const isSelected = activePreset === preset.id;
                const missingFather = preset.requiresFather && !fatherAvailable;
                const missingMother = preset.requiresMother && !motherAvailable;
                const disabled = missingFather || missingMother;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    className={
                      isSelected ? 'lp-preset-card lp-preset-card--active' : 'lp-preset-card'
                    }
                    aria-pressed={isSelected}
                    onClick={() => onSelectPreset(preset.id)}
                  >
                    <span className="lp-preset-card__title">{preset.title}</span>
                    <span className="lp-preset-card__desc">
                      {missingFather
                        ? 'Wymaga potwierdzonego ubezpieczenia taty w planie.'
                        : missingMother
                          ? 'Wymaga potwierdzonego ubezpieczenia mamy w planie.'
                          : preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ręczna edycja części, łączenie z pracą i pozostałe daty – zwinięte w <details> */}
          <details
            className="lp-details"
            open={manualOpen}
            onToggle={(event) => setManualOpen(event.currentTarget.open)}
          >
            <summary className="lp-details__summary">Ułóż ręcznie / połącz z pracą</summary>
            <div className="lp-details__body">
              <div className="lp-manual-intro">
                <p className="lp-card__lead">
                  Urlop rodzicielski można podzielić na maksymalnie {params.parentalLeave.maxParts}{' '}
                  części i wykorzystać jednocześnie lub naprzemiennie
                  {parentalDeadline ? ` do ${formatPolishDate(parentalDeadline)}` : ''}. Po{' '}
                  {usage.nonTransferableWeeks} tyg. jest nieprzenoszalne dla każdego z rodziców.
                </p>
                {input.parental_leave_parts && !input.parental_only && (
                  <button
                    type="button"
                    className="plan-btn plan-btn--secondary"
                    onClick={() => onUpdate({ parental_leave_parts: undefined })}
                  >
                    Przywróć proponowany rozkład
                  </button>
                )}
              </div>

              {/* Pasek wykorzystania puli */}
              <div
                className="lp-pool-progress"
                aria-label="Wykorzystanie puli urlopu rodzicielskiego"
              >
                <div className="lp-pool-progress__top">
                  <strong>
                    Wykorzystano {formatWeeksPl(usage.totalWeeks)} z {usage.poolWeeks} tyg. urlopu
                    rodzicielskiego
                  </strong>
                  <span className="lp-pool-progress__breakdown">
                    Mama: {formatWeeksPl(usage.motherWeeks)} · Tata:{' '}
                    {formatWeeksPl(usage.fatherWeeks)} · Części: {parts.length}/
                    {params.parentalLeave.maxParts}
                  </span>
                </div>
                <div
                  className="lp-pool-progress__track"
                  role="progressbar"
                  aria-valuenow={Math.round(usage.totalWeeks)}
                  aria-valuemin={0}
                  aria-valuemax={usage.poolWeeks}
                >
                  <div className="lp-pool-progress__fill" style={{ width: `${poolPct}%` }} />
                </div>
                <p className="lp-pool-progress__note">
                  Pozostało w puli: <strong>{usage.remainingTotalWeeks} tyg.</strong> (Mama: do{' '}
                  {usage.remainingByRole.MOTHER} tyg.
                  {fatherAvailable && <>, Tata: do {usage.remainingByRole.FATHER} tyg.</>}).
                </p>
              </div>

              <h4 className="lp-planner-subtitle">
                Części urlopu rodzicielskiego ({parts.length}/{params.parentalLeave.maxParts})
              </h4>

              {parts.length === 0 ? (
                <p className="lp-card__empty">
                  Brak zaplanowanych części urlopu rodzicielskiego. Wybierz gotowy scenariusz
                  powyżej lub dodaj część poniżej.
                </p>
              ) : (
                <div className="lp-manual-parts">
                  {parts.map((part, index) => {
                    const role = part.parent_role ?? input.applicant_role;
                    const days = getPartDays(part);
                    const weeks =
                      days > 0 ? Math.round((days / params.calendar.daysPerWeek) * 10) / 10 : 0;
                    const workFraction = part.work_fraction ?? 0;
                    const extensionPeriod = workExtensionByParentStart.get(
                      `${role}:${part.start_date}`,
                    );

                    return (
                      <fieldset className="lp-part-fieldset" key={index}>
                        <legend className="lp-part-fieldset__legend">
                          Część {index + 1}
                          {days > 0 && (
                            <span className="lp-part-fieldset__meta">
                              {' '}
                              ({formatWeeksPl(weeks)} / {formatDaysPl(days)})
                            </span>
                          )}
                        </legend>

                        <div className="lp-part-fields">
                          <label className="lp-field">
                            <span>Rodzic</span>
                            <select
                              className="plan-field__input"
                              value={role}
                              onChange={(event) =>
                                editPart(index, {
                                  parent_role:
                                    event.target.value === roles[1] ? roles[1] : roles[0],
                                })
                              }
                            >
                              <option value="MOTHER">Matka</option>
                              <option value="FATHER">Ojciec</option>
                            </select>
                          </label>

                          <label className="lp-field">
                            <span>Początek</span>
                            <input
                              aria-label={`Początek części ${index + 1}`}
                              type="date"
                              className="plan-field__input"
                              value={part.start_date}
                              onChange={(event) => {
                                if (event.target.value) {
                                  editPart(index, { start_date: event.target.value });
                                }
                              }}
                            />
                          </label>

                          <label className="lp-field">
                            <span>Koniec</span>
                            <input
                              aria-label={`Koniec części ${index + 1}`}
                              type="date"
                              className="plan-field__input"
                              value={part.end_date}
                              onChange={(event) => {
                                if (event.target.value) {
                                  editPart(index, { end_date: event.target.value });
                                }
                              }}
                            />
                          </label>

                          <label className="lp-field">
                            <span>
                              Część etatu podczas urlopu (maks.{' '}
                              {formatWorkFraction(params.parentalLeave.maxWorkTimeFraction)})
                            </span>
                            <input
                              aria-label={`Część etatu podczas urlopu w części ${index + 1}`}
                              className="plan-field__input"
                              type="number"
                              min="0"
                              max={params.parentalLeave.maxWorkTimeFraction}
                              step="0.05"
                              value={workFraction}
                              onChange={(event) =>
                                editPart(index, { work_fraction: Number(event.target.value) })
                              }
                            />
                          </label>
                        </div>

                        <div
                          className="lp-work-quick-row"
                          aria-label={`Szybki wybór etatu dla części ${index + 1}`}
                        >
                          {workQuickOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={
                                Math.abs(workFraction - opt.value) < 0.001
                                  ? 'lp-quick-chip lp-quick-chip--active'
                                  : 'lp-quick-chip'
                              }
                              onClick={() => editPart(index, { work_fraction: opt.value })}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {workFraction > 0 && extensionPeriod && (
                          <p className="lp-work-result" role="status">
                            <strong>
                              Wydłużenie po pracy ({formatWorkFraction(workFraction)}):
                            </strong>{' '}
                            {formatPolishDate(extensionPeriod.start_date)} –{' '}
                            {formatPolishDate(extensionPeriod.end_date)} (+
                            {formatWeeksPl(extensionPeriod.weeks)} / {formatDaysPl(extensionPeriod.days)}).
                            Powrót do pracy po tej części:{' '}
                            <strong>
                              {formatPolishDate(addDaysIso(extensionPeriod.end_date, 1))}
                            </strong>
                            .
                          </p>
                        )}

                        <div className="lp-part-actions">
                          <button
                            type="button"
                            className="lp-parts-item__remove"
                            onClick={() =>
                              onUpdate({
                                parental_leave_parts: parts.filter((_, i) => i !== index),
                              })
                            }
                          >
                            Usuń część
                          </button>
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              )}

              {maxPartsReached && (
                <p className="lp-limit-notice lp-limit-notice--warn" role="status">
                  Osiągnięto limit {params.parentalLeave.maxParts} części urlopu rodzicielskiego.
                </p>
              )}

              <div className="lp-manual-actions">
                {nextStartBase && (
                  <button
                    type="button"
                    className="plan-btn plan-btn--secondary"
                    disabled={maxPartsReached}
                    onClick={handleAddPart}
                  >
                    Dodaj część
                  </button>
                )}
              </div>

              {/* Pozostałe daty: macierzyński przed porodem, ojcowski, przejęcie macierzyńskiego */}
              <div className="lp-extra-leaves" aria-labelledby="extra-leaves-heading">
                <h4 id="extra-leaves-heading" className="lp-planner-subtitle">
                  Pozostałe daty (macierzyński i ojcowski)
                </h4>
                <div className="lp-extra-grid">
                  {input.applicant_role === 'MOTHER' && input.stage !== 'ADOPTION' && (
                    <div className="lp-extra-card">
                      <label className="lp-field">
                        <span>Początek macierzyńskiego</span>
                        <input
                          type="date"
                          className="plan-field__input"
                          value={input.maternity_leave_start_date ?? input.due_or_birth_date ?? ''}
                          onChange={(event) =>
                            onUpdate({
                              maternity_leave_start_date: event.target.value || undefined,
                            })
                          }
                        />
                      </label>
                      <p className="lp-extra-card__hint">
                        Można rozpocząć do {params.maternityLeave.maxWeeksBeforeBirth} tyg. przed
                        przewidywaną datą porodu (stawka {formatRate(params.rates.maternity)} lub{' '}
                        {formatRate(params.rates.combined)}).
                      </p>
                    </div>
                  )}

                  <div className="lp-extra-card">
                    <label className="lp-field">
                      <span>Początek ojcowskiego</span>
                      <input
                        type="date"
                        className="plan-field__input"
                        value={input.paternity_leave_start_date ?? ''}
                        onChange={(event) =>
                          onUpdate({ paternity_leave_start_date: event.target.value || undefined })
                        }
                      />
                    </label>
                    <p className="lp-extra-card__hint">
                      {params.paternityLeave.weeks} tyg. ({formatRate(params.rates.paternity)}), do
                      wykorzystania w ciągu {params.paternityLeave.deadlineChildAgeMonths} mies.
                      {paternityDeadline ? ` (do ${formatPolishDate(paternityDeadline)})` : ''}.
                    </p>
                  </div>

                  {input.applicant_role === 'MOTHER' && input.stage !== 'ADOPTION' && (
                    <div className="lp-extra-card">
                      <label className="lp-field">
                        <span>Przejęcie macierzyńskiego przez ojca</span>
                        <input
                          type="date"
                          className="plan-field__input"
                          value={input.father_takeover_date ?? ''}
                          onChange={(event) =>
                            onUpdate({ father_takeover_date: event.target.value || undefined })
                          }
                        />
                      </label>
                      <p className="lp-extra-card__hint">
                        Możliwe po wykorzystaniu przez matkę pierwszych {mandatoryMotherWeeks} tyg.
                        po porodzie (wymaga ubezpieczenia chorobowego ojca).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
