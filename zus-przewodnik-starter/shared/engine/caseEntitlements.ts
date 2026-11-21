import type { BenefitParams, CaseEntitlement, CaseInputs, CaseOutcome } from '../types';
import { insured, KP, parentDenial, payer, qualifiesAfterUnlawfulTermination } from './caseRules';

export function caseEntitlements(
  input: CaseInputs,
  outcome: CaseOutcome,
  event: string | null,
  denial: string | null,
  paternityEnd: string | null,
  hasLivingChildren: boolean,
  params?: BenefitParams,
): CaseEntitlement[] {
  const result: CaseEntitlement[] = [];
  const today = input.reference_date ?? input.application_date;
  const otherDenial =
    input.co_parenting && input.other_parent && event && params
      ? parentDenial(input.other_parent, event, params)
      : null;
  const otherInsured = input.co_parenting
    ? input.other_parent
      ? event && params
        ? otherDenial === null
        : insured(input.other_parent)
      : input.other_parent_insured
    : null;
  const kind = input.stage === 'ADOPTION' ? 'ADOPTION_MATERNITY' : 'MATERNITY';
  const fosterFamily = input.stage === 'ADOPTION' && input.adoption_type === 'FOSTER_FAMILY';
  const adoptionOverPaternityAge =
    input.stage === 'ADOPTION' &&
    params !== undefined &&
    input.special_circumstances.adopted_or_foster_child_age_years !== null &&
    input.special_circumstances.adopted_or_foster_child_age_years >=
      params.paternityLeave.adoptionMaxChildAgeYears;

  for (const role of ['MOTHER', 'FATHER'] as const) {
    const applicant = role === input.applicant_role;
    const absentOther = !applicant && !input.co_parenting;
    const person = applicant ? input : input.other_parent;
    const courtMaternity = applicant && event !== null && params !== undefined &&
      qualifiesAfterUnlawfulTermination(input, event, params);
    const state = applicant ? (event ? denial === null : null) : absentOther ? null : otherInsured;
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
            : courtMaternity && benefit_type !== 'SICKNESS'
              ? 'ZUS'
              : person
                ? payer(person)
                : null,
      });
    };
    const insuranceReason = absentOther
      ? 'Drugi rodzic nie został uwzględniony w planie (plan samodzielnego rodzica).'
      : applicant && denial
        ? denial
        : !applicant && otherDenial
          ? otherDenial
          : state === false
            ? 'Brak ubezpieczenia chorobowego.'
            : 'Uzupełnij dane ubezpieczenia i datę zdarzenia.';
    const parentalExpired = today && outcome.parental_deadline && today > outcome.parental_deadline;
    const available = outcome.parental_pool_weeks > 0 && !parentalExpired;
    const nonTransferable = params?.parentalLeave.nonTransferableWeeksPerParent;
    const parentalReason = !available
      ? 'Brak dostępnej puli lub upłynął termin jej wykorzystania.'
      : state
        ? !input.co_parenting && nonTransferable !== undefined
          ? `Rodzic może wykorzystać maks. ${outcome.parental_applicant_limit_weeks} z ${outcome.parental_pool_weeks} tyg. (${nonTransferable} tyg. to nieprzenoszalna część drugiego rodzica).`
          : role === 'FATHER' && input.applicant_role === 'MOTHER' && denial !== null
            ? `Mimo braku ubezpieczenia chorobowego matki, ubezpieczony ojciec może skorzystać z urlopu rodzicielskiego (maks. ${outcome.parental_applicant_limit_weeks} tyg.).`
            : 'Rodzic może wykorzystać część wspólnej puli.'
        : insuranceReason;
    add('PARENTAL', available ? state : false, parentalReason, KP.parental);

    if (role === 'MOTHER' || kind === 'ADOPTION_MATERNITY') {
      const motherDeceased =
        role === 'MOTHER' && Boolean(input.special_circumstances.mother_deceased);
      add(
        kind,
        motherDeceased ? false : applicant && input.parental_only ? false : state,
        motherDeceased
          ? 'W związku ze śmiercią matki prawo do urlopu macierzyńskiego może przejąć ubezpieczony ojciec.'
          : applicant && input.parental_only
            ? 'Wniosek obejmuje wyłącznie późniejszy okres rodzicielskiego.'
            : courtMaternity
              ? 'Prawomocny wyrok potwierdzający rozwiązanie stosunku pracy z naruszeniem prawa daje podstawę do zasiłku od dnia porodu.'
              : state
                ? 'Ubezpieczenie w dniu zdarzenia daje prawo do świadczenia.'
                : insuranceReason,
        courtMaternity ? KP.unlawfulTermination : kind === 'MATERNITY' ? KP.maternity : KP.adoption,
      );
    } else {
      const takeover = rolePeriods.some((period) => period.leave_type === 'MATERNITY');
      add(
        'MATERNITY',
        takeover ? true : state === false ? false : null,
        takeover
          ? input.special_circumstances.mother_deceased
            ? 'W związku ze śmiercią matki ubezpieczony ojciec przejmuje urlop macierzyński.'
            : 'Ojciec przejmuje pozostały okres macierzyńskiego.'
          : (outcome.warnings.find((warning) => warning.code === 'FATHER_TAKEOVER_ABANDONMENT')
              ?.message_pl ??
            (absentOther
              ? insuranceReason
              : 'Przejęcie wymaga spełnienia warunków i ustalenia daty przekazania opieki.')),
        input.mother_abandonment_date ? KP.abandonment : KP.maternity,
      );
    }
    if (role === 'FATHER') {
      const expired = today && paternityEnd && today > paternityEnd;
      const canUse =
        hasLivingChildren && !expired && !fosterFamily && !adoptionOverPaternityAge ? state : false;
      add(
        'PATERNITY',
        canUse,
        fosterFamily
          ? 'Urlop ojcowski nie przysługuje w ramach rodziny zastępczej – dotyczy ojców biologicznych i adopcyjnych.'
          : adoptionOverPaternityAge
            ? 'Wiek dziecka przekracza ustawowy limit dla urlopu ojcowskiego przy adopcji.'
            : !hasLivingChildren
              ? 'Urlop ojcowski przysługuje ojcu wychowującemu dziecko.'
              : expired
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
