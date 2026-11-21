import type {
  BenefitBaseInput,
  BenefitParams,
  CaseInputs,
  CaseParentInsurance,
  EmploymentType,
  IsoDate,
  MonthlyBase,
  ParentData,
} from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import type { ScenarioDraft } from '../../app/scenarioDraft';
import { addDaysIso, diffDaysIso, todayIsoDate } from './planScenario';

const titles = {
  employment: 'UOP',
  selfEmployed: 'B2B',
  mandateContract: 'ZLECENIE',
  none: 'NONE',
} satisfies Record<string, EmploymentType>;
const stages = {
  planning: 'PLANNING',
  pregnant: 'PREGNANCY',
  afterBirth: 'POST_BIRTH',
  adoption: 'ADOPTION',
} as const;

function addMonthsIso(iso: IsoDate, months: number): IsoDate {
  const [year, month, day] = iso.split('-').map(Number);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonthIndex, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function previousMonthIso(iso: IsoDate): string {
  return addMonthsIso(`${iso.slice(0, 7)}-01`, -1).slice(0, 7);
}

function monthlyBasesFromInput(baseInput: BenefitBaseInput | undefined): MonthlyBase[] | undefined {
  if (!baseInput) return undefined;
  if (baseInput.incomes.length > 0) {
    return baseInput.incomes.map(({ month, grossAmount, components }) => ({
      month,
      amount_pln:
        grossAmount +
        (components ?? [])
          .filter((item) => item.kind !== 'excluded')
          .reduce((sum, item) => sum + item.amount, 0),
    }));
  }
  const fallbackAmount = baseInput.declaredContributionBase ?? baseInput.contractMonthlySalary;
  if (fallbackAmount != null) {
    return [{ month: previousMonthIso(baseInput.rightArisesOn), amount_pln: fallbackAmount }];
  }
  return undefined;
}

function isParentInsured(parent: Partial<ParentData> | null | undefined): boolean | null {
  if (!parent?.insuranceTitle) return null;
  if (parent.insuranceTitle === 'employment') return true;
  if (parent.insuranceTitle === 'none') return false;
  if (parent.sicknessInsurance === undefined) return null;
  return parent.sicknessInsurance === 'voluntary';
}

function hasB2bDebtAboveThreshold(
  parent: Partial<ParentData>,
  params: BenefitParams,
): boolean | null {
  if (parent.insuranceTitle !== 'selfEmployed' || parent.contributionDebt == null) return null;
  const threshold =
    Math.round(
      params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
    ) / 100;
  return parent.contributionDebt > threshold;
}

function parentInsurance(
  parent: Partial<ParentData>,
  params: BenefitParams,
  baseInput?: BenefitBaseInput,
): CaseParentInsurance {
  const monthlyBases = parent.benefitBase == null ? monthlyBasesFromInput(baseInput) : undefined;
  const arrears = hasB2bDebtAboveThreshold(parent, params);
  return {
    employment_type: parent.insuranceTitle ? titles[parent.insuranceTitle] : 'NONE',
    payer_insured_count_nov_30:
      parent.employerInsuredCount == null
        ? null
        : parent.employerInsuredCount > params.payerThresholdInsuredCount
          ? '> 20'
          : '<= 20',
    benefit_base_amount_pln: parent.benefitBase ?? null,
    voluntary_sickness_insured:
      parent.sicknessInsurance === undefined ? null : parent.sicknessInsurance === 'voluntary',
    contract_end_date: parent.insuranceEndDate ?? null,
    ...(arrears !== null ? { has_b2b_arrears: arrears } : {}),
    ...(parent.insuredSince ? { title_start_date: parent.insuredSince } : {}),
    ...(parent.contributionDebt != null ? { debt_amount_pln: parent.contributionDebt } : {}),
    ...(monthlyBases ? { monthly_bases: monthlyBases } : {}),
  };
}

function defaultPaternityStartDate(
  event: IsoDate,
  referenceDate: IsoDate,
  father: Partial<ParentData>,
  isAdoption: boolean,
  params: BenefitParams,
): IsoDate | undefined {
  const deadlineMonths = isAdoption
    ? params.paternityLeave.adoptionDeadlineMonthsFromAdoption
    : params.paternityLeave.deadlineChildAgeMonths;
  const paternityEnd = addDaysIso(addMonthsIso(event, deadlineMonths), -1);
  if (referenceDate > paternityEnd) return undefined;
  const paternityDays = params.paternityLeave.weeks * params.calendar.daysPerWeek;
  const noticeDays =
    father.insuranceTitle === 'employment' ? params.applicationDeadlinesDays.paternityLeave : 0;
  const earliestWithoutOverdue = addDaysIso(referenceDate, noticeDays);
  const candidate = event >= earliestWithoutOverdue ? event : earliestWithoutOverdue;
  if (addDaysIso(candidate, paternityDays - 1) <= paternityEnd) return candidate;
  const latestStart = addDaysIso(paternityEnd, -(paternityDays - 1));
  return latestStart >= event ? latestStart : undefined;
}

export function wizardCase(
  draft: ScenarioDraft,
  params: BenefitParams = DEFAULT_PARAMS,
): CaseInputs | null {
  const applicant = draft.mother ?? draft.father;
  if (!applicant?.insuranceTitle || !draft.situation) return null;
  const fatherOnly = !draft.mother;
  const other = fatherOnly ? draft.mother : draft.father;
  const special = draft.special ?? {};
  if (special.motherDeceased && draft.motherDeathDate === null) return null;
  const isAdoption = draft.situation === 'adoption';
  const birth = draft.birthDate ?? draft.expectedBirthDate ?? null;
  const event = isAdoption ? (draft.childAcceptanceDate ?? null) : birth;
  const referenceDate = draft.referenceDate ?? todayIsoDate();
  const sick = draft.pregnancySickLeave;
  const applicantBaseInput =
    draft.sicknessBenefitBaseInput ?? draft.benefitBaseInputs?.[fatherOnly ? 'father' : 'mother'];
  const otherBaseInput = fatherOnly ? undefined : draft.benefitBaseInputs?.father;
  const hospital =
    birth && special.hospitalizationDays
      ? addDaysIso(birth, special.hospitalizationDays - 1)
      : undefined;
  const death = special.childDeathDate;
  const childrenCount = draft.childrenCount ?? 1;
  const childDeathThresholdDays =
    params.childDeath.thresholdWeeksOfLife * params.calendar.daysPerWeek;
  const hasChildLoss = Boolean(special.stillbirth || death);
  const livingChildren = hasChildLoss ? Math.max(0, childrenCount - 1) : childrenCount;

  const motherInsured = isParentInsured(draft.mother);
  const fatherInsured = isParentInsured(draft.father);
  const fatherWantsLeave = Boolean(
    draft.father && fatherInsured === true && draft.father.wantsLeave === true,
  );

  let fatherParentalWeeks = 0;
  if (!fatherOnly && fatherWantsLeave && livingChildren > 0) {
    const motherActive =
      motherInsured === true && draft.mother?.wantsLeave !== false && !special.motherDeceased;
    if (motherActive) {
      fatherParentalWeeks = params.parentalLeave.nonTransferableWeeksPerParent;
    } else {
      const singlePool =
        livingChildren === 1 ||
        (livingChildren > 1 && hasChildLoss && Boolean(special.zaZyciemCertificate));
      const pool = special.zaZyciemCertificate
        ? singlePool
          ? params.parentalLeave.weeksSingleChildZaZyciem
          : params.parentalLeave.weeksMultipleChildrenZaZyciem
        : singlePool
          ? params.parentalLeave.weeksSingleChild
          : params.parentalLeave.weeksMultipleChildren;
      fatherParentalWeeks = Math.max(0, pool - params.parentalLeave.nonTransferableWeeksPerParent);
    }
  }

  const canTakePaternity =
    fatherWantsLeave &&
    livingChildren > 0 &&
    event !== null &&
    !(isAdoption && draft.adoptionType === 'fosterFamily') &&
    !(
      isAdoption &&
      draft.childAgeYears != null &&
      draft.childAgeYears >= params.paternityLeave.adoptionMaxChildAgeYears
    );
  const paternityStart =
    canTakePaternity && draft.father && event
      ? defaultPaternityStartDate(event, referenceDate, draft.father, isAdoption, params)
      : undefined;

  const motherWantsResignTakeover =
    !fatherOnly &&
    !isAdoption &&
    livingChildren > 0 &&
    birth !== null &&
    motherInsured === true &&
    draft.mother?.wantsLeave === false &&
    !special.motherDeceased &&
    fatherWantsLeave;
  const mandatoryMotherWeeks =
    special.motherHospitalized || special.motherIncapableOfIndependentLiving
      ? params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate
      : params.maternityLeave.motherMandatoryWeeksAfterBirth;
  const fatherTakeoverDate =
    special.motherDeceased && draft.motherDeathDate
      ? addDaysIso(draft.motherDeathDate, 1)
      : motherWantsResignTakeover && birth
      ? addDaysIso(birth, mandatoryMotherWeeks * params.calendar.daysPerWeek)
      : undefined;

  const applicantInsurance = parentInsurance(applicant, params);
  const applicantMonthlyBases =
    applicant.benefitBase == null ? monthlyBasesFromInput(applicantBaseInput) : undefined;
  const durationTarget = sick?.startDate ?? event ?? referenceDate;
  const rawInsuranceDuration =
    applicant.insuredSince && durationTarget
      ? diffDaysIso(applicant.insuredSince, durationTarget)
      : null;
  const insuranceDurationDays =
    rawInsuranceDuration !== null && rawInsuranceDuration >= 0 ? rawInsuranceDuration : null;
  const applicantContractType =
    applicant.insuranceTitle === 'employment' && applicant.insuranceEndDate ? 'FIXED_TERM' : null;
  const applicantHasB2bArrears = hasB2bDebtAboveThreshold(applicant, params);

  return {
    employment_type: applicantInsurance.employment_type,
    payer_insured_count_nov_30: applicantInsurance.payer_insured_count_nov_30,
    benefit_base_amount_pln: applicantInsurance.benefit_base_amount_pln,
    voluntary_sickness_insured: applicantInsurance.voluntary_sickness_insured,
    applicant_role: fatherOnly ? 'FATHER' : 'MOTHER',
    stage: stages[draft.situation],
    co_parenting: other != null,
    other_parent_insured: isParentInsured(other),
    other_parent: other?.insuranceTitle
      ? parentInsurance(other, params, otherBaseInput)
      : undefined,
    contract_type: applicantContractType,
    contract_end_date: applicant.insuranceEndDate ?? null,
    insurance_duration_days: insuranceDurationDays,
    has_b2b_arrears: applicantHasB2bArrears,
    applicant_age_50_plus: applicant.age == null ? null : applicant.age >= 50,
    due_or_birth_date: birth,
    application_date: null,
    days_from_birth_to_application: null,
    children_count: childrenCount,
    requested_payment_variant: draft.rateVariant === 'combined' ? 'COMBINED_81_5' : 'SPLIT_100_70',
    father_parental_weeks: fatherParentalWeeks,
    part_time_work_fraction: 0,
    special_circumstances: {
      has_code_b_on_ezla: sick?.startDate ? true : null,
      premature_or_hospitalized_newborn:
        hospital !== undefined || special.pregnancyWeekAtBirth != null,
      za_zyciem_certificate: !!special.zaZyciemCertificate,
      stillbirth_or_child_death:
        special.stillbirth || death
          ? death && birth && diffDaysIso(birth, death) >= childDeathThresholdDays
            ? 'AFTER_8_WEEKS'
            : 'BEFORE_8_WEEKS'
          : 'NONE',
      mother_hospitalized_or_incapable: !!(
        special.motherHospitalized || special.motherIncapableOfIndependentLiving
      ),
      ...(special.motherDeceased ? { mother_deceased: true } : {}),
      employer_bankruptcy_or_liquidation: !!special.employerBankruptcyOrLiquidation,
      adopted_or_foster_child_age_years: draft.childAgeYears ?? null,
      is_professional_foster_family: false,
    },
    reference_date: referenceDate,
    title_start_date: applicant.insuredSince ?? undefined,
    debt_amount_pln: applicant.contributionDebt ?? undefined,
    adopted_or_foster_child_acceptance_date: draft.childAcceptanceDate ?? undefined,
    adoption_type: draft.adoptionType
      ? draft.adoptionType === 'adoption'
        ? 'ADOPTION'
        : 'FOSTER_FAMILY'
      : undefined,
    school_obligation_deferred: draft.schoolObligationDeferred,
    child_death_date: death ?? undefined,
    sickness_leave_start_date: sick?.startDate ?? undefined,
    sickness_leave_end_date: sick?.endDate ?? undefined,
    pregnancy_week_at_birth: special.pregnancyWeekAtBirth?.toString(),
    birth_weight_grams: special.birthWeightGrams ?? undefined,
    newborn_hospitalization_start: hospital ? birth! : undefined,
    newborn_hospitalization_end: hospital,
    paternity_leave_start_date: paternityStart,
    father_takeover_date: fatherTakeoverDate,
    monthly_bases: applicantMonthlyBases,
  };
}
