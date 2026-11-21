import { describe, expect, it } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs, PlannedParentalPart } from '@shared/types';
import { addDaysIso, computeReturnToWorkDates, getLeavePeriods } from '../leavePlanHelpers';
import { buildCalendarMilestones, validateLeavePlan } from '../leavePlanValidation';

function makeInputs(overrides: Partial<CaseInputs> = {}): CaseInputs {
  return {
    applicant_role: 'MOTHER',
    stage: 'POST_BIRTH',
    co_parenting: true,
    other_parent_insured: true,
    employment_type: 'UOP',
    contract_type: 'INDEFINITE',
    contract_end_date: null,
    payer_insured_count_nov_30: '> 20',
    voluntary_sickness_insured: false,
    insurance_duration_days: null,
    has_b2b_arrears: false,
    applicant_age_50_plus: false,
    benefit_base_amount_pln: 6000,
    due_or_birth_date: '2026-11-10',
    application_date: '2026-11-15',
    days_from_birth_to_application: 5,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
    father_parental_weeks: 9,
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
    },
    reference_date: '2026-11-21',
    ...overrides,
  };
}

describe('leavePlanValidation', () => {
  it('zgłasza naruszenie 14 obowiązkowych tygodni matki po porodzie', () => {
    const input = makeInputs({
      father_takeover_date: addDaysIso('2026-11-10', 10 * 7), // po 10 tyg. zamiast min. 14
    });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, [], params);

    expect(issues.some((i) => i.code === 'MATERNITY_MOTHER_MANDATORY_WEEKS')).toBe(true);
    expect(issues.some((i) => i.message.includes('14 tygodni'))).toBe(true);
  });

  it('zgłasza przekroczenie nieprzenoszalnych 9 tygodni drugiego rodzica', () => {
    const parts: PlannedParentalPart[] = [
      {
        parent_role: 'MOTHER',
        start_date: '2027-03-30',
        end_date: addDaysIso('2027-03-30', 35 * 7 - 1), // 35 tyg. > 32 tyg. limitu
        work_fraction: 0,
      },
    ];
    const input = makeInputs({ parental_leave_parts: parts });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, parts, params);

    expect(issues.some((i) => i.code === 'PARENTAL_MOTHER_NON_TRANSFERABLE')).toBe(true);
    expect(issues.some((i) => i.message.includes('9 tyg.'))).toBe(true);
  });

  it('zgłasza przekroczenie limitu maksymalnie 5 części urlopu rodzicielskiego', () => {
    const parts: PlannedParentalPart[] = Array.from({ length: 6 }, (_, i) => {
      const start = addDaysIso('2027-03-30', i * 14);
      return {
        parent_role: 'MOTHER' as const,
        start_date: start,
        end_date: addDaysIso(start, 6),
        work_fraction: 0,
      };
    });
    const input = makeInputs({ parental_leave_parts: parts });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, parts, params);

    expect(issues.some((i) => i.code === 'PARENTAL_MAX_PARTS')).toBe(true);
    expect(issues.some((i) => i.message.includes('5 części'))).toBe(true);
  });

  it('zgłasza przekroczenie końca roku kalendarzowego, w którym dziecko kończy 6 lat', () => {
    const parts: PlannedParentalPart[] = [
      {
        parent_role: 'MOTHER',
        start_date: '2032-12-01',
        end_date: '2033-01-15',
        work_fraction: 0,
      },
    ];
    const input = makeInputs({ parental_leave_parts: parts });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, parts, params);

    expect(issues.some((i) => i.code === 'PARENTAL_DEADLINE_EXCEEDED')).toBe(true);
    expect(issues.some((i) => i.message.includes('6 lat'))).toBe(true);
  });

  it('zgłasza przekroczenie 12 miesięcy na urlop ojcowski', () => {
    const input = makeInputs({
      paternity_leave_start_date: '2027-11-05', // 2 tyg. kończą się po 12 mies. od 2026-11-10
    });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, [], params);

    expect(issues.some((i) => i.code === 'PATERNITY_DEADLINE_EXCEEDED')).toBe(true);
    expect(issues.some((i) => i.message.includes('12 miesięcy'))).toBe(true);
  });

  it('zgłasza przekroczenie maksymalnego wymiaru pracy (1/2 etatu) podczas rodzicielskiego', () => {
    const parts: PlannedParentalPart[] = [
      {
        parent_role: 'MOTHER',
        start_date: '2027-03-30',
        end_date: addDaysIso('2027-03-30', 10 * 7 - 1),
        work_fraction: 0.6,
      },
    ];
    const input = makeInputs({ parental_leave_parts: parts });
    const plan = calculateCasePlan(input, params);
    const issues = validateLeavePlan(input, plan, parts, params);

    expect(issues.some((i) => i.code === 'PARENTAL_WORK_FRACTION_EXCEEDED')).toBe(true);
    expect(issues.some((i) => i.message.includes('1/2 etatu'))).toBe(true);
  });

  it('buduje kamienie milowe i oznacza minione terminy względem reference_date', () => {
    const input = makeInputs({ reference_date: '2027-04-01' });
    const plan = calculateCasePlan(input, params);
    const periods = getLeavePeriods(plan);
    const returnDates = computeReturnToWorkDates(periods);
    const milestones = buildCalendarMilestones(input, plan, returnDates);

    const deadlines = milestones.filter((m) => m.kind === 'deadline');
    expect(deadlines.length).toBeGreaterThan(0);
    expect(deadlines.some((m) => m.isPast)).toBe(true);
    expect(deadlines.some((m) => !m.isPast)).toBe(true);
  });
});
