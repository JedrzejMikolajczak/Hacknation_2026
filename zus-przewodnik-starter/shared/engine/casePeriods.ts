import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseLeaveType,
  CasePayer,
  CasePeriod,
  PaymentVariant,
} from '../types';
import { addDays, calculateBenefitAmount, daysBetween, roundPln } from './core';
import { applicantDenial, grossBasis, KP, livingChildrenCount, payer } from './caseRules';

export function calculatePeriod(
  params: BenefitParams,
  leaveType: CaseLeaveType,
  startDate: string,
  days: number,
  role: ApplicantRole,
  whoPays: CasePayer | null,
  rawBase: number | null,
  rate: number,
  workFraction = 0,
  denial: string | null = null,
  legalBasis: string = KP.parental,
): CasePeriod {
  const base = rawBase === null ? null : roundPln(rawBase);
  const effectiveRate = rate * (1 - workFraction);
  const monthly = denial || base === null ? null : base * effectiveRate;
  const amount =
    denial || base === null
      ? null
      : calculateBenefitAmount(base, effectiveRate, days, params.calendar.dailyBenefitDivisor);
  return {
    leave_type: leaveType,
    start_date: startDate,
    end_date: addDays(startDate, days - 1),
    parent_role: role,
    who_pays: denial ? null : whoPays,
    days,
    weeks: days / params.calendar.daysPerWeek,
    rate_percent: denial ? null : rate * 100,
    work_fraction: workFraction,
    benefit_base_pln: base,
    daily_amount_pln: amount?.dailyAmount ?? null,
    monthly_amount_pln: monthly === null ? null : roundPln(monthly),
    total_amount_pln: amount?.totalAmount ?? null,
    denied: denial !== null,
    denial_reason_pl: denial,
    legal_basis: legalBasis,
  };
}

const PARENTAL_KINDS = new Set<CaseLeaveType>([
  'PARENTAL',
  'PARENTAL_ZA_ZYCIEM_EXTENSION',
  'PARENTAL_WORK_EXTENSION',
]);

/**
 * Kwota okresów drugiego rodzica przeliczona na wskazany wariant stawek (do porównania wariantów).
 * W wariancie 81,5% obniżoną stawką objęte są tylko nieprzenoszalne tygodnie rodzicielskiego,
 * reszta jego rodzicielskiego jest liczona stawką łączoną; w wariancie 100% + 70% całość po 70%.
 * Zwraca null, gdy brak okresów albo któryś nie ma ustalonej kwoty.
 */
export function secondParentTotalForVariant(
  periods: CasePeriod[],
  variant: PaymentVariant,
  params: BenefitParams,
): number | null {
  const { rates, calendar, parentalLeave } = params;
  const reducedDays = parentalLeave.nonTransferableWeeksPerParent * calendar.daysPerWeek;
  const active = periods
    .filter((period) => !period.denied)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!active.length) return null;
  const amount = (base: number, rate: number, work: number, days: number) =>
    calculateBenefitAmount(base, rate * (1 - work), days, calendar.dailyBenefitDivisor).totalAmount;
  let total = 0;
  let reducedUsed = 0;
  for (let index = 0; index < active.length; index++) {
    const period = active[index];
    if (period.total_amount_pln === null || period.benefit_base_pln === null) return null;
    if (!PARENTAL_KINDS.has(period.leave_type)) {
      total += period.total_amount_pln;
      continue;
    }
    // Sąsiadujące kawałki tego samego okresu (silnik dzieli je na granicy nieprzenoszalnych
    // tygodni) łączymy z powrotem, żeby zaokrąglać tak samo jak przy jednym okresie.
    let days = period.days;
    let end = period.end_date;
    while (index + 1 < active.length) {
      const next = active[index + 1];
      if (
        next.leave_type !== period.leave_type ||
        next.work_fraction !== period.work_fraction ||
        next.benefit_base_pln !== period.benefit_base_pln ||
        next.start_date !== addDays(end, 1)
      )
        break;
      days += next.days;
      end = next.end_date;
      index++;
    }
    const base = period.benefit_base_pln;
    if (variant !== 'COMBINED_81_5') {
      total += amount(base, rates.parental, period.work_fraction, days);
      continue;
    }
    const reduced = Math.max(0, Math.min(days, reducedDays - reducedUsed));
    reducedUsed += days;
    total +=
      amount(base, rates.secondParentNonTransferableInCombined, period.work_fraction, reduced) +
      amount(base, rates.combined, period.work_fraction, days - reduced);
  }
  return roundPln(total);
}

