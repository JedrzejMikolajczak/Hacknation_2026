
import { test, assert } from 'vitest';
import params from '../../params.json' ;
import type { ScenarioInput } from '../../types';
import { calculateBenefitAmount, calculateBenefitBase, calculateMaternity, calculateSicknessInPregnancy, checkEligibility, CalculationError } from '../index';
import type { BaseInput } from '../index';

function scenario(): ScenarioInput {
  const parent = { role: 'mother' as const, insuranceTitle: 'employment' as const, sicknessInsurance: 'mandatory' as const, insuredSince: '2025-01-01', insuranceEndDate: null, benefitBase: 6000, employerInsuredCount: 21, age: 30, contributionDebt: null, wantsLeave: true };
  return { situation: 'afterBirth', referenceDate: '2026-11-21', expectedBirthDate: null, birthDate: '2026-11-01', childrenCount: 1, adoptionType: null, childAcceptanceDate: null, childAgeYears: null, schoolObligationDeferred: false, rateVariant: 'standard', mother: parent, father: { ...parent, role: 'father', benefitBase: 9000 }, special: { zaZyciemCertificate: false, pregnancyWeekAtBirth: null, birthWeightGrams: null, hospitalizationDays: null, stillbirth: false, childDeathDate: null, motherHospitalized: false, motherIncapableOfIndependentLiving: false, motherDeceased: false, employerBankruptcyOrLiquidation: false } };
}

function base(): BaseInput {
  return { insuranceTitle: 'employment', rightArisesOn: '2026-11-01', insuredSince: '2026-09-01', employmentFraction: 1, incomes: ['2026-09', '2026-10'].map(month => ({ month, grossAmount: 6000, workedDays: 20, requiredWorkingDays: 20 })), contractMonthlySalary: null, declaredContributionBase: null, previousBenefitEndDate: null, previousBenefitBase: null };
}

