import type { BenefitParams } from '../../zus-przewodnik-starter/shared/types.ts';

export class CalculationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'CalculationError';
  }
}

export function requireValue(condition: unknown, field: string, message: string): asserts condition {
  if (!condition) throw new CalculationError(field, message);
}

export function amount(value: unknown, field: string): asserts value is number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0, field, `Nieprawidłowa kwota: ${field}.`);
}

export function date(value: string): number {
  const timestamp = Date.parse(value + 'T00:00:00Z');
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value, 'date', 'Podaj poprawną datę YYYY-MM-DD.');
  return timestamp;
}

export function daysBetween(start: string, end: string): number {
  return (date(end) - date(start)) / 86400000;
}

export function addDays(start: string, days: number): string {
  return new Date(date(start) + days * 86400000).toISOString().slice(0, 10);
}

export function roundPln(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateParams(params: BenefitParams, on: string): void {
  requireValue(date(on) >= date(params.effectiveFrom), 'params.effectiveFrom', 'Potrzebna jest wcześniejsza wersja parametrów.');
  for (const [key, rate] of Object.entries(params.rates)) {
    requireValue(Number.isFinite(rate) && rate >= 0 && rate <= 1, `rates.${key}`, 'Stawka musi należeć do przedziału 0–1.');
  }
  amount(params.benefitBase.minimumWage, 'minimumWage');
  requireValue(params.benefitBase.socialContributionDeduction >= 0 && params.benefitBase.socialContributionDeduction < 1, 'socialContributionDeduction', 'Nieprawidłowa stopa odliczenia składek.');
}

export function calculateBenefitAmount(base: number, rate: number, days: number) {
  amount(base, 'benefitBase');
  requireValue(Number.isFinite(rate) && rate >= 0 && rate <= 1, 'rate', 'Nieprawidłowa stawka.');
  requireValue(Number.isInteger(days) && days >= 0, 'days', 'Liczba dni musi być nieujemną liczbą całkowitą.');
  // Art. 36 ust. 3: ustawowy dzielnik dzienny, niezależny od długości miesiąca.
  const dailyAmount = roundPln(base * rate / 30);
  return { dailyAmount, totalAmount: roundPln(dailyAmount * days) };
}
