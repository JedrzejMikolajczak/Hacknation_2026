import type { CaseInputs, CaseParentInsurance, EmploymentType, ParentData } from '@shared/types';
import type { ScenarioDraft } from '../../app/scenarioDraft';
import { addDaysIso, diffDaysIso, todayIsoDate } from './planScenario';

const titles = { employment: 'UOP', selfEmployed: 'B2B', mandateContract: 'ZLECENIE', none: 'NONE' } satisfies Record<string, EmploymentType>;
const stages = { planning: 'PLANNING', pregnant: 'PREGNANCY', afterBirth: 'POST_BIRTH', adoption: 'ADOPTION' } as const;

function parentInsurance(parent: Partial<ParentData>): CaseParentInsurance {
  return {
    employment_type: parent.insuranceTitle ? titles[parent.insuranceTitle] : 'NONE',
    payer_insured_count_nov_30: parent.employerInsuredCount == null ? null : parent.employerInsuredCount > 20 ? '> 20' : '<= 20',
    benefit_base_amount_pln: parent.benefitBase ?? null,
    voluntary_sickness_insured: parent.sicknessInsurance === undefined ? null : parent.sicknessInsurance === 'voluntary',
    contract_end_date: parent.insuranceEndDate ?? null,
  };
}

export function wizardCase(draft: ScenarioDraft): CaseInputs | null {
  const applicant = draft.mother ?? draft.father;
  if (!applicant?.insuranceTitle || !draft.situation) return null;
  const fatherOnly = !draft.mother;
  const other = fatherOnly ? draft.mother : draft.father;
  const special = draft.special ?? {};
  const birth = draft.birthDate ?? draft.expectedBirthDate ?? null;
  const sick = draft.pregnancySickLeave;
  const baseInput = draft.sicknessBenefitBaseInput ?? draft.benefitBaseInputs?.[fatherOnly ? 'father' : 'mother'];
  const hospital = birth && special.hospitalizationDays ? addDaysIso(birth, special.hospitalizationDays - 1) : undefined;
  const death = special.childDeathDate;
  return {
    ...parentInsurance(applicant),
    applicant_role: fatherOnly ? 'FATHER' : 'MOTHER',
    stage: stages[draft.situation],
    co_parenting: other != null,
    other_parent_insured: other?.insuranceTitle ? other.insuranceTitle === 'employment' ? true :
      other.insuranceTitle === 'none' ? false : other.sicknessInsurance === 'voluntary' : null,
    other_parent: other?.insuranceTitle ? parentInsurance(other) : undefined,
    contract_type: null, contract_end_date: applicant.insuranceEndDate ?? null,
    insurance_duration_days: null, has_b2b_arrears: null,
    applicant_age_50_plus: applicant.age == null ? null : applicant.age >= 50,
    due_or_birth_date: birth, application_date: null, days_from_birth_to_application: null,
    children_count: draft.childrenCount ?? 1,
    requested_payment_variant: draft.rateVariant === 'combined' ? 'COMBINED_81_5' : 'SPLIT_100_70',
    father_parental_weeks: 0, part_time_work_fraction: 0,
    special_circumstances: {
      has_code_b_on_ezla: sick?.startDate ? true : null,
      premature_or_hospitalized_newborn: hospital !== undefined || special.pregnancyWeekAtBirth != null,
      za_zyciem_certificate: !!special.zaZyciemCertificate,
      stillbirth_or_child_death: special.stillbirth || death ? death && birth && diffDaysIso(birth, death) >= 56
        ? 'AFTER_8_WEEKS' : 'BEFORE_8_WEEKS' : 'NONE',
      mother_hospitalized_or_incapable: !!(special.motherHospitalized || special.motherIncapableOfIndependentLiving),
      employer_bankruptcy_or_liquidation: !!special.employerBankruptcyOrLiquidation,
      adopted_or_foster_child_age_years: draft.childAgeYears ?? null,
      is_professional_foster_family: false,
    },
    reference_date: todayIsoDate(),
    title_start_date: applicant.insuredSince ?? undefined,
    debt_amount_pln: applicant.contributionDebt ?? undefined,
    adopted_or_foster_child_acceptance_date: draft.childAcceptanceDate ?? undefined,
    adoption_type: draft.adoptionType ? draft.adoptionType === 'adoption' ? 'ADOPTION' : 'FOSTER_FAMILY' : undefined,
    school_obligation_deferred: draft.schoolObligationDeferred,
    child_death_date: death ?? undefined,
    sickness_leave_start_date: sick?.startDate ?? undefined,
    sickness_leave_end_date: sick?.endDate ?? undefined,
    pregnancy_week_at_birth: special.pregnancyWeekAtBirth?.toString(),
    birth_weight_grams: special.birthWeightGrams ?? undefined,
    newborn_hospitalization_start: hospital ? birth! : undefined,
    newborn_hospitalization_end: hospital,
    monthly_bases: baseInput?.incomes.map(({ month, grossAmount, components }) => ({
      month, amount_pln: grossAmount + (components ?? []).filter((item) => item.kind !== 'excluded').reduce((sum, item) => sum + item.amount, 0),
    })),
  };
}
