import type { BenefitParams, LeavePeriod, MaternityCalculationResult, ScenarioInput } from '../types';
import { addDays, amount, calculateBenefitAmount, daysBetween, requireValue, roundPln } from './core';
import { checkEligibility } from './eligibility';

export type MaternityInput = ScenarioInput & { combinedApplicationDate?: string };

export function calculateMaternity(input: MaternityInput, params: BenefitParams): MaternityCalculationResult {
  requireValue(Number.isInteger(input.childrenCount) && input.childrenCount > 0, 'childrenCount', 'Podaj dodatnią całkowitą liczbę dzieci.');
  requireValue(input.rateVariant === 'standard' || input.rateVariant === 'combined', 'rateVariant', 'Nieprawidłowy wariant stawki.');

  const isAdoption = input.situation === 'adoption';
  if (isAdoption) {
    requireValue(input.childAcceptanceDate, 'childAcceptanceDate', 'Podaj datę przyjęcia dziecka na wychowanie.');
    requireValue(input.adoptionType, 'adoptionType', 'Podaj formę przyjęcia dziecka.');
  }

  if (input.special.hospitalizationDays) {
    requireValue(
      Number.isInteger(input.special.pregnancyWeekAtBirth),
      'pregnancyWeekAtBirth',
      'Podaj tydzień ciąży w chwili porodu, aby obliczyć hospitalizację noworodka.',
    );
  }

  const eligibility = checkEligibility(input, params);
  const start = isAdoption ? input.childAcceptanceDate! : (input.birthDate ?? input.expectedBirthDate!);

  if (input.rateVariant === 'combined') {
    requireValue(input.combinedApplicationDate, 'combinedApplicationDate', 'Podaj datę złożenia wniosku o 81,5%.');
    const delay = daysBetween(start, input.combinedApplicationDate);
    requireValue(delay >= 0 && delay <= params.combinedRateApplicationDeadlineDays, 'combinedApplicationDate', 'Wniosek wykracza poza termin dla wariantu 81,5%.');
  }

  const keys = Object.keys(params.maternityLeave.weeksByChildrenCount).map(Number);
  const key = String(Math.min(input.childrenCount, Math.max(...keys))) as keyof BenefitParams['maternityLeave']['weeksByChildrenCount'];
  let maternityWeeks = params.maternityLeave.weeksByChildrenCount[key];

  if (isAdoption) {
    maternityWeeks = Math.max(maternityWeeks, params.adoptionMaternityLeave.minWeeks);
  }

  if (input.special.stillbirth) {
    maternityWeeks = params.childDeath.weeksAfterBirthIfBeforeThreshold;
  }

  const parental = params.parentalLeave;
  let pool = 0;
  if (!input.special.stillbirth && !input.special.childDeathDate) {
    pool = input.childrenCount === 1 ? parental.weeksSingleChild : parental.weeksMultipleChildren;
    if (input.special.zaZyciemCertificate) {
      pool = input.childrenCount === 1 ? parental.weeksSingleChildZaZyciem : parental.weeksMultipleChildrenZaZyciem;
    }
  }

  // Uzupełniający urlop macierzyński (wcześniaki i hospitalizowane noworodki)
  let supplementaryWeeks = 0;
  if (input.special.hospitalizationDays && input.special.pregnancyWeekAtBirth) {
    const hospDays = input.special.hospitalizationDays;
    const week = input.special.pregnancyWeekAtBirth;
    const weight = input.special.birthWeightGrams;

    if (week < 28 || (weight !== null && weight <= 1000)) {
      supplementaryWeeks = Math.min(15, Math.ceil(hospDays / 7));
    } else if (week >= 28 && week < 37) {
      supplementaryWeeks = Math.min(8, Math.ceil(hospDays / 7));
    } else if (week >= 37 && hospDays >= 2) {
      supplementaryWeeks = Math.min(8, Math.ceil(hospDays / 7));
    }
  }

  const motherEligible = eligibility.entitlements.some(item => item.parentRole === 'mother' && item.entitled);
  const fatherEligible = eligibility.entitlements.some(item => item.parentRole === 'father' && item.entitled);
  const motherUses = motherEligible && input.mother.wantsLeave;
  const fatherUses = fatherEligible && Boolean(input.father?.wantsLeave);

  requireValue(motherUses || !motherEligible, 'mother.wantsLeave', 'Rezygnacja matki wymaga indywidualnego planu przejęcia urlopu.');

  const periods: LeavePeriod[] = [];
  function append(role: 'mother' | 'father', type: LeavePeriod['leaveType'], from: string, weeks: number, rate: number) {
    const parent = role === 'mother' ? input.mother : input.father!;
    amount(parent.benefitBase, `${role}.benefitBase`);
    const days = weeks * 7;
    const money = calculateBenefitAmount(parent.benefitBase, rate, days);
    periods.push({
      parentRole: role,
      leaveType: type,
      startDate: from,
      endDate: addDays(from, days - 1),
      weeks,
      days,
      rate,
      monthlyAmount: roundPln(parent.benefitBase * rate),
      totalAmount: money.totalAmount,
    });
  }

  const combined = input.rateVariant === 'combined';
  let currentDate = start;

  if (motherUses) {
    const primaryLeaveType: LeavePeriod['leaveType'] = isAdoption ? 'adoptionMaternityLeave' : 'maternityLeave';
    append('mother', primaryLeaveType, currentDate, maternityWeeks, combined ? params.rates.combined : params.rates.maternity);
    currentDate = addDays(currentDate, maternityWeeks * 7);

    if (supplementaryWeeks > 0) {
      append('mother', 'supplementaryMaternityLeave', currentDate, supplementaryWeeks, params.rates.supplementaryMaternity);
      currentDate = addDays(currentDate, supplementaryWeeks * 7);
    }

    if (pool > 0) {
      const motherParentalWeeks = pool - parental.nonTransferableWeeksPerParent;
      append('mother', 'parentalLeave', currentDate, motherParentalWeeks, combined ? params.rates.combined : params.rates.parental);
    }
  }

  if (fatherUses) {
    if (pool > 0) {
      const fatherWeeks = motherUses ? parental.nonTransferableWeeksPerParent : pool - parental.nonTransferableWeeksPerParent;
      const fatherParentalStart = addDays(start, (maternityWeeks + supplementaryWeeks) * 7);
      append('father', 'parentalLeave', fatherParentalStart, fatherWeeks, params.rates.parental);
    }
    append('father', 'paternityLeave', start, params.paternityLeave.weeks, params.rates.paternity);
  }

  // Wyliczenie porównania wariantów standard vs combined
  let variants: MaternityCalculationResult['variants'] = null;
  if (input.mother.benefitBase !== null && input.mother.benefitBase !== undefined && pool > 0) {
    const motherBase = input.mother.benefitBase;
    const fatherBase = input.father?.benefitBase ?? 0;
    const motherParental = pool - parental.nonTransferableWeeksPerParent;
    const fatherParental = fatherUses ? parental.nonTransferableWeeksPerParent : 0;

    const stdTotal = roundPln(
      (motherUses ? calculateBenefitAmount(motherBase, params.rates.maternity, maternityWeeks * 7).totalAmount : 0) +
      (motherUses ? calculateBenefitAmount(motherBase, params.rates.parental, motherParental * 7).totalAmount : 0) +
      (fatherUses ? calculateBenefitAmount(fatherBase, params.rates.parental, fatherParental * 7).totalAmount : 0) +
      (fatherUses ? calculateBenefitAmount(fatherBase, params.rates.paternity, params.paternityLeave.weeks * 7).totalAmount : 0),
    );

    const combTotal = roundPln(
      (motherUses ? calculateBenefitAmount(motherBase, params.rates.combined, maternityWeeks * 7).totalAmount : 0) +
      (motherUses ? calculateBenefitAmount(motherBase, params.rates.combined, motherParental * 7).totalAmount : 0) +
      (fatherUses ? calculateBenefitAmount(fatherBase, params.rates.secondParentNonTransferableInCombined, fatherParental * 7).totalAmount : 0) +
      (fatherUses ? calculateBenefitAmount(fatherBase, params.rates.paternity, params.paternityLeave.weeks * 7).totalAmount : 0),
    );

    variants = { standard: stdTotal, combined: combTotal };
  }

  return {
    periods,
    totalAmount: roundPln(periods.reduce((sum, period) => sum + period.totalAmount, 0)),
    variants,
    warnings: eligibility.warnings,
    explanations: [
      {
        message: 'Plan zasiłków od dnia zdarzenia. Kwoty brutto (dzielnik dzienny 30). Wariant 81,5% obejmuje pełny okres macierzyńskiego i rodzicielskiego matki, a 9 tygodni drugiego rodzica wynosi 70%.',
        legalBasis: 'KP art. 180, 182¹a, 182¹c, 182³; ustawa zasiłkowa art. 30a–31, 36 ust. 3',
      },
    ],
  };
}
