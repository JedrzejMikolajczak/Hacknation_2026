import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { ScenarioInput } from '../../types';
import { calculateParentalLeaveWithWork, planParentalSplit, CalculationError } from '../index';

function testScenario(): ScenarioInput {
  const mother = {
    role: 'mother' as const,
    insuranceTitle: 'employment' as const,
    sicknessInsurance: 'mandatory' as const,
    insuredSince: '2025-01-01',
    insuranceEndDate: null,
    benefitBase: 6000,
    employerInsuredCount: 25,
    age: 30,
    contributionDebt: null,
    wantsLeave: true,
  };

  const father = {
    ...mother,
    role: 'father' as const,
    benefitBase: 8000,
  };

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
    mother,
    father,
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

describe('parental leave rules', () => {
  it('allows valid split between mother and father within pool', () => {
    const scenario = testScenario();
    const result = planParentalSplit(
      {
        scenario,
        parts: [
          { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 32 },
          { parentRole: 'father', leaveType: 'parentalLeave', startDate: '2027-11-02', weeks: 9 },
        ],
      },
      params,
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.periods).toHaveLength(2);
    expect(result.remainingWeeks).toEqual({ mother: 0, father: 0 });
    expect(result.periods[0].rate).toBe(0.7);
    expect(result.periods[1].rate).toBe(0.7);
  });

  it('rejects more than 5 parts', () => {
    const scenario = testScenario();
    const parts = [
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-03-22', weeks: 5 },
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-04-26', weeks: 5 },
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-05-31', weeks: 5 },
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-07-05', weeks: 5 },
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-08-09', weeks: 5 },
      { parentRole: 'mother' as const, leaveType: 'parentalLeave' as const, startDate: '2027-09-13', weeks: 5 },
    ];

    const result = planParentalSplit({ scenario, parts }, params);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('przekracza maksymalną dopuszczalną liczbę'))).toBe(true);
  });

  it('protects 9 non-transferable weeks for the second parent', () => {
    const scenario = testScenario();
    // Mother attempts to take 35 weeks (max allowed for single parent is 41 - 9 = 32 weeks)
    const result = planParentalSplit(
      {
        scenario,
        parts: [{ parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 35 }],
      },
      params,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('9 tygodni jest nieprzenoszalne'))).toBe(true);
  });

  it('calculates parental leave extended with part-time work (art. 182¹f KP)', () => {
    const scenario = testScenario();
    const result = calculateParentalLeaveWithWork(
      {
        scenario,
        parentRole: 'mother',
        workTimeFraction: 0.5,
        startDate: '2027-03-22',
        weeks: 10,
      },
      params,
    );

    expect(result.extendedWeeks).toBe(5);
    expect(result.extendedDays).toBe(35);
    expect(result.periods).toHaveLength(2);

    // Worked period has reduced benefit rate (0.7 * (1 - 0.5) = 0.35)
    expect(result.periods[0].weeks).toBe(10);
    expect(result.periods[0].rate).toBe(0.35);

    // Extended period has full benefit rate (0.7)
    expect(result.periods[1].weeks).toBe(5);
    expect(result.periods[1].rate).toBe(0.7);
  });

  it('throws CalculationError when workTimeFraction exceeds 0.5', () => {
    const scenario = testScenario();
    expect(() =>
      calculateParentalLeaveWithWork(
        {
          scenario,
          parentRole: 'mother',
          workTimeFraction: 0.75,
          startDate: '2027-03-22',
          weeks: 10,
        },
        params,
      ),
    ).toThrow(CalculationError);
  });
});
