import type {
  BenefitParams,
  IsoDate,
  MonthlyIncome,
  SickLeaveCertificate,
  SituationType,
  ZusData,
} from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import type {
  FieldConflict,
  FieldSource,
  ManualFormState,
  ScenarioDraft,
} from '../../app/scenarioDraft';
import { changeAnswer, getQuestions, todayLocal, validateAnswer } from './wizardModel';

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  zus: 'ZUS',
  mobywatel: 'mObywatel',
  user: 'Ty',
  edited: 'zmienione',
};

export interface IncomingSuggestion {
  id: string;
  value: string;
  source: 'zus' | 'mobywatel';
  allowConflict: boolean;
}

export function getPregnancyCertificates(zusData: ZusData | null | undefined): SickLeaveCertificate[] {
  if (!zusData) return [];
  return zusData.sickLeaveCertificates
    .filter((cert) => cert.pregnancyCode)
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getSuggestedSickLeaveStart(zusData: ZusData | null | undefined): IsoDate | null {
  return getPregnancyCertificates(zusData)[0]?.startDate ?? null;
}

export function computeAverageIncome(incomes: MonthlyIncome[]): number | null {
  if (incomes.length === 0) return null;
  const total = incomes.reduce((sum, item) => sum + item.grossAmount, 0);
  return Math.round((total / incomes.length) * 100) / 100;
}

export function extractZusSuggestions(
  situation: SituationType,
  zusData: ZusData,
): IncomingSuggestion[] {
  const { mother } = zusData.profile;
  const suggestions: IncomingSuggestion[] = [
    { id: 'family', value: 'motherOnly', source: 'mobywatel', allowConflict: false },
    { id: 'mother.insuranceTitle', value: mother.insuranceTitle, source: 'zus', allowConflict: true },
  ];

  if (mother.insuranceTitle === 'mandateContract' || mother.insuranceTitle === 'selfEmployed') {
    if (mother.sicknessInsurance === 'voluntary' || mother.sicknessInsurance === 'none') {
      suggestions.push({
        id: 'mother.sicknessInsurance',
        value: mother.sicknessInsurance === 'voluntary' ? 'yes' : 'no',
        source: 'zus',
        allowConflict: true,
      });
    }
  }

  if (mother.insuredSince) {
    suggestions.push({
      id: 'mother.insuredSince',
      value: mother.insuredSince,
      source: 'zus',
      allowConflict: true,
    });
  }

  if (mother.insuranceEndDate) {
    suggestions.push({
      id: 'mother.insuranceEndDate',
      value: mother.insuranceEndDate,
      source: 'zus',
      allowConflict: true,
    });
  }

  if (mother.employerInsuredCount !== null) {
    suggestions.push({
      id: 'mother.employerInsuredCount',
      value: String(mother.employerInsuredCount),
      source: 'zus',
      allowConflict: true,
    });
  }

  if (mother.age !== null) {
    suggestions.push({
      id: 'mother.age',
      value: String(mother.age),
      source: 'mobywatel',
      allowConflict: true,
    });
  }

  if (mother.insuranceTitle === 'selfEmployed') {
    const debt = zusData.contributionDebt ?? mother.contributionDebt ?? 0;
    suggestions.push({
      id: 'mother.contributionDebt',
      value: String(debt),
      source: 'zus',
      allowConflict: true,
    });
  }

  const pregnancyStart = getSuggestedSickLeaveStart(zusData);
  if (pregnancyStart && (situation === 'pregnant' || situation === 'afterBirth')) {
    suggestions.push(
      { id: 'mother.pregnancySickLeave', value: 'yes', source: 'zus', allowConflict: true },
      { id: 'mother.sickLeaveStart', value: pregnancyStart, source: 'zus', allowConflict: true },
    );
  }

  if (mother.benefitBase !== null) {
    suggestions.push({
      id: 'mother.benefitBase',
      value: String(mother.benefitBase),
      source: 'zus',
      allowConflict: true,
    });
  } else if (zusData.incomes.length > 0) {
    const average = computeAverageIncome(zusData.incomes);
    if (average !== null) {
      suggestions.push({
        id: 'mother.benefitBase',
        value: 'unknown',
        source: 'zus',
        allowConflict: true,
      });
      if (mother.insuranceTitle === 'employment' || mother.insuranceTitle === 'mandateContract') {
        suggestions.push({
          id: 'mother.averageGross',
          value: String(average),
          source: 'zus',
          allowConflict: true,
        });
      } else if (mother.insuranceTitle === 'selfEmployed') {
        suggestions.push({
          id: 'mother.declaredContributionBase',
          value: String(average),
          source: 'zus',
          allowConflict: true,
        });
      }
    }
  }

  return suggestions;
}

export interface ZusMergeResult {
  form: ManualFormState;
  filledIds: string[];
  conflictIds: string[];
}

/**
 * Łączy dane z ZUS / mObywatela ze stanem formularza:
 * - uzupełnia wyłącznie puste pola (nigdy nie nadpisuje wpisów użytkownika),
 * - zapisuje etykietę źródła ('zus' | 'mobywatel'),
 * - przy rozbieżności z istniejącą odpowiedzią zgłasza konflikt do decyzji użytkownika.
 */
export function mergeZusIntoForm(
  form: ManualFormState,
  zusData: ZusData,
  params: BenefitParams = DEFAULT_PARAMS,
): ZusMergeResult {
  const answers: Record<string, string> = { ...form.answers };
  const fieldSources: Record<string, FieldSource> = { ...(form.fieldSources ?? {}) };
  const pendingConflicts: Record<string, FieldConflict> = { ...(form.pendingConflicts ?? {}) };
  const suggestions = extractZusSuggestions(form.situation, zusData);
  const filledIds: string[] = [];

  for (let pass = 0; pass < 8; pass += 1) {
    const questions = getQuestions(form.situation, answers, params);
    const byId = new Map(questions.map((question) => [question.id, question]));
    let changed = false;

    for (const item of suggestions) {
      const question = byId.get(item.id);
      if (!question) continue;
      if (validateAnswer(question, item.value) !== null) continue;

      const existing = answers[item.id];
      if (!existing) {
        answers[item.id] = item.value;
        fieldSources[item.id] = item.source;
        delete pendingConflicts[item.id];
        filledIds.push(item.id);
        changed = true;
      } else if (existing === item.value) {
        delete pendingConflicts[item.id];
      } else if (item.allowConflict) {
        pendingConflicts[item.id] = {
          questionId: item.id,
          userValue: existing,
          incomingValue: item.value,
          incomingSource: item.source,
        };
      }
    }

    if (!changed) break;
  }

  const finalActive = new Set(
    getQuestions(form.situation, answers, params).map((question) => question.id),
  );
  const cleanSources = Object.fromEntries(
    Object.entries(fieldSources).filter(([key]) => finalActive.has(key) && Boolean(answers[key])),
  );
  const cleanConflicts = Object.fromEntries(
    Object.entries(pendingConflicts).filter(
      ([key, conflict]) => finalActive.has(key) && answers[key] !== conflict.incomingValue,
    ),
  );

  return {
    form: {
      ...form,
      answers,
      fieldSources: cleanSources,
      pendingConflicts: cleanConflicts,
    },
    filledIds,
    conflictIds: Object.keys(cleanConflicts),
  };
}

/**
 * Zapisuje edycję użytkownika, pilnując etykiety źródła:
 * - edycja pola pustego / własnego → 'user' („Ty”)
 * - edycja pola wypełnionego wcześniej przez ZUS lub mObywatela → 'edited' („zmienione”)
 */
export function recordUserEdit(
  form: ManualFormState,
  id: string,
  value: string,
): ManualFormState {
  const prevValue = form.answers[id];
  const prevSource = form.fieldSources?.[id];
  const nextAnswers = changeAnswer(form.situation, form.answers, id, value);
  const nextSources: Record<string, FieldSource> = { ...(form.fieldSources ?? {}) };
  const nextConflicts: Record<string, FieldConflict> = { ...(form.pendingConflicts ?? {}) };

  if (nextAnswers[id]) {
    if (prevSource === 'zus' || prevSource === 'mobywatel' || prevSource === 'edited') {
      nextSources[id] = nextAnswers[id] !== prevValue ? 'edited' : prevSource;
    } else {
      nextSources[id] = 'user';
    }
  } else {
    delete nextSources[id];
  }
  delete nextConflicts[id];

  const activeKeys = new Set(Object.keys(nextAnswers));
  return {
    ...form,
    answers: nextAnswers,
    fieldSources: Object.fromEntries(
      Object.entries(nextSources).filter(([key]) => activeKeys.has(key)),
    ),
    pendingConflicts: Object.fromEntries(
      Object.entries(nextConflicts).filter(([key]) => activeKeys.has(key)),
    ),
  };
}

export function resolveConflictInForm(
  form: ManualFormState,
  questionId: string,
  choice: 'keepUser' | 'useIncoming',
  zusData: ZusData | null,
  params: BenefitParams = DEFAULT_PARAMS,
): ManualFormState {
  const conflict = form.pendingConflicts?.[questionId];
  if (!conflict) return form;

  const nextConflicts = { ...(form.pendingConflicts ?? {}) };
  delete nextConflicts[questionId];

  if (choice === 'keepUser') {
    return {
      ...form,
      fieldSources: {
        ...(form.fieldSources ?? {}),
        [questionId]: form.fieldSources?.[questionId] ?? 'user',
      },
      pendingConflicts: nextConflicts,
    };
  }

  const nextAnswers = changeAnswer(form.situation, form.answers, questionId, conflict.incomingValue);
  const activeKeys = new Set(Object.keys(nextAnswers));
  const nextSources: Record<string, FieldSource> = {
    ...Object.fromEntries(
      Object.entries(form.fieldSources ?? {}).filter(([key]) => activeKeys.has(key)),
    ),
    [questionId]: conflict.incomingSource,
  };
  const updated: ManualFormState = {
    ...form,
    answers: nextAnswers,
    fieldSources: nextSources,
    pendingConflicts: Object.fromEntries(
      Object.entries(nextConflicts).filter(([key]) => activeKeys.has(key)),
    ),
  };

  return zusData ? mergeZusIntoForm(updated, zusData, params).form : updated;
}

/** Zwraca dokładne miesięczne przychody z ZUS tylko gdy użytkownik nie nadpisał zarobków. */
export function selectZusIncomesForBuild(
  form: ManualFormState | null,
  zusData: ZusData | null,
): MonthlyIncome[] | undefined {
  if (!zusData || zusData.incomes.length === 0) return undefined;
  if (!form) return undefined;
  const title = form.answers['mother.insuranceTitle'];
  if (title !== zusData.profile.mother.insuranceTitle) return undefined;
  if (form.answers['mother.benefitBase'] !== 'unknown') return undefined;
  const grossSource =
    title === 'selfEmployed'
      ? form.fieldSources?.['mother.declaredContributionBase']
      : form.fieldSources?.['mother.averageGross'];
  return grossSource === 'zus' ? zusData.incomes : undefined;
}

/** Data powstania prawa do świadczenia używana w symulacji zaświadczenia o zadłużeniu (JDG). */
export function resolveRightArisesDate(
  scenario: ScenarioDraft,
  answers?: Record<string, string>,
): IsoDate {
  const sickStart =
    answers?.['mother.pregnancySickLeave'] === 'yes' &&
    answers['mother.sickLeaveStart'] &&
    answers['mother.sickLeaveStart'] !== 'unknown'
      ? answers['mother.sickLeaveStart']
      : scenario.pregnancySickLeave?.startDate;
  return (
    sickStart ??
    scenario.birthDate ??
    scenario.expectedBirthDate ??
    scenario.childAcceptanceDate ??
    scenario.referenceDate ??
    todayLocal()
  );
}
