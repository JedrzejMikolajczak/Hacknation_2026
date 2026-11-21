import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BenefitParams, ScenarioInput } from '@shared/types';
import {
  getMatchingSpecialSituationIds,
  getSpecialSituations,
  HELP_CHANNELS,
  type SpecialSituationGuide,
} from './supportMock';

interface SpecialSituationsSectionProps {
  scenario: ScenarioInput;
  params: BenefitParams;
}

export function SpecialSituationsSection({ scenario, params }: SpecialSituationsSectionProps) {
  const allSituations = getSpecialSituations(params);
  const matchingIds = getMatchingSpecialSituationIds(scenario);

  const matchingSituations = allSituations.filter((item) => matchingIds.includes(item.id));
  const otherSituations = allSituations.filter((item) => !matchingIds.includes(item.id));

  const [showOtherPicker, setShowOtherPicker] = useState<boolean>(false);
  const [otherSelectedId, setOtherSelectedId] = useState<SpecialSituationGuide['id']>(
    otherSituations[0]?.id ?? allSituations[0].id,
  );

  const selectedOther =
    otherSituations.find((item) => item.id === otherSelectedId) ?? otherSituations[0];

  const isLossScenario =
    scenario.special.stillbirth || scenario.special.childDeathDate !== null;

  return (
    <>
      <section className="support-card" aria-labelledby="special-situations-heading">
        <h2 id="special-situations-heading" className="support-card__title">
          Sytuacje szczególne i trudne
        </h2>
        <p className="support-card__lead">
          {matchingSituations.length > 0
            ? isLossScenario
              ? 'Na podstawie Twoich danych przygotowaliśmy spokojne informacje krok po kroku dla Twojej sytuacji.'
              : 'Na podstawie Twoich danych wybraliśmy informacje szczególne, które dotyczą Twojej rodziny.'
            : 'W Twoich danych nie wskazano żadnej sytuacji szczególnej (np. wcześniactwa, pobytu w szpitalu, „Za życiem” czy adopcji).'}
        </p>

        {matchingSituations.length > 0 && (
          <div className="special-matched-list">
            {matchingSituations.map((item) => (
              <article
                key={item.id}
                className={
                  item.id === 'loss' || item.id === 'motherDeceased'
                    ? 'support-detail-box support-detail-box--calm'
                    : 'support-detail-box'
                }
              >
                <h3 className="support-detail-box__title">{item.title}</h3>
                <p className="support-detail-box__text">{item.summary}</p>
                <ul className="special-card__steps">
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <p className="support-legal-basis">Podstawa prawna: {item.legalBasis}</p>
              </article>
            ))}
          </div>
        )}

        {otherSituations.length > 0 && (
          <div className="other-situations-wrap">
            <button
              type="button"
              className="button button--secondary"
              aria-expanded={showOtherPicker}
              onClick={() => setShowOtherPicker((prev) => !prev)}
            >
              {showOtherPicker
                ? 'Ukryj inne sytuacje szczególne'
                : 'Sprawdź instrukcję na wypadek innej sytuacji szczególnej'}
            </button>

            {showOtherPicker && selectedOther && (
              <div className="support-picker">
                <label htmlFor="special-situation-select" className="support-picker__label">
                  Wybierz inną sytuację szczególną z listy
                </label>
                <select
                  id="special-situation-select"
                  className="support-picker__select"
                  value={selectedOther.id}
                  onChange={(e) =>
                    setOtherSelectedId(e.target.value as SpecialSituationGuide['id'])
                  }
                >
                  {otherSituations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>

                <article
                  className={
                    selectedOther.id === 'loss' || selectedOther.id === 'motherDeceased'
                      ? 'support-detail-box support-detail-box--calm'
                      : 'support-detail-box'
                  }
                  aria-live="polite"
                >
                  <h3 className="support-detail-box__title">{selectedOther.title}</h3>
                  <p className="support-detail-box__text">{selectedOther.summary}</p>
                  <ul className="special-card__steps">
                    {selectedOther.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <p className="support-legal-basis">
                    Podstawa prawna: {selectedOther.legalBasis}
                  </p>
                </article>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="support-card" aria-labelledby="channels-heading">
        <h2 id="channels-heading" className="support-card__title">
          Gdzie załatwić sprawę i skonsultować się z człowiekiem
        </h2>
        <p className="support-card__lead">
          Jeśli masz nietypową umowę lub chcesz potwierdzić dokumenty przed złożeniem, skorzystaj z
          oficjalnych bezpłatnych kanałów.
        </p>

        <div className="channels-grid">
          {HELP_CHANNELS.map((channel) => (
            <article key={channel.name} className="channel-card">
              <h3 className="channel-card__title">{channel.name}</h3>
              <p className="channel-card__desc">{channel.description}</p>
              <a
                className="channel-card__link"
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {channel.actionLabel}
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </article>
          ))}
        </div>

        <div className="support-next-links">
          <Link to="/plan/documents" className="button button--secondary">
            Przejdź do dokumentów i terminów
          </Link>
          <Link to="/guide" className="button button--secondary">
            Otwórz pełny Przewodnik
          </Link>
        </div>
      </section>
    </>
  );
}
