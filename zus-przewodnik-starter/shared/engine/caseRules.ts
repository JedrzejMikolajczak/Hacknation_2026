import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseParentInsurance,
  CaseWarning,
} from '../types';
import { addDays, addMonths, daysBetween } from './core';

export const KP = {
  maternity: 'Kodeks pracy, art. 180 i 180¹',
  supplementary: 'Kodeks pracy, art. 180²',
  transitional: 'Ustawa z 6 grudnia 2024 r. o zmianie ustawy – Kodeks pracy, art. 17',
  parental: 'Kodeks pracy, art. 182¹ᵃ–182¹ᵈ',
  zaZyciem: 'Kodeks pracy, art. 182¹ᵃ § 2 i ustawa „Za życiem”, art. 4 ust. 3',
  work: 'Kodeks pracy, art. 182¹ᵉ–182¹ᶠ oraz ustawa zasiłkowa, art. 31 ust. 4a',
  paternity: 'Kodeks pracy, art. 182³',
  adoption: 'Kodeks pracy, art. 183',
  sickness: 'Ustawa zasiłkowa, art. 4, 8 i 11',
  sickPay: 'Kodeks pracy, art. 92',
  qualification: 'Ustawa zasiłkowa, art. 29–29a i 61',
  combined: 'Ustawa zasiłkowa, art. 30a i 31',
  debt: 'Ustawa zasiłkowa, art. 2a',
} as const;

export function eventDate(input: CaseInputs): string | null {
  return input.stage === 'ADOPTION'
    ? (input.adopted_or_foster_child_acceptance_date ?? null)
    : input.due_or_birth_date;
}

export function otherRole(role: ApplicantRole): ApplicantRole {
  return role === 'MOTHER' ? 'FATHER' : 'MOTHER';
}

export function insured(parent: CaseParentInsurance): boolean | null {
  if (parent.employment_type === 'UOP') return true;
  if (parent.employment_type === 'NONE') return false;
  return parent.voluntary_sickness_insured;
}

export function payer(parent: CaseParentInsurance) {
  if (parent.employment_type === 'NONE') return null;
  if (parent.employment_type === 'B2B') return 'ZUS';
  if (parent.payer_insured_count_nov_30 === null) return null;
  return parent.payer_insured_count_nov_30 === '> 20' ? 'EMPLOYER' : 'ZUS';
}

export function applicantDenial(
  input: CaseInputs,
  on: string,
  params: BenefitParams,
): string | null {
  if (insured(input) === false) return 'Brak ubezpieczenia chorobowego.';
  if (
    input.employment_type === 'B2B' &&
    (input.debt_amount_pln !== undefined
      ? input.debt_amount_pln >
        params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage
      : input.has_b2b_arrears)
  ) {
    return 'Zadłużenie składkowe przekracza ustawowy próg. Do wypłaty potrzebna jest spłata.';
  }
  if (input.title_start_date && on < input.title_start_date)
    return 'Tytuł ubezpieczenia powstał po zdarzeniu.';
  if (input.contract_end_date && input.contract_end_date < on) {
    if (
      input.employment_type === 'UOP' &&
      input.applicant_role === 'MOTHER' &&
      input.due_or_birth_date
    ) {
      const pregnancyStart = addDays(
        input.due_or_birth_date,
        -params.insuranceRisk.estimatedPregnancyDays,
      );
      const eligibleContract = input.contract_type === 'FIXED_TERM';
      if (
        eligibleContract &&
        on <= input.due_or_birth_date &&
        daysBetween(pregnancyStart, input.contract_end_date) >=
          params.maternityLeave.contractProtectionWeeksFrom * params.calendar.daysPerWeek
      )
        return null;
      if (input.special_circumstances.employer_bankruptcy_or_liquidation) return null;
    }
    return 'Umowa zakończyła się przed powstaniem prawa do tego świadczenia.';
  }
  return insured(input) === null ? 'Brakuje informacji o ubezpieczeniu chorobowym.' : null;
}

export function grossBasis(input: CaseInputs, from: string, params: BenefitParams) {
  const months = (input.monthly_bases ?? [])
    .filter(
      (item) =>
        item.month < from.slice(0, 7) &&
        item.month >= addMonths(from, -params.benefitBase.lookbackMonths).slice(0, 7),
    )
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!months.length) return null;
  const average =
    months.reduce((sum, item) => sum + item.amount_pln - (item.excluded_bonus_pln ?? 0), 0) /
    months.length;
  const afterDeduction = average * (1 - params.benefitBase.socialContributionDeduction);
  return input.employment_type === 'UOP'
    ? afterDeduction
    : Math.min(afterDeduction, params.benefitBase.maxBaseNonEmployee);
}

export function insuranceRisks(input: CaseInputs, params: BenefitParams): CaseWarning[] {
  const birth = input.due_or_birth_date;
  const event = input.sickness_leave_start_date ?? eventDate(input);
  const { insuranceRisk: risk } = params;
  const pregnancy =
    birth && input.stage !== 'ADOPTION' ? addDays(birth, -risk.estimatedPregnancyDays) : null;
  const warning = (code: string, signal: string): CaseWarning => ({
    code,
    legal_basis: null,
    message_pl: `${signal} ZUS może poprosić o wyjaśnienia lub dokumenty dotyczące wykonywanej pracy, działalności i wysokości wynagrodzenia. Przygotuj umowę, ewidencję czasu pracy, potwierdzenia wykonania zleceń, faktury lub przelewy. Sam sygnał nie przesądza o uprawnieniach.`,
  });
  if (input.employment_type === 'NONE') return [];
  const warnings: CaseWarning[] = [];
  const title = input.title_start_date;
  if (
    title &&
    ((pregnancy && birth && title >= pregnancy && title <= birth) ||
      (event && title <= event && title > addMonths(event, -risk.shortTitleMonths)))
  ) {
    warnings.push(
      warning(
        'SHAM_CONTRACT_RISK',
        'Tytuł ubezpieczenia powstał w trakcie ciąży lub niedługo przed zdarzeniem.',
      ),
    );
  }
  const months = [...(input.monthly_bases ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  if (
    pregnancy &&
    birth &&
    months.some((item, index) => {
      if (
        index === 0 ||
        item.month < addMonths(pregnancy, -risk.beforePregnancyMonths).slice(0, 7) ||
        item.month > birth.slice(0, 7)
      )
        return false;
      const preceding = months.slice(0, index).map((base) => base.amount_pln);
      const average = preceding.reduce((sum, value) => sum + value, 0) / preceding.length;
      return average > 0 && item.amount_pln >= average * (1 + risk.baseIncreasePercent / 100);
    })
  ) {
    warnings.push(
      warning(
        'BASE_INCREASE_IN_PREGNANCY',
        'Zadeklarowana podstawa wyraźnie wzrosła w ciąży lub przed ciążą.',
      ),
    );
  }
  if (input.employer_is_family_member || input.newly_created_position) {
    warnings.push(
      warning(
        'EMPLOYMENT_CONTEXT_RISK',
        'Wskazano zatrudnienie u członka rodziny lub na nowo utworzonym stanowisku.',
      ),
    );
  }
  return warnings;
}
