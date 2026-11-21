import { describe, expect, it } from 'vitest';
import { buildScenario, changeAnswer, getQuestions, validateAnswer } from '../wizardModel';

describe('conditional family paths', () => {
  it.each(['planning', 'pregnant'] as const)('%s only asks prebirth questions', (situation) => {
    const ids = getQuestions(situation, { family: 'both', hospitalization: 'yes' }).map(
      (question) => question.id,
    );
    expect(ids).toContain('expectedBirthDate');
    for (const id of [
      'birthDate',
      'hospitalization',
      'pregnancyWeekAtBirth',
      'birthWeightGrams',
      'hospitalizationDays',
      'zaZyciemCertificate',
    ])
      expect(ids).not.toContain(id);
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
});
