import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseLeaveType,
  CaseOutcome,
  CasePeriod,
  CasePlan,
  CaseWarning,
  PaymentVariant,
} from '../types';
import {
  addDays,
  addMonths,
  daysBetween,
  endOfYearChildTurnsAge,
  formatPercentPl,
  roundPln,
} from './core';
import {
  abandonmentTakeover,
  applicantDenial,
  eventDate,
  finalizeWarnings,
  grossBasis,
  grossBasisForParent,
  hasChildLoss,
  insuranceRisks,
  insured,
  KP,
  livingChildrenCount,
  parentDenial,
  payer,
  qualifiesAfterUnlawfulTermination,
} from './caseRules';
import { calculatePeriod, maternityWeeks, sicknessPeriods, supplementaryDays } from './casePeriods';
import { documentsForPlan } from './caseDocuments';
import { calculateAdditionalTitleOutcomes } from './caseInsuranceTitles';
import { caseEntitlements } from './caseEntitlements';
import { supportResources } from './caseSupport';

const PARENTAL = new Set<CaseLeaveType>([
  'PARENTAL',
  'PARENTAL_ZA_ZYCIEM_EXTENSION',
  'PARENTAL_WORK_EXTENSION',
]);
const SPLIT: PaymentVariant = 'SPLIT_100_70';
const COMBINED: PaymentVariant = 'COMBINED_81_5';