export function maternityWeeks(
  input: CaseInputs,
  birth: string,
  start: string,
  params: BenefitParams,
) {
  const week = params.calendar.daysPerWeek;
  const alive = livingChildrenCount(input);
  const death = input.child_death_date;
  const requiredDaysAfterDeath =
    death && death >= birth
      ? daysBetween(start, death) + 1 + params.childDeath.minDaysAfterDeath
      : 0;
  const beforeThreshold = death
    ? daysBetween(birth, death) < params.childDeath.thresholdWeeksOfLife * week
    : input.special_circumstances.stillbirth_or_child_death !== 'AFTER_8_WEEKS';
  if (alive > 0) {
    const dimensions = params.maternityLeave.weeksByChildrenCount;
    const weeks =
      dimensions[
        Math.min(alive, Object.keys(dimensions).length).toString() as keyof typeof dimensions
      ];
    return {
      alive,
      days: Math.max(
        weeks * week,
        alive < input.children_count && !beforeThreshold ? requiredDaysAfterDeath : 0,
      ),
    };
  }
  return {
    alive,
    days: Math.max(
      beforeThreshold
        ? daysBetween(start, birth) + params.childDeath.weeksAfterBirthIfBeforeThreshold * week
        : 0,
      requiredDaysAfterDeath,
    ),
  };
}

export function supplementaryDays(
  input: CaseInputs,
  birth: string,
  maternityEnd: string,
  params: BenefitParams,
  acceptedOn?: string,
) {
  const rules = params.supplementaryMaternityLeave;
  if (
    maternityEnd < rules.transitionalEffectiveDate ||
    !input.newborn_hospitalization_start ||
    !input.newborn_hospitalization_end ||
    !input.pregnancy_week_at_birth
  )
    return 0;
  const gestation = Number(input.pregnancy_week_at_birth.split('+')[0]);
  const weights = Array.isArray(input.birth_weight_grams)
    ? input.birth_weight_grams
    : input.birth_weight_grams === undefined
      ? []
      : [input.birth_weight_grams];
  const weight = weights.length ? Math.min(...weights) : null;
  const stayStart = [birth, acceptedOn ?? birth, input.newborn_hospitalization_start].sort()[2];
  const week = params.calendar.daysPerWeek;
  for (const rule of rules.cases) {
    if (
      (rule.minPregnancyWeek !== null && gestation < rule.minPregnancyWeek) ||
      (rule.maxPregnancyWeekExclusive !== null && gestation >= rule.maxPregnancyWeekExclusive) ||
      (rule.maxBirthWeightGrams !== null &&
        (weight === null || weight > rule.maxBirthWeightGrams)) ||
      (rule.minBirthWeightGramsExclusive !== null &&
        (weight === null || weight <= rule.minBirthWeightGramsExclusive))
    )
      continue;
    let countedStart = stayStart;
    if (rule.countFromDayAfterBirth !== null && rule.minHospitalizationDays !== null) {
      const windowStart = addDays(birth, rule.countFromDayAfterBirth);
      const windowEnd = addDays(birth, rules.termQualificationLastDay);
      countedStart = stayStart > windowStart ? stayStart : windowStart;
      if (
        countedStart > windowEnd ||
        daysBetween(countedStart, input.newborn_hospitalization_end) + 1 <
          rule.minHospitalizationDays
      )
        continue;
    }
    const windowEnd = addDays(birth, rule.limitWeekAfterBirth * week - 1);
    const end =
      input.newborn_hospitalization_end < windowEnd ? input.newborn_hospitalization_end : windowEnd;
    const hospitalDays = Math.max(0, daysBetween(countedStart, end) + 1);
    return Math.ceil(hospitalDays / week) * week;
  }
  return 0;
}

