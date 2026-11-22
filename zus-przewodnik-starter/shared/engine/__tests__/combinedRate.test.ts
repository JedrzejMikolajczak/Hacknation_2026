import { describe, expect, it } from 'vitest';
import type { CaseInputs, CasePeriod } from '../../types';
import params from '../../params.json';
import { buildDemoAssistantAnswer } from '../assistantAnswers';
import { calculateCasePlan } from '../casePlan';
import { secondParentTotalForVariant } from '../casePeriods';

const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;

function input(overrides: Partial<CaseInputs> = {}): CaseInputs {
  return {
    applicant_role: 'MOTHER',
    stage: 'POST_BIRTH',
    co_parenting: true,
    other_parent_insured: true,
    employment_type: 'UOP',
    contract_type: null,
    contract_end_date: null,
    payer_insured_count_nov_30: '> 20',
    voluntary_sickness_insured: false,
    insurance_duration_days: null,
    has_b2b_arrears: false,
    applicant_age_50_plus: false,
    benefit_base_amount_pln: 5000,
    due_or_birth_date: '2026-10-15',
    application_date: '2026-10-20',
    days_from_birth_to_application: null,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
    father_parental_weeks: 20,
    part_time_work_fraction: 0,
    special_circumstances: {
      has_code_b_on_ezla: null,
      premature_or_hospitalized_newborn: false,
      za_zyciem_certificate: false,
      stillbirth_or_child_death: 'NONE',
      mother_hospitalized_or_incapable: false,
      employer_bankruptcy_or_liquidation: false,
      adopted_or_foster_child_age_years: null,
      is_professional_foster_family: false,
    },
    other_parent: {
      employment_type: 'UOP',
      payer_insured_count_nov_30: '> 20',
      benefit_base_amount_pln: 5000,
      voluntary_sickness_insured: false,
      contract_end_date: null,
      title_start_date: '2019-01-01',
    },
    reference_date: '2026-11-22',
    title_start_date: '2020-01-01',
    ...overrides,
  };
}

const fatherParental = (periods: CasePeriod[]) =>
  periods.filter((period) => period.parent_role === 'FATHER' && period.leave_type === 'PARENTAL');

const sum = (periods: CasePeriod[]) =>
  Math.round(periods.reduce((total, period) => total + (period.total_amount_pln ?? 0), 0) * 100) /
  100;

describe('Wariant 81,5%: stawka 70% tylko dla nieprzenoszalnych tygodni drugiego rodzica', () => {
  it('ojciec z 20 tyg. rodzicielskiego: pierwsze 9 tyg. po 70%, pozostałe po 81,5%', () => {
    const plan = calculateCasePlan(input({ father_parental_weeks: 20 }), params);
    expect(plan.outcome.applied_payment_variant).toBe('COMBINED_81_5');
    const father = fatherParental(plan.outcome.periods);
    expect(father.map((period) => period.rate_percent)).toEqual([
      params.rates.secondParentNonTransferableInCombined * 100,
      params.rates.combined * 100,
    ]);
    expect(father.map((period) => period.weeks)).toEqual([nonTransferable, 20 - nonTransferable]);
    expect(father[1].start_date > father[0].end_date).toBe(true);
  });

  it('ojciec z 9 tyg. rodzicielskiego ma jeden okres po 70%', () => {
    const plan = calculateCasePlan(input({ father_parental_weeks: nonTransferable }), params);
    const father = fatherParental(plan.outcome.periods);
    expect(father).toHaveLength(1);
    expect(father[0].rate_percent).toBe(params.rates.secondParentNonTransferableInCombined * 100);
  });

  it('wniosek ojca po 32 tyg. (samodzielne rodzicielskie): 9 tyg. po 70%, 23 tyg. po 81,5%', () => {
    const plan = calculateCasePlan(input({ father_parental_weeks: 32 }), params);
    const father = fatherParental(plan.outcome.periods);
    expect(father.map((period) => period.weeks)).toEqual([nonTransferable, 32 - nonTransferable]);
    expect(father[1].rate_percent).toBe(params.rates.combined * 100);
  });

  it('wniosek rodzica po 100% + 70%: całe rodzicielskie ojca po 70%', () => {
    const plan = calculateCasePlan(
      input({ requested_payment_variant: 'SPLIT_100_70', father_parental_weeks: 20 }),
      params,
    );
    const father = fatherParental(plan.outcome.periods);
    expect(father).toHaveLength(1);
    expect(father[0].weeks).toBe(20);
    expect(father[0].rate_percent).toBe(params.rates.parental * 100);
  });

  it('części ręczne ojca liczą 9 tyg. łącznie, także gdy są rozdzielone', () => {
    const plan = calculateCasePlan(
      input({
        parental_leave_parts: [
          { parent_role: 'FATHER', start_date: '2027-04-01', end_date: '2027-05-26' },
          { parent_role: 'FATHER', start_date: '2027-07-01', end_date: '2027-08-25' },
        ],
      }),
      params,
    );
    const father = fatherParental(plan.outcome.periods);
    // 8 tyg. + 8 tyg.: pierwsza część w całości po 70%, druga: 1 tyg. po 70% i 7 tyg. po 81,5%.
    expect(plan.validation_errors).toEqual([]);
    expect(father.map((period) => period.weeks)).toEqual([8, 1, 7]);
    expect(father.map((period) => period.rate_percent)).toEqual([70, 70, 81.5]);
  });
});

