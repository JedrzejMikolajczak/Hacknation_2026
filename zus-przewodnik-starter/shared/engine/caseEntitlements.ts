import type { CaseEntitlement, CaseInputs, CaseOutcome } from '../types';
import { insured, KP, payer } from './caseRules';

export function caseEntitlements(
  input: CaseInputs,
  outcome: CaseOutcome,
  event: string | null,
  denial: string | null,
  paternityEnd: string | null,
  hasLivingChildren: boolean,
): CaseEntitlement[] {
  const result: CaseEntitlement[] = [];
  const today = input.reference_date ?? input.application_date;
  const otherInsured = input.co_parenting
    ? input.other_parent
      ? insured(input.other_parent)
      : input.other_parent_insured
    : null;
  const kind = input.stage === 'ADOPTION' ? 'ADOPTION_MATERNITY' : 'MATERNITY';
  for (const role of ['MOTHER', 'FATHER'] as const) {
    const applicant = role === input.applicant_role;
    const person = applicant ? input : input.other_parent;
    const state = applicant ? (event ? denial === null : null) : otherInsured;
    const rolePeriods = outcome.periods.filter(
      (period) => period.parent_role === role && !period.denied,
    );
    const add = (
      benefit_type: CaseEntitlement['benefit_type'],
      is_qualified: boolean | null,
      reason_pl: string,
      legal_basis: string,
    ) => {
      result.push({
        parent_role: role,
        benefit_type,
        is_qualified,
        reason_pl,
        legal_basis,
        who_pays: !is_qualified
          ? null
          : benefit_type === 'SICKNESS' && outcome.who_pays === 'SPLIT_EMPLOYER_THEN_ZUS'
            ? outcome.who_pays
            : person
              ? payer(person)
              : null,
      });
    };
    const insuranceReason =
      applicant && denial
        ? denial
        : state === false
          ? 'Brak ubezpieczenia chorobowego.'
          : 'Uzupełnij dane ubezpieczenia i datę zdarzenia.';
    const parentalExpired = today && outcome.parental_deadline && today > outcome.parental_deadline;
    const available = outcome.parental_pool_weeks > 0 && !parentalExpired;
    add(
      'PARENTAL',
      available ? state : false,
      !available
        ? 'Brak dostępnej puli lub upłynął termin jej wykorzystania.'
        : state
          ? 'Rodzic może wykorzystać część wspólnej puli.'
          : insuranceReason,
      KP.parental,
    );
    if (role === 'MOTHER' || kind === 'ADOPTION_MATERNITY') {
      add(
        kind,
        applicant && input.parental_only ? false : state,
        applicant && input.parental_only
          ? 'Wniosek obejmuje wyłącznie późniejszy okres rodzicielskiego.'
          : state
            ? 'Ubezpieczenie w dniu zdarzenia daje prawo do świadczenia.'
            : insuranceReason,
        kind === 'MATERNITY' ? KP.maternity : KP.adoption,
      );
    } else {
      const takeover = rolePeriods.some((period) => period.leave_type === 'MATERNITY');
      add(
        'MATERNITY',
        takeover ? true : state === false ? false : null,
        takeover
          ? 'Ojciec przejmuje pozostały okres macierzyńskiego.'
          : 'Przejęcie wymaga spełnienia warunków i ustalenia daty przekazania opieki.',
        KP.maternity,
      );
    }
    if (role === 'FATHER') {
      const expired = today && paternityEnd && today > paternityEnd;
      const canUse = hasLivingChildren && !expired ? state : false;
      add(
        'PATERNITY',
        canUse,
        expired
          ? 'Upłynął termin wykorzystania ojcowskiego.'
          : canUse
            ? 'Ojciec może zaplanować odrębny okres ojcowskiego.'
            : insuranceReason,
        KP.paternity,
      );
    }
    if (applicant && input.special_circumstances.premature_or_hospitalized_newborn) {
      const warning = outcome.warnings.find((item) => item.code.startsWith('SUPPLEMENTARY_'));
      const granted = rolePeriods.some((period) => period.leave_type === 'SUPPLEMENTARY_MATERNITY');
      add(
        'SUPPLEMENTARY_MATERNITY',
        granted ? true : warning?.code === 'SUPPLEMENTARY_DATA' ? null : false,
        warning?.message_pl ??
          (granted
            ? 'Podane daty hospitalizacji dają prawo do dodatkowego okresu.'
            : 'Nie ustalono prawa na podstawie danych o porodzie i hospitalizacji.'),
        warning?.legal_basis ?? KP.supplementary,
      );
    }
    if (
      role === 'MOTHER' &&
      applicant &&
      (input.stage === 'PREGNANCY' || input.sickness_leave_start_date)
    ) {
      const paid =
        rolePeriods.some((period) => period.leave_type === 'SICKNESS') ||
        outcome.employer_sick_pay.length > 0;
      add(
        'SICKNESS',
        input.sickness_leave_start_date ? paid : null,
        paid
          ? 'Okres wyczekiwania upłynął. Daty wypłaty wynikają z e-ZLA i początku macierzyńskiego.'
          : (outcome.periods.find((period) => period.leave_type === 'SICKNESS')?.denial_reason_pl ??
              'Podaj dane e-ZLA i długość ubezpieczenia.'),
        KP.sickness,
      );
      add(
        'REHABILITATION',
        null,
        'Prawo wymaga wyczerpania zasiłku chorobowego, dalszej niezdolności do pracy i rokowania jej odzyskania w ocenie ZUS.',
        'Ustawa zasiłkowa, art. 18',
      );
      add(
        'MATERNITY_EQUIVALENT',
        input.special_circumstances.employer_bankruptcy_or_liquidation ? null : false,
        input.special_circumstances.employer_bankruptcy_or_liquidation
          ? 'Sprawdź okoliczności ustania zatrudnienia i możliwość zapewnienia innego zatrudnienia.'
          : 'Brak informacji o ustaniu zatrudnienia w okolicznościach objętych przepisem.',
        'Ustawa zasiłkowa, art. 30',
      );
    }
  }
  return result;
}
