import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseLeaveType,
  CasePayer,
  CasePeriod,
} from '../types';
import { addDays, daysBetween, roundPln } from './core';
import { applicantDenial, grossBasis, KP, payer } from './caseRules';

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
  const monthly = denial || base === null ? null : base * rate * (1 - workFraction);
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
    daily_amount_pln:
      monthly === null ? null : roundPln(monthly / params.calendar.dailyBenefitDivisor),
    monthly_amount_pln: monthly === null ? null : roundPln(monthly),
    total_amount_pln:
      monthly === null ? null : roundPln((monthly * days) / params.calendar.dailyBenefitDivisor),
    denied: denial !== null,
    denial_reason_pl: denial,
    legal_basis: legalBasis,
  };
}

export function maternityWeeks(
  input: CaseInputs,
  birth: string,
  start: string,
  params: BenefitParams,
) {
  const week = params.calendar.daysPerWeek;
  const alive =
    input.living_children_count ??
    (input.deceased_children_count !== undefined
      ? Math.max(0, input.children_count - input.deceased_children_count)
      : input.special_circumstances.stillbirth_or_child_death === 'NONE'
        ? input.children_count
        : Math.max(0, input.children_count - 1));
  const dimensions = params.maternityLeave.weeksByChildrenCount;
  if (alive > 0)
    return {
      alive,
      days:
        dimensions[
          Math.min(alive, Object.keys(dimensions).length).toString() as keyof typeof dimensions
        ] * week,
    };
  const death = input.child_death_date ?? birth;
  const before = input.special_circumstances.stillbirth_or_child_death === 'BEFORE_8_WEEKS';
  return {
    alive,
    days: Math.max(
      before
        ? daysBetween(start, birth) + params.childDeath.weeksAfterBirthIfBeforeThreshold * week
        : 0,
      daysBetween(start, death) + params.childDeath.minDaysAfterDeath,
    ),
  };
}

