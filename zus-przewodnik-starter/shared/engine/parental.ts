import type {
  BenefitParams,
  LeavePeriod,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
} from '../types';
import { addDays, amount, calculateBenefitAmount, requireValue, roundPln } from './core';

export function planParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): ParentalSplitResult {
  const { scenario, parts } = input;
  const isCombined = scenario.rateVariant === 'combined';
  const errors: ParentalSplitResult['errors'] = [];

  const isZaZyciem = scenario.special.zaZyciemCertificate;
  const totalPool = scenario.childrenCount === 1
    ? (isZaZyciem ? params.parentalLeave.weeksSingleChildZaZyciem : params.parentalLeave.weeksSingleChild)
    : (isZaZyciem ? params.parentalLeave.weeksMultipleChildrenZaZyciem : params.parentalLeave.weeksMultipleChildren);

  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const maxPerParent = totalPool - nonTransferable;

  let motherWeeksUsed = 0;
  let fatherWeeksUsed = 0;
  let totalWeeksUsed = 0;

  if (parts.length > params.parentalLeave.maxParts) {
    errors.push({
      message: `Liczba części urlopu (${parts.length}) przekracza maksymalną dopuszczalną liczbę ${params.parentalLeave.maxParts} części.`,
      legalBasis: 'KP art. 182¹c § 1',
    });
  }

  const periods: LeavePeriod[] = [];

  for (const part of parts) {
    requireValue(part.weeks > 0, 'weeks', 'Wymiar części urlopu musi być większy niż 0.');
    totalWeeksUsed += part.weeks;

    const parent = part.parentRole === 'mother' ? scenario.mother : scenario.father;
    requireValue(parent, `${part.parentRole}`, `Brak danych rodzica: ${part.parentRole}`);
    amount(parent.benefitBase, `${part.parentRole}.benefitBase`);

    let rate: number;
    if (isCombined) {
      if (part.parentRole === 'father') {
        rate = params.rates.secondParentNonTransferableInCombined;
      } else {
        rate = params.rates.combined;
      }
    } else {
      rate = params.rates.parental;
    }

    if (part.parentRole === 'mother') {
      motherWeeksUsed += part.weeks;
    } else {
      fatherWeeksUsed += part.weeks;
    }

    const days = part.weeks * 7;
    const money = calculateBenefitAmount(parent.benefitBase, rate, days);

    periods.push({
      parentRole: part.parentRole,
      leaveType: 'parentalLeave',
      startDate: part.startDate,
      endDate: addDays(part.startDate, days - 1),
      weeks: part.weeks,
      days,
      rate,
      monthlyAmount: roundPln(parent.benefitBase * rate),
      totalAmount: money.totalAmount,
    });
  }

  if (motherWeeksUsed > maxPerParent) {
    errors.push({
      message: `Matka przekroczyła maksymalny wymiar urlopu rodzicielskiego (${motherWeeksUsed} z ${maxPerParent} tyg.). 9 tygodni jest nieprzenoszalne dla ojca.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  if (fatherWeeksUsed > maxPerParent) {
    errors.push({
      message: `Ojciec przekroczył maksymalny wymiar urlopu rodzicielskiego (${fatherWeeksUsed} z ${maxPerParent} tyg.). 9 tygodni jest nieprzenoszalne dla matki.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  if (totalWeeksUsed > totalPool) {
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

  requireValue(
    workTimeFraction > 0 && workTimeFraction <= params.parentalLeave.maxWorkTimeFraction,
    'workTimeFraction',
    `Wymiar pracy podczas urlopu rodzicielskiego nie może przekraczać ${params.parentalLeave.maxWorkTimeFraction} etatu.`,
  );
  requireValue(weeks > 0, 'weeks', 'Liczba tygodni urlopu łączonego z pracą musi być większa od zera.');

  const parent = parentRole === 'mother' ? scenario.mother : scenario.father;
  requireValue(parent, 'parent', `Brak danych rodzica: ${parentRole}`);
  amount(parent.benefitBase, `${parentRole}.benefitBase`);

  // Art. 182¹f § 3 Kodeksu pracy:
  // Okres wydłużenia = tygodnie * wymiar czasu pracy
  const extendedDays = Math.round(weeks * 7 * workTimeFraction);
  const extendedWeeks = Math.floor(extendedDays / 7);

  const baseRate = scenario.rateVariant === 'combined'
    ? (parentRole === 'father' ? params.rates.secondParentNonTransferableInCombined : params.rates.combined)
    : params.rates.parental;

  // Art. 31 ust. 4 ustawy zasiłkowej: zasiłek ulega zmniejszeniu proporcjonalnie do wymiaru czasu pracy
  const workedPartRate = roundPln(baseRate * (1 - workTimeFraction));

  const periods: LeavePeriod[] = [];

  // Część 1: urlop rodzicielski połączony z pracą
  const workedDays = weeks * 7;
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

  // Część 2: okres wydłużenia urlopu (pełny zasiłek)
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
        message: `Łączenie ${weeks} tyg. urlopu z pracą na ${workTimeFraction} etatu wydłuża urlop rodzicielski o ${extendedDays} dni (${extendedWeeks} tyg.). W okresie pracy zasiłek wynosi ${roundPln(workedPartRate * 100)}% podstawy.`,
        legalBasis: 'KP art. 182¹f; ustawa zasiłkowa art. 31 ust. 4',
      },
    ],
  };
}
