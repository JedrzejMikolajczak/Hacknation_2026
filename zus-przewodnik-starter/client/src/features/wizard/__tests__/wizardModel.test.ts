import { describe, expect, it } from 'vitest';
import type { BenefitParams } from '@shared/types';
import paramsJson from '@shared/params.json';
import { buildScenario, changeAnswer, getQuestions, todayLocal, validateAnswer } from '../wizardModel';
import { addDaysIso } from '../../plan/planScenario';

const ids = (...args: Parameters<typeof getQuestions>) =>
  getQuestions(...args).map((question) => question.id);

describe('conditional family paths', () => {
  it.each(['planning', 'pregnant'] as const)('%s only asks prebirth questions', (situation) => {
    const ids = getQuestions(situation, { family: 'both', hospitalization: 'yes' }).map(
      (question) => question.id,
    );
    expect(ids).toContain('expectedBirthDate');
    for (const id of [
      'birthDate',
      'birthOutcome',
      'childDeathDate',
      'hospitalization',
      'pregnancyWeekAtBirth',
      'birthWeightGrams',
      'hospitalizationDays',
    ])
      expect(ids).not.toContain(id);
    // „Za życiem” wydaje się także w ciąży; przy planowaniu jeszcze nie dotyczy
    if (situation === 'pregnant') expect(ids).toContain('zaZyciemCertificate');
    else expect(ids).not.toContain('zaZyciemCertificate');
  });

  it('asks hospitalization details only when the answer is yes and clears them when changed', () => {
    const answers = {
      family: 'fatherOnly',
      hospitalization: 'yes',
      birthWeightGrams: '2000',
      pregnancyWeekAtBirth: '35',
      hospitalizationDays: '12',
    };
    expect(getQuestions('afterBirth', answers).map((question) => question.id)).toContain(
      'birthWeightGrams',
    );
    const changed = changeAnswer('afterBirth', answers, 'hospitalization', 'no');
    expect(changed).not.toHaveProperty('birthWeightGrams');
    expect(changed).not.toHaveProperty('hospitalizationDays');
    expect(buildScenario('afterBirth', changed).special?.hospitalizationDays).toBe(0);
  });

  it('changes adoption questions for planned and actual acceptance and clears the old date', () => {
    const answers = { adoptionStage: 'accepted', childAcceptanceDate: '2025-01-01' };
    const changed = changeAnswer('adoption', answers, 'adoptionStage', 'planned');
    expect(changed).not.toHaveProperty('childAcceptanceDate');
    const planned = getQuestions('adoption', changed).find(
      (question) => question.id === 'childAcceptanceDate',
    )!;
    const actual = getQuestions('adoption', answers).find(
      (question) => question.id === 'childAcceptanceDate',
    )!;
    expect(planned.unknownLabel).toBeTruthy();
    expect(actual.unknownLabel).toBeUndefined();
    expect(validateAnswer(planned, 'unknown')).toBeNull();
    expect(validateAnswer(actual, '2099-01-01')).toBeTruthy();
  });

  it('clears obsolete insurance answers and never converts an unknown to no insurance', () => {
    const changed = changeAnswer(
      'pregnant',
      {
        family: 'both',
        'mother.insuranceTitle': 'employment',
        'mother.insuredSince': '2020-01-01',
        'mother.benefitBase': '6000',
      },
      'mother.insuranceTitle',
      'unknown',
    );
    expect(changed).not.toHaveProperty('mother.insuredSince');
    const draft = buildScenario('pregnant', changed);
    expect(draft.mother).not.toHaveProperty('insuranceTitle');
    expect(draft.mother?.benefitBase).toBeNull();
  });

  it('rejects invalid dates, fractional counts and negative amounts', () => {
    const questions = getQuestions('afterBirth', {
      family: 'motherOnly',
      'mother.insuranceTitle': 'employment',
    });
    const birth = questions.find((question) => question.id === 'birthDate')!;
    const count = questions.find((question) => question.id === 'childrenCount')!;
    const amount = questions.find((question) => question.id === 'mother.benefitBase')!;
    expect(validateAnswer(birth, '2026-02-30')).toBeTruthy();
    expect(validateAnswer(count, '1.5')).toBeTruthy();
    expect(validateAnswer(amount, '-100')).toBeTruthy();
    expect(validateAnswer(amount, 'unknown')).toBeNull();
  });

  it('asks for the child death date and skips birth details after a loss', () => {
    const base = { family: 'motherOnly', birthDate: '2026-03-01' };
    const death = ids('afterBirth', { ...base, birthOutcome: 'childDeath' });
    expect(death).toContain('childDeathDate');
    for (const id of ['hospitalization', 'zaZyciemCertificate', 'rateVariant'])
      expect(death).not.toContain(id);
    const draft = buildScenario('afterBirth', {
      ...base,
      childrenCount: '1',
      birthOutcome: 'childDeath',
      childDeathDate: '2026-03-20',
    });
    expect(draft.special).toEqual({ stillbirth: false, childDeathDate: '2026-03-20' });
    expect(ids('afterBirth', { ...base, birthOutcome: 'none' })).toContain('hospitalization');
  });

  it('asks about the mother only when the father is in the plan', () => {
    expect(ids('afterBirth', { family: 'motherOnly' })).not.toContain('motherSituation');
    const pregnant = getQuestions('pregnant', { family: 'both' }).find(
      (question) => question.id === 'motherSituation',
    )!;
    expect(pregnant.options?.map((option) => option.value)).not.toContain('deceased');
    const after = getQuestions('afterBirth', { family: 'fatherOnly' }).find(
      (question) => question.id === 'motherSituation',
    )!;
    expect(after.options?.map((option) => option.value)).toContain('deceased');
    expect(
      buildScenario('afterBirth', { family: 'both', motherSituation: 'incapable' }).special,
    ).toMatchObject({
      motherHospitalized: false,
      motherIncapableOfIndependentLiving: true,
      motherDeceased: false,
    });
  });

  it('asks payer size for employment and mandate contracts, age and bankruptcy only for an employed mother', () => {
    const employed = ids('pregnant', {
      family: 'both',
      'mother.insuranceTitle': 'employment',
      'father.insuranceTitle': 'mandateContract',
    });
    expect(employed).toEqual(
      expect.arrayContaining([
        'mother.employerInsuredCount',
        'father.employerInsuredCount',
        'mother.age',
        'employerBankruptcyOrLiquidation',
      ]),
    );
    expect(employed).not.toContain('father.age');
    const selfEmployed = ids('pregnant', {
      family: 'motherOnly',
      'mother.insuranceTitle': 'selfEmployed',
    });
    for (const id of [
      'mother.employerInsuredCount',
      'mother.age',
      'employerBankruptcyOrLiquidation',
    ])
      expect(selfEmployed).not.toContain(id);
    const draft = buildScenario('pregnant', {
      family: 'motherOnly',
      'mother.insuranceTitle': 'employment',
      'mother.employerInsuredCount': '12',
      'mother.age': 'unknown',
      employerBankruptcyOrLiquidation: 'unknown',
    });
    expect(draft.mother).toMatchObject({ employerInsuredCount: 12, age: null });
    expect(draft.special).not.toHaveProperty('employerBankruptcyOrLiquidation');
  });

  it('accepts hospital and incapacity together and drops obsolete answers after maternal death', () => {
    const answers = {
      family: 'both',
      motherSituation: 'hospitalized,incapable',
      'mother.insuranceTitle': 'employment',
      'mother.wantsLeave': 'yes',
      rateVariant: 'combined',
    };
    const situation = getQuestions('afterBirth', answers).find((item) => item.id === 'motherSituation')!;
    expect(validateAnswer(situation, answers.motherSituation)).toBeNull();
    expect(validateAnswer(situation, 'deceased,hospitalized')).not.toBeNull();
    expect(buildScenario('afterBirth', answers).special).toMatchObject({
      motherHospitalized: true,
      motherIncapableOfIndependentLiving: true,
    });
    const changed = changeAnswer('afterBirth', answers, 'motherSituation', 'deceased');
    expect(changed).toEqual({ family: 'both', motherSituation: 'deceased' });
    expect(ids('afterBirth', changed)).toContain('father.wantsLeave');
    expect(buildScenario('afterBirth', changed).mother).toBeNull();
  });

  it('offers the combined rate until the last day and replaces a stale choice on day 22', () => {
    const deadline = (paramsJson as BenefitParams).combinedRateApplicationDeadlineDays;
    const onTime = { family: 'motherOnly', birthDate: addDaysIso(todayLocal(), -deadline), rateVariant: 'combined' };
    const late = changeAnswer('afterBirth', onTime, 'birthDate', addDaysIso(onTime.birthDate, -1));
    expect(buildScenario('afterBirth', onTime).rateVariant).toBe('combined');
    expect(late.rateVariant).toBe('standard');
    const rate = getQuestions('afterBirth', late).find((item) => item.id === 'rateVariant')!;
    expect(validateAnswer(rate, 'combined')).not.toBeNull();
    expect(buildScenario('afterBirth', { ...late, rateVariant: 'combined' }).rateVariant).toBe('standard');
  });

  it('builds benefit base input from earnings only when the base is unknown', () => {
    const answers = {
      family: 'motherOnly',
      expectedBirthDate: '2027-02-10',
      'mother.insuranceTitle': 'employment',
      'mother.insuredSince': '2026-09-15',
      'mother.benefitBase': 'unknown',
      'mother.averageGross': '7000',
    };
    expect(ids('pregnant', answers)).toContain('mother.averageGross');
    const input = buildScenario('pregnant', answers).benefitBaseInputs?.mother;
    // pełne miesiące od początku ubezpieczenia (15.09 → od października) do miesiąca przed porodem
    expect(input?.incomes.map((income) => income.month)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    expect(input).toMatchObject({ rightArisesOn: '2027-02-10', declaredContributionBase: null });

    const known = buildScenario('pregnant', { ...answers, 'mother.benefitBase': '6000' });
    expect(known.benefitBaseInputs).toBeUndefined();
    expect(ids('pregnant', { ...answers, 'mother.benefitBase': '6000' })).not.toContain(
      'mother.averageGross',
    );
  });

  it('uses the lookback period from params and the declared base for self-employed', () => {
    const params: BenefitParams = {
      ...(paramsJson as BenefitParams),
      benefitBase: { ...(paramsJson as BenefitParams).benefitBase, lookbackMonths: 3 },
    };
    const employed = buildScenario(
      'afterBirth',
      {
        family: 'motherOnly',
        birthDate: '2026-01-20',
        'mother.insuranceTitle': 'employment',
        'mother.insuredSince': 'unknown',
        'mother.benefitBase': 'unknown',
        'mother.averageGross': '5000',
      },
      params,
    );
    expect(employed.benefitBaseInputs?.mother?.incomes.map((income) => income.month)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
    ]);
    const jdg = buildScenario('pregnant', {
      family: 'motherOnly',
      'mother.insuranceTitle': 'selfEmployed',
      'mother.sicknessInsurance': 'yes',
      'mother.benefitBase': 'unknown',
      'mother.declaredContributionBase': '4806',
    });
    expect(jdg.benefitBaseInputs?.mother).toMatchObject({
      insuranceTitle: 'selfEmployed',
      incomes: [],
      declaredContributionBase: 4806,
    });
  });

  it('maps the rate variant and leaves it unset when undecided; labels come from params', () => {
    const question = getQuestions('pregnant', { family: 'motherOnly' }).find(
      (item) => item.id === 'rateVariant',
    )!;
    expect(question.options?.[0].label).toMatch(/^81,5%/);
    expect(question.hint).toContain('21 dni');
    expect(
      buildScenario('pregnant', { family: 'motherOnly', rateVariant: 'standard' }).rateVariant,
    ).toBe('standard');
    expect(
      buildScenario('pregnant', { family: 'motherOnly', rateVariant: 'unknown' }),
    ).not.toHaveProperty('rateVariant');
  });

  it('asks about sick leave in pregnancy only for a sickness-insured mother', () => {
    const employed = { family: 'motherOnly', 'mother.insuranceTitle': 'employment' };
    expect(ids('pregnant', employed)).toContain('mother.pregnancySickLeave');
    expect(ids('afterBirth', employed)).toContain('mother.pregnancySickLeave');
    expect(ids('planning', employed)).not.toContain('mother.pregnancySickLeave');
    const jdg = { family: 'motherOnly', 'mother.insuranceTitle': 'selfEmployed' };
    expect(ids('pregnant', { ...jdg, 'mother.sicknessInsurance': 'no' })).not.toContain(
      'mother.pregnancySickLeave',
    );
    expect(ids('pregnant', { ...jdg, 'mother.sicknessInsurance': 'yes' })).toContain(
      'mother.pregnancySickLeave',
    );
    const withLeave = { ...employed, 'mother.pregnancySickLeave': 'yes' };
    expect(ids('pregnant', withLeave)).toEqual(
      expect.arrayContaining(['mother.sickLeaveStart', 'mother.sickLeaveUntilBirth']),
    );
    expect(ids('pregnant', withLeave)).not.toContain('mother.sickLeaveEnd');
    expect(ids('pregnant', { ...withLeave, 'mother.sickLeaveUntilBirth': 'no' })).toContain(
      'mother.sickLeaveEnd',
    );
  });

  it('links sick leave ending before birth to the maternity base and builds a sickness base', () => {
    const draft = buildScenario('afterBirth', {
      family: 'motherOnly',
      birthDate: '2026-06-10',
      'mother.insuranceTitle': 'employment',
      'mother.insuredSince': '2020-01-01',
      'mother.pregnancySickLeave': 'yes',
      'mother.sickLeaveStart': '2026-03-02',
      'mother.sickLeaveUntilBirth': 'no',
      'mother.sickLeaveEnd': '2026-05-15',
      'mother.benefitBase': 'unknown',
      'mother.averageGross': '6000',
    });
    expect(draft.pregnancySickLeave).toEqual({
      startDate: '2026-03-02',
      untilBirth: false,
      endDate: '2026-05-15',
    });
    expect(draft.benefitBaseInputs?.mother).toMatchObject({
      rightArisesOn: '2026-06-10',
      previousBenefitEndDate: '2026-05-15',
    });
    expect(draft.sicknessBenefitBaseInput).toMatchObject({ rightArisesOn: '2026-03-02' });
    expect(draft.sicknessBenefitBaseInput?.incomes.at(-1)?.month).toBe('2026-02');

    const noLeave = buildScenario('afterBirth', {
      family: 'motherOnly',
      birthDate: '2026-06-10',
      'mother.insuranceTitle': 'employment',
      'mother.pregnancySickLeave': 'no',
    });
    expect(noLeave.pregnancySickLeave).toBeNull();
    expect(noLeave.sicknessBenefitBaseInput).toBeUndefined();
  });

  it('uses the contract salary when there is no full month of insurance yet', () => {
    const answers = {
      family: 'motherOnly',
      expectedBirthDate: '2027-02-10',
      'mother.insuranceTitle': 'employment',
      'mother.insuredSince': '2027-01-20',
      'mother.benefitBase': 'unknown',
      'mother.averageGross': 'unknown',
      'mother.contractSalary': '6500',
    };
    expect(ids('pregnant', answers)).toContain('mother.contractSalary');
    expect(buildScenario('pregnant', answers).benefitBaseInputs?.mother).toMatchObject({
      incomes: [],
      contractMonthlySalary: 6500,
    });
    expect(ids('pregnant', { ...answers, 'mother.insuranceTitle': 'selfEmployed' })).not.toContain(
      'mother.contractSalary',
    );
  });
});