test('podstawa pracownika 6000 brutto = 5177,40', () => assert.equal(calculateBenefitBase(base(), params).benefitBase, 5177.4));
test('minimum dla połowy etatu', () => {
  const input = base(); input.employmentFraction = .5; input.incomes.forEach(row => row.grossAmount = 2000);
  assert.equal(calculateBenefitBase(input, params).benefitBase, 2073.55);
});
test('poniżej połowy miesiąc wyłączany, połowa uzupełniana', () => {
  const input = base(); input.absencesJustified = true;
  input.incomes[0].workedDays = 9; input.incomes[0].grossAmount = 2700;
  input.incomes[1].workedDays = 10; input.incomes[1].grossAmount = 3000;
  const output = calculateBenefitBase(input, params);
  assert.equal(output.benefitBase, 5177.4); assert.deepEqual(output.monthsExcluded, ['2026-09']);
});
test('wszystkie miesiące poniżej połowy są uzupełniane', () => {
  const input = base(); input.absencesJustified = true;
  input.incomes.forEach(row => { row.workedDays = 5; row.grossAmount = 1500; });
  assert.equal(calculateBenefitBase(input, params).benefitBase, 5177.4);
});
test('pełny miesiąc kalendarzowy przerwy wymaga nowej podstawy', () => {
  const input = base(); input.previousBenefitEndDate = '2026-09-30'; input.previousBenefitBase = 7000;
  assert.equal(calculateBenefitBase(input, params).benefitBase, 5177.4);
  input.previousBenefitEndDate = '2026-10-01';
  assert.equal(calculateBenefitBase(input, params).benefitBase, 7000);
});
test('niepełny pierwszy miesiąc wykluczony z historii', () => {
  const input = base(); input.insuredSince = '2026-09-15'; input.incomes[0].grossAmount = 20000;
  assert.equal(calculateBenefitBase(input, params).benefitBase, 5177.4);
});
test('brak miesiąca i duplikat blokują obliczenie', () => {
  const input = base(); input.incomes.pop();
  assert.throws(() => calculateBenefitBase(input, params), CalculationError);
  input.incomes.push(input.incomes[0]);
  assert.throws(() => calculateBenefitBase(input, params), CalculationError);
});
test('JDG poniżej 12 miesięcy: proporcjonalna nadwyżka art. 48a', () => {
  const input = base(); input.insuranceTitle = 'selfEmployed'; input.creditedPreviousMonths = 0;
  input.minimumContributionBases = { '2026-09': 4000, '2026-10': 4000 };
  assert.equal(calculateBenefitBase(input, params).benefitBase, 3739.23);
});
test('ujemna kwota i nieistniejąca data są odrzucane', () => {
  assert.throws(() => calculateBenefitAmount(-1, .7, 10), CalculationError);
  const input = base(); input.rightArisesOn = '2026-02-30';
  assert.throws(() => calculateBenefitBase(input, params), CalculationError);
});
test('macierzyński bez wyczekiwania, nawet od pierwszego dnia', () => {
  const input = scenario(); input.mother.insuredSince = input.birthDate;
  assert.equal(checkEligibility(input, params).entitlements[0].entitled, true);
});
test('próg płatnika 20/21', () => {
  const input = scenario(); input.mother.employerInsuredCount = 20;
  assert.equal(checkEligibility(input, params).entitlements[0].payer, 'zus');
  input.mother.employerInsuredCount = 21;
  assert.equal(checkEligibility(input, params).entitlements[0].payer, 'employer');
});
test('JDG: dług równy progowi dopuszczony, grosz powyżej blokuje', () => {
  const input = scenario(); input.mother.insuranceTitle = 'selfEmployed'; input.mother.sicknessInsurance = 'voluntary'; input.mother.contributionDebt = 48.06;
  assert.equal(checkEligibility(input, params).entitlements[0].entitled, true);
  input.mother.contributionDebt = 48.07;
  assert.equal(checkEligibility(input, params).entitlements[0].entitled, false);
});
test('20 tygodni macierzyńskiego, 32+9 rodzicielskiego, 2 ojcowskiego', () => {
  const result = calculateMaternity(scenario(), params);
  assert.deepEqual(result.periods.map(p => p.weeks), [20, 32, 9, 2]);
  assert.equal(result.periods[0].totalAmount, 28000);
  assert.equal(result.periods[2].totalAmount, 13230);
});
test('81,5% i 70% drugiego rodzica oraz termin 21/22 dni', () => {
  const input = { ...scenario(), rateVariant: 'combined' as const, combinedApplicationDate: '2026-11-22' };
  assert.deepEqual(calculateMaternity(input, params).periods.map(p => p.rate), [.815, .815, .7, 1]);
  input.combinedApplicationDate = '2026-11-23';
  assert.throws(() => calculateMaternity(input, params), CalculationError);
});
test('bliźnięta z Za życiem: 31, 58+9 tygodni', () => {
  const input = scenario(); input.childrenCount = 2; input.special.zaZyciemCertificate = true;
  assert.deepEqual(calculateMaternity(input, params).periods.map(p => p.weeks), [31, 58, 9, 2]);
});
test('brak podstawy daje błąd, a zero jest prawidłową liczbą', () => {
  const input = scenario(); input.mother.benefitBase = null;
  assert.throws(() => calculateMaternity(input, params), CalculationError);
  input.mother.benefitBase = 0;
  assert.equal(calculateMaternity(input, params).periods[0].totalAmount, 0);
});
test('chorobowy obowiązkowy dopiero od 31. dnia', () => {
  const input = { ...scenario(), situation: 'pregnant' as const, sicknessStartDate: '2026-01-30', creditedInsuranceDays: 0, waitingPeriodExempt: false, sicknessDaysUsed: 0, employerSickPayDaysUsed: 0, yearTurned50: 2046 };
  input.mother.insuredSince = '2026-01-01';
  assert.equal(calculateSicknessInPregnancy(input, params).entitled, false);
  input.sicknessStartDate = '2026-01-31';
  assert.equal(calculateSicknessInPregnancy(input, params).entitled, true);
});
test('rok ukończenia 50 lat: 33 dni, następny rok: 14', () => {
  const input = { ...scenario(), situation: 'pregnant' as const, sicknessStartDate: '2026-11-01', creditedInsuranceDays: 0, waitingPeriodExempt: false, sicknessDaysUsed: 0, employerSickPayDaysUsed: 0, yearTurned50: 2026 };
  assert.equal(calculateSicknessInPregnancy(input, params).employerSickPayDays, 33);
  input.yearTurned50 = 2025;
  assert.equal(calculateSicknessInPregnancy(input, params).employerSickPayDays, 14);
});
test('odmowa zgadywania hospitalizacji i adopcji', () => {
  const input = scenario(); input.special.hospitalizationDays = 10;
  assert.throws(() => calculateMaternity(input, params), CalculationError);
  input.special.hospitalizationDays = null; input.situation = 'adoption';
  assert.throws(() => calculateMaternity(input, params), CalculationError);
});
test('parametry przekazywane przez wywołującego zmieniają wynik bez mutacji', () => {
  const custom = structuredClone(params); custom.rates.maternity = .9;
  const input = scenario(); const snapshot = structuredClone(input);
  assert.equal(calculateMaternity(input, custom).periods[0].totalAmount, 25200);
  assert.deepEqual(input, snapshot); assert.equal(params.rates.maternity, 1);
});
