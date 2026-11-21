import { describe, expect, it } from 'vitest';
import type { ZusData } from '@shared/types';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { ManualFormState } from '../../../app/scenarioDraft';
import { wizardCase } from '../../plan/caseScenario';
import { buildScenario } from '../wizardModel';
import {
  getSuggestedSickLeaveStart,
  mergeZusIntoForm,
  recordUserEdit,
  resolveConflictInForm,
  selectZusIncomesForBuild,
} from '../zusMerge';

const jdgDebtZusData: ZusData = {
  profile: {
    profileId: 'katarzyna-jdg-dlug',
    firstName: 'Katarzyna',
    lastName: 'Kowalska',
    mother: {
      role: 'mother',
      insuranceTitle: 'selfEmployed',
      sicknessInsurance: 'voluntary',
      insuredSince: '2024-01-01',
      insuranceEndDate: null,
      benefitBase: null,
      employerInsuredCount: null,
      age: 33,
      contributionDebt: 680.5,
      wantsLeave: true,
    },
  },
  incomes: [
    { month: '2026-07', grossAmount: 5203.8, workedDays: null, requiredWorkingDays: null },
    { month: '2026-08', grossAmount: 5203.8, workedDays: null, requiredWorkingDays: null },
    { month: '2026-09', grossAmount: 5203.8, workedDays: null, requiredWorkingDays: null },
  ],
  sickLeaveCertificates: [
    { id: 'EZLA-1', startDate: '2026-02-01', endDate: '2026-02-05', pregnancyCode: false },
    { id: 'EZLA-2', startDate: '2026-10-01', endDate: '2026-11-05', pregnancyCode: true },
  ],
  contributionDebt: 680.5,
};

function emptyForm(answers: Record<string, string> = {}): ManualFormState {
  return {
    version: 2,
    situation: 'pregnant',
    answers,
    currentQuestionId: 'family',
    completed: false,
  };
}

describe('łączenie danych z ZUS z formularzem (zusMerge)', () => {
  it('uzupełnia puste pola z odpowiednimi etykietami źródeł i podpowiada początek e-ZLA kod B', () => {
    expect(getSuggestedSickLeaveStart(jdgDebtZusData)).toBe('2026-10-01');

    const { form, filledIds, conflictIds } = mergeZusIntoForm(emptyForm(), jdgDebtZusData);

    expect(conflictIds).toEqual([]);
    expect(filledIds).toEqual(
      expect.arrayContaining([
        'family',
        'mother.insuranceTitle',
        'mother.sicknessInsurance',
        'mother.insuredSince',
        'mother.contributionDebt',
        'mother.pregnancySickLeave',
        'mother.sickLeaveStart',
        'mother.benefitBase',
        'mother.declaredContributionBase',
      ]),
    );
    expect(form.answers['mother.insuranceTitle']).toBe('selfEmployed');
    expect(form.answers['mother.contributionDebt']).toBe('680.5');
    expect(form.answers['mother.pregnancySickLeave']).toBe('yes');
    expect(form.answers['mother.sickLeaveStart']).toBe('2026-10-01');
    expect(form.fieldSources?.['family']).toBe('mobywatel');
    expect(form.fieldSources?.['mother.insuranceTitle']).toBe('zus');
    expect(form.fieldSources?.['mother.contributionDebt']).toBe('zus');
    expect(form.fieldSources?.['mother.sickLeaveStart']).toBe('zus');

    // Dane z ZUS (w tym contributionDebt dla JDG) trafiają do silnika i uruchamiają SELF_EMPLOYED_DEBT.
    const answersWithDueDate = { ...form.answers, expectedBirthDate: '2026-12-20', childrenCount: '1' };
    const zusIncomes = selectZusIncomesForBuild(form, jdgDebtZusData);
    const scenario = buildScenario('pregnant', answersWithDueDate, params, { zusIncomes });
    expect(scenario.mother?.contributionDebt).toBe(680.5);
    expect(scenario.pregnancySickLeave?.startDate).toBe('2026-10-01');

    const caseInput = wizardCase(scenario, params)!;
    expect(caseInput.debt_amount_pln).toBe(680.5);
    expect(caseInput.has_b2b_arrears).toBe(true);
    const plan = calculateCasePlan(caseInput, params);
    expect(plan.outcome.warnings.some((warning) => warning.code === 'SELF_EMPLOYED_DEBT')).toBe(
      true,
    );
  });

  it('nie nadpisuje wpisów użytkownika i zgłasza konflikt, a edycja pola ZUS zmienia źródło na „zmienione”', () => {
    const userForm: ManualFormState = {
      ...emptyForm({
        family: 'both',
        'mother.insuranceTitle': 'employment',
        'mother.insuredSince': '2021-05-01',
      }),
      fieldSources: {
        family: 'user',
        'mother.insuranceTitle': 'user',
        'mother.insuredSince': 'user',
      },
    };

    const { form: merged, conflictIds } = mergeZusIntoForm(userForm, jdgDebtZusData);

    // Wpisy użytkownika nie zostały nadpisane!
    expect(merged.answers.family).toBe('both');
    expect(merged.answers['mother.insuranceTitle']).toBe('employment');
    expect(merged.answers['mother.insuredSince']).toBe('2021-05-01');
    // Puste pole (wiek z mObywatela, zwolnienie z ZUS) zostało uzupełnione!
    expect(merged.answers['mother.age']).toBe('33');
    expect(merged.fieldSources?.['mother.age']).toBe('mobywatel');
    expect(merged.answers['mother.pregnancySickLeave']).toBe('yes');
    expect(merged.fieldSources?.['mother.pregnancySickLeave']).toBe('zus');
    // Konflikty zgłoszone zamiast nadpisywania:
    expect(conflictIds).toEqual(
      expect.arrayContaining(['mother.insuranceTitle', 'mother.insuredSince']),
    );
    expect(merged.pendingConflicts?.['mother.insuranceTitle']).toEqual({
      questionId: 'mother.insuranceTitle',
      userValue: 'employment',
      incomingValue: 'selfEmployed',
      incomingSource: 'zus',
    });

    // Wybór „Zostaw moją wartość” zachowuje wpis użytkownika i zamyka konflikt.
    const kept = resolveConflictInForm(merged, 'mother.insuredSince', 'keepUser', jdgDebtZusData);
    expect(kept.answers['mother.insuredSince']).toBe('2021-05-01');
    expect(kept.pendingConflicts?.['mother.insuredSince']).toBeUndefined();

    // Wybór „Użyj danych z ZUS” podmienia wartość, ustawia źródło ZUS i uzupełnia nowe puste pola JDG.
    const accepted = resolveConflictInForm(
      kept,
      'mother.insuranceTitle',
      'useIncoming',
      jdgDebtZusData,
    );
    expect(accepted.answers['mother.insuranceTitle']).toBe('selfEmployed');
    expect(accepted.fieldSources?.['mother.insuranceTitle']).toBe('zus');
    expect(accepted.answers['mother.contributionDebt']).toBe('680.5');
    expect(accepted.fieldSources?.['mother.contributionDebt']).toBe('zus');

    // Ręczna edycja pola wypełnionego z ZUS ustawia etykietę źródła na 'edited' („zmienione”).
    const edited = recordUserEdit(accepted, 'mother.contributionDebt', '0');
    expect(edited.answers['mother.contributionDebt']).toBe('0');
    expect(edited.fieldSources?.['mother.contributionDebt']).toBe('edited');
  });
});
