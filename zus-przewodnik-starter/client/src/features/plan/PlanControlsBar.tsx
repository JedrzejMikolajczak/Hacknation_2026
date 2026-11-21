import { useState } from 'react';
import type {
  AdoptionType,
  BenefitParams,
  InsuranceTitle,
  RateVariant,
  ScenarioInput,
  SituationType,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import {
  buildEmptyParent,
  defaultSicknessInsurance,
  getExplicitEventDate,
  type ScenarioMeta,
} from './planScenario';

interface PlanControlsBarProps {
  scenario: ScenarioInput;
  meta: ScenarioMeta;
  params: BenefitParams;
  onChange: (next: ScenarioInput, nextMeta?: Partial<ScenarioMeta>) => void;
  onCopyShareLink: () => void;
  shareCopied: boolean;
}

function shortSituationLabel(situation: SituationType): string {
  switch (situation) {
    case 'planning':
      return 'Planuję dziecko';
    case 'pregnant':
      return 'Jestem w ciąży';
    case 'afterBirth':
      return 'Urodziło się dziecko';
    case 'adoption':
      return 'Adopcja / rodzina zastępcza';
  }
}

function shortInsuranceLabel(title: InsuranceTitle): string {
  switch (title) {
    case 'employment':
      return 'umowa o pracę';
    case 'mandateContract':
      return 'umowa zlecenie';
    case 'selfEmployed':
      return 'JDG';
    case 'none':
      return 'brak ubezpieczenia';
  }
}

function shortChildrenLabel(count: number): string {
  if (count === 1) return '1 dziecko';
  if (count >= 5) return '5+ dzieci';
  return `${count} dzieci`;
}

function buildSummaryParts(
  scenario: ScenarioInput,
  meta: ScenarioMeta,
  params: BenefitParams,
): string[] {
  const parts: string[] = [shortSituationLabel(scenario.situation)];

  if (meta.hasMotherInPlan) {
    parts.push(
      meta.motherInsuranceKnown
        ? shortInsuranceLabel(scenario.mother.insuranceTitle)
        : 'brak danych o ubezpieczeniu',
    );
  } else if (scenario.father && meta.fatherInsuranceKnown) {
    parts.push(`tata: ${shortInsuranceLabel(scenario.father.insuranceTitle)}`);
  } else {
    parts.push('samodzielny tata');
  }

  parts.push(shortChildrenLabel(scenario.childrenCount));

  if (!scenario.special.stillbirth) {
    parts.push(
      scenario.rateVariant === 'combined'
        ? formatRate(params.rates.combined)
        : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`,
    );
  }

  return parts;
}

export function PlanControlsBar({
  scenario,
  meta,
  params,
  onChange,
  onCopyShareLink,
  shareCopied,
}: PlanControlsBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const explicitEventDate = getExplicitEventDate(scenario);
  const summaryText = buildSummaryParts(scenario, meta, params).join(' · ');

  function updateSituation(situation: SituationType) {
    onChange({
      ...scenario,
      situation,
      expectedBirthDate:
        situation === 'planning' || situation === 'pregnant'
          ? (scenario.expectedBirthDate ?? explicitEventDate)
          : scenario.expectedBirthDate,
      birthDate:
        situation === 'afterBirth' ? (scenario.birthDate ?? explicitEventDate) : scenario.birthDate,
      childAcceptanceDate:
        situation === 'adoption' ? (scenario.childAcceptanceDate ?? explicitEventDate) : null,
      adoptionType: situation === 'adoption' ? scenario.adoptionType : null,
      childAgeYears: situation === 'adoption' ? scenario.childAgeYears : null,
    });
  }

  function updateEmployment(title: InsuranceTitle) {
    onChange(
      {
        ...scenario,
        mother: {
          ...scenario.mother,
          insuranceTitle: title,
          sicknessInsurance: defaultSicknessInsurance(title),
          benefitBase: title === 'none' ? null : scenario.mother.benefitBase,
          contributionDebt: title === 'selfEmployed' ? scenario.mother.contributionDebt : null,
          employerInsuredCount:
            title === 'employment' || title === 'mandateContract'
              ? scenario.mother.employerInsuredCount
              : null,
        },
      },
      { hasMotherInPlan: true, motherInsuranceKnown: true },
    );
  }

  function updateEventDate(value: string) {
    const nextDate = value || null;
    if (scenario.situation === 'adoption') {
      onChange({ ...scenario, childAcceptanceDate: nextDate });
    } else if (scenario.situation === 'afterBirth') {
      onChange({ ...scenario, birthDate: nextDate });
    } else {
      onChange({ ...scenario, expectedBirthDate: nextDate });
    }
  }

  return (
    <section className="plan-controls" aria-label="Twoje dane planu">
      <div className="plan-controls__summary-bar">
        <p className="plan-controls__summary">
          <strong className="plan-controls__summary-label">Twoje dane:</strong> {summaryText}
        </p>
        <button
          type="button"
          className="plan-controls__toggle"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="plan-controls-panel"
        >
          {isOpen ? 'Zwiń' : 'Zmień dane'}
        </button>
      </div>

      {isOpen && (
        <div id="plan-controls-panel" className="plan-controls__panel">
          <div className="plan-controls__grid">
            <label className="plan-field">
              <span className="plan-field__label">Sytuacja</span>
              <select
                className="plan-field__input"
                value={scenario.situation}
                onChange={(e) => updateSituation(e.target.value as SituationType)}
              >
                <option value="planning">Planuję dziecko</option>
                <option value="pregnant">Jestem w ciąży</option>
                <option value="afterBirth">Urodziło się dziecko</option>
                <option value="adoption">Adopcja / rodzina zastępcza</option>
              </select>
            </label>

            {meta.hasMotherInPlan && (
              <label className="plan-field">
                <span className="plan-field__label">Forma zatrudnienia (matka)</span>
                <select
                  className="plan-field__input"
                  value={meta.motherInsuranceKnown ? scenario.mother.insuranceTitle : ''}
                  onChange={(e) => {
                    if (e.target.value) updateEmployment(e.target.value as InsuranceTitle);
                  }}
                >
                  {!meta.motherInsuranceKnown && <option value="">— Wybierz z listy —</option>}
                  <option value="employment">Umowa o pracę</option>
                  <option value="mandateContract">Umowa zlecenie</option>
                  <option value="selfEmployed">Działalność gospodarcza (JDG)</option>
                  <option value="none">Brak ubezpieczenia</option>
                </select>
              </label>
            )}

            <label className="plan-field">
              <span className="plan-field__label">
                {scenario.situation === 'adoption'
                  ? 'Data przyjęcia dziecka'
                  : scenario.situation === 'afterBirth'
                    ? 'Data porodu'
                    : 'Przewidywana data porodu'}
              </span>
              <input
                type="date"
                className="plan-field__input"
                value={explicitEventDate ?? ''}
                onChange={(e) => updateEventDate(e.target.value)}
              />
            </label>

            <label className="plan-field">
              <span className="plan-field__label">Liczba dzieci</span>
              <select
                className="plan-field__input"
                value={scenario.childrenCount}
                onChange={(e) => onChange({ ...scenario, childrenCount: Number(e.target.value) })}
              >
                <option value={1}>1 dziecko</option>
                <option value={2}>2 dzieci (bliźnięta)</option>
                <option value={3}>3 dzieci</option>
                <option value={4}>4 dzieci</option>
                <option value={5}>5 lub więcej dzieci</option>
              </select>
            </label>

            {meta.hasMotherInPlan && (
              <label className="plan-field">
                <span className="plan-field__label">Podstawa wymiaru matki (PLN)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="plan-field__input"
                  placeholder="Uzupełnij kwotę"
                  disabled={meta.motherInsuranceKnown && scenario.mother.insuranceTitle === 'none'}
                  value={scenario.mother.benefitBase ?? ''}
                  onChange={(e) => {
                    const num = Number.parseFloat(e.target.value);
                    onChange({
                      ...scenario,
                      mother: {
                        ...scenario.mother,
                        benefitBase: Number.isNaN(num) ? null : num,
                      },
                    });
                  }}
                />
              </label>
            )}

            <label className="plan-field">
              <span className="plan-field__label">Wariant stawki</span>
              <select
                className="plan-field__input"
                value={scenario.rateVariant}
                onChange={(e) =>
                  onChange({ ...scenario, rateVariant: e.target.value as RateVariant })
                }
              >
                <option value="combined">
                  {formatRate(params.rates.combined)} za cały okres (wniosek w{' '}
                  {params.combinedRateApplicationDeadlineDays} dni)
                </option>
                <option value="standard">
                  {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}{' '}
                  (standardowy)
                </option>
              </select>
            </label>
          </div>

          <details className="plan-controls__details">
            <summary className="plan-controls__details-summary">
              Więcej parametrów i okoliczności
            </summary>
            <div className="plan-controls__advanced">
              {scenario.situation === 'adoption' && (
                <>
                  <label className="plan-field">
                    <span className="plan-field__label">Forma opieki</span>
                    <select
                      className="plan-field__input"
                      value={scenario.adoptionType ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...scenario,
                          adoptionType: (e.target.value || null) as AdoptionType | null,
                        })
                      }
                    >
                      <option value="">— Wybierz —</option>
                      <option value="adoption">Przysposobienie (adopcja)</option>
                      <option value="fosterFamily">Rodzina zastępcza niezawodowa</option>
                    </select>
                  </label>

                  <label className="plan-field">
                    <span className="plan-field__label">Wiek dziecka (lata)</span>
                    <input
                      type="number"
                      min={0}
                      max={18}
                      className="plan-field__input"
                      value={scenario.childAgeYears ?? ''}
                      onChange={(e) => {
                        const num = Number.parseFloat(e.target.value);
                        onChange({
                          ...scenario,
                          childAgeYears: Number.isNaN(num) ? null : num,
                        });
                      }}
                    />
                  </label>
                </>
              )}

              {(scenario.mother.insuranceTitle === 'employment' ||
                scenario.mother.insuranceTitle === 'mandateContract') && (
                <label className="plan-field">
                  <span className="plan-field__label">
                    Liczba ubezpieczonych u płatnika (próg: {params.payerThresholdInsuredCount})
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="plan-field__input"
                    placeholder="Nie podano"
                    value={scenario.mother.employerInsuredCount ?? ''}
                    onChange={(e) => {
                      const num = Number.parseInt(e.target.value, 10);
                      onChange({
                        ...scenario,
                        mother: {
                          ...scenario.mother,
                          employerInsuredCount: Number.isNaN(num) ? null : num,
                        },
                      });
                    }}
                  />
                </label>
              )}

              {scenario.mother.insuranceTitle === 'selfEmployed' && (
                <label className="plan-field">
                  <span className="plan-field__label">Zadłużenie składkowe JDG (PLN)</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    className="plan-field__input"
                    placeholder="Nie podano"
                    value={scenario.mother.contributionDebt ?? ''}
                    onChange={(e) => {
                      const num = Number.parseFloat(e.target.value);
                      onChange({
                        ...scenario,
                        mother: {
                          ...scenario.mother,
                          contributionDebt: Number.isNaN(num) ? null : num,
                        },
                      });
                    }}
                  />
                </label>
              )}

              <label className="plan-field">
                <span className="plan-field__label">
                  Data końca umowy / ubezpieczenia (opcjonalnie)
                </span>
                <input
                  type="date"
                  className="plan-field__input"
                  value={scenario.mother.insuranceEndDate ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...scenario,
                      mother: {
                        ...scenario.mother,
                        insuranceEndDate: e.target.value || null,
                      },
                    })
                  }
                />
              </label>

              {scenario.father && (
                <label className="plan-field">
                  <span className="plan-field__label">Podstawa wymiaru ojca (PLN)</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className="plan-field__input"
                    placeholder="Uzupełnij kwotę"
                    value={scenario.father.benefitBase ?? ''}
                    onChange={(e) => {
                      const num = Number.parseFloat(e.target.value);
                      onChange({
                        ...scenario,
                        father: scenario.father
                          ? {
                              ...scenario.father,
                              benefitBase: Number.isNaN(num) ? null : num,
                            }
                          : null,
                      });
                    }}
                  />
                </label>
              )}

              <label className="plan-field">
                <span className="plan-field__label">
                  Dni pobytu dziecka w szpitalu (opcjonalnie)
                </span>
                <input
                  type="number"
                  min={0}
                  max={150}
                  className="plan-field__input"
                  placeholder="Brak"
                  value={scenario.special.hospitalizationDays ?? ''}
                  onChange={(e) => {
                    const days = Number.parseInt(e.target.value, 10);
                    onChange({
                      ...scenario,
                      special: {
                        ...scenario.special,
                        hospitalizationDays: Number.isNaN(days) || days <= 0 ? null : days,
                      },
                    });
                  }}
                />
              </label>

              {scenario.special.hospitalizationDays !== null &&
                scenario.special.hospitalizationDays > 0 && (
                  <>
                    <label className="plan-field">
                      <span className="plan-field__label">Tydzień ciąży w chwili porodu</span>
                      <input
                        type="number"
                        min={20}
                        max={44}
                        className="plan-field__input"
                        placeholder="Np. 32"
                        value={scenario.special.pregnancyWeekAtBirth ?? ''}
                        onChange={(e) => {
                          const week = Number.parseInt(e.target.value, 10);
                          onChange({
                            ...scenario,
                            special: {
                              ...scenario.special,
                              pregnancyWeekAtBirth: Number.isNaN(week) ? null : week,
                            },
                          });
                        }}
                      />
                    </label>

                    <label className="plan-field">
                      <span className="plan-field__label">
                        Masa urodzeniowa dziecka (g, opcjonalnie)
                      </span>
                      <input
                        type="number"
                        min={300}
                        max={6000}
                        step={50}
                        className="plan-field__input"
                        placeholder="Np. 1600"
                        value={scenario.special.birthWeightGrams ?? ''}
                        onChange={(e) => {
                          const weight = Number.parseInt(e.target.value, 10);
                          onChange({
                            ...scenario,
                            special: {
                              ...scenario.special,
                              birthWeightGrams: Number.isNaN(weight) ? null : weight,
                            },
                          });
                        }}
                      />
                    </label>
                  </>
                )}

              <div className="plan-checkboxes">
                <label className="plan-checkbox">
                  <input
                    type="checkbox"
                    checked={scenario.special.zaZyciemCertificate}
                    onChange={(e) =>
                      onChange({
                        ...scenario,
                        special: { ...scenario.special, zaZyciemCertificate: e.target.checked },
                      })
                    }
                  />
                  <span>Zaświadczenie „Za życiem”</span>
                </label>

                <label className="plan-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(scenario.father)}
                    onChange={(e) =>
                      onChange(
                        {
                          ...scenario,
                          father: e.target.checked
                            ? buildEmptyParent('father', {
                                insuranceTitle: 'employment',
                                sicknessInsurance: 'mandatory',
                                wantsLeave: true,
                              })
                            : null,
                        },
                        { fatherInsuranceKnown: e.target.checked },
                      )
                    }
                  />
                  <span>Drugi rodzic korzysta z urlopu</span>
                </label>

                {scenario.situation === 'adoption' && scenario.adoptionType === 'fosterFamily' && (
                  <label className="plan-checkbox">
                    <input
                      type="checkbox"
                      checked={scenario.schoolObligationDeferred}
                      onChange={(e) =>
                        onChange({ ...scenario, schoolObligationDeferred: e.target.checked })
                      }
                    />
                    <span>
                      Odroczenie obowiązku szkolnego (limit{' '}
                      {params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYearsDeferredSchool}{' '}
                      lat)
                    </span>
                  </label>
                )}

                <label className="plan-checkbox">
                  <input
                    type="checkbox"
                    checked={scenario.special.stillbirth}
                    onChange={(e) =>
                      onChange({
                        ...scenario,
                        special: { ...scenario.special, stillbirth: e.target.checked },
                      })
                    }
                  />
                  <span>Trudna sytuacja (strata dziecka)</span>
                </label>
              </div>
            </div>
          </details>

          <div className="plan-controls__footer">
            <p className="plan-controls__hint">
              Zmiany od razu przeliczają plan i zapisują się w adresie URL.
            </p>
            <button
              type="button"
              className="plan-btn plan-btn--secondary"
              onClick={onCopyShareLink}
            >
              {shareCopied ? 'Skopiowano link do planu ✓' : 'Kopiuj link do planu'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
