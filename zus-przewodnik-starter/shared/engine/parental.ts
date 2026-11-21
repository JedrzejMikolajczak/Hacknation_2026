import type {
  BenefitParams,
  LeavePeriod,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
} from '../types';
import {
  addDays,
  amount,
  calculateBenefitAmount,
  date,
  endOfYearChildTurnsAge,
  formatPercentPl,
  requireValue,
  roundPln,
  validateParams,
} from './core';
import { getAdoptionAgeLimit } from './eligibility';
import { getParentalPoolWeeks } from './maternity';

export function planParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): ParentalSplitResult {
  const { scenario, parts } = input;
  const referenceOn =
    scenario.birthDate ??
    scenario.expectedBirthDate ??
    scenario.childAcceptanceDate ??
    scenario.referenceDate;
  validateParams(params, referenceOn);

  const isCombined = scenario.rateVariant === 'combined';
  const errors: ParentalSplitResult['errors'] = [];

  const hasChildLoss = scenario.special.stillbirth || scenario.special.childDeathDate !== null;
  const aliveChildren = hasChildLoss
    ? scenario.special.deceasedChildrenCount !== undefined &&
      scenario.special.deceasedChildrenCount !== null
      ? Math.max(0, scenario.childrenCount - scenario.special.deceasedChildrenCount)
      : scenario.special.stillbirth
        ? 0
        : Math.max(0, scenario.childrenCount - 1)
    : scenario.childrenCount;
  const childLostAll = hasChildLoss && aliveChildren === 0;

  const maxAdoptionAge = getAdoptionAgeLimit(scenario, params);
  const adoptionOverAge =
    scenario.situation === 'adoption' &&
    maxAdoptionAge !== null &&
    scenario.childAgeYears !== null &&
    scenario.childAgeYears >= maxAdoptionAge;

  const totalPool =
    childLostAll || adoptionOverAge
      ? 0
      : getParentalPoolWeeks(aliveChildren, scenario.special.zaZyciemCertificate, params);

  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const maxPerParent = Math.max(0, totalPool - nonTransferable);

  if (childLostAll && parts.length > 0) {
    errors.push({
      message: 'Po utracie jedynego dziecka urlop rodzicielski nie przysługuje.',
      legalBasis: 'KP art. 180¹, art. 182¹a',
    });
  }

  if (adoptionOverAge && parts.length > 0) {
    errors.push({
      message: `Urlop rodzicielski nie przysługuje, ponieważ dziecko ukończyło ${maxAdoptionAge}. rok życia.`,
      legalBasis: 'KP art. 183 § 4',
    });
  }

  if (parts.length > params.parentalLeave.maxParts) {
    errors.push({
      message: `Liczba części urlopu (${parts.length}) przekracza maksymalną dopuszczalną liczbę ${params.parentalLeave.maxParts} części.`,
      legalBasis: 'KP art. 182¹c § 1',
    });
  }

  // Termin końcowy wykorzystania urlopu rodzicielskiego: koniec roku kalendarzowego, w którym dziecko kończy 6 lat
  const birthDate = scenario.birthDate ?? scenario.expectedBirthDate;
  const parentalDeadline =
    scenario.situation !== 'adoption' && birthDate !== null
      ? endOfYearChildTurnsAge(birthDate, params.parentalLeave.deadlineChildTurnsAgeYears)
      : null;

  let motherWeeksUsed = 0;
  let fatherWeeksUsed = 0;
  let totalWeeksUsed = 0;
  const periods: LeavePeriod[] = [];

  for (const part of parts) {
    requireValue(
      Number.isInteger(part.weeks) && part.weeks > 0,
      'weeks',
      'Wymiar części urlopu (weeks) musi być dodatnią liczbą całkowitą.',
    );
    date(part.startDate, 'startDate');
    totalWeeksUsed += part.weeks;

    const parent = part.parentRole === 'mother' ? scenario.mother : scenario.father;
    requireValue(parent, part.parentRole, `Brak danych rodzica: ${part.parentRole}.`);
    amount(parent.benefitBase, `${part.parentRole}.benefitBase`);

    let rate: number;
    if (isCombined) {
      rate =
        part.parentRole === 'father'
          ? params.rates.secondParentNonTransferableInCombined
          : params.rates.combined;
    } else {
      rate = params.rates.parental;
    }

    if (part.parentRole === 'mother') {
      motherWeeksUsed += part.weeks;
    } else {
      fatherWeeksUsed += part.weeks;
    }

    const days = part.weeks * 7;
    const endDate = addDays(part.startDate, days - 1);

    if (parentalDeadline !== null && date(endDate) > date(parentalDeadline)) {
      errors.push({
        message: `Część urlopu (${part.startDate} – ${endDate}) wykracza poza koniec roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat (${parentalDeadline}).`,
        legalBasis: 'KP art. 182¹c § 1',
      });
    }

    const money = calculateBenefitAmount(parent.benefitBase, rate, days);

    periods.push({
      parentRole: part.parentRole,
      leaveType: 'parentalLeave',
      startDate: part.startDate,
      endDate,
      weeks: part.weeks,
      days,
      rate,
      monthlyAmount: roundPln(parent.benefitBase * rate),
      totalAmount: money.totalAmount,
    });
  }

  if (totalPool > 0 && motherWeeksUsed > maxPerParent) {
    errors.push({
      message: `Matka przekroczyła maksymalny wymiar urlopu rodzicielskiego (${motherWeeksUsed} z ${maxPerParent} tyg.). ${nonTransferable} tygodni jest nieprzenoszalne dla ojca.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  if (totalPool > 0 && fatherWeeksUsed > maxPerParent) {
    errors.push({
      message: `Ojciec przekroczył maksymalny wymiar urlopu rodzicielskiego (${fatherWeeksUsed} z ${maxPerParent} tyg.). ${nonTransferable} tygodni jest nieprzenoszalne dla matki.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  if (totalPool > 0 && totalWeeksUsed > totalPool) {
    errors.push({
      message: `Łączny wymiar urlopu (${totalWeeksUsed} tyg.) przekracza pulę całkowitą ${totalPool} tygodni.`,
      legalBasis: 'KP art. 182¹a § 1',
    });
  }

  const remainingPool = Math.max(0, totalPool - totalWeeksUsed);
  const remainingWeeks = {
    mother: Math.min(remainingPool, Math.max(0, maxPerParent - motherWeeksUsed)),
    father: Math.min(remainingPool, Math.max(0, maxPerParent - fatherWeeksUsed)),
  };

  return {
    valid: errors.length === 0,
    errors,
    periods,
    remainingWeeks,
  };
}

export function calculateParentalLeaveWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): ParentalWithWorkResult {
  const { scenario, parentRole, workTimeFraction, startDate, weeks } = input;
  validateParams(params, startDate);

  requireValue(
    Number.isFinite(workTimeFraction) &&
      workTimeFraction > 0 &&
      workTimeFraction <= params.parentalLeave.maxWorkTimeFraction,
    'workTimeFraction',
    `Wymiar pracy podczas urlopu rodzicielskiego (workTimeFraction) musi mieścić się w przedziale (0, ${params.parentalLeave.maxWorkTimeFraction}] etatu.`,
  );
  requireValue(
    Number.isInteger(weeks) && weeks > 0,
    'weeks',
    'Liczba tygodni urlopu łączonego z pracą (weeks) musi być dodatnią liczbą całkowitą.',
  );

  const parent = parentRole === 'mother' ? scenario.mother : scenario.father;
  requireValue(parent, parentRole, `Brak danych rodzica: ${parentRole}.`);
  amount(parent.benefitBase, `${parentRole}.benefitBase`);

  // Art. 182¹f § 3 i § 6 Kodeksu pracy:
  // Okres wydłużenia = wymiar łączonego urlopu × wymiar czasu pracy (niepełny dzień pomija się).
  const workedDays = weeks * 7;
  const extendedDays = Math.floor(workedDays * workTimeFraction);
  const extendedWeeks = Math.floor(extendedDays / 7);

  const baseRate =
    scenario.rateVariant === 'combined'
      ? parentRole === 'father'
        ? params.rates.secondParentNonTransferableInCombined
        : params.rates.combined
      : params.rates.parental;

  // Art. 31 ust. 4 ustawy zasiłkowej: stawka ulega proporcjonalnemu zmniejszeniu – NIE zaokrąglamy stawki!
  const workedPartRate = baseRate * (1 - workTimeFraction);

  const periods: LeavePeriod[] = [];

  // Część 1: urlop rodzicielski połączony z pracą
  const workedMoney = calculateBenefitAmount(parent.benefitBase, workedPartRate, workedDays);
  periods.push({
    parentRole,
    leaveType: 'parentalLeave',
    startDate,
    endDate: addDays(startDate, workedDays - 1),
    weeks,
    days: workedDays,
    rate: workedPartRate,
    monthlyAmount: roundPln(parent.benefitBase * workedPartRate),
    totalAmount: workedMoney.totalAmount,
  });

  // Część 2: okres wydłużenia urlopu (pełna stawka zasiłku bez łączenia z pracą)
  if (extendedDays > 0) {
    const extendedStartDate = addDays(startDate, workedDays);
    const extendedMoney = calculateBenefitAmount(parent.benefitBase, baseRate, extendedDays);
    periods.push({
      parentRole,
      leaveType: 'parentalLeave',
      startDate: extendedStartDate,
      endDate: addDays(extendedStartDate, extendedDays - 1),
      weeks: extendedWeeks,
      days: extendedDays,
      rate: baseRate,
      monthlyAmount: roundPln(parent.benefitBase * baseRate),
      totalAmount: extendedMoney.totalAmount,
    });
  }

  return {
    extendedWeeks,
    extendedDays,
    periods,
    explanations: [
      {
        message: `Łączenie ${weeks} tyg. urlopu rodzicielskiego z pracą na ${workTimeFraction} etatu wydłuża urlop o ${extendedDays} dni (${extendedWeeks} tyg.). W czasie pracy stawka zasiłku wynosi ${formatPercentPl(workedPartRate)} podstawy wymiaru, a w okresie wydłużenia (bez pracy) – ${formatPercentPl(baseRate)}.`,
        legalBasis: 'KP art. 182¹f; ustawa zasiłkowa art. 31 ust. 4',
      },
    ],
  };
}