describe('Kwoty wariantów zgadzają się z sumą widocznych okresów', () => {
  it('suma wariantu wnioskodawcy = suma zaokrąglonych okresów (bez groszowej różnicy)', () => {
    const split = calculateCasePlan(input({ requested_payment_variant: 'SPLIT_100_70' }), params);
    const applicantSplit = split.outcome.periods.filter(
      (period) => period.parent_role === 'MOTHER' && period.leave_type !== 'SICKNESS',
    );
    expect(split.outcome.variants.SPLIT_100_70).toBe(sum(applicantSplit));
    expect(split.outcome.calculated_amount_pln).toBe(sum(applicantSplit));

    const combined = calculateCasePlan(input(), params);
    const applicantCombined = combined.outcome.periods.filter(
      (period) => period.parent_role === 'MOTHER' && period.leave_type !== 'SICKNESS',
    );
    expect(combined.outcome.variants.COMBINED_81_5).toBe(sum(applicantCombined));
    // Wariant niewybrany liczy się tak samo, jak gdyby był wybrany.
    expect(combined.outcome.variants.SPLIT_100_70).toBe(split.outcome.variants.SPLIT_100_70);
    expect(split.outcome.variants.COMBINED_81_5).toBe(combined.outcome.variants.COMBINED_81_5);
  });

  it('kwoty obu wariantów używają stawki dziennej w groszach przy podstawie 5000 zł', () => {
    const input9 = input({ father_parental_weeks: nonTransferable });
    const split = calculateCasePlan({ ...input9, requested_payment_variant: 'SPLIT_100_70' }, params);
    const combined = calculateCasePlan(input9, params);
    expect(split.outcome.variants.SPLIT_100_70).toBe(49467.88);
    expect(combined.outcome.variants.SPLIT_100_70).toBe(49467.88);
    // 364 dni po 135,83 zł.
    expect(combined.outcome.variants.COMBINED_81_5).toBe(49442.12);
  });

  it('drugi rodzic przeliczony na drugi wariant daje taką kwotę, jak pełny przebieg silnika', () => {
    for (const weeks of [nonTransferable, 20, 32]) {
      const combined = calculateCasePlan(input({ father_parental_weeks: weeks }), params);
      const split = calculateCasePlan(
        input({ requested_payment_variant: 'SPLIT_100_70', father_parental_weeks: weeks }),
        params,
      );
      const fatherOf = (periods: CasePeriod[]) =>
        periods.filter((period) => period.parent_role === 'FATHER');
      expect(
        secondParentTotalForVariant(fatherOf(combined.outcome.periods), 'SPLIT_100_70', params),
      ).toBe(sum(fatherOf(split.outcome.periods)));
      expect(
        secondParentTotalForVariant(fatherOf(split.outcome.periods), 'COMBINED_81_5', params),
      ).toBe(sum(fatherOf(combined.outcome.periods)));
    }
  });

  it('bez okresów drugiego rodzica zwraca null', () => {
    expect(secondParentTotalForVariant([], 'COMBINED_81_5', params)).toBeNull();
  });
});

describe('Termin wniosku o stawkę 81,5%', () => {
  const combinedRate = (overrides: Partial<CaseInputs>) =>
    calculateCasePlan(input(overrides), params).documents.find(
      (document) => document.id === 'COMBINED_RATE',
    );

  it('wniosek złożony w terminie nie jest przeterminowany po upływie terminu', () => {
    const document = combinedRate({ application_date: '2026-10-20', reference_date: '2026-11-22' });
    expect(document?.deadline).toBe('2026-11-05');
    expect(document?.is_overdue).toBe(false);
  });

  it('data złożenia u płatnika ma pierwszeństwo przed datą wniosku', () => {
    const document = combinedRate({
      application_date: '2026-12-30',
      application_to_payer_date: '2026-11-01',
      reference_date: '2026-11-22',
    });
    expect(document?.is_overdue).toBe(false);
  });

  it('bez daty wniosku przed upływem terminu dokument ma termin, ale nie jest przeterminowany', () => {
    const document = combinedRate({ application_date: null, reference_date: '2026-10-20' });
    expect(document?.deadline).toBe('2026-11-05');
    expect(document?.is_overdue).toBe(false);
  });
});

describe('Asystent demo', () => {
  it('podaje stawkę 81,5% z przecinkiem, tak jak reszta aplikacji', () => {
    const { answer } = buildDemoAssistantAnswer('Jak złożyć wniosek o 81,5%?', params);
    expect(answer).toContain('81,5%');
    expect(answer).not.toContain('81.5%');
  });
});
