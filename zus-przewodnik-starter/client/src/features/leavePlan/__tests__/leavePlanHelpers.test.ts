import { describe, expect, it } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs } from '@shared/types';
import {
  buildPresetParentalParts,
  computeParentalUsage,
  computeReturnToWorkDates,
  detectActivePreset,
  formatParentLeaveSummary,
  getEditableParentalParts,
  getLeavePeriods,
  getLeavePlanPresets,
  getParentAvailability,
  mergeParentLeaveRanges,
} from '../leavePlanHelpers';

function makeCoupleInputs(overrides: Partial<CaseInputs> = {}): CaseInputs {
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
    benefit_base_amount_pln: 6903.2,
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

describe('leavePlanHelpers', () => {
  it('udostępnia 5 gotowych scenariuszy podziału urlopu', () => {
    const presets = getLeavePlanPresets(params);
    expect(presets.map((p) => p.title)).toEqual([
      'Najpierw mama, potem tata',
      'Po połowie',
      'Jednocześnie',
      'Tylko mama',
      'Tylko tata',
    ]);
  });

  it('buduje poprawne części dla wszystkich 5 gotowych scenariuszy i wykrywa aktywny preset', () => {
    const input = makeCoupleInputs();
    const plan = calculateCasePlan(input, params);

    // classic: 32 tyg. mama + 9 tyg. tata
    const classic = buildPresetParentalParts('classic', input, plan, params);
    expect(classic).toHaveLength(2);
    expect(classic[0].parent_role).toBe('MOTHER');
    expect(classic[1].parent_role).toBe('FATHER');
    expect(detectActivePreset(classic, input, plan, params)).toBe('classic');

    // equal: 21 tyg. mama + 20 tyg. tata (41 tyg. puli)
    const equal = buildPresetParentalParts('equal', input, plan, params);
    expect(equal).toHaveLength(2);
    const equalPlan = calculateCasePlan({ ...input, parental_leave_parts: equal }, params);
    expect(equalPlan.validation_errors).toHaveLength(0);
    expect(detectActivePreset(equal, input, equalPlan, params)).toBe('equal');

    // simultaneous: obie części zaczynają się tego samego dnia
    const simultaneous = buildPresetParentalParts('simultaneous', input, plan, params);
    expect(simultaneous).toHaveLength(2);
    expect(simultaneous[0].start_date).toBe(simultaneous[1].start_date);
    const simPlan = calculateCasePlan({ ...input, parental_leave_parts: simultaneous }, params);
    expect(simPlan.validation_errors).toHaveLength(0);
    expect(detectActivePreset(simultaneous, input, simPlan, params)).toBe('simultaneous');

    // onlyMother & onlyFather
    const onlyMother = buildPresetParentalParts('onlyMother', input, plan, params);
    expect(onlyMother).toHaveLength(1);
    expect(onlyMother[0].parent_role).toBe('MOTHER');
    expect(detectActivePreset(onlyMother, input, plan, params)).toBe('onlyMother');

    const onlyFather = buildPresetParentalParts('onlyFather', input, plan, params);
    expect(onlyFather).toHaveLength(1);
    expect(onlyFather[0].parent_role).toBe('FATHER');
    expect(detectActivePreset(onlyFather, input, plan, params)).toBe('onlyFather');
  });

  it('wylicza daty powrotu do pracy, łączy ciągłe okresy i formatuje podsumowanie dla obojga rodziców', () => {
    const input = makeCoupleInputs();
    const plan = calculateCasePlan(input, params);
    const periods = getLeavePeriods(plan);
    const returnDates = computeReturnToWorkDates(periods);

    expect(returnDates.MOTHER).not.toBeNull();
    expect(returnDates.FATHER).not.toBeNull();

    const motherRanges = mergeParentLeaveRanges(periods, 'MOTHER');
    expect(motherRanges).toHaveLength(1); // macierzyński + rodzicielski łączą się w ciągły przedział

    const motherLine = formatParentLeaveSummary('MOTHER', periods, returnDates.MOTHER, 0);
    const fatherLine = formatParentLeaveSummary('FATHER', periods, returnDates.FATHER, 0);
    expect(motherLine).toContain('Mama: urlop od 10.11.2026');
    expect(motherLine).toContain('powrót do pracy');
    expect(fatherLine).toContain('Tata: urlop od');
    expect(fatherLine).toContain('powrót do pracy');
  });

  it('wylicza pozostałe tygodnie i dostępność rodziców bez wymyślania drugiego rodzica', () => {
    const singleMother = makeCoupleInputs({
      co_parenting: false,
      other_parent_insured: false,
      other_parent: undefined,
      father_parental_weeks: 0,
    });
    const plan = calculateCasePlan(singleMother, params);
    const availability = getParentAvailability(singleMother, plan);
    expect(availability.motherAvailable).toBe(true);
    expect(availability.fatherAvailable).toBe(false);

    const parts = getEditableParentalParts(singleMother, plan);
    const usage = computeParentalUsage(parts, singleMother, plan, params);
    expect(usage.motherWeeks).toBe(32);
    expect(usage.fatherWeeks).toBe(0);
    expect(usage.remainingByRole.MOTHER).toBe(0);
    expect(usage.remainingByRole.FATHER).toBe(9);
  });
});
