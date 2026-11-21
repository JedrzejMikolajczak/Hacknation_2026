import { describe, expect, it } from 'vitest';
import type { CaseInputs, CaseRecord } from '../../types';
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

function baseTwoParentInput(overrides: Partial<CaseInputs> = {}): CaseInputs {
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
    benefit_base_amount_pln: 6903.2,
    due_or_birth_date: '2026-11-10',
    application_date: null,
    days_from_birth_to_application: null,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
    father_parental_weeks: params.parentalLeave.nonTransferableWeeksPerParent,
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
      payer_insured_count_nov_30: '<= 20',
      benefit_base_amount_pln: 5000,
      voluntary_sickness_insured: false,
      contract_end_date: null,
      title_start_date: '2019-01-01',
    },
    paternity_leave_start_date: '2026-11-28',
    reference_date: '2026-11-21',
    title_start_date: '2020-01-01',
    ...overrides,
  };
}

describe('Sprawy konkursowe ZUS', () => {
  for (const fixture of cases) {
    const { inputs, ground_truth_outcome: expected, case_id } = fixture;
    const outcome = calculateCasePlan(inputs, params).outcome;
    const differences = compareCase(expected, outcome);

    it(`${case_id} odtwarza decyzję ZUS bez rozbieżności`, () => {
      expect(differences).toEqual([]);
    });

    it(`${case_id} nie sygnalizuje ryzyka bez danych spełniających warunki`, () => {
      expect(
        outcome.warnings.filter(({ code }) => /SHAM|BASE_INCREASE|EMPLOYMENT_CONTEXT/.test(code)),
      ).toEqual([]);
    });
  }

  it('case-02 zachowuje połowę kwoty w okresach pracy na 1/2 etatu', () => {
    const withBase = calculateCasePlan(
      { ...cases[1].inputs, benefit_base_amount_pln: 6000 },
      params,
    ).outcome;
    expect(withBase.granted_duration_weeks).toBe(143);
    expect(
      withBase.periods.map(({ days, work_fraction, monthly_amount_pln }) => [
        days,
        work_fraction,
        monthly_amount_pln,
      ]),
    ).toEqual([
      [217, 0, 4890],
      [392, 0.5, 2445],
      [392, 0.5, 2445],
    ]);
  });

  it('poród mnogi z utratą jednego z bliźniąt liczy macierzyński i rodzicielski jak dla 1 żywego dziecka', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        children_count: 2,
        living_children_count: 1,
        father_parental_weeks: 0,
        paternity_leave_start_date: undefined,
        special_circumstances: {
          ...baseTwoParentInput().special_circumstances,
          stillbirth_or_child_death: 'BEFORE_8_WEEKS',
        },
      }),
      params,
    );
    expect(plan.outcome.parental_pool_weeks).toBe(params.parentalLeave.weeksSingleChild);
    expect(plan.outcome.parental_applicant_limit_weeks).toBe(
      params.parentalLeave.weeksSingleChild - params.parentalLeave.nonTransferableWeeksPerParent,
    );
    expect(plan.outcome.periods.map(({ leave_type, weeks }) => [leave_type, weeks])).toEqual([
      ['MATERNITY', params.maternityLeave.weeksByChildrenCount['1']],
      [
        'PARENTAL',
        params.parentalLeave.weeksSingleChild - params.parentalLeave.nonTransferableWeeksPerParent,
      ],
    ]);
  });

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

