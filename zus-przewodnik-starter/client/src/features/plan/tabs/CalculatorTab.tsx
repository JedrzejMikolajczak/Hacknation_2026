import { Link, useLocation } from 'react-router-dom';
import type {
  BenefitParams,
  LeavePeriod,
  MaternityCalculationResult,
  RateVariant,
  ScenarioInput,
  SicknessResult,
} from '@shared/types';
import { formatRate } from '../../../app/benefitParams';
import type { ComputedBaseInfo } from '../PlanPage';
import {
  formatLeaveType,
  formatParentRole,
  formatPln,
  formatPolishDate,
  isDifficultSituation,
} from '../planScenario';
import './CalculatorTab.css';

interface CalculatorTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  sickness: SicknessResult;
  onScenarioChange: (next: ScenarioInput) => void;
  missingFields?: string[];
  wizardHref?: string;
  computedBases?: ComputedBaseInfo;
  hasMotherInPlan?: boolean;
}

function formatWeeksPl(weeks: number): string {
  if (weeks === 1) return '1 tydzień';
  const mod10 = weeks % 10;
  const mod100 = weeks % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${weeks} tygodnie`;
  }
  return `${weeks} tygodni`;
}

function summarizePeriods(periods: LeavePeriod[]): {
  weeks: number;
  days: number;
  totalAmount: number;
  weightedMonthlyAmount: number;
} {
  const weeks = periods.reduce((sum, period) => sum + period.weeks, 0);
  const days = periods.reduce((sum, period) => sum + period.days, 0);
  const totalAmount = periods.reduce((sum, period) => sum + period.totalAmount, 0);
  const weightedMonthlyAmount =
    days > 0
      ? periods.reduce((sum, period) => sum + period.monthlyAmount * period.days, 0) / days
      : 0;
  return { weeks, days, totalAmount, weightedMonthlyAmount };
}

export function CalculatorTab({
  scenario,
  params,
  maternity,
  sickness,
  onScenarioChange,
  missingFields = [],
  wizardHref = '/wizard',
  computedBases,
  hasMotherInPlan = true,
}: CalculatorTabProps) {
  const { search } = useLocation();
  const difficult = isDifficultSituation(scenario);
  const childLostAll =
    (scenario.special.stillbirth || scenario.special.childDeathDate !== null) &&
    scenario.childrenCount <= 1;

  if (missingFields.length > 0) {
    return (
      <div className="calc-tab">
        <section
          className="calc-answer calc-answer--missing"
          aria-labelledby="calc-missing-heading"
        >
          <div className="plan-missing-data" role="status">
            <h2 id="calc-missing-heading" className="calc-answer__title">
              Uzupełnij dane, aby wyliczyć zasiłek
            </h2>
            <p className="calc-answer__lead">
              Nie podstawiamy zmyślonych kwot ani dat. Do wyliczenia brakuje:
            </p>
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="calc-next" aria-label="Następny krok">
          <Link to={`/plan/leave-plan${search}`} className="calc-next__link">
            Dalej: Plan urlopów ›
          </Link>
        </nav>
      </div>
    );
  }

  function setRateVariant(variant: RateVariant) {
    onScenarioChange({ ...scenario, rateVariant: variant });
  }

  const motherPeriods = maternity.periods.filter((period) => period.parentRole === 'mother');
  const fatherPeriods = maternity.periods.filter((period) => period.parentRole === 'father');
  const primaryPeriods = motherPeriods.length > 0 ? motherPeriods : fatherPeriods;
  const secondaryPeriods = motherPeriods.length > 0 ? fatherPeriods : [];

  const primarySummary = summarizePeriods(primaryPeriods);
  const secondarySummary = summarizePeriods(secondaryPeriods);

  const variantLabel = childLostAll
    ? `stawka ${formatRate(params.rates.maternity)}`
    : scenario.rateVariant === 'combined'
      ? `wariant ${formatRate(params.rates.combined)}`
      : `wariant ${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`;

  const otherVariantLabel =
    scenario.rateVariant === 'combined'
      ? `Wariant ${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`
      : `Wariant ${formatRate(params.rates.combined)}`;

  const otherVariantTotal =
    maternity.variants !== null
      ? scenario.rateVariant === 'combined'
        ? maternity.variants.standard
        : maternity.variants.combined
      : null;

  const selectedVariantTotal =
    maternity.variants !== null
      ? scenario.rateVariant === 'combined'
        ? maternity.variants.combined
        : maternity.variants.standard
      : null;

  const otherVariantDiff =
    otherVariantTotal !== null && selectedVariantTotal !== null
      ? otherVariantTotal - selectedVariantTotal
      : null;

  const hasAutoBases = Boolean(
    computedBases && (computedBases.mother || computedBases.father || computedBases.sickness),
  );

  const autoBaseLeadAmount =
    computedBases?.mother?.benefitBase ??
    computedBases?.father?.benefitBase ??
    computedBases?.sickness?.benefitBase ??
    null;

  const sicknessSummaryText = sickness.entitled
    ? sickness.dailyAmount !== null
      ? `przysługuje (${formatPln(sickness.dailyAmount)} / dzień)`
      : 'przysługuje'
    : 'nie przysługuje';

  return (
    <div className="calc-tab">
      <section
        className={maternity.periods.length > 0 ? 'calc-answer' : 'calc-answer calc-answer--empty'}
        aria-labelledby="calc-answer-heading"
      >
        <h2 id="calc-answer-heading" className="calc-answer__title">
          {difficult ? 'Szacowana wysokość zasiłku' : 'Twój szacowany zasiłek'}
        </h2>

        {maternity.periods.length === 0 ? (
          <>
            <p className="calc-answer__headline">
              Dla podanych danych zasiłek macierzyński nie przysługuje.
            </p>
            <p className="calc-answer__sub">
              Sprawdź przyczyny w zakładce Uprawnienia lub uzupełnij dane w formularzu.
            </p>
          </>
        ) : (
          <>
            <p className="calc-answer__headline">
              {difficult
                ? `Szacowany zasiłek: ok. ${formatPln(primarySummary.weightedMonthlyAmount)} miesięcznie przez ${formatWeeksPl(primarySummary.weeks)} (${variantLabel}).`
                : `Otrzymasz ok. ${formatPln(primarySummary.weightedMonthlyAmount)} miesięcznie przez ${formatWeeksPl(primarySummary.weeks)} (${variantLabel}).`}
            </p>

            <p className="calc-answer__total">
              Łącznie: <strong>{formatPln(maternity.totalAmount)}</strong>
              {secondarySummary.weeks > 0 && (
                <span className="calc-answer__sub">
                  {' '}
                  (w tym dla ojca: {formatWeeksPl(secondarySummary.weeks)} –{' '}
                  {formatPln(secondarySummary.totalAmount)})
                </span>
              )}
            </p>

            {otherVariantTotal !== null && (
              <p className="calc-answer__compare">
                {otherVariantLabel}: łącznie <strong>{formatPln(otherVariantTotal)}</strong>
                {otherVariantDiff !== null && Math.abs(otherVariantDiff) >= 0.01 && (
                  <span>
                    {' '}
                    ({otherVariantDiff > 0 ? '+' : ''}
                    {formatPln(otherVariantDiff)} względem wybranego)
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </section>

      <section className="calc-controls" aria-label="Opcje kalkulatora">
        {!childLostAll && (
          <div className="calc-controls__group">
            <span className="plan-field__label">Wariant stawki</span>
            <div
              className="calc-controls__segmented"
              role="group"
              aria-label="Wybór wariantu stawki"
            >
              <button
                type="button"
                className={
                  scenario.rateVariant === 'combined'
                    ? 'calc-controls__btn calc-controls__btn--active'
                    : 'calc-controls__btn'
                }
                aria-pressed={scenario.rateVariant === 'combined'}
                onClick={() => setRateVariant('combined')}
              >
                {formatRate(params.rates.combined)} za cały okres
              </button>
              <button
                type="button"
                className={
                  scenario.rateVariant === 'standard'
                    ? 'calc-controls__btn calc-controls__btn--active'
                    : 'calc-controls__btn'
                }
                aria-pressed={scenario.rateVariant === 'standard'}
                onClick={() => setRateVariant('standard')}
              >
                {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}
              </button>
            </div>
          </div>
        )}

        <label className="plan-field">
          <span className="plan-field__label">Liczba dzieci</span>
          <select
            className="plan-field__input"
            aria-label="Liczba dzieci w kalkulatorze"
            value={scenario.childrenCount}
            onChange={(e) =>
              onScenarioChange({ ...scenario, childrenCount: Number(e.target.value) })
            }
          >
            <option value={1}>1 dziecko</option>
            <option value={2}>2 dzieci</option>
            <option value={3}>3 dzieci</option>
            <option value={4}>4 dzieci</option>
            <option value={5}>5 lub więcej dzieci</option>
          </select>
        </label>
      </section>

      {hasAutoBases && computedBases && (
        <div className="calc-base-note" aria-label="Wyliczona podstawa wymiaru">
          <p className="calc-base-note__summary-line">
            Podstawę wyliczono z podanych zarobków
            {autoBaseLeadAmount !== null ? `: ${formatPln(autoBaseLeadAmount)}.` : '.'}
          </p>
          <details className="calc-details calc-details--inline">
            <summary className="calc-details__summary">Zobacz szczegóły podstawy</summary>
            <div className="calc-details__body">
              <ul className="calc-explanations-list">
                {computedBases.sickness && (
                  <li>
                    Podstawa zasiłku chorobowego w ciąży:{' '}
                    <strong>{formatPln(computedBases.sickness.benefitBase)}</strong>
                    {computedBases.sickness.explanations[0]?.legalBasis && (
                      <span className="plan-legal">
                        {' '}
                        ({computedBases.sickness.explanations[0].legalBasis})
                      </span>
                    )}
                  </li>
                )}
                {computedBases.mother && (
                  <li>
                    Podstawa zasiłku macierzyńskiego matki:{' '}
                    <strong>{formatPln(computedBases.mother.benefitBase)}</strong>
                    {computedBases.mother.appliedMinimum && ' (zastosowano minimalną podstawę)'}
                    {computedBases.mother.appliedMaximum && ' (zastosowano ustawowy limit)'}
                    {computedBases.mother.explanations.at(-1)?.legalBasis && (
                      <span className="plan-legal">
                        {' '}
                        ({computedBases.mother.explanations.at(-1)?.legalBasis})
                      </span>
                    )}
                  </li>
                )}
                {computedBases.father && (
                  <li>
                    Podstawa zasiłku ojca:{' '}
                    <strong>{formatPln(computedBases.father.benefitBase)}</strong>
                    {computedBases.father.explanations.at(-1)?.legalBasis && (
                      <span className="plan-legal">
                        {' '}
                        ({computedBases.father.explanations.at(-1)?.legalBasis})
                      </span>
                    )}
                  </li>
                )}
              </ul>
            </div>
          </details>
        </div>
      )}

      <div className="calc-details-stack">
        <details className="calc-details">
          <summary className="calc-details__summary">Zobacz okresy i kwoty</summary>
          <div className="calc-details__body">
            {maternity.periods.length === 0 ? (
              <p className="calc-sickness-note">
                Brak okresów do wyliczenia dla bieżących parametrów.
              </p>
            ) : (
              <div className="calc-table-wrap">
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th>Rodzaj urlopu</th>
                      <th>Rodzic</th>
                      <th>Okres (od – do)</th>
                      <th>Wymiar</th>
                      <th>Stawka</th>
                      <th>Kwota miesięczna</th>
                      <th>Suma za okres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maternity.periods.map((period) => (
                      <tr
                        key={`${period.leaveType}-${period.parentRole}-${period.startDate}-${period.days}`}
                      >
                        <td data-label="Rodzaj urlopu">
                          <strong>{formatLeaveType(period.leaveType)}</strong>
                        </td>
                        <td data-label="Rodzic">{formatParentRole(period.parentRole)}</td>
                        <td data-label="Okres">
                          {formatPolishDate(period.startDate)} – {formatPolishDate(period.endDate)}
                        </td>
                        <td data-label="Wymiar">
                          {period.weeks} tyg. ({period.days} dni)
                        </td>
                        <td data-label="Stawka">{formatRate(period.rate)}</td>
                        <td data-label="Miesięcznie">{formatPln(period.monthlyAmount)}</td>
                        <td data-label="Suma za okres">
                          <strong>{formatPln(period.totalAmount)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>

        {maternity.explanations.length > 0 && (
          <details className="calc-details">
            <summary className="calc-details__summary">
              Zobacz szczegóły wyliczenia i podstawy prawne
            </summary>
            <div className="calc-details__body">
              <ul className="calc-explanations-list">
                {maternity.explanations.map((exp) => (
                  <li key={exp.message}>
                    {exp.message}{' '}
                    {exp.legalBasis && <span className="plan-legal">({exp.legalBasis})</span>}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {hasMotherInPlan && (
          <details className="calc-details">
            <summary className="calc-details__summary">
              Zmień podstawę wymiaru ({formatPln(scenario.mother.benefitBase)})
            </summary>
            <div className="calc-details__body">
              <label className="plan-field calc-base-editor">
                <span className="plan-field__label">Podstawa wymiaru zasiłku matki (PLN)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="plan-field__input"
                  aria-label="Podstawa wymiaru w kalkulatorze"
                  value={scenario.mother.benefitBase ?? ''}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value);
                    onScenarioChange({
                      ...scenario,
                      mother: {
                        ...scenario.mother,
                        benefitBase: Number.isNaN(value) ? null : value,
                      },
                    });
                  }}
                />
              </label>
            </div>
          </details>
        )}

        {hasMotherInPlan && scenario.situation !== 'adoption' && (
          <details className="calc-details">
            <summary className="calc-details__summary">
              Zasiłek chorobowy w ciąży (kod „B”) – {sicknessSummaryText}
            </summary>
            <div className="calc-details__body">
              <div className="calc-sickness-stats">
                <div className="calc-sickness-stats__item">
                  <span className="calc-sickness-stats__label">Status prawa</span>
                  <strong>{sickness.entitled ? 'Przysługuje' : 'Nie przysługuje'}</strong>
                </div>
                <div className="calc-sickness-stats__item">
                  <span className="calc-sickness-stats__label">
                    Stawka dzienna ({formatRate(sickness.rate)})
                  </span>
                  <strong>
                    {sickness.dailyAmount !== null
                      ? `${formatPln(sickness.dailyAmount)} / dzień`
                      : 'Brak danych'}
                  </strong>
                </div>
                <div className="calc-sickness-stats__item">
                  <span className="calc-sickness-stats__label">Wynagrodzenie od pracodawcy</span>
                  <strong>{sickness.employerSickPayDays} dni</strong>
                </div>
                <div className="calc-sickness-stats__item">
                  <span className="calc-sickness-stats__label">Maksymalny okres zasiłkowy</span>
                  <strong>{sickness.sicknessBenefitMaxDays} dni</strong>
                </div>
              </div>
              {sickness.explanations.map((exp) => (
                <p key={exp.message} className="calc-sickness-note">
                  {exp.message}{' '}
                  {exp.legalBasis && <span className="plan-legal">({exp.legalBasis})</span>}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      <nav className="calc-next" aria-label="Następny krok">
        <Link to={`/plan/leave-plan${search}`} className="calc-next__link">
          Dalej: Plan urlopów ›
        </Link>
      </nav>
    </div>
  );
}
