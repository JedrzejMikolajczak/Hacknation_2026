import type { BenefitBaseInput, BenefitBaseResult, BenefitParams } from '../types';
import { amount, date, requireValue, roundPln, validateParams } from './core';

export type BaseInput = BenefitBaseInput & {
  employmentFraction?: number;
  // Początek aktualnego zatrudnienia/ubezpieczenia. Historia musi zawierać wszystkie pełne miesiące.
  insuredSince?: string;
  absencesJustified?: boolean;
  employmentFractionChanged?: boolean;
  minimumContributionBases?: Record<string, number>;
  creditedPreviousMonths?: number;
};

function monthIndex(month: string): number {
  date(month + '-01');
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export function calculateBenefitBase(input: BaseInput, params: BenefitParams): BenefitBaseResult {
  validateParams(params, input.rightArisesOn);
  requireValue(input.insuranceTitle !== 'none', 'insuranceTitle', 'Brak tytułu do obliczenia podstawy.');
  const employee = input.insuranceTitle === 'employment';
  requireValue(!input.employmentFractionChanged, 'employmentFractionChanged', 'Zmiana etatu wymaga historii wynagrodzenia po zmianie (art. 40).');
  const fraction = input.employmentFraction;
  if (employee) requireValue(fraction !== undefined && fraction > 0 && fraction <= 1, 'employmentFraction', 'Podaj wymiar etatu do ustalenia minimalnej podstawy.');
  const deduction = 1 - params.benefitBase.socialContributionDeduction;
  const minimum = employee ? params.benefitBase.minimumWage * fraction! * deduction : 0;
  function result(base: number, used: string[], excluded: string[], basis: string): BenefitBaseResult {
    return {
      benefitBase: roundPln(Math.max(base, minimum)), monthsUsed: used, monthsExcluded: excluded,
      appliedMinimum: base < minimum, appliedMaximum: false,
      explanations: [{ message: 'Podstawa po uwzględnieniu składek i minimalnej podstawy właściwej dla etatu.', legalBasis: basis }],
    };
  }
  const currentMonth = monthIndex(input.rightArisesOn.slice(0, 7));
  if (input.previousBenefitEndDate !== null) {
    requireValue(date(input.previousBenefitEndDate) < date(input.rightArisesOn), 'previousBenefitEndDate', 'Poprzedni okres musi zakończyć się przed bieżącym.');
    // Pełny miesiąc kalendarzowy pomiędzy świadczeniami, nie stałe 30 dni.
    const previousMonth = monthIndex(input.previousBenefitEndDate.slice(0, 7));
    if (currentMonth - previousMonth <= params.benefitBase.newBaseAfterGapMonths) {
      amount(input.previousBenefitBase, 'previousBenefitBase');
      return result(input.previousBenefitBase, [], [], 'Ustawa zasiłkowa art. 43, 45');
    }
  }
  requireValue(input.insuredSince, 'insuredSince', 'Podaj początek aktualnego ubezpieczenia.');
  requireValue(date(input.insuredSince) <= date(input.rightArisesOn), 'insuredSince', 'Ubezpieczenie zaczyna się po powstaniu prawa.');
  const firstFull = monthIndex(input.insuredSince.slice(0, 7)) + (input.insuredSince.endsWith('-01') ? 0 : 1);
  const firstMonth = Math.max(firstFull, currentMonth - params.benefitBase.lookbackMonths);
  const seen = new Set<string>();
  for (const row of input.incomes) {
    monthIndex(row.month);
    amount(row.grossAmount, 'grossAmount');
    requireValue(!seen.has(row.month), 'incomes', 'Powtórzony miesiąc wynagrodzenia.');
    seen.add(row.month);
  }
  const rows = input.incomes.filter(row => monthIndex(row.month) >= firstMonth && monthIndex(row.month) < currentMonth);
  requireValue(rows.length === Math.max(0, currentMonth - firstMonth), 'incomes', 'Uzupełnij wszystkie pełne miesiące ubezpieczenia.');
  if (rows.length === 0) {
    requireValue(employee, 'incomes', 'Pierwszy miesiąc zlecenia/JDG wymaga danych z art. 49.');
    amount(input.contractMonthlySalary, 'contractMonthlySalary');
    return result(input.contractMonthlySalary * deduction, [], [], 'Ustawa zasiłkowa art. 37, 45');
  }
  for (const row of rows) {
    requireValue(!row.components?.length, 'components', 'Składniki okresowe wymagają przypisania do okresów z art. 41–42. Podaj zweryfikowane wynagrodzenie miesięczne.');
    if (row.workedDays !== null || row.requiredWorkingDays !== null) {
      requireValue(Number.isInteger(row.workedDays) && Number.isInteger(row.requiredWorkingDays) && row.workedDays! >= 0 && row.requiredWorkingDays! > 0 && row.workedDays! <= row.requiredWorkingDays!, 'workedDays', 'Nieprawidłowe dni pracy.');
      if (row.workedDays !== row.requiredWorkingDays) requireValue(employee && input.absencesJustified === true, 'absencesJustified', 'Potwierdź usprawiedliwione nieobecności. Dla niepracowników potrzebne są przesłanki art. 50.');
    }
  }
  const qualifying = rows.filter(row => row.workedDays === null || row.workedDays >= row.requiredWorkingDays! / 2);
  const used = qualifying.length ? qualifying : rows;
  const excluded = rows.filter(row => !used.includes(row)).map(row => row.month);
  const values = used.map(row => {
    if (row.workedDays === null || row.workedDays === row.requiredWorkingDays) return row.grossAmount;
    if (input.contractMonthlySalary !== null) {
      amount(input.contractMonthlySalary, 'contractMonthlySalary');
      return input.contractMonthlySalary;
    }
    requireValue(row.workedDays > 0, 'workedDays', 'Przy zerowej liczbie dni potrzebna jest kwota z art. 37 ust. 2 pkt 3.');
    return row.grossAmount / row.workedDays * row.requiredWorkingDays!;
  });
  let average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (input.insuranceTitle === 'selfEmployed' && rows.length < params.benefitBase.lookbackMonths) {
    const previous = input.creditedPreviousMonths;
    requireValue(Number.isInteger(previous) && previous! >= 0, 'creditedPreviousMonths', 'Podaj liczbę pełnych miesięcy zaliczanych z poprzedniego tytułu (art. 48a).');
    const minima = rows.map(row => {
      const value = input.minimumContributionBases?.[row.month];
      amount(value, 'minimumContributionBases');
      requireValue(value <= row.grossAmount, 'minimumContributionBases', 'Podstawa zadeklarowana jest niższa od podanej minimalnej.');
      return value;
    });
    const minimumAverage = minima.reduce((sum, value) => sum + value, 0) / minima.length;
    average = minimumAverage + (average - minimumAverage) * Math.min(rows.length + previous!, params.benefitBase.lookbackMonths) / params.benefitBase.lookbackMonths;
  }
  return result(average * deduction, used.map(row => row.month), excluded, employee ? 'Ustawa zasiłkowa art. 36–38, 45' : 'Ustawa zasiłkowa art. 3 pkt 4, 48–48a');
}
