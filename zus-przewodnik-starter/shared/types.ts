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
}

export interface SpecialCircumstances {
  zaZyciemCertificate: boolean;
  pregnancyWeekAtBirth: number | null;   // dla urlopu uzupełniającego
  birthWeightGrams: number | null;
  hospitalizationDays: number | null;
  stillbirth: boolean;
  childDeathDate: IsoDate | null;
  motherHospitalized: boolean;
  motherIncapableOfIndependentLiving: boolean; // orzeczenie o niezdolności do samodzielnej egzystencji
  motherDeceased: boolean;
  employerBankruptcyOrLiquidation: boolean;    // zasiłek w wysokości macierzyńskiego
}

export interface ScenarioInput {
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
  mother: ParentData;
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
  scenario: ScenarioInput;
  parts: LeavePartRequest[];
}

export interface ParentalSplitResult {
  valid: boolean;
  errors: Explanation[];
  periods: LeavePeriod[];
  remainingWeeks: Record<ParentRole, number>;
}

export interface ParentalWithWorkInput {
  scenario: ScenarioInput;
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
  mother: ParentData;
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

/* ---------- przykładowe sprawy ZUS ---------- */

export interface ZusCaseSummary {
  caseId: string;
  title: string;
  expectedGranted: boolean;
}

export interface ZusCase {
  caseId: string;
  title: string;
  scenario: ScenarioInput;
  benefitBaseInput: BenefitBaseInput | null;
  zusDecision: { granted: boolean; benefitBase: Pln | null; amount: Pln | null; note: string | null };
}

export interface CaseEvaluationResult {
  caseId: string;
  eligibility: EligibilityResult;
  calculation: MaternityCalculationResult | null;
  benefitBase: BenefitBaseResult | null;
  matchesZusDecision: boolean;
  differences: string[];
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
  rates: Record<'maternity' | 'adoptionMaternity' | 'supplementaryMaternity' | 'paternity' | 'parental' | 'combined' | 'sicknessPregnancy' | 'secondParentNonTransferableInCombined', Rate>;
  maternityLeave: {
    weeksByChildrenCount: Record<'1' | '2' | '3' | '4' | '5', number>;
    maxWeeksBeforeBirth: number;
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
  supplementaryMaternityLeave: { cases: SupplementaryCase[] };
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
