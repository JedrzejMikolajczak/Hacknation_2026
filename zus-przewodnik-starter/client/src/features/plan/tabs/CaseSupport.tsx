import type { BenefitParams, CaseInputs, CasePlan } from '@shared/types';
import { OrganizationsDetails } from '../../support/OrganizationsSection';
import { AssistantSection } from '../../support/AssistantSection';
import {
  PueSimulationDetails,
  OfficialLinksAndUscDetails,
} from '../../support/PueSimulationSection';
import { todayIsoDate } from '../planScenario';
import './SupportTab.css';
import '../../support/AssistantSection.css';

export function CaseSupport({
  input,
  plan,
  params,
}: {
  input: CaseInputs;
  plan: CasePlan;
  params: BenefitParams;
}) {
  return (
    <div className="support-tab">
      <h2>Wsparcie</h2>
      {plan.outcome.warnings.length > 0 && (
        <section className="plan-callout plan-callout--warning">
          <h3>Ostrzeżenia dla Twojej sytuacji</h3>
          <ul>
            {plan.outcome.warnings.map((item) => (
              <li key={item.code}>{item.message_pl}</li>
            ))}
          </ul>
        </section>
      )}
      <OrganizationsDetails organizations={plan.support.organizations} defaultOpen />
      <PueSimulationDetails input={input} />
      <OfficialLinksAndUscDetails
        referenceDate={input.reference_date ?? todayIsoDate()}
        links={plan.support.official_links}
      />
      <AssistantSection params={params} />
    </div>
  );
}
