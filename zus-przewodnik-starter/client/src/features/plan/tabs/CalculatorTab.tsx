import type {
  BenefitParams,
  MaternityCalculationResult,
  RateVariant,
  ScenarioInput,
  SicknessResult,
} from '@shared/types';
import { formatRate } from '../../../app/benefitParams';
import {
  formatLeaveType,
  formatParentRole,
  formatPln,
  formatPolishDate,
} from '../planScenario';

interface CalculatorTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  sickness: SicknessResult;
  onScenarioChange: (next: ScenarioInput) => void;
}

export function CalculatorTab({
  scenario,
  params,
  maternity,
  sickness,
  onScenarioChange,
}: CalculatorTabProps) {
  const standardTotal = maternity.variants?.standard ?? null;
  const combinedTotal = maternity.variants?.combined ?? null;
  const variantDiff =
    standardTotal !== null && combinedTotal !== null ? combinedTotal - standardTotal : null;

  function setRateVariant(variant: RateVariant) {
    onScenarioChange({ ...scenario, rateVariant: variant });
  }

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="calc-switches-heading">
        <h2 id="calc-switches-heading" className="plan-section__title">
          Przełączniki kalkulatora
        </h2>
        <p className="plan-section__lead">
          Porównaj wariant jednolity ({formatRate(params.rates.combined)}) ze standardowym (
          {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}), dostosuj
          liczbę dzieci lub podstawę wymiaru zasiłku.
        </p>

        <div className="calc-switches">
          <div className="calc-switch-group">
            <span className="plan-field__label">Wariant stawki zasiłku macierzyńskiego</span>
            <div className="calc-segmented" role="group" aria-label="Wybór wariantu stawki">
              <button
                type="button"
                className={
                  scenario.rateVariant === 'combined'
                    ? 'calc-segmented__btn calc-segmented__btn--active'
                    : 'calc-segmented__btn'
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
                    ? 'calc-segmented__btn calc-segmented__btn--active'
                    : 'calc-segmented__btn'
                }
                aria-pressed={scenario.rateVariant === 'standard'}
                onClick={() => setRateVariant('standard')}
              >
                {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}
              </button>
            </div>
          </div>

          <label className="plan-field">
            <span className="plan-field__label">Liczba dzieci w jednym porodzie</span>
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

          <label className="plan-field">
            <span className="plan-field__label">Podstawa wymiaru zasiłku (PLN)</span>
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

        <div className="calc-summary-cards">
          <div className="calc-kpi-card calc-kpi-card--highlight">
            <span className="calc-kpi-card__label">Łączna kwota w wybranym wariancie</span>
            <strong className="calc-kpi-card__value">{formatPln(maternity.totalAmount)}</strong>
            <span className="calc-kpi-card__hint">
              Wariant:{' '}
              {scenario.rateVariant === 'combined'
                ? `${formatRate(params.rates.combined)} (wniosek w ${params.combinedRateApplicationDeadlineDays} dni)`
                : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`}
            </span>
          </div>

          {maternity.variants && (
            <>
              <div className="calc-kpi-card">
                <span className="calc-kpi-card__label">
                  Wariant {formatRate(params.rates.combined)} (uśredniony)
                </span>
                <strong className="calc-kpi-card__value">
                  {formatPln(maternity.variants.combined)}
                </strong>
                <span className="calc-kpi-card__hint">
                  9 tyg. drugiego rodzica zawsze {formatRate(params.rates.secondParentNonTransferableInCombined)}
                </span>
              </div>

              <div className="calc-kpi-card">
                <span className="calc-kpi-card__label">
                  Wariant {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}
                </span>
                <strong className="calc-kpi-card__value">
                  {formatPln(maternity.variants.standard)}
                </strong>
                <span className="calc-kpi-card__hint">
                  {variantDiff !== null
                    ? `Różnica (81,5% vs 100/70): ${variantDiff >= 0 ? '+' : ''}${formatPln(variantDiff)}`
                    : 'Porównanie sumy świadczeń'}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="calc-periods-heading">
        <h2 id="calc-periods-heading" className="plan-section__title">
          Okresy i wysokość zasiłku macierzyńskiego
        </h2>

        {maternity.periods.length === 0 ? (
          <div className="plan-callout plan-callout--warning">
            Brak okresów do wyliczenia dla bieżących parametrów (sprawdź zakładkę Uprawnienia lub
            podaj podstawę wymiaru zasiłku).
          </div>
        ) : (
          <div className="plan-table-wrap">
            <table className="plan-table">
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
                    key={`${period.leaveType}-${period.parentRole}-${period.startDate}-${period.weeks}`}
                  >
                    <td>
                      <strong>{formatLeaveType(period.leaveType)}</strong>
                    </td>
                    <td>{formatParentRole(period.parentRole)}</td>
                    <td>
                      {formatPolishDate(period.startDate)} – {formatPolishDate(period.endDate)}
                    </td>
                    <td>
                      {period.weeks} tyg. ({period.days} dni)
                    </td>
                    <td>{formatRate(period.rate)}</td>
                    <td>{formatPln(period.monthlyAmount)}</td>
                    <td>
                      <strong>{formatPln(period.totalAmount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {maternity.explanations.length > 0 && (
          <div className="plan-explanations">
            <h3>Uzasadnienie i podstawy prawne wyliczenia</h3>
            <ul>
              {maternity.explanations.map((exp) => (
                <li key={exp.message}>
                  {exp.message}{' '}
                  {exp.legalBasis && <span className="plan-legal">({exp.legalBasis})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="plan-section" aria-labelledby="calc-sickness-heading">
        <h2 id="calc-sickness-heading" className="plan-section__title">
          Zasiłek chorobowy w ciąży (kod literowy „B”)
        </h2>
        <div className="calc-sickness-box">
          <div className="calc-sickness-box__stats">
            <div>
              <span className="calc-kpi-card__label">Status prawa</span>
              <strong>{sickness.entitled ? 'Przysługuje' : 'Nie przysługuje'}</strong>
            </div>
            <div>
              <span className="calc-kpi-card__label">Stawka dzienna (100%)</span>
              <strong>{formatPln(sickness.dailyAmount)} / dzień</strong>
            </div>
            <div>
              <span className="calc-kpi-card__label">Wynagrodzenie od pracodawcy</span>
              <strong>{sickness.employerSickPayDays} dni</strong>
            </div>
            <div>
              <span className="calc-kpi-card__label">Maksymalny okres zasiłkowy</span>
              <strong>{sickness.sicknessBenefitMaxDays} dni</strong>
            </div>
          </div>
          {sickness.explanations.map((exp) => (
            <p key={exp.message} className="calc-sickness-box__note">
              {exp.message}{' '}
              {exp.legalBasis && <span className="plan-legal">({exp.legalBasis})</span>}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
