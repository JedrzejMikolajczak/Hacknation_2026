import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import { calculateCasePlan } from '../casePlan';
import { addDays, daysBetween } from '../core';
import { birthInput } from './auditFixtures';

const levels = [
  ['UOP', 'ZLECENIE', 'B2B', 'NONE'],
  [true, false, null],
  [0, 48.06, 48.07],
  ['2026-01-31', '2026-03-29', '2026-10-25'],
  [1, 2],
  [false, true],
  [21, 22],
  [null, 6000],
] as const;

function pairs(row: number[]): string[] {
  return row.flatMap((value, first) =>
    row
      .slice(first + 1)
      .map((other, offset) => [first, value, first + offset + 1, other].join(':')),
  );
}

function pairwiseRows(): { selected: number[][]; pairCount: number } {
  const possibilities = levels.reduce<number[][]>(
    (rows, values) => rows.flatMap((row) => values.map((_, index) => [...row, index])),
    [[]],
  );
  const candidates = possibilities.map((row) => ({ row, pairs: pairs(row) }));
  const uncovered = new Set(candidates.flatMap((candidate) => candidate.pairs));
  const pairCount = uncovered.size;
  const selected: number[][] = [];

  while (uncovered.size > 0) {
    let best: (typeof candidates)[number] | undefined;
    let score = 0;
    for (const candidate of candidates) {
      const hits = candidate.pairs.filter((key) => uncovered.has(key)).length;
      if (hits > score) {
        best = candidate;
        score = hits;
      }
    }
    if (!best) throw new Error('Niezrealizowane pary parametrów.');
    selected.push(best.row);
    best.pairs.forEach((key) => uncovered.delete(key));
  }
  return { selected, pairCount };
}

function utcOffset(iso: string, offset: number): string {
  const instant = new Date(iso + 'T00:00:00Z');
  instant.setUTCDate(instant.getUTCDate() + offset);
  return instant.toISOString().slice(0, 10);
}

const matrix = pairwiseRows();

