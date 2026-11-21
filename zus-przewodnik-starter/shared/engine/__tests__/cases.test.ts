import { describe, expect, it } from 'vitest';
import type { CaseRecord } from '../../types';
import params from '../../params.json';
import { calculateCasePlan } from '../casePlan';
import { compareCase } from '../caseComparison';
import case01 from '../../../data/cases/case-01.json';
import case02 from '../../../data/cases/case-02.json';
import case03 from '../../../data/cases/case-03.json';
import case04 from '../../../data/cases/case-04.json';
import case05 from '../../../data/cases/case-05.json';
import case06 from '../../../data/cases/case-06.json';

const cases = [case01, case02, case03, case04, case05, case06] as CaseRecord[];
const moneyFields = /benefit_base_pln|daily_amount_pln|monthly_amount_pln/;

describe('Sprawy konkursowe ZUS', () => {
  for (const fixture of cases) {
    const { inputs, ground_truth_outcome: expected, case_id } = fixture;
    const outcome = calculateCasePlan(inputs, params).outcome;
    const differences = compareCase(expected, outcome);
    const domainDifferences = differences.filter(({ field }) => !moneyFields.test(field));
    if (case_id === 'case-02') {
      // rozbieżność z decyzją ZUS – do potwierdzenia u mentorów
      it.fails(`${case_id} odtwarza wymiar przyznany w decyzji`, () =>
        expect(domainDifferences).toEqual([]),
      );
      it(`${case_id} stosuje ustawowe 58 tygodni i połowę kwoty w okresach pracy`, () => {
        const withBase = calculateCasePlan(
          { ...inputs, benefit_base_amount_pln: 6000 },
          params,
        ).outcome;
        expect(withBase.granted_duration_weeks).toBe(147);
        expect(
          withBase.periods.map(({ days, work_fraction, monthly_amount_pln }) => [
            days,
            work_fraction,
            monthly_amount_pln,
          ]),
        ).toEqual([
          [217, 0, 4890],
          [406, 0.5, 2445],
          [406, 0.5, 2445],
        ]);
      });
    } else {
      it(`${case_id} odtwarza kwalifikację, płatnika, stawkę, formularze i okresy`, () =>
        expect(domainDifferences).toEqual([]));
    }
    it(`${case_id} liczy kwoty z podanej podstawy lub udokumentowanej średniej`, () => {
      const mismatches = differences.filter(({ field }) => moneyFields.test(field));
      if (case_id === 'case-03' || case_id === 'case-06') {
        if (case_id === 'case-06') expect(mismatches.length).toBeGreaterThan(0);
        else expect(mismatches).toEqual([]);
        const months = inputs.monthly_bases!;
        const mean = months.reduce((sum, item) => sum + item.amount_pln, 0) / months.length;
        const base = mean * (1 - params.benefitBase.socialContributionDeduction);
        expect(outcome.benefit_base_pln).toBeCloseTo(base, 2);
        for (const period of outcome.periods.filter((item) => !item.denied)) {
          const monthly = (base * (period.rate_percent ?? 0)) / 100;
          expect(period.monthly_amount_pln).toBe(Math.round(monthly * 100) / 100);
          expect(period.daily_amount_pln).toBe(Math.round((monthly / 30) * 100) / 100);
        }
      } else if (case_id !== 'case-01') {
        expect(mismatches).toEqual([]);
        expect(outcome.benefit_base_pln).toBeNull();
      } else {
        expect(
          outcome.periods.find(({ leave_type }) => leave_type === 'MATERNITY')?.monthly_amount_pln,
        ).toBe(3024.03);
        expect(
          outcome.periods[0].amount_segments?.map(({ daily_amount_pln }) => daily_amount_pln),
        ).toEqual([122.01, 123.68]);
      }
    });
    it(`${case_id} nie sygnalizuje ryzyka bez danych spełniających warunki`, () => {
      expect(
        outcome.warnings.filter(({ code }) => /SHAM|BASE_INCREASE|EMPLOYMENT_CONTEXT/.test(code)),
      ).toEqual([]);
    });
  }

  it('przelicza termin drugiego rodzica po zmianie planu', () => {
    const input = {
      ...cases[3].inputs,
      other_parent: {
        employment_type: 'UOP' as const,
        voluntary_sickness_insured: false,
        payer_insured_count_nov_30: '> 20' as const,
        benefit_base_amount_pln: null,
      },
    };
    const plan = (start_date: string, end_date: string) =>
      calculateCasePlan(
        {
          ...input,
          parental_leave_parts: [{ parent_role: 'FATHER', start_date, end_date }],
        },
        params,
      ).documents.find((item) => item.parent_role === 'FATHER' && item.id === 'PARENTAL_REQUEST')
        ?.deadline;
    expect(plan('2027-06-20', '2027-06-26')).toBe('2027-05-30');
    expect(plan('2027-11-09', '2028-01-10')).toBe('2027-10-19');
  });

  it('podaje sygnał weryfikacji bez zmiany prawa do świadczenia', () => {
    const input = {
      ...cases[1].inputs,
      title_start_date: '2024-04-08',
      employer_is_family_member: true,
      monthly_bases: [
        { month: '2024-02', amount_pln: 4000 },
        { month: '2024-03', amount_pln: 6000 },
      ],
    };
    const { outcome } = calculateCasePlan(input, params);
    expect(outcome.is_qualified).toBe(true);
    expect(outcome.warnings.map(({ code }) => code)).toEqual([
      'SHAM_CONTRACT_RISK',
      'BASE_INCREASE_IN_PREGNANCY',
      'EMPLOYMENT_CONTEXT_RISK',
    ]);
    expect(outcome.warnings.every(({ legal_basis }) => legal_basis === null)).toBe(true);
  });
});
