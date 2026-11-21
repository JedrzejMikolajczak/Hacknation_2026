/**
 * WSPÓLNE TYPY – kontrakt między client, server i shared/engine.
 * Zmiany wyłącznie przez branch feature/contract-* (patrz agents/CONVENTIONS.md).
 */

/* ---------- podstawowe ---------- */

export type IsoDate = string; // 'YYYY-MM-DD'
export type Pln = number;     // kwota w złotych
export type Rate = number;    // ułamek, np. 0.815

export type InsuranceTitle = 'employment' | 'mandateContract' | 'selfEmployed' | 'none';
export type SicknessInsurance = 'mandatory' | 'voluntary' | 'none';
export type Payer = 'employer' | 'zus';
export type ParentRole = 'mother' | 'father';
export type SituationType = 'planning' | 'pregnant' | 'afterBirth' | 'adoption';
export type AdoptionType = 'fosterFamily' | 'adoption';

export type LeaveType =
  | 'maternityLeave'
  | 'adoptionMaternityLeave'
  | 'supplementaryMaternityLeave'
  | 'parentalLeave'
  | 'paternityLeave';

export type BenefitType =
  | 'sicknessBenefit'
  | 'employerSickPay'
  | 'maternityBenefit'
  | 'maternityEquivalentBenefit'
  | 'rehabilitationBenefit';

export type RateVariant = 'standard' | 'combined'; // standard = 100% + 70%, combined = 81,5%

/* ---------- dane użytkownika ---------- */

export interface ParentData {
  role: ParentRole;
  insuranceTitle: InsuranceTitle;
  sicknessInsurance: SicknessInsurance;
  insuredSince: IsoDate | null;          // początek nieprzerwanego ubezpieczenia chorobowego
  insuranceEndDate: IsoDate | null;      // np. koniec umowy
  benefitBase: Pln | null;               // jeśli znana; inaczej liczona z BenefitBaseInput
  employerInsuredCount: number | null;   // > 20 → wypłaca pracodawca
  age: number | null;                    // dla 33/14 dni wynagrodzenia chorobowego
  contributionDebt: Pln | null;          // tylko selfEmployed
  wantsLeave: boolean;
  secondaryInsuranceTitle?: InsuranceTitle | null;
  secondarySicknessInsurance?: SicknessInsurance | null;
}

export interface SpecialCircumstances {
  zaZyciemCertificate: boolean;
  pregnancyWeekAtBirth: number | null;   // dla urlopu uzupełniającego
  birthWeightGrams: number | null;
  hospitalizationDays: number | null;
  stillbirth: boolean;
  childDeathDate: IsoDate | null;
  deceasedChildrenCount?: number | null;
  motherHospitalized: boolean;
  motherIncapableOfIndependentLiving: boolean; // orzeczenie o niezdolności do samodzielnej egzystencji
  motherDeceased: boolean;
  motherAbandonedChild?: boolean;
  unlawfulTerminationConfirmedByCourt?: boolean;
  employerBankruptcyOrLiquidation: boolean;    // zasiłek w wysokości macierzyńskiego
}

/** Wewnętrzny format szkicu kreatora oraz testów wcześniejszych reguł. */
export interface WizardScenario {
  situation: SituationType;
  referenceDate: IsoDate;                 // „dzisiaj” – engine nie używa Date.now()
  expectedBirthDate: IsoDate | null;
  birthDate: IsoDate | null;
  childrenCount: number;                  // z jednego porodu / przyjętych jednocześnie
  adoptionType: AdoptionType | null;
  childAcceptanceDate: IsoDate | null;
  childAgeYears: number | null;           // przy adopcji
  schoolObligationDeferred: boolean;
  rateVariant: RateVariant;
  mother: ParentData | null;
  father: ParentData | null;
  special: SpecialCircumstances;
}

/* ---------- wyniki ---------- */

export interface Explanation {
  message: string;            // po polsku, dla użytkownika
  legalBasis: string | null;  // np. 'KP art. 180 § 1', 'ustawa zasiłkowa art. 2a'
}

export interface Warning {
  code:
    | 'SELF_EMPLOYED_DEBT'
    | 'NO_INSURANCE_ON_BIRTH_DATE'
    | 'CONTRACT_ENDS_BEFORE_BIRTH'
    | 'SHAM_CONTRACT_RISK'
    | 'BASE_INCREASE_IN_PREGNANCY'
    | 'COMBINED_RATE_DEADLINE'
    | 'WAITING_PERIOD_NOT_MET';
  message: string;
  legalBasis: string | null;
}