function formatDatePl(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function adoptionDenial(input: CaseInputs, params: BenefitParams): string | null {
  const age = input.special_circumstances.adopted_or_foster_child_age_years;
  const rules = params.adoptionMaternityLeave;
  if (input.special_circumstances.is_professional_foster_family)
    return 'Zawodowa rodzina zastępcza nie jest objęta tym świadczeniem.';
  if (age === null) return 'Podaj wiek przyjętego dziecka.';
  const limit =
    input.adoption_type !== 'FOSTER_FAMILY'
      ? rules.adoptionMaxChildAgeYears
      : input.school_obligation_deferred
        ? rules.fosterFamilyMaxChildAgeYearsDeferredSchool
        : rules.fosterFamilyMaxChildAgeYears;
  return age >= limit ? 'Wiek dziecka osiągnął limit dla tej formy przyjęcia.' : null;
}

function calculateSingleCase(input: CaseInputs, params: BenefitParams): CasePlan {
  const { calendar, parentalLeave, rates, paternityLeave, maternityLeave } = params;
  const week = calendar.daysPerWeek;
  const event = eventDate(input);
  const role = input.applicant_role;
  const adoption = input.stage === 'ADOPTION';
  const fosterFamily = adoption && input.adoption_type === 'FOSTER_FAMILY';
  const motherDeceased = Boolean(input.special_circumstances.mother_deceased);
  const abandonment =
    event && !adoption &&
    (input.mother_abandonment_date || input.special_circumstances.mother_abandoned_child)
      ? abandonmentTakeover(input, event, params)
      : null;
  const courtMaternity = event !== null && qualifiesAfterUnlawfulTermination(input, event, params);
  const maturityStart =
    event && !adoption && !courtMaternity ? (input.maternity_leave_start_date ?? event) : event;
  const deadline = event
    ? endOfYearChildTurnsAge(event, parentalLeave.deadlineChildTurnsAgeYears)
    : null;
  const paternityEnd = event
    ? addDays(
        addMonths(
          event,
          adoption
            ? paternityLeave.adoptionDeadlineMonthsFromAdoption
            : paternityLeave.deadlineChildAgeMonths,
        ),
        -1,
      )
    : null;
  const paternityDays = paternityLeave.weeks * week;
  let paternityStart = input.paternity_leave_start_date;
  const warnings = insuranceRisks(input, params);
  const validation_errors: CaseWarning[] = [];
  const periods: CasePeriod[] = [];
  const addError = (code: string, message_pl: string, legal_basis: string = KP.parental) =>
    validation_errors.push({ code, message_pl, legal_basis });
  const length =
    event && maturityStart ? maternityWeeks(input, event, maturityStart, params) : null;
  const living = length?.alive ?? livingChildrenCount(input);
  const childLoss = hasChildLoss(input);
  // Przy porodzie mnogim z utratą dziecka i zaświadczeniem „Za życiem” dla jednego dziecka pula odpowiada wymiarowi 1 dziecka z „Za życiem” (decyzja ZUS).
  const singleChildParentalPool =
    living === 1 ||
    (living > 1 && childLoss && input.special_circumstances.za_zyciem_certificate);
  const ordinary =
    living === 0
      ? 0
      : singleChildParentalPool
        ? parentalLeave.weeksSingleChild
        : parentalLeave.weeksMultipleChildren;
  const pool =
    living === 0
      ? 0
      : input.special_circumstances.za_zyciem_certificate
        ? singleChildParentalPool
          ? parentalLeave.weeksSingleChildZaZyciem
          : parentalLeave.weeksMultipleChildrenZaZyciem
        : ordinary;
  const additional = Math.max(0, pool - ordinary);
  const individualLimit = Math.max(0, pool - parentalLeave.nonTransferableWeeksPerParent);

  const plans = input.parental_leave_parts;
  const firstPart = [...(plans ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const rightOn = input.parental_only
    ? (firstPart?.start_date ?? input.application_date)
    : role === 'FATHER'
      ? motherDeceased
        ? (input.father_takeover_date ?? event)
        : (abandonment?.start ?? event)
      : event;
  const denial = rightOn
    ? ((adoption ? adoptionDenial(input, params) : null) ?? applicantDenial(input, rightOn, params))
    : 'Uzupełnij datę zdarzenia i dane ubezpieczenia.';

  if (abandonment?.reason && !input.mother_abandonment_date) {
    warnings.push({
      code: 'FATHER_TAKEOVER_ABANDONMENT',
      legal_basis: KP.abandonment,
      message_pl: abandonment.reason,
    });
  }
  if (courtMaternity && input.maternity_leave_start_date && input.maternity_leave_start_date < event) {
    warnings.push({
      code: 'MATERNITY_BEFORE_BIRTH_AFTER_TERMINATION',
      legal_basis: KP.unlawfulTermination,
      message_pl:
        'Wyrok daje podstawę do zasiłku od dnia porodu. W harmonogramie przyjęto tę datę jako początek macierzyńskiego.',
    });
  }

  const application = input.application_to_payer_date ?? input.application_date;
  const elapsed =
    application && event ? daysBetween(event, application) : input.days_from_birth_to_application;
  const canUseCombined =
    living > 0 &&
    (role === 'MOTHER' || adoption) &&
    !input.parental_only &&
    !motherDeceased &&
    !abandonment &&
    !denial;
  const combinedDeadline = event
    ? addDays(event, params.combinedRateApplicationDeadlineDays)
    : null;
  const missedCombinedDeadline =
    elapsed === null &&
    combinedDeadline !== null &&
    !!input.reference_date &&
    (input.stage === 'POST_BIRTH' || adoption) &&
    input.reference_date > combinedDeadline;
  const withinCombinedDeadline =
    elapsed === null
      ? !missedCombinedDeadline
      : elapsed >= 0 && elapsed <= params.combinedRateApplicationDeadlineDays;
  const eligibleCombined = canUseCombined && withinCombinedDeadline;
  const variant =
    input.requested_payment_variant === COMBINED && eligibleCombined ? COMBINED : SPLIT;
  if (input.requested_payment_variant === COMBINED) {
    if (variant === COMBINED && elapsed === null) {
      warnings.push({
        code: 'COMBINED_RATE_DEADLINE',
        legal_basis: KP.combined,
        message_pl: combinedDeadline
          ? `Złóż wniosek o ${formatPercentPl(rates.combined)} do ${formatDatePl(combinedDeadline)} (w ciągu ${params.combinedRateApplicationDeadlineDays} dni od ${adoption ? 'przyjęcia dziecka' : 'porodu'}). Założono terminowe złożenie wniosku; w przeciwnym razie będą obowiązywać stawki ${formatPercentPl(rates.maternity)} i ${formatPercentPl(rates.parental)}. Co zrobić: złóż jeden wniosek o urlop macierzyński i rodzicielski u płatnika (pracodawcy lub ZUS) przed tym terminem.`
          : `Złóż wniosek o ${formatPercentPl(rates.combined)} w ciągu ${params.combinedRateApplicationDeadlineDays} dni od ${adoption ? 'przyjęcia dziecka' : 'porodu'}. Co zrobić: złóż jeden wniosek o pełny urlop u płatnika (pracodawcy lub ZUS) w terminie.`,
      });
    } else if (variant === SPLIT && event && !denial) {
      warnings.push({
        code: 'COMBINED_RATE_DEADLINE',
        legal_basis: KP.combined,
        message_pl:
          (missedCombinedDeadline ||
            (elapsed !== null && elapsed > params.combinedRateApplicationDeadlineDays)) &&
          combinedDeadline
            ? `Termin ${params.combinedRateApplicationDeadlineDays} dni na wniosek upłynął ${formatDatePl(combinedDeadline)}. Zastosowano wariant ${formatPercentPl(rates.maternity)} i ${formatPercentPl(rates.parental)}. Co zrobić: sprawdź datę wpływu wniosku u płatnika (przy umowie o pracę liczy się data złożenia u pracodawcy, a nie przekazania do ZUS).`
            : `Dla podanych danych obowiązują stawki odrębne (${formatPercentPl(rates.maternity)} i ${formatPercentPl(rates.parental)}). Co zrobić: sprawdź termin ${params.combinedRateApplicationDeadlineDays} dni u właściwego płatnika.`,
      });
    }
  }

  const otherInsuredOn = (on: string | null): boolean | null => {
    if (!input.co_parenting) return false;
    if (!input.other_parent) return input.other_parent_insured;
    if (!on) return insured(input.other_parent);
    return parentDenial(input.other_parent, on, params) === null;
  };
  const otherInsured = otherInsuredOn(event);
  const parentFor = (parent: ApplicantRole) => (parent === role ? input : input.other_parent);
  const baseDate = input.parental_only
    ? rightOn
    : (input.sickness_leave_start_date ?? maturityStart ?? rightOn);
  const rawBase =
    input.benefit_base_amount_pln !== null
      ? roundPln(input.benefit_base_amount_pln)
      : baseDate
        ? grossBasis(input, baseDate, params)
        : null;
  const rateFor = (parent: ApplicantRole, choice: PaymentVariant = variant) =>
    choice === COMBINED
      ? parent === role
        ? rates.combined
        : rates.secondParentNonTransferableInCombined
      : rates.parental;
  const hasBlockingWarning = warnings.some(
    (item) =>
      item.code === 'NO_INSURANCE_ON_BIRTH_DATE' ||
      item.code === 'CONTRACT_ENDS_BEFORE_BIRTH' ||
      item.code === 'SELF_EMPLOYED_DEBT',
  );
  if (denial && event && !hasBlockingWarning)
    warnings.push({
      code: 'QUALIFICATION_CHECK',
      message_pl: `${denial} Co zrobić: uzupełnij brakujące dane lub sprawdź warunki ubezpieczenia na PUE/eZUS.`,
      legal_basis: KP.qualification,
    });

  function put(
    kind: CaseLeaveType,
    from: string,
    days: number,
    parent: ApplicantRole,
    rate: number,
    basis: string,
    work = 0,
  ) {
    const person = parentFor(parent);
    const parentBase =
      parent === role
        ? rawBase
        : person
          ? person.benefit_base_amount_pln !== null
            ? roundPln(person.benefit_base_amount_pln)
            : (grossBasisForParent(person, from, params) ??
              (event ? grossBasisForParent(person, event, params) : null))
          : null;
    if (days > 0)
      periods.push(
        calculatePeriod(
          params,
          kind,
          from,
          days,
          parent,
          parent === role && courtMaternity ? 'ZUS' : person ? payer(person) : null,
          parentBase,
          rate,
          work,
          null,
          basis,
        ),
      );
    return addDays(from, Math.max(0, days));
  }

  let parentalStart = event;
  let fatherStart: string | null = null;
  const maternityRate =
    variant === COMBINED ? rates.combined : adoption ? rates.adoptionMaternity : rates.maternity;
  if (event && maturityStart && length && !input.parental_only) {
    if (
      maturityStart > event ||
      daysBetween(maturityStart, event) > maternityLeave.maxWeeksBeforeBirth * week
    ) {
      addError(
        'MATERNITY_START',
        'Początek macierzyńskiego wykracza poza dopuszczalne daty.',
        KP.maternity,
      );
    } else if (motherDeceased && !adoption) {
      const start = input.father_takeover_date ?? maturityStart;
      const fatherQualifiedForTakeover =
        role === 'FATHER' ? !denial : otherInsuredOn(start) === true;
      const end = addDays(maturityStart, length.days - 1);
      parentalStart = addDays(end, 1);
      if (fatherQualifiedForTakeover) {
        put(
          'MATERNITY',
          start,
          daysBetween(start, end) + 1,
          'FATHER',
          rates.maternity,
          KP.maternity,
        );
        parentalStart = parentalStart < start ? start : parentalStart;
        if (living > 0 && input.special_circumstances.premature_or_hospitalized_newborn) {
          const supplementary = supplementaryDays(input, event, end, params);
          parentalStart = put(
            'SUPPLEMENTARY_MATERNITY',
            parentalStart,
            supplementary,
            'FATHER',
            rates.supplementaryMaternity,
            KP.supplementary,
          );
        }
      }
    } else if (abandonment && input.mother_abandonment_date) {
      const end = addDays(maturityStart, length.days - 1);
      parentalStart = addDays(end, 1);
      if (
        role === 'MOTHER' &&
        !denial &&
        input.mother_was_insured_at_abandonment !== false &&
        input.mother_abandonment_date >= event &&
        input.stage === 'POST_BIRTH'
      ) {
        const minimum =
          maternityLeave.motherMandatoryWeeksWithIncapacityCertificate * week;
        const motherDays = daysBetween(maturityStart, addDays(input.mother_abandonment_date, 1));
        const usedAfterBirth = Math.max(minimum, input.mother_maternity_days_used ?? 0);
        const requiredDays = daysBetween(maturityStart, event) + usedAfterBirth;
        const days = Math.min(length.days, Math.max(motherDays, requiredDays));
        put('MATERNITY', maturityStart, days, 'MOTHER', maternityRate, KP.abandonment);
      }
      const start = abandonment.start;
      if (
        start &&
        start <= end &&
        (role === 'FATHER' ? !denial : otherInsuredOn(start) === true)
      ) {
        put('MATERNITY', start, daysBetween(start, end) + 1, 'FATHER', rates.maternity, KP.abandonment);
        if (living > 0 && input.special_circumstances.premature_or_hospitalized_newborn) {
          const supplementary = supplementaryDays(input, event, end, params);
          parentalStart = put(
            'SUPPLEMENTARY_MATERNITY',
            parentalStart,
            supplementary,
            'FATHER',
            rates.supplementaryMaternity,
            KP.supplementary,
          );
        }
      } else {
        warnings.push({
          code: 'FATHER_TAKEOVER_ABANDONMENT',
          legal_basis: KP.abandonment,
          message_pl:
            abandonment.reason ??
            (start && start > end
              ? 'W podanej dacie nie pozostały już dni macierzyńskiego do przejęcia.'
              : 'Ojciec musi mieć potwierdzone ubezpieczenie chorobowe w dniu przejęcia.'),
        });
      }
    } else if (!denial && (role === 'MOTHER' || adoption)) {
      const days = adoption
        ? Math.max(params.adoptionMaternityLeave.minWeeks * week, length.days)
        : length.days;
      const end = addDays(maturityStart, days - 1);
      const takeover = adoption ? undefined : input.father_takeover_date;
      if (takeover) {
        const minimum = input.special_circumstances.mother_hospitalized_or_incapable
          ? maternityLeave.motherMandatoryWeeksWithIncapacityCertificate
          : maternityLeave.motherMandatoryWeeksAfterBirth;
        if (
          takeover < addDays(event, minimum * week) ||
          takeover > end ||
          otherInsuredOn(takeover) !== true
        ) {
          addError(
            'FATHER_TAKEOVER',
            'Przejęcie wymaga ubezpieczenia ojca i zachowania wymaganego okresu po porodzie.',
            KP.maternity,
          );
        } else {
          put(
            'MATERNITY',
            maturityStart,
            daysBetween(maturityStart, takeover),
            'MOTHER',
            maternityRate,
            KP.maternity,
          );
          put(
            'MATERNITY',
            takeover,
            daysBetween(takeover, end) + 1,
            'FATHER',
            rates.maternity,
            KP.maternity,
          );
        }
      }
      if (!periods.length)
        put(
          adoption ? 'ADOPTION_MATERNITY' : 'MATERNITY',
          maturityStart,
          days,
          role,
          maternityRate,
          adoption ? KP.adoption : courtMaternity ? KP.unlawfulTermination : KP.maternity,
        );
      parentalStart = addDays(end, 1);
      if (
        !adoption &&
        living > 0 &&
        input.special_circumstances.premature_or_hospitalized_newborn
      ) {
        const supplementary = supplementaryDays(input, event, end, params);
        if (end < params.supplementaryMaternityLeave.transitionalEffectiveDate)
          warnings.push({
            code: 'SUPPLEMENTARY_TRANSITION',
            message_pl:
              'Macierzyński skończył się przed wejściem w życie prawa do urlopu uzupełniającego. Co zrobić: jeśli dziecko ma zaświadczenie „Za życiem”, sprawdź prawo do wydłużonego urlopu rodzicielskiego.',
            legal_basis: KP.transitional,
          });
        else if (
          !input.newborn_hospitalization_start ||
          !input.newborn_hospitalization_end ||
          !input.pregnancy_week_at_birth
        )
          warnings.push({
            code: 'SUPPLEMENTARY_DATA',
            message_pl:
              'Brakuje danych do ustalenia wymiaru urlopu uzupełniającego. Co zrobić: podaj tydzień ciąży przy porodzie, masę urodzeniową dziecka oraz daty pobytu w szpitalu.',
            legal_basis: KP.supplementary,
          });
        parentalStart = put(
          'SUPPLEMENTARY_MATERNITY',
          parentalStart,
          supplementary,
          role,
          rates.supplementaryMaternity,
          KP.supplementary,
        );
      }
    }
  }

  const fatherTakeoverStart = motherDeceased ? input.father_takeover_date : abandonment?.start;
  if (
    role === 'FATHER' &&
    !plans &&
    !denial &&
    living > 0 &&
    fatherTakeoverStart &&
    paternityStart &&
    paternityEnd &&
    parentalStart &&
    addDays(paternityStart, paternityDays - 1) >= fatherTakeoverStart
  ) {
    // Ojcowski przypada po przejętym macierzyńskim i przed automatycznie planowanym rodzicielskim.
    paternityStart = paternityStart < parentalStart ? parentalStart : paternityStart;
    if (
      addDays(paternityStart, paternityDays - 1) <= paternityEnd &&
      !applicantDenial(input, paternityStart, params)
    )
      parentalStart = addDays(paternityStart, paternityDays);
  }

  if (parentalStart && deadline && pool > 0) {
    const existingPeriods = periods.length;
    const workValid = (work: number, parent: ApplicantRole) =>
      work >= 0 &&
      work <= parentalLeave.maxWorkTimeFraction &&
      (work === 0 || parentFor(parent)?.employment_type === 'UOP');
    const extendedDays = (days: number, work: number) => Math.floor(days / (1 - work)) - days;
    const limitDays = individualLimit * week;
    if (plans !== undefined) {
      if (plans.length > parentalLeave.maxParts)
        addError(
          'PARENTAL_PARTS',
          `Limit części rodzicielskiego wynosi ${parentalLeave.maxParts}.`,
        );
      const used: Record<ApplicantRole, number> = { MOTHER: 0, FATHER: 0 };
      const ends: Partial<Record<ApplicantRole, string>> = {};
      for (const part of [...plans].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
        const parent = part.parent_role ?? role;
        const days = daysBetween(part.start_date, part.end_date) + 1;
        const work = part.work_fraction ?? 0;
        if (!workValid(work, parent)) {
          addError(
            'PARENTAL_WORK',
            'Łączenie z pracą wymaga umowy o pracę i dopuszczalnego wymiaru etatu.',
            KP.work,
          );
          continue;
        }
        const extra = extendedDays(days, work);
        const end = addDays(part.end_date, extra);
        const earliest =
          input.parental_only || (role === 'FATHER' && !motherDeceased && !abandonment?.start)
            ? event!
            : parentalStart;
        if (
          days <= 0 ||
          part.start_date < earliest ||
          end > deadline ||
          (ends[parent] && part.start_date <= ends[parent]!)
        ) {
          addError(
            'PARENTAL_DATES',
            'Części rodzicielskiego nakładają się lub wykraczają poza dostępne daty.',
          );
          continue;
        }
        if (
          (parent === role && applicantDenial(input, part.start_date, params)) ||
          (parent !== role && otherInsuredOn(part.start_date) !== true)
        ) {
          addError(
            'PARENTAL_INSURANCE',
            'Rodzic nie ma potwierdzonego prawa do zaplanowanej części.',
          );
          continue;
        }
        used[parent] += days;
        ends[parent] = end;
        const next = put(
          'PARENTAL',
          part.start_date,
          days,
          parent,
          rateFor(parent),
          KP.parental,
          work,
        );
        put('PARENTAL_WORK_EXTENSION', next, extra, parent, rateFor(parent), KP.work, work);
      }
      if (
        used.MOTHER > limitDays ||
        used.FATHER > limitDays ||
        used.MOTHER + used.FATHER > pool * week
      )
        addError('PARENTAL_POOL', 'Plan przekracza pulę wspólną lub indywidualną.');
      fatherStart = ends.MOTHER ? addDays(ends.MOTHER, 1) : parentalStart;
    } else if (
      !input.parental_only &&
      !denial &&
      !(role === 'MOTHER' && (motherDeceased || abandonment))
    ) {
      const work = input.part_time_work_fraction;
      const fatherWeeksRequested = role === 'MOTHER' ? input.father_parental_weeks : 0;
      const fatherQualifiedInitially = fatherWeeksRequested > 0 && otherInsured === true;
      if (!workValid(work, role))
        addError(
          'PARENTAL_WORK',
          'Łączenie z pracą wymaga umowy o pracę i dopuszczalnego wymiaru etatu.',
          KP.work,
        );
      else if (fatherQualifiedInitially && fatherWeeksRequested > individualLimit)
        addError('PARENTAL_POOL', 'Wymiar rodzicielskiego ojca przekracza jego pulę.');
      else {
        const fatherWeeks = fatherQualifiedInitially ? fatherWeeksRequested : 0;
        const days = Math.min(limitDays, (pool - fatherWeeks) * week);
        const extra = extendedDays(days, work);
        const ordinaryDays = Math.max(
          0,
          (ordinary - parentalLeave.nonTransferableWeeksPerParent) * week,
        );
        const lateCertificate =
          additional &&
          input.za_zyciem_certificate_date &&
          input.za_zyciem_certificate_date >= addDays(parentalStart, ordinaryDays) &&
          !work;
        const basic = lateCertificate ? Math.min(days, ordinaryDays) : days;
        const projectedFatherStart = addDays(parentalStart, days + extra);
        const activeFatherWeeks =
          fatherWeeks > 0 && otherInsuredOn(projectedFatherStart) === true ? fatherWeeks : 0;
        const last = addDays(parentalStart, days + extra + activeFatherWeeks * week - 1);
        if (last > deadline)
          addError(
            'PARENTAL_DEADLINE',
            'Plan wykracza poza termin wykorzystania rodzicielskiego. Wybierz krótsze części.',
          );
        else {
          const next = put(
            'PARENTAL',
            parentalStart,
            basic,
            role,
            rateFor(role),
            KP.parental,
            work,
          );
          const afterCertificate = put(
            'PARENTAL_ZA_ZYCIEM_EXTENSION',
            next,
            days - basic,
            role,
            rateFor(role),
            KP.zaZyciem,
          );
          fatherStart = put(
            'PARENTAL_WORK_EXTENSION',
            afterCertificate,
            extra,
            role,
            rateFor(role),
            KP.work,
            work,
          );
          if (activeFatherWeeks)
            put(
              'PARENTAL',
              fatherStart,
              activeFatherWeeks * week,
              'FATHER',
              rateFor('FATHER'),
              KP.parental,
            );
          if (!input.co_parenting) {
            warnings.push({
              code: 'NON_TRANSFERABLE_PARENTAL_PART',
              legal_basis: KP.parental,
              message_pl: `Z łącznej puli ${pool} tyg. urlopu rodzicielskiego jeden rodzic może wykorzystać maks. ${individualLimit} tyg. Pozostałe ${parentalLeave.nonTransferableWeeksPerParent} tyg. to wyłączna, nieprzenoszalna część drugiego rodzica – nie przechodzi na pierwszego rodzica (również w planie samodzielnego rodzica). Co zrobić: zaplanuj maks. ${individualLimit} tyg. urlopu rodzicielskiego.`,
            });
          }
        }
      }
    } else if (
      !input.parental_only &&
      role === 'MOTHER' &&
      (denial !== null || motherDeceased) &&
      otherInsuredOn(parentalStart) === true
    ) {
      // Matka nieubezpieczona w dniu porodu lub zmarła – ubezpieczony ojciec ma prawo do urlopu rodzicielskiego (PDF B).
      const fatherWeeks = input.father_parental_weeks;
      if (fatherWeeks > individualLimit)
        addError('PARENTAL_POOL', 'Wymiar rodzicielskiego ojca przekracza jego pulę.');
      else if (fatherWeeks > 0) {
        const last = addDays(parentalStart, fatherWeeks * week - 1);
        if (last > deadline)
          addError(
            'PARENTAL_DEADLINE',
            'Plan wykracza poza termin wykorzystania rodzicielskiego. Wybierz krótsze części.',
          );
        else {
          fatherStart = parentalStart;
          put('PARENTAL', parentalStart, fatherWeeks * week, 'FATHER', rates.parental, KP.parental);
          if (!motherDeceased) {
            warnings.push({
              code: 'FATHER_PARENTAL_MOTHER_UNINSURED',
              legal_basis: KP.parental,
              message_pl: `Mimo braku ubezpieczenia chorobowego matki, ubezpieczonemu ojcu przysługuje urlop rodzicielski (maks. ${individualLimit} tyg., ${formatPercentPl(rates.parental)}) oraz urlop ojcowski (${paternityLeave.weeks} tyg., ${formatPercentPl(rates.paternity)}). Pozostałe ${parentalLeave.nonTransferableWeeksPerParent} tyg. jest nieprzenoszalne. Co zrobić: złóż wniosek o urlop rodzicielski i ojcowski u pracodawcy ojca lub w ZUS (ZAM).`,
            });
          }
        }
      }
    }
    if (validation_errors.length) periods.splice(existingPeriods);
  }

  const fatherInsured =
    role === 'FATHER'
      ? (motherDeceased || abandonment) && paternityStart
        ? !applicantDenial(input, paternityStart, params)
        : !denial
      : otherInsuredOn(paternityStart ?? event) === true;
  if (paternityStart) {
    const start = paternityStart;
    const end = addDays(start, paternityDays - 1);
    const overlaps =
      fatherTakeoverStart &&
      periods.some(
        (period) =>
          period.parent_role === 'FATHER' && start <= period.end_date && end >= period.start_date,
      );
    if (
      !event ||
      !paternityEnd ||
      fosterFamily ||
      paternityStart < event ||
      end > paternityEnd ||
      overlaps ||
      !fatherInsured ||
      !living ||
      (adoption &&
        (input.special_circumstances.adopted_or_foster_child_age_years ?? Infinity) >=
          paternityLeave.adoptionMaxChildAgeYears)
    ) {
      addError(
        'PATERNITY_DATES',
        fosterFamily
          ? 'Urlop ojcowski nie przysługuje w ramach rodziny zastępczej.'
          : overlaps
            ? 'Urlop ojcowski nie może pokrywać się z innym urlopem taty.'
            : 'Sprawdź ubezpieczenie ojca i termin wykorzystania ojcowskiego.',
        KP.paternity,
      );
    } else put('PATERNITY', paternityStart, paternityDays, 'FATHER', rates.paternity, KP.paternity);
  }
  const sickness = sicknessPeriods(input, input.parental_only ? null : maturityStart, params);
  periods.unshift(...sickness.sickness);
  const documents = documentsForPlan(
    { ...input, requested_payment_variant: variant },
    periods,
    event,
    params,
  );
  const subject = periods.filter((period) => period.parent_role === role && !period.denied);
  const maternity = subject.filter((period) => period.leave_type !== 'SICKNESS');
  const counted = maternity.length ? maternity : subject;
  const otherPeriods = periods.filter((period) => period.parent_role !== role && !period.denied);
  const days = counted.reduce((sum, period) => sum + period.days, 0);
  const otherDays = otherPeriods.reduce((sum, period) => sum + period.days, 0);
  const totalFor = (choice: PaymentVariant) => {
    if (!counted.length || counted.some((period) => period.total_amount_pln === null)) return null;
    return roundPln(
      counted.reduce((sum, period) => {
        if (period.leave_type === 'SICKNESS') return sum + (period.total_amount_pln ?? 0);
        const rate = PARENTAL.has(period.leave_type)
          ? rateFor(role, choice)
          : period.leave_type === 'SUPPLEMENTARY_MATERNITY'
            ? rates.supplementaryMaternity
            : period.leave_type === 'PATERNITY'
              ? rates.paternity
              : choice === COMBINED
                ? rates.combined
                : adoption
                  ? rates.adoptionMaternity
                  : rates.maternity;
        return (
          sum +
          ((rawBase ?? 0) * rate * (1 - period.work_fraction) * period.days) /
            calendar.dailyBenefitDivisor
        );
      }, 0),
    );
  };
  const formIds = new Set(
    documents.filter((document) => document.parent_role === role).map((document) => document.id),
  );
  if (
    (maturityStart && event && maturityStart < event) ||
    (input.employment_type === 'UOP' && formIds.has('HOSPITAL_CERTIFICATE')) ||
    (input.parental_only && (plans?.length ?? 0) > 1)
  )
    formIds.add('POG');
  const outcome: CaseOutcome = {
    is_qualified: Boolean(counted.length || sickness.employer.length || otherPeriods.length),
    decision_summary_pl: counted.length
      ? `Dla wnioskodawcy wyliczono ${days} dni świadczenia.`
      : otherPeriods.length
        ? `Wnioskodawca nie spełnia warunków ubezpieczenia; dla drugiego rodzica wyliczono ${otherDays} dni świadczenia.`
        : 'Sprawdź przyczynę i uzupełnij dane planu.',
    denial_or_reduction_reason_pl:
      denial ??
      periods.find((period) => period.denied)?.denial_reason_pl ??
      validation_errors[0]?.message_pl ??
      null,
    who_pays:
      sickness.employer.length &&
      subject.some((period) => period.leave_type === 'SICKNESS' && period.who_pays === 'ZUS')
        ? 'SPLIT_EMPLOYER_THEN_ZUS'
        : counted.length
          ? counted[0].who_pays
          : (sickness.employer[0]?.who_pays ?? otherPeriods[0]?.who_pays ?? null),
    granted_rate_percent: counted[0]?.rate_percent ?? otherPeriods[0]?.rate_percent ?? null,
    granted_duration_days: days,
    granted_duration_weeks: days > 0 && days % week === 0 ? days / week : null,
    calculated_amount_pln: totalFor(variant),
    mapped_forms_2026: ['ZAM', 'Z-3', 'Z-3a', 'ZAS-12', 'e-ZLA', 'POG'].filter((id) =>
      formIds.has(id),
    ),
    legal_basis_cited: [
      ...new Set([...periods, ...sickness.employer].map((period) => period.legal_basis)),
    ],
    benefit_base_pln: rawBase === null ? null : roundPln(rawBase),
    periods,
    warnings: finalizeWarnings(warnings),
    employer_sick_pay: sickness.employer,
    parental_pool_weeks: pool,
    parental_applicant_limit_weeks: individualLimit,
    parental_deadline: deadline,
    requested_payment_variant: input.requested_payment_variant,
    applied_payment_variant: variant,
    variants: {
      SPLIT_100_70: totalFor(SPLIT),
      COMBINED_81_5: eligibleCombined ? totalFor(COMBINED) : null,
    },
  };
  return {
    outcome,
    documents,
    validation_errors,
    support: supportResources(input),
    default_father_parental_start_date: fatherStart,
    entitlements: caseEntitlements(input, outcome, event, denial, paternityEnd, living > 0, params),
  };
}

export function calculateCasePlan(input: CaseInputs, params: BenefitParams): CasePlan {
  const plan = calculateSingleCase(input, params);
  const additionalTitles = calculateAdditionalTitleOutcomes(input, params, calculateSingleCase);
  return additionalTitles.length ? { ...plan, additional_title_outcomes: additionalTitles } : plan;
}
