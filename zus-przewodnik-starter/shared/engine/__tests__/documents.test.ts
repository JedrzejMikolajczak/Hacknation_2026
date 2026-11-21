import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { WizardScenario } from '../../types';
import { getRequiredDocuments } from '../index';

function testScenario(): WizardScenario {
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
  it('assigns payer zus when employer has <= 20 insured employees and sets parental deadline 21 days before start', () => {
    const scenario = testScenario();
    const result = getRequiredDocuments(scenario, params);

    expect(result.payer).toBe('zus');
    expect(result.documents.some((d) => d.id === 'formZAM')).toBe(true);
    expect(result.documents.some((d) => d.id === 'formZ3')).toBe(true);
    expect(result.documents.some((d) => d.id === 'birthCertificateShort')).toBe(true);

    // 81.5% deadline = 2026-11-01 + 21 days = 2026-11-22
    const combinedDl = result.deadlines.find((d) => d.label.includes('81,5%'));
    expect(combinedDl?.date).toBe('2026-11-22');

    // Parental leave starts 2026-11-01 + 140 days = 2027-03-21 -> 21 days BEFORE = 2027-02-28
    const parentalDl = result.deadlines.find((d) => d.label.includes('rodzicielski'));
    expect(parentalDl?.date).toBe('2027-02-28');
  });

  it('assigns payer employer when employer or mandate payer has > 20 insured employees', () => {
    const scenario = testScenario();
    scenario.mother.employerInsuredCount = 50;
    const result = getRequiredDocuments(scenario, params);

    expect(result.payer).toBe('employer');
    expect(result.documents.some((d) => d.id === 'applicationToEmployer')).toBe(true);
    expect(result.documents.some((d) => d.id === 'formZ3')).toBe(false);

    // Mandate contract > 20 insured -> employer payer too
    scenario.mother.insuranceTitle = 'mandateContract';
    scenario.mother.sicknessInsurance = 'voluntary';
    const mandateRes = getRequiredDocuments(scenario, params);
    expect(mandateRes.payer).toBe('employer');
    expect(mandateRes.documents.some((d) => d.id === 'formZ3a')).toBe(false);
  });

  it('resolves payer independently per parent and uses params.applicationDeadlinesDays for paternity', () => {
    const scenario = testScenario();
    scenario.mother.employerInsuredCount = 50; // mother -> employer
    scenario.father = {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2025-01-01',
      insuranceEndDate: null,
      benefitBase: 7000,
      employerInsuredCount: 10, // father -> ZUS!
      age: 31,
      contributionDebt: null,
      wantsLeave: true,
    };

    const customParams = structuredClone(params);
    customParams.applicationDeadlinesDays.paternityLeave = 10;

    const result = getRequiredDocuments(scenario, customParams);
    expect(result.payer).toBe('employer');
    expect(result.documents.some((d) => d.id === 'fatherFormZ3')).toBe(true);
    const patDoc = result.documents.find((d) => d.id === 'applicationPaternity');
    expect(patDoc?.submitTo).toBe('zus');
    expect(patDoc?.note).toContain('10 dni');
  });

  it('mentions post-24.10.2026 rules (ZUR/ZAO merged into ZAM, Z-3b abolished) for JDG', () => {
    const scenario = testScenario();
    scenario.situation = 'pregnant';
    scenario.birthDate = null;
    scenario.expectedBirthDate = '2027-03-10';
    scenario.mother.insuranceTitle = 'selfEmployed';
    scenario.mother.sicknessInsurance = 'voluntary';
    scenario.mother.employerInsuredCount = null;

    const result = getRequiredDocuments(scenario, params);
    expect(result.payer).toBe('zus');
    const zam = result.documents.find((d) => d.id === 'formZAM');
    expect(zam?.note).toContain('24.10.2026');
    expect(zam?.note).toContain('Z-3b');
    expect(result.documents.some((d) => d.id === 'formZAS53')).toBe(true);
    expect(result.documents.some((d) => d.id === 'eZlaCodeB')).toBe(true);
  });

  it('routes e-ZLA to the payer without requiring a leave date and lists ZAS-12 only for continuation paid by ZUS', () => {
    const scenario = testScenario();
    scenario.situation = 'pregnant';
    scenario.birthDate = null;
    scenario.expectedBirthDate = '2027-03-10';
    scenario.mother.insuranceTitle = 'mandateContract';
    scenario.mother.sicknessInsurance = 'voluntary';

    const firstLeave = getRequiredDocuments(scenario, params);
    expect(firstLeave.documents).toContainEqual(expect.objectContaining({ id: 'eZlaCodeB', submitTo: 'zus' }));
    expect(firstLeave.documents.some((d) => d.id === 'formZAS12')).toBe(false);

    const continuation = { ...scenario, sicknessLeaveContinues: true };
    expect(getRequiredDocuments(continuation, params).documents).toContainEqual(
      expect.objectContaining({ id: 'formZAS12', submitTo: 'zus', note: expect.stringContaining('Z-3a') }),
    );

    scenario.mother.employerInsuredCount = 21;
    const largePayer = getRequiredDocuments(continuation, params);
    expect(largePayer.documents).toContainEqual(expect.objectContaining({ id: 'eZlaCodeB', submitTo: 'employer' }));
    expect(largePayer.documents.some((d) => d.id === 'formZAS12')).toBe(false);
  });

  it.each([
    { start: '2026-09-19', expected: false },
    { start: '2026-09-20', expected: true },
    { start: '2026-11-01', expected: false },
  ])('lists the expected-birth certificate for a valid prenatal start ($start)', ({ start, expected }) => {
    const scenario = testScenario();
    const { documents } = getRequiredDocuments({ ...scenario, maternityLeaveStartDate: start }, params);
    expect(documents.some((d) => d.id === 'expectedBirthCertificate' && d.submitTo === 'zus')).toBe(expected);
  });

  it('includes Za Zyciem certificate and court order for adoption, and omits parental deadlines on stillbirth', () => {
    const zaZyciem = testScenario();
    zaZyciem.special.zaZyciemCertificate = true;
    expect(
      getRequiredDocuments(zaZyciem, params).documents.some((d) => d.id === 'certificateZaZyciem'),
    ).toBe(true);

    const adoption = testScenario();
    adoption.situation = 'adoption';
    adoption.childAcceptanceDate = '2026-11-15';
    adoption.adoptionType = 'adoption';
    expect(
      getRequiredDocuments(adoption, params).documents.some((d) => d.id === 'adoptionCourtOrder'),
    ).toBe(true);

    const stillbirth = testScenario();
    stillbirth.special.stillbirth = true;
    const stillRes = getRequiredDocuments(stillbirth, params);
    expect(stillRes.deadlines).toHaveLength(0);
    expect(stillRes.documents.find((d) => d.id === 'stillbirthCertificate')?.name).toContain('martwym urodzeniu');
    expect(stillRes.documents.some((d) => d.id === 'birthCertificateShort')).toBe(false);
  });
});
