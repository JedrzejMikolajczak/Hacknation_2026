import type { BenefitParams } from '../types';

export class CalculationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'CalculationError';
  }
}

export function requireValue(
  condition: unknown,
  field: string,
  message: string,
): asserts condition {
  if (!condition) throw new CalculationError(field, message);
}

export function amount(value: unknown, field: string): asserts value is number {
  requireValue(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    field,
    `Nieprawidłowa kwota w polu ${field}.`,
  );
}

export function date(value: string, field = 'date'): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(timestamp) &&
      new Date(timestamp).toISOString().slice(0, 10) === value,
    field,
    `Podaj poprawną datę w formacie RRRR-MM-DD (pole: ${field}).`,
  );
  return timestamp;
}

export function daysBetween(start: string, end: string): number {
  return Math.round((date(end) - date(start)) / 86400000);
}

export function addDays(start: string, days: number): string {
  return new Date(date(start) + days * 86400000).toISOString().slice(0, 10);
}

export function addMonths(start: string, months: number): string {
  date(start);
  const [y, m, d] = start.split('-').map(Number);
  const targetTotalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonthIndex = ((targetTotalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay)).toISOString().slice(0, 10);
}

export function monthIndex(month: string, field = 'month'): number {
  date(`${month}-01`, field);
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export function endOfYearChildTurnsAge(birthDate: string, ageYears: number): string {
  date(birthDate, 'birthDate');
  const year = Number(birthDate.slice(0, 4)) + ageYears;
  return `${year}-12-31`;
}

export function roundPln(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  requireValue(Number.isFinite(rounded), 'amount_pln', 'Kwota przekracza zakres kalkulatora.');
  return rounded;
}

export function formatPercentPl(rate: number): string {
  const percent = Math.round(rate * 10000) / 100;
  return `${percent.toString().replace('.', ',')}%`;
}

export function validateParams(params: BenefitParams, on: string): void {
  date(on, 'referenceDate');
  date(params.effectiveFrom, 'params.effectiveFrom');
  for (const [key, rate] of Object.entries(params.rates)) {
    requireValue(
      Number.isFinite(rate) && rate >= 0 && rate <= 1,
      `rates.${key}`,
      'Stawka musi należeć do przedziału 0–1.',
    );
  }
  amount(params.benefitBase.minimumWage, 'minimumWage');
  requireValue(
    params.benefitBase.socialContributionDeduction >= 0 &&
      params.benefitBase.socialContributionDeduction < 1,
    'socialContributionDeduction',
    'Nieprawidłowa stopa odliczenia składek.',
  );
}

export function calculateBenefitAmount(base: number, rate: number, days: number, divisor = 30) {
  amount(base, 'benefitBase');
  requireValue(Number.isFinite(rate) && rate >= 0 && rate <= 1, 'rate', 'Nieprawidłowa stawka.');
  requireValue(
    Number.isInteger(days) && days >= 0,
    'days',
    'Liczba dni musi być nieujemną liczbą całkowitą.',
  );
  // Art. 36 ust. 3: ustawowy dzielnik dzienny (30), niezależny od długości miesiąca.
  const dailyAmount = roundPln((base * rate) / divisor);
  return { dailyAmount, totalAmount: roundPln(dailyAmount * days) };
}
