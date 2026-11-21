import type { BenefitParams, ScenarioInput, Warning } from '@shared/types';
import { getTailoredTipsForScenario, WARNING_GUIDES } from './supportMock';

interface RiskAlertsSectionProps {
  scenario: ScenarioInput;
  warnings: Warning[];
  params: BenefitParams;
}

const INSURANCE_TITLE_LABEL = {
  employment: 'umowa o pracę',
  mandateContract: 'umowa zlecenie',
  selfEmployed: 'działalność gospodarcza (JDG)',
  none: 'brak ubezpieczenia w ZUS',
} as const;

export function RiskAlertsSection({ scenario, warnings, params }: RiskAlertsSectionProps) {
  const tailoredTips = getTailoredTipsForScenario(scenario, params);
  const titleLabel = INSURANCE_TITLE_LABEL[scenario.mother.insuranceTitle];

  return (
    <section className="support-card" aria-labelledby="risks-heading">
      <h2 id="risks-heading" className="support-card__title">
        Na co musisz uważać
      </h2>
      <p className="support-card__lead">
        Lista dobrana indywidualnie do Twojego profilu ({titleLabel}) — pokazujemy tylko te ryzyka i
        wskazówki, które mogą dotyczyć Twojej sytuacji.
      </p>

      {warnings.length > 0 ? (
        <div className="risk-alerts" aria-label="Wykryte ostrzeżenia dla Twojego profilu">
          {warnings.map((warning) => {
            const guide = WARNING_GUIDES[warning.code];
            return (
              <article
                key={warning.code}
                className="risk-alert"
                role="region"
                aria-label={guide.title}
              >
                <h3 className="risk-alert__title">{guide.title}</h3>
                <p className="risk-alert__text">{warning.message}</p>
                <p className="risk-alert__action">
                  <strong>Co zrobić:</strong> {guide.action}
                </p>
                {warning.legalBasis && (
                  <p className="support-legal-basis">Podstawa prawna: {warning.legalBasis}</p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="risk-ok">
          Dla Twoich aktualnych danych nie wykryliśmy krytycznych ostrzeżeń.
        </p>
      )}

      {tailoredTips.length > 0 && (
        <div className="tailored-tips" aria-label="Dodatkowe wskazówki dla Twojego profilu">
          <h3 className="support-subtitle">Wskazówki dopasowane do Twojej sytuacji</h3>
          <div className="tailored-grid">
            {tailoredTips.map((tip) => (
              <article key={tip.id} className="trap-card">
                <h4 className="trap-card__title">{tip.title}</h4>
                <p className="trap-card__risk">{tip.description}</p>
                <p className="trap-card__avoid">
                  <strong>Co warto zrobić:</strong> {tip.action}
                </p>
                <p className="support-legal-basis">{tip.legalBasis}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
