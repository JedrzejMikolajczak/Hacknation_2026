import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { ScenarioInput } from '../../types';
import { getRequiredDocuments } from '../index';

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
    rateVariant: 'combined',
    mother: {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2025-01-01',
      insuranceEndDate: null,
      benefitBase: 6000,
      employerInsuredCount: 15, // <= 20 -> payer is ZUS
      age: 28,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: null,
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

describe('documents checklist', () => {
  it('assigns payer zus when employer has <= 20 insured employees', () => {
    const scenario = testScenario();
    const result = getRequiredDocuments(scenario, params);

    expect(result.payer).toBe('zus');
    expect(result.documents.some((d) => d.id === 'formZAM')).toBe(true);
    expect(result.documents.some((d) => d.id === 'formZ3')).toBe(true);
    expect(result.documents.some((d) => d.id === 'birthCertificateShort')).toBe(true);
    expect(result.deadlines.length).toBeGreaterThan(0);
  });

  it('assigns payer employer when employer has > 20 insured employees', () => {
    const scenario = testScenario();
    scenario.mother.employerInsuredCount = 50;
    const result = getRequiredDocuments(scenario, params);

    expect(result.payer).toBe('employer');
    expect(result.documents.some((d) => d.id === 'applicationToEmployer')).toBe(true);
    expect(result.documents.some((d) => d.id === 'formZ3')).toBe(false);
  });

  it('includes Za Zyciem certificate when applicable', () => {
    const scenario = testScenario();
    scenario.special.zaZyciemCertificate = true;
    const result = getRequiredDocuments(scenario, params);

    expect(result.documents.some((d) => d.id === 'certificateZaZyciem')).toBe(true);
  });

  it('includes court order for adoption situation', () => {
    const scenario = testScenario();
    scenario.situation = 'adoption';
    scenario.childAcceptanceDate = '2026-11-15';
    scenario.adoptionType = 'adoption';
    const result = getRequiredDocuments(scenario, params);

    expect(result.documents.some((d) => d.id === 'adoptionCourtOrder')).toBe(true);
  });
});