export interface Entitlement {
  benefit: BenefitType;
  parentRole: ParentRole;
  entitled: boolean;
  reason: Explanation;
  payer: Payer | null;
}

export interface EligibilityResult {
  entitlements: Entitlement[];
  warnings: Warning[];
}

export interface LeavePeriod {
  leaveType: LeaveType;
  parentRole: ParentRole;
  startDate: IsoDate;
  endDate: IsoDate;
  weeks: number;
  days: number;
  rate: Rate;
  monthlyAmount: Pln;
  totalAmount: Pln;
}

export interface MaternityCalculationResult {
  periods: LeavePeriod[];
  totalAmount: Pln;
  variants: { standard: Pln; combined: Pln } | null; // porównanie 100/70 vs 81,5
  explanations: Explanation[];
  warnings: Warning[];
}

export interface SicknessResult {
  entitled: boolean;
  employerSickPayDays: number;
  sicknessBenefitMaxDays: number;
  rate: Rate;
  dailyAmount: Pln | null;
  explanations: Explanation[];
}

/* ---------- podstawa wymiaru ---------- */

export type PayComponentKind = 'monthly' | 'monthlyNonSupplemented' | 'quarterly' | 'annual' | 'excluded';

export interface MonthlyIncome {
  month: string;                 // 'YYYY-MM'
  grossAmount: Pln;
  workedDays: number | null;
  requiredWorkingDays: number | null;
  components?: { kind: PayComponentKind; amount: Pln }[];
}

export interface BenefitBaseInput {
  insuranceTitle: InsuranceTitle;
  rightArisesOn: IsoDate;        // dzień powstania prawa do zasiłku
  incomes: MonthlyIncome[];
  contractMonthlySalary: Pln | null;  // do uzupełniania niepełnych miesięcy
  declaredContributionBase: Pln | null; // JDG
  previousBenefitEndDate: IsoDate | null;
  previousBenefitBase: Pln | null;
}

export interface BenefitBaseResult {
  benefitBase: Pln;
  monthsUsed: string[];
  monthsExcluded: string[];
  appliedMinimum: boolean;
  appliedMaximum: boolean;
  explanations: Explanation[];
}

/* ---------- plan urlopów ---------- */

export interface LeavePartRequest {
  parentRole: ParentRole;
  leaveType: LeaveType;
  startDate: IsoDate;
  weeks: number;
}

export interface ParentalSplitInput {
  scenario: WizardScenario;
  parts: LeavePartRequest[];
}

export interface ParentalSplitResult {
  valid: boolean;
  errors: Explanation[];
  periods: LeavePeriod[];
  remainingWeeks: Record<ParentRole, number>;
}

export interface ParentalWithWorkInput {
  scenario: WizardScenario;
  parentRole: ParentRole;
  workTimeFraction: number;      // 0 < x <= 0.5 (część etatu)
  startDate: IsoDate;
  weeks: number;                 // wymiar urlopu przed wydłużeniem
}

export interface ParentalWithWorkResult {
  extendedWeeks: number;
  extendedDays: number;
  periods: LeavePeriod[];
  explanations: Explanation[];
}

/* ---------- dokumenty i wnioski ---------- */

export interface RequiredDocument {
  id: string;                    // np. 'ZAM', 'Z-3', 'birthCertificateShort'
  name: string;
  submitTo: Payer;
  deadline: IsoDate | null;
  note: string | null;
}

export interface DocumentChecklist {
  payer: Payer;
  documents: RequiredDocument[];
  deadlines: { label: string; date: IsoDate; legalBasis: string | null }[];
}

/* ---------- symulacje ---------- */

export interface MockProfileSummary {
  profileId: string;
  label: string;                 // np. 'Anna – umowa o pracę, 3 lata stażu'
}

export interface UserProfile {
  profileId: string;
  firstName: string;
  lastName: string;
  pesel: string;
  birthDate: IsoDate;
  mother: ParentData;
}

export interface AuthSession {
  sessionToken: string;
  profile: UserProfile;
}

export interface SickLeaveCertificate {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate;
  pregnancyCode: boolean;        // kod literowy „B”
}

export interface ZusData {
  profile: UserProfile;
  incomes: MonthlyIncome[];
  sickLeaveCertificates: SickLeaveCertificate[];
  contributionDebt: Pln;
}

/* ---------- API ---------- */

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INTERNAL_ERROR';