describe('Macierz pairwise i własności obliczeń', () => {
  it('PAIR-00 każda para poziomów ośmiu parametrów ma pokrycie', () => {
    const theoreticalPairs = levels
      .flatMap((first, i) => levels.slice(i + 1).map((second) => first.length * second.length))
      .reduce((sum, count) => sum + count, 0);
    expect(matrix.pairCount).toBe(theoreticalPairs);
    expect(new Set(matrix.selected.flatMap(pairs)).size).toBe(theoreticalPairs);
    expect(matrix.selected.length).toBeLessThan(40);
  });

  it.each(matrix.selected)(
    'PAIR-01 kombinacja poziomów %i %i %i %i %i %i %i %i',
    (title, coverage, arrears, birth, children, certificate, filing, base) => {
      const employment = levels[0][title];
      const insurance = levels[1][coverage];
      const debt = levels[2][arrears];
      const date = levels[3][birth];
      const count = levels[4][children];
      const hasCertificate = levels[5][certificate];
      const filingDay = levels[6][filing];
      const benefitBase = levels[7][base];
      const input = birthInput(
        {
          employment_type: employment,
          voluntary_sickness_insured: insurance,
          debt_amount_pln: debt,
          due_or_birth_date: date,
          children_count: count,
          application_date: utcOffset(date, filingDay),
          requested_payment_variant: 'COMBINED_81_5',
          benefit_base_amount_pln: benefitBase,
        },
        { za_zyciem_certificate: hasCertificate },
      );
      const outcome = calculateCasePlan(input, params).outcome;

      const titleProvidesCoverage =
        employment === 'UOP' ||
        ((employment === 'B2B' || employment === 'ZLECENIE') && insurance === true);
      const qualifies = titleProvidesCoverage && !(employment === 'B2B' && debt > 48.06);
      expect(outcome.is_qualified).toBe(qualifies);
      const paid = outcome.periods.filter((row) => !row.denied);
      if (!qualifies) {
        expect(paid).toEqual([]);
        return;
      }

      const maternity = count === 1 ? 140 : 217;
      const pool = (count === 1 ? 41 : 43) + (hasCertificate ? 24 : 0);
      const parental = (pool - 9) * 7;
      expect(outcome.parental_pool_weeks).toBe(pool);
      expect(paid.map(({ days, who_pays }) => [days, who_pays])).toEqual([
        [maternity, 'ZUS'],
        [parental, 'ZUS'],
      ]);
      const combined = filingDay === 21;
      expect(outcome.applied_payment_variant).toBe(combined ? 'COMBINED_81_5' : 'SPLIT_100_70');
      const expectedTotal =
        benefitBase === null
          ? null
          : combined
            ? (maternity + parental) * 163
            : maternity * 200 + parental * 140;
      expect(outcome.calculated_amount_pln).toBe(expectedTotal);
    },
  );

  it.each(Array.from({ length: 48 }, (_, i) => i))(
    'PROP-01 powtarzalny wariant kalendarza i wymiaru pracy #%i',
    (index) => {
      // Stałe ziarno i jawne poziomy umożliwiają odtworzenie pojedynczego wariantu.
      const sample = Math.imul(index + 1, 0x9e3779b1) >>> 0;
      const start = utcOffset('2026-11-20', sample % 75);
      const days = 1 + (sample % 42);
      const workQuarters = index % 3;
      const end = utcOffset(start, days - 1);
      const input = birthInput({
        parental_leave_parts: [
          { start_date: start, end_date: end, work_fraction: workQuarters / 4 },
        ],
      });
      const plan = calculateCasePlan(input, params);
      expect(plan).toEqual(calculateCasePlan(structuredClone(input), params));
      expect(plan.validation_errors).toEqual([]);

      const additionalDays = Math.floor((days * workQuarters) / (4 - workQuarters));
      const rows = plan.outcome.periods.slice(1);
      expect(rows.map((row) => row.days)).toEqual(
        additionalDays === 0 ? [days] : [days, additionalDays],
      );
      expect(rows.at(-1)?.end_date).toBe(utcOffset(end, additionalDays));
      expect(rows.reduce((sum, row) => sum + (row.total_amount_pln ?? NaN), 0)).toBe(
        (days + additionalDays) * [140, 105, 70][workQuarters],
      );

      for (const row of plan.outcome.periods) {
        expect(row.days).toBeGreaterThan(0);
        expect(row.days).toBe(daysBetween(row.start_date, row.end_date) + 1);
        expect(Number.isFinite(row.total_amount_pln)).toBe(true);
      }
      expect(addDays(addDays(start, days), -days)).toBe(start);
    },
  );

  it('PROP-02 rozdzielenie części o dokładnej stawce dziennej nie zmienia kwoty', () => {
    const whole = birthInput({
      parental_leave_parts: [{ start_date: '2026-11-18', end_date: '2026-12-22' }],
    });
    const split = birthInput({
      parental_leave_parts: [
        { start_date: '2026-11-18', end_date: '2026-12-08' },
        { start_date: '2026-12-09', end_date: '2026-12-22' },
      ],
    });
    const alsoWithUnrelatedField = { ...split, newly_created_position: true };
    for (const input of [whole, split, alsoWithUnrelatedField]) {
      const { outcome } = calculateCasePlan(input, params);
      expect(outcome.calculated_amount_pln).toBe(28000 + 35 * 140);
    }
  });

  it('PROP-03 odwrócenie kolejności ręcznych części utrzymuje okresy i terminy', () => {
    const parts = [
      { start_date: '2026-11-20', end_date: '2026-11-26' },
      { start_date: '2026-12-10', end_date: '2026-12-16' },
    ];
    const first = calculateCasePlan(birthInput({ parental_leave_parts: parts }), params);
    const second = calculateCasePlan(
      birthInput({ parental_leave_parts: [...parts].reverse() }),
      params,
    );
    expect(first.outcome.periods).toEqual(second.outcome.periods);
    expect(first.documents).toEqual(second.documents);
  });
});
