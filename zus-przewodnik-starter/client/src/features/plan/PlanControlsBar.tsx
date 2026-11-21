import { useState } from 'react';
import type {
  BenefitParams,
  InsuranceTitle,
  RateVariant,
  ScenarioInput,
  SituationType,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { defaultSicknessInsurance, getScenarioEventDate } from './planScenario';

interface PlanControlsBarProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  onChange: (next: ScenarioInput) => void;
  onCopyShareLink: () => void;
  shareCopied: boolean;
}

export function PlanControlsBar({
  scenario,
  params,
  onChange,
  onCopyShareLink,
  shareCopied,
}: PlanControlsBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const eventDate = getScenarioEventDate(scenario);

  function updateSituation(situation: SituationType) {
    onChange({
      ...scenario,
      situation,
      expectedBirthDate:
        situation === 'planning' || situation === 'pregnant'
          ? (scenario.expectedBirthDate ?? eventDate)
          : scenario.expectedBirthDate,
      birthDate: situation === 'afterBirth' ? (scenario.birthDate ?? eventDate) : scenario.birthDate,
      childAcceptanceDate:
        situation === 'adoption' ? (scenario.childAcceptanceDate ?? eventDate) : null,
      adoptionType: situation === 'adoption' ? (scenario.adoptionType ?? 'adoption') : null,
    });
  }

  function updateEmployment(title: InsuranceTitle) {
    onChange({
      ...scenario,
      mother: {
        ...scenario.mother,
        insuranceTitle: title,
        sicknessInsurance: defaultSicknessInsurance(title),
        benefitBase: title === 'none' ? null : (scenario.mother.benefitBase ?? 6000),
        contributionDebt:
          title === 'selfEmployed' ? (scenario.mother.contributionDebt ?? 0) : null,
        employerInsuredCount:
          title === 'employment' ? (scenario.mother.employerInsuredCount ?? 25) : null,
      },
    });
  }

  function updateEventDate(value: string) {
    if (!value) return;
    if (scenario.situation === 'adoption') {
      onChange({ ...scenario, childAcceptanceDate: value });
    } else if (scenario.situation === 'afterBirth') {
      onChange({ ...scenario, birthDate: value });
    } else {
      onChange({ ...scenario, expectedBirthDate: value });
    }
  }

  return (
    <section className="plan-controls" aria-labelledby="plan-controls-heading">
      <div className="plan-controls__header">
        <div>
          <h2 id="plan-controls-heading" className="plan-controls__title">
            Parametry planu – przelicz na żywo
          </h2>
          <p className="plan-controls__subtitle">
            Zmień dowolne pole, aby natychmiast przeliczyć wszystkie zakładki bez powrotu do
            kreatora. Stan zapisuje się w adresie URL.
          </p>
        </div>
        <div className="plan-controls__header-actions">
          <button
            type="button"
            className="plan-btn plan-btn--ghost"
            onClick={() => setShowAdvanced((open) => !open)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? 'Ukryj okoliczności dodatkowe' : 'Więcej parametrów i ryzyka'}
          </button>
          <button
            type="button"
            className="plan-btn plan-btn--secondary"
            onClick={onCopyShareLink}
          >
            {shareCopied ? 'Skopiowano link do wyliczenia ✓' : 'Kopiuj link URL do planu'}
          </button>
        </div>
      </div>

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

        <label className="plan-field">
          <span className="plan-field__label">Forma zatrudnienia</span>
          <select
            className="plan-field__input"
            value={scenario.mother.insuranceTitle}
            onChange={(e) => updateEmployment(e.target.value as InsuranceTitle)}
          >
            <option value="employment">Umowa o pracę</option>
            <option value="mandateContract">Umowa zlecenie</option>
            <option value="selfEmployed">Działalność gospodarcza (JDG)</option>
            <option value="none">Brak ubezpieczenia</option>
          </select>
        </label>

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
            value={eventDate}
            onChange={(e) => updateEventDate(e.target.value)}
          />
        </label>

        <label className="plan-field">
          <span className="plan-field__label">Liczba dzieci</span>
          <select
            className="plan-field__input"
            value={scenario.childrenCount}
            onChange={(e) =>
              onChange({ ...scenario, childrenCount: Number(e.target.value) })
            }
          >
            <option value={1}>1 dziecko</option>
            <option value={2}>2 dzieci (bliźnięta)</option>
            <option value={3}>3 dzieci</option>
            <option value={4}>4 dzieci</option>
            <option value={5}>5 lub więcej dzieci</option>
          </select>
        </label>

        <label className="plan-field">
          <span className="plan-field__label">Podstawa wymiaru (PLN)</span>
          <input
            type="number"
            min={0}
            step={100}
            className="plan-field__input"
            disabled={scenario.mother.insuranceTitle === 'none'}
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
              {formatRate(params.rates.combined)} za cały okres (wniosek w {params.combinedRateApplicationDeadlineDays} dni)
            </option>
            <option value="standard">
              {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)} (standardowy)
            </option>
          </select>
        </label>
      </div>

      {showAdvanced && (
        <div className="plan-controls__advanced">
          {scenario.mother.insuranceTitle === 'employment' && (
            <label className="plan-field">
              <span className="plan-field__label">
                Liczba ubezpieczonych u pracodawcy (próg: {params.payerThresholdInsuredCount})
              </span>
              <input
                type="number"
                min={1}
                className="plan-field__input"
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
                value={scenario.mother.contributionDebt ?? 0}
                onChange={(e) => {
                  const num = Number.parseFloat(e.target.value);
                  onChange({
                    ...scenario,
                    mother: {
                      ...scenario.mother,
                      contributionDebt: Number.isNaN(num) ? 0 : num,
                    },
                  });
                }}
              />
            </label>
          )}

          <label className="plan-field">
            <span className="plan-field__label">Data końca umowy / ubezpieczenia (opcjonalnie)</span>
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

          <label className="plan-field">
            <span className="plan-field__label">Dni pobytu wcześniaka w szpitalu (opcjonalnie)</span>
            <input
              type="number"
              min={0}
              max={120}
              className="plan-field__input"
              value={scenario.special.hospitalizationDays ?? ''}
              onChange={(e) => {
                const days = Number.parseInt(e.target.value, 10);
                onChange({
                  ...scenario,
                  special: {
                    ...scenario.special,
                    hospitalizationDays: Number.isNaN(days) || days <= 0 ? null : days,
                    pregnancyWeekAtBirth:
                      !Number.isNaN(days) && days > 0
                        ? (scenario.special.pregnancyWeekAtBirth ?? 31)
                        : null,
                    birthWeightGrams:
                      !Number.isNaN(days) && days > 0
                        ? (scenario.special.birthWeightGrams ?? 1600)
                        : null,
                  },
                });
              }}
            />
          </label>

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
                  onChange({
                    ...scenario,
                    father: e.target.checked
                      ? {
                          role: 'father',
                          insuranceTitle: 'employment',
                          sicknessInsurance: 'mandatory',
                          insuredSince: '2024-01-01',
                          insuranceEndDate: null,
                          benefitBase: 7500,
                          employerInsuredCount: 30,
                          age: 32,
                          contributionDebt: null,
                          wantsLeave: true,
                        }
                      : null,
                  })
                }
              />
              <span>Drugi rodzic korzysta z urlopu</span>
            </label>

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
      )}
    </section>
  );
}