export interface ApiResponse<T> {
  data: T | null;
  error: { code: ApiErrorCode; message: string; details?: unknown } | null;
}

/* ---------- parametry (shared/params.json) ---------- */

export interface SupplementaryCase {
  id: number;
  description: string;
  maxPregnancyWeekExclusive: number | null;
  minPregnancyWeek: number | null;
  maxBirthWeightGrams: number | null;
  minBirthWeightGramsExclusive: number | null;
  minHospitalizationDays: number | null;
  countFromDayAfterBirth: number | null;
  limitWeekAfterBirth: number;
}

export interface BenefitParams {
  version: string;
  effectiveFrom: IsoDate;
  rates: Record<'maternity' | 'adoptionMaternity' | 'supplementaryMaternity' | 'paternity' | 'parental' | 'combined' | 'sicknessPregnancy' | 'secondParentNonTransferableInCombined' | 'sicknessStandard', Rate>;
  maternityLeave: {
    weeksByChildrenCount: Record<'1' | '2' | '3' | '4' | '5', number>;
    maxWeeksBeforeBirth: number;
    contractProtectionWeeksFrom: number;
    motherMandatoryWeeksAfterBirth: number;
    motherMandatoryWeeksWithIncapacityCertificate: number;
  };
  adoptionMaternityLeave: {
    minWeeks: number;
    fosterFamilyMaxChildAgeYears: number;
    fosterFamilyMaxChildAgeYearsDeferredSchool: number;
    adoptionMaxChildAgeYears: number;
  };
  parentalLeave: {
    zaZyciemExtensionWeeks: number;
    weeksSingleChild: number;
    weeksMultipleChildren: number;
    weeksSingleChildZaZyciem: number;
    weeksMultipleChildrenZaZyciem: number;
    nonTransferableWeeksPerParent: number;
    maxParts: number;
    deadlineChildTurnsAgeYears: number;
    maxWorkTimeFraction: number;
  };
  paternityLeave: {
    weeks: number;
    maxParts: number;
    minPartWeeks: number;
    deadlineChildAgeMonths: number;
    adoptionDeadlineMonthsFromAdoption: number;
    adoptionMaxChildAgeYears: number;
  };
  supplementaryMaternityLeave: { cases: SupplementaryCase[]; transitionalEffectiveDate: IsoDate; termQualificationLastDay: number };
  calendar: { daysPerWeek: number; dailyBenefitDivisor: number };
  forms2026EffectiveDate: IsoDate;
  insuranceRisk: {
    estimatedPregnancyDays: number;
    shortTitleMonths: number;
    baseIncreasePercent: number;
    beforePregnancyMonths: number;
    description: string;
  };
  childDeath: { thresholdWeeksOfLife: number; weeksAfterBirthIfBeforeThreshold: number; minDaysAfterDeath: number };
  combinedRateApplicationDeadlineDays: number;
  sickness: {
    waitingPeriodDaysMandatory: number;
    waitingPeriodDaysVoluntary: number;
    employerPaidDaysUnder50: number;
    employerPaidDaysFrom50: number;
    maxBenefitPeriodDays: number;
    gapDaysForSameBenefitPeriod: number;
  };
  benefitBase: {
    socialContributionDeduction: Rate;
    lookbackMonths: number;
    minimumWage: Pln;
    maxVoluntaryContributionBase: Pln;
    maxBaseNonEmployee: Pln;
    newBaseAfterGapMonths: number;
  };
  selfEmployedDebtThresholdShareOfMinimumWage: Rate;
  payerThresholdInsuredCount: number;
  applicationDeadlinesDays: Record<'parentalLeave' | 'supplementaryMaternityLeave' | 'paternityLeave' | 'resignFromMaternityPart' | 'fatherTakeoverPart' | 'fosterFamilyAfterAcceptance', number>;
}

/* ---------- Kontrakt spraw konkursowych ---------- */

export type ApplicantRole = 'MOTHER' | 'FATHER';
export type CaseStage = 'PLANNING' | 'PREGNANCY' | 'POST_BIRTH' | 'ADOPTION';
export type EmploymentType = 'UOP' | 'B2B' | 'ZLECENIE' | 'NONE';
export type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'PROBATION' | 'REPLACEMENT';
export type CasePayer = 'EMPLOYER' | 'ZUS' | 'SPLIT_EMPLOYER_THEN_ZUS';
export type PaymentVariant = 'COMBINED_81_5' | 'SPLIT_100_70';

export interface MonthlyBase {
  month: string;
  amount_pln: Pln;
  excluded_bonus_pln?: Pln;
}

