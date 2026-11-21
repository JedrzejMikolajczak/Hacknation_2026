import type { BenefitParams, LeavePeriod, MaternityCalculationResult, ScenarioInput } from '../types';
import { addDays, amount, calculateBenefitAmount, daysBetween, requireValue, roundPln } from './core';
import { checkEligibility } from './eligibility';

export type MaternityInput = ScenarioInput & { combinedApplicationDate?: string };

export function calculateMaternity(input: MaternityInput, params: BenefitParams): MaternityCalculationResult {
  requireValue(Number.isInteger(input.childrenCount) && input.childrenCount > 0, 'childrenCount', 'Podaj dodatnią całkowitą liczbę dzieci.');
  requireValue(input.rateVariant === 'standard' || input.rateVariant === 'combined', 'rateVariant', 'Nieprawidłowy wariant stawki.');
  requireValue(!input.special.stillbirth && !input.special.childDeathDate && !input.special.hospitalizationDays, 'special', 'Zgon dziecka lub hospitalizacja wymagają indywidualnej osi czasu.');
  const eligibility = checkEligibility(input, params);
  const start = input.birthDate ?? input.expectedBirthDate!;
  if (input.rateVariant === 'combined') {
    requireValue(input.combinedApplicationDate, 'combinedApplicationDate', 'Podaj datę złożenia wniosku o 81,5%.');
    const delay = daysBetween(start, input.combinedApplicationDate);
    requireValue(delay >= 0 && delay <= params.combinedRateApplicationDeadlineDays, 'combinedApplicationDate', 'Wniosek wykracza poza termin dla wariantu 81,5%.');
  }
  const keys = Object.keys(params.maternityLeave.weeksByChildrenCount).map(Number);
  const key = String(Math.min(input.childrenCount, Math.max(...keys))) as keyof BenefitParams['maternityLeave']['weeksByChildrenCount'];
  const maternityWeeks = params.maternityLeave.weeksByChildrenCount[key];
  const parental = params.parentalLeave;
  let pool = input.childrenCount === 1 ? parental.weeksSingleChild : parental.weeksMultipleChildren;
  if (input.special.zaZyciemCertificate) pool = input.childrenCount === 1 ? parental.weeksSingleChildZaZyciem : parental.weeksMultipleChildrenZaZyciem;
  const motherEligible = eligibility.entitlements.some(item => item.parentRole === 'mother' && item.entitled);
  const fatherEligible = eligibility.entitlements.some(item => item.parentRole === 'father' && item.entitled);
  const motherUses = motherEligible && input.mother.wantsLeave;
  const fatherUses = fatherEligible && input.father?.wantsLeave;
  requireValue(motherUses || !motherEligible, 'mother.wantsLeave', 'Rezygnacja matki wymaga indywidualnego planu przejęcia urlopu.');
  const periods: LeavePeriod[] = [];
  function append(role: 'mother' | 'father', type: LeavePeriod['leaveType'], from: string, weeks: number, rate: number) {
    const parent = role === 'mother' ? input.mother : input.father!;
    amount(parent.benefitBase, `${role}.benefitBase`);
    const days = weeks * 7;
    const money = calculateBenefitAmount(parent.benefitBase, rate, days);
    periods.push({ parentRole: role, leaveType: type, startDate: from, endDate: addDays(from, days - 1), weeks, days, rate, monthlyAmount: roundPln(parent.benefitBase * rate), totalAmount: money.totalAmount });
  }
  const combined = input.rateVariant === 'combined';
  if (motherUses) {
    append('mother', 'maternityLeave', start, maternityWeeks, combined ? params.rates.combined : params.rates.maternity);
    append('mother', 'parentalLeave', addDays(start, maternityWeeks * 7), pool - parental.nonTransferableWeeksPerParent, combined ? params.rates.combined : params.rates.parental);
  }
  if (fatherUses) {
    const fatherWeeks = motherUses ? parental.nonTransferableWeeksPerParent : pool - parental.nonTransferableWeeksPerParent;
    append('father', 'parentalLeave', addDays(start, maternityWeeks * 7), fatherWeeks, params.rates.parental);
    append('father', 'paternityLeave', start, params.paternityLeave.weeks, params.rates.paternity);
  }
  return { periods, totalAmount: roundPln(periods.reduce((sum, period) => sum + period.totalAmount, 0)), variants: null,
    warnings: eligibility.warnings,
    explanations: [{ message: 'Propozycja planu od porodu: matka wykorzystuje dostępną część rodzicielskiego, ojciec własną część równolegle. Kwoty brutto, miesiąc prezentacyjny ma 30 dni. Podwyższenie do świadczenia rodzicielskiego wymaga osobnej weryfikacji.', legalBasis: 'KP art. 180, 182¹a, 182³; ustawa zasiłkowa art. 30a–31, 36 ust. 3' }] };
}
