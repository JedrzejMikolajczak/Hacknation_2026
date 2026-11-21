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
import { addDays, addMonths, daysBetween, endOfYearChildTurnsAge, roundPln } from './core';
import {
  applicantDenial,
  eventDate,
  grossBasis,
  insuranceRisks,
  insured,
  KP,
  payer,
} from './caseRules';
import { calculatePeriod, maternityWeeks, sicknessPeriods, supplementaryDays } from './casePeriods';
import { documentsForPlan } from './caseDocuments';
import { caseEntitlements } from './caseEntitlements';
import { supportResources } from './caseSupport';

const PARENTAL = new Set<CaseLeaveType>([
  'PARENTAL',
  'PARENTAL_ZA_ZYCIEM_EXTENSION',
  'PARENTAL_WORK_EXTENSION',
]);
const SPLIT: PaymentVariant = 'SPLIT_100_70';
const COMBINED: PaymentVariant = 'COMBINED_81_5';

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

export function calculateCasePlan(input: CaseInputs, params: BenefitParams): CasePlan {
  const { calendar, parentalLeave, rates, paternityLeave, maternityLeave } = params;
  const week = calendar.daysPerWeek;
  const event = eventDate(input);
  const role = input.applicant_role;
  const adoption = input.stage === 'ADOPTION';
  const maturityStart = event
    ? adoption
      ? event
      : (input.maternity_leave_start_date ?? event)
    : null;
  const deadline = event
    ? endOfYearChildTurnsAge(event, parentalLeave.deadlineChildTurnsAgeYears)
    : null;
  const warnings = insuranceRisks(input, params);
  const validation_errors: CaseWarning[] = [];
  const periods: CasePeriod[] = [];
  const addError = (code: string, message_pl: string, legal_basis: string = KP.parental) =>
    validation_errors.push({ code, message_pl, legal_basis });
  const length =
    event && maturityStart ? maternityWeeks(input, event, maturityStart, params) : null;
  const living = length?.alive ?? input.living_children_count ?? input.children_count;
  const ordinary =
    living === 0
      ? 0
      : living === 1
        ? parentalLeave.weeksSingleChild
        : parentalLeave.weeksMultipleChildren;
  const additional =
    ordinary && input.special_circumstances.za_zyciem_certificate
      ? parentalLeave.zaZyciemExtensionWeeks
      : 0;
  const pool = ordinary + additional;
  const individualLimit = Math.max(0, pool - parentalLeave.nonTransferableWeeksPerParent);
  const application = input.application_to_payer_date ?? input.application_date;
  const elapsed =
    application && event ? daysBetween(event, application) : input.days_from_birth_to_application;
  const eligibleCombined =
    living > 0 &&
    elapsed !== null &&
    elapsed >= 0 &&
    elapsed <= params.combinedRateApplicationDeadlineDays &&
    (role === 'MOTHER' || adoption) &&
    !input.parental_only;
  const variant =
    input.requested_payment_variant === COMBINED && eligibleCombined ? COMBINED : SPLIT;
  if (input.requested_payment_variant === COMBINED && variant === SPLIT && event)
    warnings.push({
      code: 'COMBINED_RATE_DEADLINE',
      legal_basis: KP.combined,
      message_pl:
        elapsed === null
          ? 'Podaj datę złożenia wniosku u płatnika, aby sprawdzić stawkę 81,5%.'
          : 'Dla podanych danych obowiązują stawki odrębne. Sprawdź termin wniosku u właściwego płatnika.',
    });
  const plans = input.parental_leave_parts;
  const firstPart = [...(plans ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const rightOn = input.parental_only ? (firstPart?.start_date ?? input.application_date) : event;
  const denial = rightOn
    ? ((adoption ? adoptionDenial(input, params) : null) ?? applicantDenial(input, rightOn, params))
    : 'Uzupełnij datę zdarzenia i dane ubezpieczenia.';
  const otherInsured = input.co_parenting
    ? input.other_parent
      ? insured(input.other_parent)
      : input.other_parent_insured
    : false;
  const parentFor = (parent: ApplicantRole) => (parent === role ? input : input.other_parent);
  const baseDate = input.parental_only
    ? rightOn
    : (input.sickness_leave_start_date ?? maturityStart ?? rightOn);
  const rawBase =
    input.benefit_base_amount_pln ?? (baseDate ? grossBasis(input, baseDate, params) : null);
  const rateFor = (parent: ApplicantRole, choice: PaymentVariant = variant) =>
    choice === COMBINED
      ? parent === role
        ? rates.combined
        : rates.secondParentNonTransferableInCombined
      : rates.parental;
  if (denial && event)
    warnings.push({
      code: denial.includes('Zadłużenie') ? 'SELF_EMPLOYED_DEBT' : 'QUALIFICATION_CHECK',
      message_pl: denial,
      legal_basis: denial.includes('Zadłużenie') ? KP.debt : KP.qualification,
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
    if (days > 0)
      periods.push(
        calculatePeriod(
          params,
          kind,
          from,
          days,
          parent,
          person ? payer(person) : null,
          parent === role ? rawBase : (person?.benefit_base_amount_pln ?? null),
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
        if (takeover < addDays(event, minimum * week) || takeover > end || otherInsured !== true) {
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
          adoption ? KP.adoption : KP.maternity,
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
              'Macierzyński skończył się przed wejściem w życie prawa do urlopu uzupełniającego.',
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
              'Do ustalenia wymiaru uzupełniającego podaj tydzień porodu, masę urodzeniową i daty hospitalizacji.',
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
        const earliest = input.parental_only || role === 'FATHER' ? event! : parentalStart;
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
          (parent !== role && otherInsured !== true)
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
    } else if (!denial && !input.parental_only) {
      const work = input.part_time_work_fraction;
      const fatherWeeks =
        role === 'MOTHER' && otherInsured === true ? input.father_parental_weeks : 0;
      if (!workValid(work, role))
        addError(
          'PARENTAL_WORK',
          'Łączenie z pracą wymaga umowy o pracę i dopuszczalnego wymiaru etatu.',
          KP.work,
        );
      else if (fatherWeeks > individualLimit)
        addError('PARENTAL_POOL', 'Wymiar rodzicielskiego ojca przekracza jego pulę.');
      else {
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
        const last = addDays(parentalStart, days + extra + fatherWeeks * week - 1);
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
          if (fatherWeeks)
            put(
              'PARENTAL',
              fatherStart,
              fatherWeeks * week,
              'FATHER',
              rateFor('FATHER'),
              KP.parental,
            );
        }
      }
    }
    if (validation_errors.length) periods.splice(existingPeriods);
  }

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
  const paternityStart = input.paternity_leave_start_date;
  const fatherInsured = role === 'FATHER' ? !denial : otherInsured === true;
  if (paternityStart) {
    if (
      !event ||
      !paternityEnd ||
      paternityStart < event ||
      addDays(paternityStart, paternityLeave.weeks * week - 1) > paternityEnd ||
      !fatherInsured ||
      !living ||
      (adoption &&
        (input.special_circumstances.adopted_or_foster_child_age_years ?? Infinity) >=
          paternityLeave.adoptionMaxChildAgeYears)
    ) {
      addError(
        'PATERNITY_DATES',
        'Sprawdź ubezpieczenie ojca i termin wykorzystania ojcowskiego.',
        KP.paternity,
      );
    } else
      put(
        'PATERNITY',
        paternityStart,
        paternityLeave.weeks * week,
        'FATHER',
        rates.paternity,
        KP.paternity,
      );
  }
  const sickness = sicknessPeriods(input, input.parental_only ? null : maturityStart, params);
  periods.unshift(...sickness.sickness);
  const documents = documentsForPlan(input, periods, event, params);
  const subject = periods.filter((period) => period.parent_role === role && !period.denied);
  const maternity = subject.filter((period) => period.leave_type !== 'SICKNESS');
  const counted = maternity.length ? maternity : subject;
  const days = counted.reduce((sum, period) => sum + period.days, 0);
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
    (input.maternity_leave_start_date && event && input.maternity_leave_start_date < event) ||
    (input.employment_type === 'UOP' && formIds.has('HOSPITAL_CERTIFICATE')) ||
    (input.parental_only && (plans?.length ?? 0) > 1)
  )
    formIds.add('POG');
  const outcome: CaseOutcome = {
    is_qualified: Boolean(counted.length || sickness.employer.length),
    decision_summary_pl: counted.length
      ? `Dla wnioskodawcy wyliczono ${days} dni świadczenia.`
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
          : (sickness.employer[0]?.who_pays ?? null),
    granted_rate_percent: counted[0]?.rate_percent ?? null,
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
    warnings,
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
    entitlements: caseEntitlements(input, outcome, event, denial, paternityEnd, living > 0),
  };
}