export interface DateRange {
  start_date: IsoDate;
  end_date: IsoDate;
}

export interface PlannedParentalPart extends DateRange {
  parent_role?: ApplicantRole;
  work_fraction?: number;
}

export interface CaseParentInsurance {
  employment_type: EmploymentType;
  payer_insured_count_nov_30: '<= 20' | '> 20' | null;
  benefit_base_amount_pln: Pln | null;
  voluntary_sickness_insured: boolean | null;
  contract_end_date?: IsoDate | null;
  has_b2b_arrears?: boolean | null;
  monthly_bases?: MonthlyBase[];
  title_start_date?: IsoDate | null;
  debt_amount_pln?: Pln | null;
}

/** Odrębny tytuł wnioskodawcy z niezależnie potwierdzanym ubezpieczeniem chorobowym. */
export interface CaseAdditionalInsuranceTitle extends CaseParentInsurance {
  employment_type: Exclude<EmploymentType, 'NONE'>;
  sickness_insured: boolean | null;
  contract_type?: ContractType | null;
  insurance_duration_days?: number | null;
}

export interface CaseCircumstances {
  has_code_b_on_ezla: boolean | null;
  premature_or_hospitalized_newborn: boolean;
  za_zyciem_certificate: boolean;
  stillbirth_or_child_death: 'NONE' | 'BEFORE_8_WEEKS' | 'AFTER_8_WEEKS';
  mother_hospitalized_or_incapable: boolean;
  mother_deceased?: boolean;
  mother_abandoned_child?: boolean;
  unlawful_termination_confirmed_by_court?: boolean;
  employer_bankruptcy_or_liquidation: boolean;
  adopted_or_foster_child_age_years: number | null;
  is_professional_foster_family: boolean;
}

export interface CaseInputs {
  applicant_role: ApplicantRole;
  stage: CaseStage;
  co_parenting: boolean;
  other_parent_insured: boolean | null;
  employment_type: EmploymentType;
  contract_type: ContractType | null;
  contract_end_date: IsoDate | null;
  payer_insured_count_nov_30: CaseParentInsurance['payer_insured_count_nov_30'];
  voluntary_sickness_insured: boolean | null;
  insurance_duration_days: number | null;
  has_b2b_arrears: boolean | null;
  applicant_age_50_plus: boolean | null;
  benefit_base_amount_pln: Pln | null;
  due_or_birth_date: IsoDate | null;
  application_date: IsoDate | null;
  days_from_birth_to_application: number | null;
  children_count: number;
  requested_payment_variant: PaymentVariant;
  father_parental_weeks: number;
  part_time_work_fraction: number;
  special_circumstances: CaseCircumstances;
  living_children_count?: number;
  deceased_children_count?: number;
  pregnancy_week_at_birth?: string;
  birth_weight_grams?: number | number[];
  newborn_hospitalization_start?: IsoDate;
  newborn_hospitalization_end?: IsoDate;
  za_zyciem_certificate_date?: IsoDate;
  application_to_payer_date?: IsoDate;
  maternity_leave_start_date?: IsoDate;
  sickness_leave_start_date?: IsoDate;
  sickness_leave_end_date?: IsoDate;
  sickness_benefit_start_date?: IsoDate;
  sickness_waiting_period_confirmed?: boolean;
  monthly_bases?: MonthlyBase[];
  parental_leave_parts?: PlannedParentalPart[];
  title_start_date?: IsoDate;
  employer_is_family_member?: boolean;
  newly_created_position?: boolean;
  adopted_or_foster_child_acceptance_date?: IsoDate;
  adoption_type?: 'ADOPTION' | 'FOSTER_FAMILY';
  school_obligation_deferred?: boolean;
  child_death_date?: IsoDate;
  other_parent?: CaseParentInsurance;
  parental_only?: boolean;
  paternity_leave_start_date?: IsoDate;
  father_takeover_date?: IsoDate;
  mother_abandonment_date?: IsoDate;
  mother_maternity_days_used?: number;
  mother_was_insured_at_abandonment?: boolean;
  father_stops_gainful_activity?: boolean;
  additional_insurance_titles?: CaseAdditionalInsuranceTitle[];
  secondary_employment_type?: EmploymentType | null;
  secondary_voluntary_sickness_insured?: boolean | null;
  reference_date?: IsoDate;
  debt_amount_pln?: Pln;
  sick_pay_days_already_used?: number;
  sickness_benefit_days_already_used?: number;
  sickness_base_changes?: { effective_date: IsoDate; amount_pln: Pln }[];
}

