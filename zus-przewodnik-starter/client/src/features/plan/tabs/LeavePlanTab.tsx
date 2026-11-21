import { useEffect, useState } from 'react';
import type {
  BenefitParams,
  LeavePartRequest,
  MaternityCalculationResult,
  ParentRole,
  ParentalSplitResult,
  ParentalWithWorkResult,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../../app/benefitParams';
import { fetchParentalSplit, fetchParentalWithWork } from '../planApi';
import {
  addDaysIso,
  formatLeaveType,
  formatParentRole,
  formatPln,
  formatPolishDate,
  getScenarioEventDate,
} from '../planScenario';

interface LeavePlanTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
}

export function LeavePlanTab({ scenario, params, maternity }: LeavePlanTabProps) {
  const totalParentalPool = scenario.special.zaZyciemCertificate
    ? scenario.childrenCount > 1
      ? params.parentalLeave.weeksMultipleChildrenZaZyciem
      : params.parentalLeave.weeksSingleChildZaZyciem
    : scenario.childrenCount > 1
      ? params.parentalLeave.weeksMultipleChildren
      : params.parentalLeave.weeksSingleChild;

  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const maxPerParent = totalParentalPool - nonTransferable;

  const [motherParentalWeeks, setMotherParentalWeeks] = useState<number>(maxPerParent);
  const [fatherParentalWeeks, setFatherParentalWeeks] = useState<number>(nonTransferable);
  const [splitResult, setSplitResult] = useState<ParentalSplitResult | null>(null);

  const [workParent, setWorkParent] = useState<ParentRole>('mother');
  const [workFraction, setWorkFraction] = useState<number>(0.5);
  const [workWeeks, setWorkWeeks] = useState<number>(12);
  const [workResult, setWorkResult] = useState<ParentalWithWorkResult | null>(null);

  const effectiveMotherWeeks = Math.min(motherParentalWeeks, totalParentalPool);
  const effectiveFatherWeeks = scenario.father
    ? Math.min(fatherParentalWeeks, totalParentalPool)
    : 0;

  const maternityEnd =
    maternity.periods.find((p) => p.leaveType === 'maternityLeave' || p.leaveType === 'adoptionMaternityLeave')
      ?.endDate ?? addDaysIso(getScenarioEventDate(scenario), 20 * 7 - 1);
  const parentalStart = addDaysIso(maternityEnd, 1);

  useEffect(() => {
    let active = true;
    const parts: LeavePartRequest[] = [];
    let cursor = parentalStart;

    if (effectiveMotherWeeks > 0) {
      parts.push({
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: cursor,
        weeks: effectiveMotherWeeks,
      });
      cursor = addDaysIso(cursor, effectiveMotherWeeks * 7);
    }
    if (scenario.father && effectiveFatherWeeks > 0) {
      parts.push({
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: cursor,
        weeks: effectiveFatherWeeks,
      });
    }

    fetchParentalSplit({ scenario, parts }, params).then((result) => {
      if (active) setSplitResult(result);
    });

    return () => {
      active = false;
    };
  }, [scenario, params, effectiveMotherWeeks, effectiveFatherWeeks, parentalStart]);

  useEffect(() => {
    let active = true;
    const effectiveRole: ParentRole =
      workParent === 'father' && !scenario.father ? 'mother' : workParent;
    fetchParentalWithWork(
      {
        scenario,
        parentRole: effectiveRole,
        workTimeFraction: workFraction,
        startDate: parentalStart,
        weeks: workWeeks,
      },
      params,
    ).then((result) => {
      if (active) setWorkResult(result);
    });
    return () => {
      active = false;
    };
  }, [scenario, params, workParent, workFraction, workWeeks, parentalStart]);

  // Oś czasu: urlop macierzyński / uzupełniający z maternity + zaktualizowany podział rodzicielskiego + ojcowski
  const baseNonParentalPeriods = maternity.periods.filter(
    (p) => p.leaveType !== 'parentalLeave',
  );
  const timelinePeriods = [
    ...baseNonParentalPeriods,
    ...(splitResult?.periods ?? maternity.periods.filter((p) => p.leaveType === 'parentalLeave')),
  ];
  const motherPeriods = timelinePeriods.filter((p) => p.parentRole === 'mother');
  const fatherPeriods = timelinePeriods.filter((p) => p.parentRole === 'father');
  const maxTotalWeeks = Math.max(
    1,
    motherPeriods.reduce((sum, p) => sum + p.weeks, 0) +
      fatherPeriods.reduce((sum, p) => sum + p.weeks, 0),
  );

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="plan-section__title">
          Oś czasu urlopów obojga rodziców
        </h2>
        <p className="plan-section__lead">
          Wizualny rozkład urlopów matki i ojca (macierzyński, uzupełniający, rodzicielski oraz
          ojcowski). Matka musi wykorzystać min. {params.maternityLeave.motherMandatoryWeeksAfterBirth}{' '}
          tyg. po porodzie, a każdy rodzic ma {nonTransferable} tyg. nieprzenoszalnego urlopu
          rodzicielskiego.
        </p>

        <div className="timeline">
          <div className="timeline__row">
            <div className="timeline__label">Matka</div>
            <div className="timeline__track" aria-label="Oś czasu urlopów matki">
              {motherPeriods.length === 0 ? (
                <span className="timeline__empty">Brak zaplanowanych okresów</span>
              ) : (
                motherPeriods.map((period) => (
                  <div
                    key={`m-${period.leaveType}-${period.startDate}-${period.weeks}`}
                    className={`timeline__bar timeline__bar--${period.leaveType}`}
                    style={{ flexGrow: Math.max(period.weeks, 2) }}
                    title={`${formatLeaveType(period.leaveType)}: ${formatPolishDate(period.startDate)} – ${formatPolishDate(period.endDate)}`}
                  >
                    <strong>{formatLeaveType(period.leaveType)}</strong>
                    <span>
                      {period.weeks} tyg. · {formatRate(period.rate)}
                    </span>
                    <span className="timeline__dates">
                      {formatPolishDate(period.startDate)} – {formatPolishDate(period.endDate)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="timeline__row">
            <div className="timeline__label">Ojciec / drugi rodzic</div>
            <div className="timeline__track" aria-label="Oś czasu urlopów drugiego rodzica">
              {!scenario.father || fatherPeriods.length === 0 ? (
                <span className="timeline__empty">
                  {scenario.father
                    ? 'Przydziel tygodnie poniżej, aby zobaczyć oś czasu drugiego rodzica.'
                    : 'Drugi rodzic nie jest uwzględniony w planie (możesz włączyć go w parametrach u góry).'}
                </span>
              ) : (
                fatherPeriods.map((period) => (
                  <div
                    key={`f-${period.leaveType}-${period.startDate}-${period.weeks}`}
                    className={`timeline__bar timeline__bar--${period.leaveType} timeline__bar--father`}
                    style={{
                      flexGrow: Math.max(period.weeks, 2),
                      minWidth: `${Math.min(100, Math.round((period.weeks / maxTotalWeeks) * 100))}%`,
                    }}
                    title={`${formatLeaveType(period.leaveType)}: ${formatPolishDate(period.startDate)} – ${formatPolishDate(period.endDate)}`}
                  >
                    <strong>{formatLeaveType(period.leaveType)}</strong>
                    <span>
                      {period.weeks} tyg. · {formatRate(period.rate)}
                    </span>
                    <span className="timeline__dates">
                      {formatPolishDate(period.startDate)} – {formatPolishDate(period.endDate)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="plan-section" aria-labelledby="split-heading">
        <h2 id="split-heading" className="plan-section__title">
          Podział urlopu rodzicielskiego ({totalParentalPool} tyg. łącznie)
        </h2>
        <p className="plan-section__lead">
          Urlop rodzicielski można podzielić na max {params.parentalLeave.maxParts} części i
          wykorzystać do końca roku, w którym dziecko kończy{' '}
          {params.parentalLeave.deadlineChildTurnsAgeYears} lat. Każdy rodzic ma gwarantowane{' '}
          {nonTransferable} tyg. nieprzenoszalne (max {maxPerParent} tyg. dla jednego rodzica).
        </p>

        <div className="leave-split-controls">
          <label className="plan-field">
            <span className="plan-field__label">
              Urlop rodzicielski matki: <strong>{effectiveMotherWeeks} tyg.</strong> (max{' '}
              {maxPerParent} tyg.)
            </span>
            <input
              type="range"
              min={0}
              max={totalParentalPool}
              value={effectiveMotherWeeks}
              aria-label="Tygodnie urlopu rodzicielskiego matki"
              onChange={(e) => setMotherParentalWeeks(Number(e.target.value))}
            />
          </label>

          <label className="plan-field">
            <span className="plan-field__label">
              Urlop rodzicielski drugiego rodzica: <strong>{effectiveFatherWeeks} tyg.</strong> (min{' '}
              {nonTransferable} tyg. aby nie przepadły)
            </span>
            <input
              type="range"
              min={0}
              max={totalParentalPool}
              disabled={!scenario.father}
              value={effectiveFatherWeeks}
              aria-label="Tygodnie urlopu rodzicielskiego drugiego rodzica"
              onChange={(e) => setFatherParentalWeeks(Number(e.target.value))}
            />
          </label>
        </div>

        {splitResult && !splitResult.valid && (
          <div className="plan-callout plan-callout--warning" role="alert">
            <strong>Niepoprawny podział urlopu rodzicielskiego:</strong>
            <ul>
              {splitResult.errors.map((err) => (
                <li key={err.message}>
                  {err.message} {err.legalBasis && <span className="plan-legal">({err.legalBasis})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {splitResult && splitResult.valid && (
          <div className="plan-callout plan-callout--success">
            <strong>Podział zgodny z Kodeksem pracy.</strong> Pozostało do wykorzystania: matka{' '}
            <strong>{splitResult.remainingWeeks.mother} tyg.</strong>, drugi rodzic{' '}
            <strong>{splitResult.remainingWeeks.father} tyg.</strong>
          </div>
        )}
      </section>

      <section className="plan-section" aria-labelledby="work-combine-heading">
        <h2 id="work-combine-heading" className="plan-section__title">
          Łączenie urlopu rodzicielskiego z pracą (do {params.parentalLeave.maxWorkTimeFraction}{' '}
          etatu)
        </h2>
        <p className="plan-section__lead">
          Możesz łączyć urlop rodzicielski z pracą na maksymalnie pół etatu. Urlop ulega wtedy
          proporcjonalnemu wydłużeniu (KP art. 182¹f), a zasiłek w czasie pracy jest zmniejszony
          proporcjonalnie do etatu.
        </p>

        <div className="plan-controls__grid">
          <label className="plan-field">
            <span className="plan-field__label">Rodzic łączący urlop z pracą</span>
            <select
              className="plan-field__input"
              value={workParent}
              onChange={(e) => setWorkParent(e.target.value as ParentRole)}
            >
              <option value="mother">Matka</option>
              {scenario.father && <option value="father">Ojciec / drugi rodzic</option>}
            </select>
          </label>

          <label className="plan-field">
            <span className="plan-field__label">Wymiar etatu podczas urlopu</span>
            <select
              className="plan-field__input"
              value={workFraction}
              onChange={(e) => setWorkFraction(Number(e.target.value))}
            >
              <option value={0.25}>1/4 etatu (0,25)</option>
              <option value={0.5}>1/2 etatu (0,50 – maksimum)</option>
            </select>
          </label>

          <label className="plan-field">
            <span className="plan-field__label">Liczba tygodni łączonych z pracą</span>
            <input
              type="number"
              min={1}
              max={maxPerParent}
              className="plan-field__input"
              value={workWeeks}
              onChange={(e) => setWorkWeeks(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        {workResult && (
          <div className="work-combine-result">
            <div className="calc-summary-cards">
              <div className="calc-kpi-card calc-kpi-card--highlight">
                <span className="calc-kpi-card__label">Wydłużenie urlopu rodzicielskiego</span>
                <strong className="calc-kpi-card__value">
                  +{workResult.extendedWeeks} tyg. ({workResult.extendedDays} dni)
                </strong>
                <span className="calc-kpi-card__hint">
                  Dotyczy: {formatParentRole(workParent)}
                </span>
              </div>
              {workResult.periods.map((period, idx) => (
                <div key={`${period.startDate}-${idx}`} className="calc-kpi-card">
                  <span className="calc-kpi-card__label">
                    {idx === 0 ? 'Okres pracy + obniżony zasiłek' : 'Okres wydłużenia (pełny zasiłek)'}
                  </span>
                  <strong className="calc-kpi-card__value">
                    {formatPln(period.monthlyAmount)} / mies.
                  </strong>
                  <span className="calc-kpi-card__hint">
                    {formatPolishDate(period.startDate)} – {formatPolishDate(period.endDate)} (
                    {formatRate(period.rate)}, suma {formatPln(period.totalAmount)})
                  </span>
                </div>
              ))}
            </div>
            {workResult.explanations.map((exp) => (
              <p key={exp.message} className="calc-sickness-box__note">
                {exp.message}{' '}
                {exp.legalBasis && <span className="plan-legal">({exp.legalBasis})</span>}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
