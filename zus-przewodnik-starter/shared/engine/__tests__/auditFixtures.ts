import type { CaseInputs } from '../../types';

const baseInput: CaseInputs = {
  applicant_role: 'MOTHER',
  stage: 'POST_BIRTH',
  co_parenting: false,
  other_parent_insured: null,
  employment_type: 'UOP',
  contract_type: 'INDEFINITE',
  contract_end_date: null,
  payer_insured_count_nov_30: '<= 20',
  voluntary_sickness_insured: null,
  insurance_duration_days: 180,
  has_b2b_arrears: false,
  applicant_age_50_plus: false,
  benefit_base_amount_pln: 6000,
  due_or_birth_date: '2026-07-01',
  application_date: null,
  days_from_birth_to_application: null,
  children_count: 1,
  requested_payment_variant: 'SPLIT_100_70',
  father_parental_weeks: 0,
  part_time_work_fraction: 0,
  special_circumstances: {
    has_code_b_on_ezla: null,
    premature_or_hospitalized_newborn: false,
    za_zyciem_certificate: false,
    stillbirth_or_child_death: 'NONE',
    mother_hospitalized_or_incapable: false,
    employer_bankruptcy_or_liquidation: false,
    adopted_or_foster_child_age_years: null,
    is_professional_foster_family: false,
  },
  reference_date: '2026-11-22',
};

export const birthInput = (
  patch: Partial<CaseInputs> = {},
  circumstances: Partial<CaseInputs['special_circumstances']> = {},
): CaseInputs => ({
  ...baseInput,
  ...patch,
  special_circumstances: { ...baseInput.special_circumstances, ...circumstances },
});