export type CaseLeaveType =
  | 'SICKNESS' | 'MATERNITY' | 'SUPPLEMENTARY_MATERNITY' | 'PARENTAL'
  | 'PARENTAL_ZA_ZYCIEM_EXTENSION' | 'PARENTAL_WORK_EXTENSION' | 'PATERNITY' | 'ADOPTION_MATERNITY';

export interface CasePeriod extends DateRange {
  leave_type: CaseLeaveType;
  parent_role: ApplicantRole;
  who_pays: CasePayer | null;
  days: number;
  weeks: number;
  rate_percent: number | null;
  work_fraction: number;
  benefit_base_pln: Pln | null;
  daily_amount_pln: Pln | null;
  monthly_amount_pln: Pln | null;
  total_amount_pln: Pln | null;
  denied: boolean;
  denial_reason_pl: string | null;
  legal_basis: string;
  amount_segments?: (DateRange & {
    benefit_base_pln: Pln;
    daily_amount_pln: Pln;
    monthly_amount_pln: Pln;
  })[];
}

export interface CaseWarning {
  code: string;
  message_pl: string;
  legal_basis: string | null;
}

export interface CaseDecision {
  is_qualified: boolean;
  decision_summary_pl: string;
  denial_or_reduction_reason_pl: string | null;
  who_pays: CasePayer | null;
  granted_rate_percent: number | null;
  granted_duration_days: number;
  granted_duration_weeks: number | null;
  calculated_amount_pln: Pln | null;
  mapped_forms_2026: string[];
  legal_basis_cited: string[];
}

export interface CaseOutcome extends CaseDecision {
  benefit_base_pln: Pln | null;
  periods: CasePeriod[];
  warnings: CaseWarning[];
  employer_sick_pay: CasePeriod[];
  parental_pool_weeks: number;
  parental_applicant_limit_weeks: number;
  parental_deadline: IsoDate | null;
  requested_payment_variant: PaymentVariant;
  applied_payment_variant: PaymentVariant;
  variants: Record<PaymentVariant, Pln | null>;
}

export interface CaseEntitlement {
  parent_role: ApplicantRole;
  benefit_type: CaseLeaveType | 'REHABILITATION' | 'MATERNITY_EQUIVALENT';
  is_qualified: boolean | null;
  who_pays: CasePayer | null;
  reason_pl: string;
  legal_basis: string;
}

export interface CaseDocument {
  id: string;
  name_pl: string;
  parent_role: ApplicantRole;
  submit_to: 'EMPLOYER' | 'ZUS' | 'USC' | null;
  leave_type: CaseLeaveType | null;
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  deadline: IsoDate | null;
  is_overdue: boolean;
  legal_basis: string;
}

export interface CaseAdditionalTitleOutcome {
  employment_type: CaseAdditionalInsuranceTitle['employment_type'];
  outcome: CaseOutcome;
  documents: CaseDocument[];
  entitlements: CaseEntitlement[];
}

export interface CasePlan {
  outcome: CaseOutcome;
  additional_title_outcomes?: CaseAdditionalTitleOutcome[];
  entitlements: CaseEntitlement[];
  documents: CaseDocument[];
  validation_errors: CaseWarning[];
  support: SupportResources;
  default_father_parental_start_date: IsoDate | null;
}

export interface CaseRecord {
  case_id: string;
  short_title: string;
  scenario_category: string;
  inputs: CaseInputs;
  ground_truth_outcome: CaseDecision & {
    periods: (Pick<CasePeriod, 'leave_type' | 'start_date' | 'end_date' | 'days' | 'weeks' |
      'rate_percent' | 'denied' | 'work_fraction'> & Partial<CasePeriod>)[];
    benefit_base_pln?: Pln;
  };
  edge_case_notes: string;
}

export type CaseSummary = Pick<CaseRecord, 'case_id' | 'short_title' | 'scenario_category'>;

export interface CaseDifference {
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface CaseEvaluation {
  case_id: string;
  outcome: CaseOutcome;
  matches: boolean;
  differences: CaseDifference[];
}

export interface AssistantAnswer {
  answer: string;
  sources: string[];
}

export interface CharitableOrganization {
  id: string;
  name: string;
  legal_form: string;
  helps_with: string;
  description: string;
  url: string;
  related_situations: string[];
}

export interface OfficialLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface SupportResources {
  organizations: CharitableOrganization[];
  official_links: OfficialLink[];
}
