import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { ScenarioInput } from '../../types';
import { CalculationError, calculateParentalLeaveWithWork, planParentalSplit } from '../index';

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
  it('allows valid split between mother and father within pool (including simultaneous use)', () => {
    const scenario = testScenario();
    const result = planParentalSplit(
      {
        scenario,
        parts: [
          { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 32 },
          { parentRole: 'father', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 9 },
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
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-03-22',
        weeks: 5,
      },
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-04-26',
        weeks: 5,
      },
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-05-31',
        weeks: 5,
      },
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-07-05',
        weeks: 5,
      },
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-08-09',
        weeks: 5,
      },
      {
        parentRole: 'mother' as const,
        leaveType: 'parentalLeave' as const,
        startDate: '2027-09-13',
        weeks: 5,
      },
    ];

    const result = planParentalSplit({ scenario, parts }, params);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes('przekracza maksymalną dopuszczalną liczbę')),
    ).toBe(true);
  });

  it('protects 9 non-transferable weeks for the second parent', () => {
    const scenario = testScenario();
    const result = planParentalSplit(
      {
        scenario,
        parts: [
          { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 35 },
        ],
      },
      params,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('9 tygodni jest nieprzenoszalne'))).toBe(
      true,
    );
  });

  it('rejects parental leave parts extending past the end of calendar year when child turns 6', () => {
    const scenario = testScenario(); // born 2026-11-01 -> deadline 2032-12-31
    const result = planParentalSplit(
      {
        scenario,
        parts: [
          { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2032-12-20', weeks: 4 },
        ],
      },
      params,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('2032-12-31'))).toBe(true);
  });

  it('calculates parental leave extended with part-time work without rounding rate (0.815 * 0.5 = 0.4075)', () => {
    const scenario = testScenario();
    const stdResult = calculateParentalLeaveWithWork(
      {
        scenario,
        parentRole: 'mother',
        workTimeFraction: 0.5,
        startDate: '2027-03-22',
        weeks: 10,
      },
      params,
    );

    expect(stdResult.extendedWeeks).toBe(5);
    expect(stdResult.extendedDays).toBe(35);
    expect(stdResult.periods).toHaveLength(2);
    expect(stdResult.periods[0].rate).toBe(0.35);
    expect(stdResult.periods[1].rate).toBe(0.7);

    // Combined 81.5% at 0.5 work -> rate MUST stay exact 0.4075, NOT 0.41!
    const combinedScenario = { ...testScenario(), rateVariant: 'combined' as const };
    const combResult = calculateParentalLeaveWithWork(
      {
        scenario: combinedScenario,
        parentRole: 'mother',
        workTimeFraction: 0.5,
        startDate: '2027-03-22',
        weeks: 10,
      },
      params,
    );

    expect(combResult.periods[0].rate).toBeCloseTo(0.4075, 6);
    expect(combResult.periods[0].monthlyAmount).toBe(2445); // 6000 * 0.4075 = 2445.00 (not 2460!)
    expect(combResult.periods[1].rate).toBe(0.815);
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