describe('Oboje rodzice, wariant 81,5% i sytuacje szczególne', () => {
  it('dla obojga rodziców bez daty wniosku liczy 81,5% z ostrzeżeniem o terminie oraz okresy ojca z jego podstawy', () => {
    const plan = calculateCasePlan(baseTwoParentInput(), params);
    const { outcome } = plan;

    expect(outcome.applied_payment_variant).toBe('COMBINED_81_5');
    expect(outcome.granted_rate_percent).toBe(81.5);
    expect(outcome.variants.COMBINED_81_5).toBeGreaterThan(0);
    expect(outcome.variants.SPLIT_100_70).toBeGreaterThan(0);

    const deadlineWarning = outcome.warnings.find((w) => w.code === 'COMBINED_RATE_DEADLINE');
    expect(deadlineWarning).toBeDefined();
    expect(deadlineWarning?.message_pl).toContain('01.12.2026');
    expect(deadlineWarning?.message_pl).toContain('81,5%');

    expect(
      outcome.periods.map(
        ({
          parent_role,
          leave_type,
          weeks,
          rate_percent,
          who_pays,
          benefit_base_pln,
          monthly_amount_pln,
        }) => ({
          parent_role,
          leave_type,
          weeks,
          rate_percent,
          who_pays,
          benefit_base_pln,
          monthly_amount_pln,
        }),
      ),
    ).toEqual([
      {
        parent_role: 'MOTHER',
        leave_type: 'MATERNITY',
        weeks: 20,
        rate_percent: 81.5,
        who_pays: 'EMPLOYER',
        benefit_base_pln: 6903.2,
        monthly_amount_pln: 5626.11,
      },
      {
        parent_role: 'MOTHER',
        leave_type: 'PARENTAL',
        weeks: 32,
        rate_percent: 81.5,
        who_pays: 'EMPLOYER',
        benefit_base_pln: 6903.2,
        monthly_amount_pln: 5626.11,
      },
      {
        parent_role: 'FATHER',
        leave_type: 'PARENTAL',
        weeks: 9,
        rate_percent: 70,
        who_pays: 'ZUS',
        benefit_base_pln: 5000,
        monthly_amount_pln: 3500,
      },
      {
        parent_role: 'FATHER',
        leave_type: 'PATERNITY',
        weeks: 2,
        rate_percent: 100,
        who_pays: 'ZUS',
        benefit_base_pln: 5000,
        monthly_amount_pln: 5000,
      },
    ]);
  });

  it('gdy znana data wniosku przekracza termin 21 dni, wraca do wariantu 100% + 70% z ostrzeżeniem', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        application_date: '2026-12-05',
      }),
      params,
    );
    expect(plan.outcome.applied_payment_variant).toBe('SPLIT_100_70');
    expect(plan.outcome.granted_rate_percent).toBe(100);
    expect(plan.outcome.variants.COMBINED_81_5).toBeNull();
    expect(plan.outcome.variants.SPLIT_100_70).toBeGreaterThan(0);
    const warning = plan.outcome.warnings.find((w) => w.code === 'COMBINED_RATE_DEADLINE');
    expect(warning?.message_pl).toContain('01.12.2026');
    expect(warning?.message_pl).toContain('100%');
    expect(warning?.message_pl).toContain('70%');
    expect(plan.outcome.periods.find((p) => p.leave_type === 'MATERNITY')?.rate_percent).toBe(100);
    expect(
      plan.outcome.periods.find((p) => p.leave_type === 'PARENTAL' && p.parent_role === 'MOTHER')
        ?.rate_percent,
    ).toBe(70);
  });

  it('po 21 dniach bez złożonego wniosku wyłącza stawkę 81,5% i jej wniosek', () => {
    const reference_date = '2026-12-02';
    const missed = calculateCasePlan(baseTwoParentInput({ reference_date }), params);
    expect(missed.outcome.applied_payment_variant).toBe('SPLIT_100_70');
    expect(missed.documents.some((document) => document.id === 'COMBINED_RATE')).toBe(false);
    const filed = calculateCasePlan(
      baseTwoParentInput({
        reference_date,
        application_date: '2026-12-01',
      }),
      params,
    );
    expect(filed.outcome.applied_payment_variant).toBe('COMBINED_81_5');
  });

  it('wylicza podstawę ojca z other_parent.monthly_bases gdy podstawa wprost jest nieznana', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        other_parent: {
          employment_type: 'B2B',
          payer_insured_count_nov_30: null,
          benefit_base_amount_pln: null,
          voluntary_sickness_insured: true,
          monthly_bases: [{ month: '2026-10', amount_pln: 5203.8 }],
        },
      }),
      params,
    );
    const fatherParental = plan.outcome.periods.find(
      (p) => p.parent_role === 'FATHER' && p.leave_type === 'PARENTAL',
    );
    const fatherPaternity = plan.outcome.periods.find(
      (p) => p.parent_role === 'FATHER' && p.leave_type === 'PATERNITY',
    );
    // 5203.8 * (1 - 0.1371) = 4490.35902 -> 4490.36
    expect(fatherParental?.benefit_base_pln).toBe(4490.36);
    expect(fatherParental?.monthly_amount_pln).toBe(3143.25);
    expect(fatherParental?.who_pays).toBe('ZUS');
    expect(fatherPaternity?.benefit_base_pln).toBe(4490.36);
    expect(fatherPaternity?.monthly_amount_pln).toBe(4490.36);
  });

  it('matka nieubezpieczona + ojciec ubezpieczony → ojciec dostaje rodzicielski i ojcowski (PDF B)', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        employment_type: 'NONE',
        benefit_base_amount_pln: null,
        payer_insured_count_nov_30: null,
        father_parental_weeks: 32,
      }),
      params,
    );
    expect(plan.outcome.is_qualified).toBe(true);
    expect(plan.outcome.applied_payment_variant).toBe('SPLIT_100_70');
    expect(
      plan.outcome.periods.map(
        ({ parent_role, leave_type, weeks, rate_percent, benefit_base_pln }) => ({
          parent_role,
          leave_type,
          weeks,
          rate_percent,
          benefit_base_pln,
        }),
      ),
    ).toEqual([
      {
        parent_role: 'FATHER',
        leave_type: 'PARENTAL',
        weeks: 32,
        rate_percent: 70,
        benefit_base_pln: 5000,
      },
      {
        parent_role: 'FATHER',
        leave_type: 'PATERNITY',
        weeks: 2,
        rate_percent: 100,
        benefit_base_pln: 5000,
      },
    ]);
    expect(plan.outcome.warnings.some((w) => w.code === 'FATHER_PARENTAL_MOTHER_UNINSURED')).toBe(
      true,
    );
    expect(
      plan.entitlements.find((e) => e.parent_role === 'FATHER' && e.benefit_type === 'PARENTAL')
        ?.is_qualified,
    ).toBe(true);
    expect(
      plan.entitlements.find((e) => e.parent_role === 'MOTHER' && e.benefit_type === 'MATERNITY')
        ?.is_qualified,
    ).toBe(false);
  });

  it('samodzielna matka dostaje 32 tyg. rodzicielskiego z wyjaśnieniem o nieprzenoszalnych 9 tyg.', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        co_parenting: false,
        other_parent_insured: null,
        other_parent: undefined,
        father_parental_weeks: 0,
        paternity_leave_start_date: undefined,
      }),
      params,
    );
    expect(plan.outcome.periods.every((p) => p.parent_role === 'MOTHER')).toBe(true);
    expect(plan.outcome.periods.find((p) => p.leave_type === 'PARENTAL')?.weeks).toBe(32);
    const note = plan.outcome.warnings.find((w) => w.code === 'NON_TRANSFERABLE_PARENTAL_PART');
    expect(note?.message_pl).toContain('9 tyg.');
    expect(note?.message_pl).toContain('32 tyg.');
  });

  it('samodzielny ojciec dostaje rodzicielski i ojcowski oraz wyjaśnienie o nieprzenoszalnej części', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        applicant_role: 'FATHER',
        co_parenting: false,
        other_parent_insured: null,
        other_parent: undefined,
        benefit_base_amount_pln: 5000,
        father_parental_weeks: 0,
        requested_payment_variant: 'SPLIT_100_70',
      }),
      params,
    );
    expect(
      plan.outcome.periods.map(({ parent_role, leave_type, weeks, rate_percent }) => ({
        parent_role,
        leave_type,
        weeks,
        rate_percent,
      })),
    ).toEqual([
      { parent_role: 'FATHER', leave_type: 'PARENTAL', weeks: 32, rate_percent: 70 },
      { parent_role: 'FATHER', leave_type: 'PATERNITY', weeks: 2, rate_percent: 100 },
    ]);
    expect(plan.outcome.warnings.some((w) => w.code === 'NON_TRANSFERABLE_PARENTAL_PART')).toBe(
      true,
    );
  });

  it('przy śmierci matki ubezpieczony ojciec przejmuje pełny urlop macierzyński, rodzicielski i ojcowski', () => {
    const plan = calculateCasePlan(
      baseTwoParentInput({
        applicant_role: 'FATHER',
        co_parenting: false,
        other_parent_insured: null,
        other_parent: undefined,
        benefit_base_amount_pln: 5000,
        father_parental_weeks: 0,
        special_circumstances: {
          ...baseTwoParentInput().special_circumstances,
          mother_deceased: true,
        },
      }),
      params,
    );
    expect(
      plan.outcome.periods.map(({ parent_role, leave_type, weeks, rate_percent }) => ({
        parent_role,
        leave_type,
        weeks,
        rate_percent,
      })),
    ).toEqual([
      { parent_role: 'FATHER', leave_type: 'MATERNITY', weeks: 20, rate_percent: 100 },
      { parent_role: 'FATHER', leave_type: 'PARENTAL', weeks: 32, rate_percent: 70 },
      { parent_role: 'FATHER', leave_type: 'PATERNITY', weeks: 2, rate_percent: 100 },
    ]);
  });
});
