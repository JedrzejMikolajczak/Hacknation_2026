import type { EligibilityResult, Warning } from '@shared/types';
import {
  formatBenefitName,
  formatParentRole,
  formatPayer,
} from '../planScenario';

interface EntitlementsTabProps {
  eligibility: EligibilityResult;
}

const WARNING_TITLES: Record<Warning['code'], string> = {
  SELF_EMPLOYED_DEBT: 'Zadłużenie składkowe (JDG)',
  NO_INSURANCE_ON_BIRTH_DATE: 'Brak ubezpieczenia chorobowego',
  CONTRACT_ENDS_BEFORE_BIRTH: 'Koniec umowy przed porodem',
  SHAM_CONTRACT_RISK: 'Ryzyko kontroli tytułu ubezpieczenia',
  BASE_INCREASE_IN_PREGNANCY: 'Podwyższenie podstawy składek w ciąży',
  COMBINED_RATE_DEADLINE: 'Termin 21 dni na wybór stawki 81,5%',
  WAITING_PERIOD_NOT_MET: 'Okres wyczekiwania na zasiłek chorobowy',
};

export function EntitlementsTab({ eligibility }: EntitlementsTabProps) {
  const { warnings, entitlements } = eligibility;

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="warnings-heading">
        <h2 id="warnings-heading" className="plan-section__title">
          Ostrzeżenia o ryzykach i terminach
        </h2>
        {warnings.length === 0 ? (
          <div className="plan-callout plan-callout--success">
            <strong>Brak zidentyfikowanych ryzyk utraty świadczeń.</strong> Na podstawie podanych
            danych nie wykryto zadłużenia składkowego ani przerwy w ubezpieczeniu przed porodem.
          </div>
        ) : (
          <ul className="plan-warning-list" role="list">
            {warnings.map((warning) => (
              <li
                key={`${warning.code}-${warning.message}`}
                className={
                  warning.code === 'COMBINED_RATE_DEADLINE'
                    ? 'plan-callout plan-callout--info'
                    : 'plan-callout plan-callout--warning'
                }
                role="alert"
              >
                <div className="plan-callout__title">{WARNING_TITLES[warning.code]}</div>
                <p>{warning.message}</p>
                {warning.legalBasis && (
                  <p className="plan-legal">Podstawa prawna: {warning.legalBasis}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="plan-section" aria-labelledby="entitlements-heading">
        <h2 id="entitlements-heading" className="plan-section__title">
          Przysługujące świadczenia
        </h2>
        <p className="plan-section__lead">
          Dla każdego świadczenia sprawdzamy, czy spełniasz warunki ustawowe oraz kto odpowiada za
          wypłatę (pracodawca czy ZUS).
        </p>

        <div className="plan-cards-grid">
          {entitlements.map((item) => (
            <article
              key={`${item.benefit}-${item.parentRole}`}
              className={
                item.entitled
                  ? 'entitlement-card entitlement-card--yes'
                  : 'entitlement-card entitlement-card--no'
              }
            >
              <div className="entitlement-card__header">
                <span
                  className={
                    item.entitled
                      ? 'plan-badge plan-badge--yes'
                      : 'plan-badge plan-badge--no'
                  }
                >
                  {item.entitled ? 'Przysługuje' : 'Nie przysługuje'}
                </span>
                <span className="plan-badge plan-badge--navy">
                  {formatParentRole(item.parentRole)}
                </span>
              </div>

              <h3 className="entitlement-card__title">{formatBenefitName(item.benefit)}</h3>
              <p className="entitlement-card__reason">{item.reason.message}</p>

              <dl className="entitlement-card__meta">
                <div>
                  <dt>Płatnik świadczenia</dt>
                  <dd>{item.entitled ? formatPayer(item.payer) : 'Nie dotyczy'}</dd>
                </div>
                {item.reason.legalBasis && (
                  <div>
                    <dt>Podstawa prawna</dt>
                    <dd>{item.reason.legalBasis}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
