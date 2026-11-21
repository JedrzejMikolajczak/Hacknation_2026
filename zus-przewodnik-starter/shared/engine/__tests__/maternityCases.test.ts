import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { ScenarioInput } from '../../types';
import { calculateMaternity } from '../index';

function testScenario(): ScenarioInput {
  return {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: null,
    birthDate: '2026-11-01',
    childrenCount: 1,
    adoptionType: null,
    childAcceptanceDate: null,
    childAgeYears: null,
    schoolObligationDeferred: false,
    rateVariant: 'standard',
    mother: {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2025-01-01',
      insuranceEndDate: null,
      benefitBase: 6000,
      employerInsuredCount: 25,
      age: 30,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2025-01-01',
      insuranceEndDate: null,
      benefitBase: 8000,
      employerInsuredCount: 25,
      age: 32,
      contributionDebt: null,
      wantsLeave: true,
    },
    special: {
      zaZyciemCertificate: false,
      pregnancyWeekAtBirth: null,
      birthWeightGrams: null,
      hospitalizationDays: null,
      stillbirth: false,
      childDeathDate: null,
      motherHospitalized: false,
      motherIncapableOfIndependentLiving: false,
      motherDeceased: false,
      employerBankruptcyOrLiquidation: false,
    },
  };
}

describe('maternity leave extended scenarios', () => {
  it('calculates adoption leave with minimum 9 weeks and adoptionMaternityLeave type', () => {
    const input = testScenario();
    input.situation = 'adoption';
    input.childAcceptanceDate = '2026-11-15';
    input.adoptionType = 'adoption';

    const result = calculateMaternity(input, params);
    expect(result.periods[0].leaveType).toBe('adoptionMaternityLeave');
    expect(result.periods[0].weeks).toBe(20);
    expect(result.periods[0].startDate).toBe('2026-11-15');
  });

  it('calculates supplementary maternity leave for premature birth with hospitalization', () => {
    const input = testScenario();
    input.special.pregnancyWeekAtBirth = 27; // < 28 tc -> max 15 weeks
    input.special.hospitalizationDays = 28;  // 4 weeks of hospitalization

    const result = calculateMaternity(input, params);
    const suppPeriod = result.periods.find((p) => p.leaveType === 'supplementaryMaternityLeave');
    expect(suppPeriod).toBeDefined();
    expect(suppPeriod?.weeks).toBe(4);
    expect(suppPeriod?.rate).toBe(1.0);
  });

  it('limits maternity leave to 8 weeks in case of stillbirth', () => {
    const input = testScenario();
    input.special.stillbirth = true;

    const result = calculateMaternity(input, params);
    expect(result.periods[0].weeks).toBe(8);
    // Parental leave should not be granted
    expect(result.periods.some((p) => p.leaveType === 'parentalLeave')).toBe(false);
  });

  it('provides variants comparison for standard vs combined rates', () => {
    const input = testScenario();
    const result = calculateMaternity(input, params);

    expect(result.variants).not.toBeNull();
    expect(result.variants?.standard).toBeGreaterThan(0);
    expect(result.variants?.combined).toBeGreaterThan(0);
  });
});
