import type { CaseDifference, CaseOutcome, CaseRecord } from '../types';

export function compareCase(expected: CaseRecord['ground_truth_outcome'], actual: CaseOutcome): CaseDifference[] {
  const differences: CaseDifference[] = [];
  function compare(field: string, expectedValue: unknown, actualValue: unknown) {
    if (expectedValue === actualValue) return;
    if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
      compare(`${field}.length`, expectedValue.length, actualValue.length);
      expectedValue.forEach((item, index) => compare(`${field}[${index}]`, item, actualValue[index]));
    } else if (expectedValue !== null && actualValue !== null && typeof expectedValue === 'object' && typeof actualValue === 'object') {
      const object = actualValue as Record<string, unknown>;
      Object.entries(expectedValue).forEach(([key, value]) => compare(`${field}.${key}`, value, object[key]));
    } else {
      differences.push({ field, expected: expectedValue, actual: actualValue ?? null });
    }
  }
  const fields = ['is_qualified', 'who_pays', 'granted_rate_percent', 'granted_duration_days', 'granted_duration_weeks', 'benefit_base_pln'] as const;
  fields.forEach((field) => {
    if (expected[field] !== undefined) compare(field, expected[field], actual[field]);
  });
  if (expected.calculated_amount_pln !== null) compare('calculated_amount_pln', expected.calculated_amount_pln, actual.calculated_amount_pln);
  compare('mapped_forms_2026', [...expected.mapped_forms_2026].sort(), [...actual.mapped_forms_2026].sort());
  compare('periods', expected.periods, actual.periods);
  return differences;
}
