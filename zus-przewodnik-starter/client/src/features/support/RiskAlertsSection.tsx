import type { BenefitParams, CaseWarning } from '@shared/types';
import { getCaseWarningGuide, getGeneralRisks } from './caseSupportData';

interface UserRiskAlertsProps {
  warnings: CaseWarning[];
  params: BenefitParams;
}

export function UserRiskAlerts({ warnings, params }: UserRiskAlertsProps) {
  if (warnings.length === 0) return null;

  return (
    <ul className="support-risk-list" aria-label="Wykryte ryzyka dla Twoich danych">
      {warnings.map((warning, index) => {
        const guide = getCaseWarningGuide(warning, params);
        const isReminder = Boolean(guide.isReminder);
        return (
          <li
            key={`${warning.code}-${index}`}
            className={
              isReminder ? 'support-risk-card support-risk-card--info' : 'support-risk-card'
            }
            role={isReminder ? undefined : 'alert'}
          >
            <h4 className="support-risk-card__title">{guide.title}</h4>
            <p className="support-risk-card__action">{guide.action}</p>
            <details className="support-inline-details">
              <summary className="support-inline-details__summary">
                Szczegóły i podstawa prawna
              </summary>
              <div className="support-inline-details__body">
                <p>{warning.message_pl}</p>
                {warning.legal_basis && (
                  <p className="support-legal">Podstawa prawna: {warning.legal_basis}</p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

interface GeneralRisksDetailsProps {
  params: BenefitParams;
}

export function GeneralRisksDetails({ params }: GeneralRisksDetailsProps) {
  const risks = getGeneralRisks(params);

  return (
    <details className="support-accordion">
      <summary className="support-accordion__summary">
        Ogólne ryzyka utraty lub obniżenia zasiłku
      </summary>
      <div className="support-accordion__body">
        <p className="support-accordion__intro">
          Najczęstsze sytuacje, w których ZUS może odmówić wypłaty zasiłku lub obniżyć jego
          wysokość:
        </p>
        <ul className="support-general-list" role="list">
          {risks.map((risk) => (
            <li key={risk.id} className="support-general-card">
              <h4 className="support-general-card__title">{risk.title}</h4>
              <p className="support-general-card__text">{risk.consequence}</p>
              <p className="support-general-card__tip">
                <strong>Jak uniknąć:</strong> {risk.howToAvoid}
              </p>
              <p className="support-legal">Podstawa prawna: {risk.legalBasis}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