export function sicknessPeriods(
  input: CaseInputs,
  maternityStart: string | null,
  params: BenefitParams,
) {
  const sickness: CasePeriod[] = [];
  const employer: CasePeriod[] = [];
  const start = input.sickness_leave_start_date;
  const end =
    input.sickness_leave_end_date ?? (maternityStart ? addDays(maternityStart, -1) : null);
  if (input.applicant_role !== 'MOTHER' || !start || !end) return { sickness, employer };
  const rules = params.sickness;
  const pregnancy = input.special_circumstances.has_code_b_on_ezla === true;
  const rate = pregnancy ? params.rates.sicknessPregnancy : params.rates.sicknessStandard;
  const wait =
    input.employment_type === 'UOP'
      ? rules.waitingPeriodDaysMandatory
      : rules.waitingPeriodDaysVoluntary;
  const duration = input.title_start_date
    ? daysBetween(input.title_start_date, start) + (input.sickness_prior_credited_days ?? 0)
    : input.insurance_duration_days;
  const waitDays =
    input.sickness_waiting_period_confirmed || duration === null ? 0 : Math.max(0, wait - duration);
  const payableStart = addDays(start, waitDays);
  const base = grossBasis(input, payableStart, params) ?? input.benefit_base_amount_pln;
  const lastPayable = maternityStart && end >= maternityStart ? addDays(maternityStart, -1) : end;
  const certifiedDays = Math.max(0, daysBetween(start, lastPayable) + 1);
  const denial =
    applicantDenial(input, payableStart, params, false) ??
    (duration === null && !input.sickness_waiting_period_confirmed
      ? 'Brakuje danych o okresie wyczekiwania.'
      : null);
  function deny(from: string, days: number, message: string) {
    if (days > 0)
      sickness.push(
        calculatePeriod(
          params,
          'SICKNESS',
          from,
          days,
          'MOTHER',
          null,
          base,
          rate,
          0,
          message,
          KP.sickness,
        ),
      );
  }
  if (denial) {
    deny(start, certifiedDays, denial);
  } else {
    const unpaid = Math.min(certifiedDays, waitDays);
    deny(start, unpaid, 'Nie upłynął okres wyczekiwania.');
    // Art. 8 i art. 9 ust. 3 ustawy zasiłkowej. Wyczekiwanie nie zużywa okresu zasiłkowego.
    const maxDays = pregnancy ? rules.maxBenefitPeriodDays : rules.maxStandardBenefitPeriodDays;
    const payableDays = certifiedDays - unpaid;
    const coveredDays = Math.min(
      payableDays,
      Math.max(0, maxDays - (input.sickness_benefit_days_already_used ?? 0)),
    );

    if (coveredDays > 0) {
      const sickPayLimit = input.applicant_age_50_plus
        ? rules.employerPaidDaysFrom50
        : rules.employerPaidDaysUnder50;
      const coveredEnd = addDays(payableStart, coveredDays - 1);
      let benefitStart = payableStart;
      let used =
        payableStart.slice(0, 4) === start.slice(0, 4)
          ? (input.sick_pay_days_already_used ?? 0)
          : 0;
      const manualBenefitStart = input.sickness_benefit_start_date;

      // Jeżeli 31 grudnia przysługiwało wynagrodzenie, nowy rok odnawia limit.
      // Rozpoczęty zasiłek trwa w tym samym, nieprzerwanym okresie zwolnienia.
      while (input.employment_type === 'UOP' && benefitStart <= coveredEnd) {
        const nextYear = `${Number(benefitStart.slice(0, 4)) + 1}-01-01`;
        const available = manualBenefitStart
          ? Math.max(0, daysBetween(benefitStart, manualBenefitStart))
          : Math.max(0, sickPayLimit - used);
        const days = Math.min(
          available,
          daysBetween(benefitStart, nextYear),
          daysBetween(benefitStart, coveredEnd) + 1,
        );
        if (!days) break;
        employer.push(
          calculatePeriod(
            params,
            'SICKNESS',
            benefitStart,
            days,
            'MOTHER',
            'EMPLOYER',
            base,
            rate,
            0,
            null,
            KP.sickPay,
          ),
        );
        benefitStart = addDays(benefitStart, days);
        if (benefitStart !== nextYear) break;
        used = 0;
      }

      if (benefitStart <= coveredEnd) {
        const period = calculatePeriod(
          params,
          'SICKNESS',
          benefitStart,
          daysBetween(benefitStart, coveredEnd) + 1,
          'MOTHER',
          payer(input),
          base,
          rate,
          0,
          null,
          KP.sickness,
        );
        const changes = [...(input.sickness_base_changes ?? [])].sort((a, b) =>
          a.effective_date.localeCompare(b.effective_date),
        );
        const withinPeriod = changes.filter(
          (change) => change.effective_date > benefitStart && change.effective_date <= coveredEnd,
        );
        const initial = changes.filter((change) => change.effective_date <= benefitStart).at(-1);
        if (initial || withinPeriod.length) {
          const segments = [
            { effective_date: benefitStart, amount_pln: initial?.amount_pln ?? base },
            ...withinPeriod,
          ];
          period.amount_segments = segments.flatMap((segment, index) => {
            if (segment.amount_pln === null) return [];
            const next = segments[index + 1]?.effective_date;
            const last = next ? addDays(next, -1) : coveredEnd;
            const calculated = calculatePeriod(
              params,
              'SICKNESS',
              segment.effective_date,
              daysBetween(segment.effective_date, last) + 1,
              'MOTHER',
              period.who_pays,
              segment.amount_pln,
              rate,
              0,
              null,
              KP.sickness,
            );
            return [
              {
                start_date: calculated.start_date,
                end_date: calculated.end_date,
                benefit_base_pln: calculated.benefit_base_pln!,
                monthly_amount_pln: calculated.monthly_amount_pln!,
                daily_amount_pln: calculated.daily_amount_pln!,
              },
            ];
          });
          period.benefit_base_pln = null;
          period.monthly_amount_pln = null;
          period.daily_amount_pln = null;
          period.total_amount_pln = segments.some((segment) => segment.amount_pln === null)
            ? null
            : roundPln(
                period.amount_segments.reduce(
                  (sum, segment) =>
                    sum +
                    segment.daily_amount_pln *
                      (daysBetween(segment.start_date, segment.end_date) + 1),
                  0,
                ),
              );
        }
        sickness.push(period);
      }
    }
    deny(
      addDays(payableStart, coveredDays),
      payableDays - coveredDays,
      'Wyczerpano okres zasiłkowy.',
    );
  }
  if (maternityStart && end >= maternityStart) {
    const deniedStart = start > maternityStart ? start : maternityStart;
    if (deniedStart <= end)
      sickness.push(
        calculatePeriod(
          params,
          'SICKNESS',
          deniedStart,
          daysBetween(deniedStart, end) + 1,
          'MOTHER',
          null,
          base,
          rate,
          0,
          'Okres zwolnienia przypada od porodu lub rozpoczęcia świadczenia macierzyńskiego.',
          KP.sickness,
        ),
      );
  }
  return { sickness, employer };
}
