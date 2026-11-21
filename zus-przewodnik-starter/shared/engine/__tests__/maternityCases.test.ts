import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { BenefitBaseInput, ParentData, WizardScenario } from '../../types';
import {
  calculateBenefitBase,
  calculateMaternity,
  calculateSicknessInPregnancy,
  checkEligibility,
} from '../index';

function testScenario(): WizardScenario & { mother: ParentData } {
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
  it('calculates combined 81.5% without combinedApplicationDate and adds assumption explanation', () => {
    const input = testScenario();
    input.rateVariant = 'combined';

    const result = calculateMaternity(input, params);
    expect(result.periods.map((p) => p.rate)).toEqual([0.815, 0.815, 0.7, 1]);
    expect(result.explanations.some((e) => e.message.includes('21 dni'))).toBe(true);
  });

  it('handles stillbirth: 8 weeks at 100%, no parental/paternity/supplementary leave, no variants', () => {
    const input = testScenario();
    input.rateVariant = 'combined';
    input.special.stillbirth = true;

    const result = calculateMaternity(input, params);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].weeks).toBe(8);
    expect(result.periods[0].days).toBe(56);
    expect(result.periods[0].rate).toBe(1);
    expect(result.variants).toBeNull();
    expect(result.periods.some((p) => p.leaveType === 'parentalLeave')).toBe(false);
    expect(result.periods.some((p) => p.leaveType === 'paternityLeave')).toBe(false);
  });

  it('handles child death before 8 weeks (day 10 -> 56 days; day 52 -> 60 days = 7 days after death)', () => {
    const day10 = testScenario();
    day10.special.childDeathDate = '2026-11-11';
    const res10 = calculateMaternity(day10, params);
    expect(res10.periods).toHaveLength(1);
    expect(res10.periods[0].days).toBe(56);
    expect(res10.periods[0].endDate).toBe('2026-12-26');
    expect(res10.periods.some((p) => p.leaveType === 'parentalLeave')).toBe(false);

    const day52 = testScenario();
    day52.special.childDeathDate = '2026-12-23';
    const res52 = calculateMaternity(day52, params);
    expect(res52.periods).toHaveLength(1);
    expect(res52.periods[0].days).toBe(60);
    expect(res52.periods[0].endDate).toBe('2026-12-30');
  });

  it('handles child death after 8 weeks (7 days from death) and multiple birth surviving children', () => {
    const after8 = testScenario();
    after8.special.childDeathDate = '2027-01-10'; // 70 days after 2026-11-01
    const resAfter8 = calculateMaternity(after8, params);
    expect(resAfter8.periods).toHaveLength(1);
    expect(resAfter8.periods[0].endDate).toBe('2027-01-17');
    expect(resAfter8.periods[0].days).toBe(78);

    const twinsOneDied = testScenario();
    twinsOneDied.childrenCount = 2;
    twinsOneDied.special.childDeathDate = '2026-11-11';
    const resTwins = calculateMaternity(twinsOneDied, params);
    expect(resTwins.periods[0].weeks).toBe(20); // length for 1 surviving child
    expect(resTwins.periods.some((p) => p.leaveType === 'parentalLeave')).toBe(true);
  });

  it('handles father takeover when mother is hospitalized, incapable, deceased, or resigns after 14 weeks', () => {
    // Hospitalized with explicit duration
    const hosp = testScenario();
    hosp.special.motherHospitalized = true;
    const resHosp = calculateMaternity({ ...hosp, motherHospitalizationWeeks: 4 }, params);
    const fatherMatHosp = resHosp.periods.find(
      (p) => p.leaveType === 'maternityLeave' && p.parentRole === 'father',
    );
    expect(fatherMatHosp?.weeks).toBe(4);

    // Incapable of independent living -> takeover after 8 weeks
    const incap = testScenario();
    incap.special.motherIncapableOfIndependentLiving = true;
    const resIncap = calculateMaternity(incap, params);
    const motherMatIncap = resIncap.periods.find(
      (p) => p.leaveType === 'maternityLeave' && p.parentRole === 'mother',
    );
    const fatherMatIncap = resIncap.periods.find(
      (p) => p.leaveType === 'maternityLeave' && p.parentRole === 'father',
    );
    expect(motherMatIncap?.weeks).toBe(8);
    expect(fatherMatIncap?.weeks).toBe(12);

    // Mother deceased -> father takes full 20 weeks maternity + 32 parental + 2 paternity
    const dec = testScenario();
    dec.special.motherDeceased = true;
    const resDec = calculateMaternity(dec, params);
    expect(resDec.periods.every((p) => p.parentRole === 'father')).toBe(true);
    expect(resDec.periods.find((p) => p.leaveType === 'maternityLeave')?.weeks).toBe(20);
    expect(resDec.periods.find((p) => p.leaveType === 'parentalLeave')?.weeks).toBe(32);

    // Normal resignation by mother -> mandatory 14 weeks mother + 6 weeks father
    const resign = testScenario();
    resign.mother.wantsLeave = false;
    const resResign = calculateMaternity(resign, params);
    expect(
      resResign.periods.find((p) => p.leaveType === 'maternityLeave' && p.parentRole === 'mother')
        ?.weeks,
    ).toBe(14);
    expect(
      resResign.periods.find((p) => p.leaveType === 'maternityLeave' && p.parentRole === 'father')
        ?.weeks,
    ).toBe(6);
  });

  it('grants father parental and paternity leave when mother is uninsured on birth date', () => {
    const input = testScenario();
    input.mother.insuranceTitle = 'none';
    input.mother.sicknessInsurance = 'none';
    input.mother.benefitBase = null;

    const elig = checkEligibility(input, params);
    expect(elig.entitlements.find((e) => e.parentRole === 'mother')?.entitled).toBe(false);
    expect(elig.entitlements.find((e) => e.parentRole === 'father')?.entitled).toBe(true);

    const result = calculateMaternity(input, params);
    expect(result.periods.find((p) => p.leaveType === 'parentalLeave')?.parentRole).toBe('father');
    expect(result.periods.find((p) => p.leaveType === 'parentalLeave')?.weeks).toBe(32);
    expect(result.periods.find((p) => p.leaveType === 'paternityLeave')?.weeks).toBe(2);
  });

  it('uses params.supplementaryMaternityLeave.cases without hardcoding and includes it in variants', () => {
    const extremePreterm = testScenario();
    extremePreterm.special.pregnancyWeekAtBirth = 27;
    extremePreterm.special.birthWeightGrams = 950;
    extremePreterm.special.hospitalizationDays = 140; // capped at 15 weeks
    const res15 = calculateMaternity(extremePreterm, params);
    expect(res15.periods.find((p) => p.leaveType === 'supplementaryMaternityLeave')?.weeks).toBe(
      15,
    );

    // Custom params override proves no hardcoded numbers
    const customParams = structuredClone(params);
    customParams.supplementaryMaternityLeave.cases.forEach((c) => {
      c.limitWeekAfterBirth = 12;
    });
    const resCustom = calculateMaternity(extremePreterm, customParams);
    expect(
      resCustom.periods.find((p) => p.leaveType === 'supplementaryMaternityLeave')?.weeks,
    ).toBe(12);

    // Full term >= 37 weeks, >= 2 days hospitalization -> case 5 (max 8 weeks)
    const fullTerm = testScenario();
    fullTerm.special.pregnancyWeekAtBirth = 39;
    fullTerm.special.birthWeightGrams = 3300;
    fullTerm.special.hospitalizationDays = 10;
    const resFull = calculateMaternity(fullTerm, params);
    const supp = resFull.periods.find((p) => p.leaveType === 'supplementaryMaternityLeave');
    expect(supp?.weeks).toBe(2);
    expect(supp?.rate).toBe(1);
    expect(resFull.variants?.standard).toBe(resFull.totalAmount);
  });

  it('explains non-transferable 9 weeks for a single parent without silently losing them', () => {
    const input = testScenario();
    input.father = null;

    const result = calculateMaternity(input, params);
    expect(result.periods.find((p) => p.leaveType === 'parentalLeave')?.weeks).toBe(32);
    expect(
      result.explanations.some(
        (e) => e.message.includes('9 tygodni') && e.message.includes('nieprzenoszalną'),
      ),
    ).toBe(true);
  });

  it('enforces adoption and foster family age limits, deferred schooling, min 9 weeks, and paternity rules', () => {
    // Adoption of 5-year-old -> entitled + paternity
    const adopt5 = testScenario();
    adopt5.situation = 'adoption';
    adopt5.adoptionType = 'adoption';
    adopt5.childAcceptanceDate = '2026-11-15';
    adopt5.childAgeYears = 5;
    const resAdopt5 = calculateMaternity(adopt5, params);
    expect(resAdopt5.periods[0].leaveType).toBe('adoptionMaternityLeave');
    expect(resAdopt5.periods[0].weeks).toBe(20);
    expect(resAdopt5.periods.some((p) => p.leaveType === 'paternityLeave')).toBe(true);

    // Adoption of 14-year-old -> over age limit, not entitled
    const adopt14 = { ...adopt5, childAgeYears: 14 };
    expect(checkEligibility(adopt14, params).entitlements[0].entitled).toBe(false);
    expect(calculateMaternity(adopt14, params).periods).toHaveLength(0);

    // Foster family age 8 without deferred school -> over 7 limit, not entitled
    const foster8 = { ...adopt5, adoptionType: 'fosterFamily' as const, childAgeYears: 8 };
    expect(checkEligibility(foster8, params).entitlements[0].entitled).toBe(false);
    expect(calculateMaternity(foster8, params).periods).toHaveLength(0);

    // Foster family age 8 WITH deferred school -> under 10 limit, entitled, NO paternity leave
    const foster8Def = { ...foster8, schoolObligationDeferred: true };
    const resFoster = calculateMaternity(foster8Def, params);
    expect(resFoster.periods[0].leaveType).toBe('adoptionMaternityLeave');
    expect(resFoster.periods[0].weeks).toBe(20);
    expect(resFoster.periods.some((p) => p.leaveType === 'paternityLeave')).toBe(false);
  });

  it('handles pregnancy sickness, rehabilitation, maternity-equivalent benefit, and all risk warnings', () => {
    const pregnant = testScenario();
    pregnant.situation = 'pregnant';
    pregnant.birthDate = null;
    pregnant.expectedBirthDate = '2027-03-10';
    pregnant.mother.insuredSince = '2026-11-10'; // 11 days before referenceDate 2026-11-21 (< 30)
    pregnant.mother.insuranceEndDate = '2027-01-31'; // ends before birth
    pregnant.mother.age = 52; // > 50 -> 14 days employer sick pay
    pregnant.special.employerBankruptcyOrLiquidation = true;

    const elig = checkEligibility(
      { ...pregnant, shamContractRiskHint: true, baseIncreasedInPregnancy: true },
      params,
    );
    const codes = elig.warnings.map((w) => w.code);
    expect(codes).toContain('CONTRACT_ENDS_BEFORE_BIRTH');
    expect(codes).toContain('WAITING_PERIOD_NOT_MET');
    expect(codes).toContain('SHAM_CONTRACT_RISK');
    expect(codes).toContain('BASE_INCREASE_IN_PREGNANCY');

    expect(elig.entitlements.some((e) => e.benefit === 'sicknessBenefit')).toBe(true);
    expect(elig.entitlements.some((e) => e.benefit === 'rehabilitationBenefit')).toBe(true);
    expect(
      elig.entitlements.find((e) => e.benefit === 'maternityEquivalentBenefit')?.entitled,
    ).toBe(true);

    // Sickness without extra fields derives age 52 -> 14 days once waiting met
    pregnant.mother.insuredSince = '2025-01-01';
    const sick = calculateSicknessInPregnancy(pregnant, params);
    expect(sick.entitled).toBe(true);
    expect(sick.employerSickPayDays).toBe(14);
    expect(sick.sicknessBenefitMaxDays).toBe(270);
    expect(sick.rate).toBe(1);
    expect(sick.dailyAmount).toBe(200);
    expect(sick.explanations.some((e) => e.message.includes('rehabilitacyjne'))).toBe(true);

    // Uninsured mother -> entitled: false (no 422 crash)
    pregnant.mother.insuranceTitle = 'none';
    pregnant.mother.sicknessInsurance = 'none';
    const sickNone = calculateSicknessInPregnancy(pregnant, params);
    expect(sickNone.entitled).toBe(false);
    expect(sickNone.dailyAmount).toBeNull();
  });

  it('calculates benefit base from wizard BenefitBaseInput without optional extra fields', () => {
    // 1. Employment with average gross, no employmentFraction and no insuredSince
    const empInput: BenefitBaseInput = {
      insuranceTitle: 'employment',
      rightArisesOn: '2027-03-10',
      incomes: [
        { month: '2027-01', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
        { month: '2027-02', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
      ],
      contractMonthlySalary: null,
      declaredContributionBase: null,
      previousBenefitEndDate: null,
      previousBenefitBase: null,
    };
    const empRes = calculateBenefitBase(empInput, params);
    expect(empRes.benefitBase).toBe(5177.4);

    // 2. Employment with no full month -> contractMonthlySalary
    const firstMonthInput: BenefitBaseInput = {
      ...empInput,
      incomes: [],
      contractMonthlySalary: 7000,
    };
    expect(calculateBenefitBase(firstMonthInput, params).benefitBase).toBe(6040.3);

    // 3. Self-employed (JDG) with declaredContributionBase and empty incomes + cap check
    const jdgInput: BenefitBaseInput = {
      insuranceTitle: 'selfEmployed',
      rightArisesOn: '2027-03-10',
      incomes: [],
      contractMonthlySalary: null,
      declaredContributionBase: 30000,
      previousBenefitEndDate: null,
      previousBenefitBase: null,
    };
    const jdgRes = calculateBenefitBase(jdgInput, params);
    expect(jdgRes.appliedMaximum).toBe(true);
    expect(jdgRes.benefitBase).toBe(params.benefitBase.maxBaseNonEmployee);

    // 4. Continuity from sickness benefit to maternity benefit
    const continuityInput: BenefitBaseInput = {
      ...empInput,
      previousBenefitEndDate: '2027-03-09',
      previousBenefitBase: 5500,
    };
    expect(calculateBenefitBase(continuityInput, params).benefitBase).toBe(5500);
  });

  it('supports single father without mother data (mother: null), abandonment, court judgment, dual titles, and multiple-birth deceased count', () => {
    // 1. Samotny ojciec bez danych matki (mother: null)
    const singleFather: WizardScenario = { ...testScenario(), mother: null };
    const singleFatherElig = checkEligibility(singleFather, params);
    expect(singleFatherElig.entitlements).toHaveLength(1);
    expect(singleFatherElig.entitlements[0]).toMatchObject({
      parentRole: 'father',
      entitled: true,
    });
    const singleFatherMat = calculateMaternity(singleFather, params);
    expect(singleFatherMat.periods.map((p) => p.leaveType)).toEqual([
      'parentalLeave',
      'paternityLeave',
    ]);
    expect(calculateSicknessInPregnancy(singleFather, params).entitled).toBe(false);

    // 2. Porzucenie dziecka przez matkę w kontrakcie SpecialCircumstances
    const abandoned = testScenario();
    abandoned.special.motherAbandonedChild = true;
    const abandonedMat = calculateMaternity(abandoned, params);
    expect(
      abandonedMat.periods.some((p) => p.parentRole === 'father' && p.leaveType === 'maternityLeave'),
    ).toBe(true);

    // 3. Bezprawne zwolnienie potwierdzone wyrokiem w SpecialCircumstances + dwa tytuły naraz
    const unlawful = testScenario();
    unlawful.special.unlawfulTerminationConfirmedByCourt = true;
    unlawful.mother!.secondaryInsuranceTitle = 'selfEmployed';
    unlawful.mother!.secondarySicknessInsurance = 'voluntary';
    const unlawfulElig = checkEligibility(unlawful, params);
    expect(
      unlawfulElig.entitlements.find((e) => e.benefit === 'maternityEquivalentBenefit')?.entitled,
    ).toBe(true);
    expect(
      unlawfulElig.entitlements.find((e) => e.benefit === 'maternityBenefit' && e.parentRole === 'mother')
        ?.reason.message,
    ).toContain('drugi równoległy tytuł');

    // 4. Liczba zmarłych dzieci przy porodzie mnogim (trojaczki, 2 zmarłe -> 1 żywe -> 20 tyg. macierzyńskiego)
    const multipleLoss = testScenario();
    multipleLoss.childrenCount = 3;
    multipleLoss.special.childDeathDate = '2026-11-25';
    multipleLoss.special.deceasedChildrenCount = 2;
    const multipleLossMat = calculateMaternity(multipleLoss, params);
    expect(multipleLossMat.periods.find((p) => p.leaveType === 'maternityLeave')?.weeks).toBe(20);
  });
});
