import type { BenefitParams, CaseInputs, CaseOutcome, ScenarioInput } from '@shared/types';
import { OrganizationsDetails } from '../../support/OrganizationsSection';
import { getMatchingSpecialSituationIds, getOrderedOrganizations } from '../../support/supportData';
import { AssistantSection } from '../../support/AssistantSection';
import '../../support/AssistantSection.css';
import { PueSimulationDetails, OfficialLinksAndUscDetails } from '../../support/PueSimulationSection';
import { buildDefaultSpecial, buildEmptyParent, todayIsoDate } from '../planScenario';
import './SupportTab.css';

function supportPreview(input: CaseInputs): ScenarioInput {
  const role = input.applicant_role === 'MOTHER' ? 'mother' : 'father';
  const title = { UOP: 'employment', B2B: 'selfEmployed', ZLECENIE: 'mandateContract', NONE: 'none' } as const;
  const person = {
    ...buildEmptyParent(role),
    insuranceTitle: title[input.employment_type],
    insuredSince: input.title_start_date ?? null,
    insuranceEndDate: input.contract_end_date,
    employerInsuredCount: null,
    contributionDebt: input.debt_amount_pln ?? null,
    sicknessInsurance: input.employment_type === 'UOP' ? 'mandatory' as const : input.voluntary_sickness_insured ? 'voluntary' as const : 'none' as const,
  };
  return {
    mother: role === 'mother' ? person : buildEmptyParent('mother'),
    father: role === 'father' ? person : null,
    situation: { POST_BIRTH: 'afterBirth', PLANNING: 'planning', PREGNANCY: 'pregnant', ADOPTION: 'adoption' }[input.stage] as ScenarioInput['situation'],
    birthDate: input.due_or_birth_date,
    expectedBirthDate: null,
    childrenCount: input.children_count, referenceDate: input.reference_date ?? todayIsoDate(),
    adoptionType: input.adoption_type === 'FOSTER_FAMILY' ? 'fosterFamily' : input.adoption_type === 'ADOPTION' ? 'adoption' : null,
    childAcceptanceDate: input.adopted_or_foster_child_acceptance_date ?? null,
    childAgeYears: input.special_circumstances.adopted_or_foster_child_age_years,
    schoolObligationDeferred: !!input.school_obligation_deferred,
    rateVariant: input.requested_payment_variant === 'COMBINED_81_5' ? 'combined' : 'standard',
    special: buildDefaultSpecial({
      zaZyciemCertificate: input.special_circumstances.za_zyciem_certificate,
      stillbirth: input.special_circumstances.stillbirth_or_child_death !== 'NONE',
      motherHospitalized: input.special_circumstances.mother_hospitalized_or_incapable,
      pregnancyWeekAtBirth: input.pregnancy_week_at_birth ? Number(input.pregnancy_week_at_birth.split('+')[0]) : null,
    }),
  };
}

export function CaseSupport({ input, outcome, params }: { input: CaseInputs; outcome: CaseOutcome; params: BenefitParams }) {
  const preview = supportPreview(input);
  const matching = getMatchingSpecialSituationIds(preview, params);
  return <div className="support-tab">
    <h2>Wsparcie</h2>
    {outcome.warnings.length > 0 && <section className="plan-callout plan-callout--warning">
      <h3>Ostrzeżenia dla Twojej sytuacji</h3>
      <ul>{outcome.warnings.map((item) => <li key={item.code}>{item.message_pl}</li>)}</ul>
    </section>}
    <OrganizationsDetails organizations={getOrderedOrganizations(matching)} defaultOpen />
    <PueSimulationDetails scenario={preview} hasMotherInPlan={input.applicant_role === 'MOTHER'} motherInsuranceKnown usePrimarySubmit />
    <OfficialLinksAndUscDetails referenceDate={preview.referenceDate} />
    <AssistantSection params={params} />
  </div>;
}