export function supplementaryDays(
  input: CaseInputs,
  birth: string,
  maternityEnd: string,
  params: BenefitParams,
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
  const stayStart =
    input.newborn_hospitalization_start < birth ? birth : input.newborn_hospitalization_start;
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
    if (rule.countFromDayAfterBirth !== null && rule.minHospitalizationDays !== null) {
      const windowStart = addDays(birth, rule.countFromDayAfterBirth - 1);
      const windowEnd = addDays(birth, rules.termQualificationLastDay - 1);
      const qualifyingStart = stayStart > windowStart ? stayStart : windowStart;
      const qualifyingEnd =
        input.newborn_hospitalization_end < windowEnd
          ? input.newborn_hospitalization_end
          : windowEnd;
      if (daysBetween(qualifyingStart, qualifyingEnd) + 1 < rule.minHospitalizationDays) continue;
    }
    const windowEnd = addDays(birth, rule.limitWeekAfterBirth * week - 1);
    const end =
      input.newborn_hospitalization_end < windowEnd ? input.newborn_hospitalization_end : windowEnd;
    const hospitalDays = Math.max(0, daysBetween(stayStart, end) + 1);
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
  const base = grossBasis(input, start, params) ?? input.benefit_base_amount_pln;
  const rate = input.special_circumstances.has_code_b_on_ezla
    ? params.rates.sicknessPregnancy
    : params.rates.sicknessStandard;
  const whoPays = payer(input);
  const wait =
    input.employment_type === 'UOP'
      ? rules.waitingPeriodDaysMandatory
      : rules.waitingPeriodDaysVoluntary;
  const duration = input.title_start_date
    ? daysBetween(input.title_start_date, start)
    : input.insurance_duration_days;
  const denial =
    applicantDenial(input, start, params) ??
    (input.sickness_waiting_period_confirmed
      ? null
      : duration === null
        ? 'Brakuje danych o okresie wyczekiwania.'
        : duration < wait
          ? 'Nie upłynął okres wyczekiwania.'
          : null);
  const lastPayable = maternityStart && end >= maternityStart ? addDays(maternityStart, -1) : end;
  const certifiedDays = daysBetween(start, lastPayable) + 1;
  const coveredDays = Math.min(
    certifiedDays,
    rules.maxBenefitPeriodDays - (input.sickness_benefit_days_already_used ?? 0),
  );
  if (denial && certifiedDays > 0) {
    sickness.push(
      calculatePeriod(
        params,
        'SICKNESS',
        start,
        certifiedDays,
        'MOTHER',
        null,
        base,
        rate,
        0,
        denial,
        KP.sickness,
      ),
    );
  }
  if (!denial && coveredDays > 0) {
    const sickPayLimit = input.applicant_age_50_plus
      ? rules.employerPaidDaysFrom50
      : rules.employerPaidDaysUnder50;
    const sickPayDays =
      input.employment_type !== 'UOP'
        ? 0
        : Math.min(
            coveredDays,
            input.sickness_benefit_start_date
              ? Math.max(0, daysBetween(start, input.sickness_benefit_start_date))
              : Math.max(0, sickPayLimit - (input.sick_pay_days_already_used ?? 0)),
          );
    if (sickPayDays > 0)
      employer.push(
        calculatePeriod(
          params,
          'SICKNESS',
          start,
          sickPayDays,
          'MOTHER',
          'EMPLOYER',
          base,
          rate,
          0,
          null,
          KP.sickPay,
        ),
      );
    if (coveredDays > sickPayDays) {
      const benefitStart = addDays(start, sickPayDays);
      const period = calculatePeriod(
        params,
        'SICKNESS',
        benefitStart,
        coveredDays - sickPayDays,
        'MOTHER',
        whoPays,
        base,
        rate,
        0,
        null,
        KP.sickness,
      );
      const changes = [...(input.sickness_base_changes ?? [])].sort((a, b) =>
        a.effective_date.localeCompare(b.effective_date),
      );
      if (changes.length) {
        const inPeriod = changes.filter(
          (change) =>
            change.effective_date > benefitStart && change.effective_date <= period.end_date,
        );
        const initial =
          changes.filter((change) => change.effective_date <= benefitStart).at(-1)?.amount_pln ??
          base;
        const segments = [{ effective_date: benefitStart, amount_pln: initial }, ...inPeriod];
        period.amount_segments = segments.flatMap((segment, index) => {
          if (segment.amount_pln === null) return [];
          const next = segments[index + 1]?.effective_date;
          const last = next ? addDays(next, -1) : period.end_date;
          const monthly = segment.amount_pln * rate;
          return [
            {
              start_date: segment.effective_date,
              end_date: last,
              benefit_base_pln: roundPln(segment.amount_pln),
              monthly_amount_pln: roundPln(monthly),
              daily_amount_pln: roundPln(monthly / params.calendar.dailyBenefitDivisor),
            },
          ];
        });
        period.benefit_base_pln = null;
        period.monthly_amount_pln = null;
        period.daily_amount_pln = null;
        period.total_amount_pln = segments.some((segment) => segment.amount_pln === null)
          ? null
          : roundPln(
              segments.reduce((sum, segment, index) => {
                const next = segments[index + 1]?.effective_date ?? addDays(period.end_date, 1);
                return (
                  sum +
                  ((segment.amount_pln ?? 0) * rate * daysBetween(segment.effective_date, next)) /
                    params.calendar.dailyBenefitDivisor
                );
              }, 0),
            );
      }
      sickness.push(period);
    }
  }
  if (!denial && certifiedDays > Math.max(coveredDays, 0)) {
    const offset = Math.max(coveredDays, 0);
    sickness.push(
      calculatePeriod(
        params,
        'SICKNESS',
        addDays(start, offset),
        certifiedDays - offset,
        'MOTHER',
        null,
        base,
        rate,
        0,
        'Wyczerpano okres zasiłkowy.',
        KP.sickness,
      ),
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
