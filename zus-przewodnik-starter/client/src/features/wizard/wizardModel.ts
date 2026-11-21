import type { InsuranceTitle, ParentData, ParentRole, SituationType } from '@shared/types';
import type { ScenarioDraft } from '../../app/scenarioDraft';

export const STAGES = ['Rodzina', 'Dziecko', 'Ubezpieczenie', 'Plany i kwoty', 'Podsumowanie'];
export const SITUATION_LABELS: Record<SituationType, string> = {
  planning: 'Planuję dziecko',
  pregnant: 'Jestem w ciąży',
  afterBirth: 'Dziecko już się urodziło',
  adoption: 'Adopcja lub rodzina zastępcza',
};

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

/** Opis kontrolki interfejsu. Typy danych domenowych pozostają w shared/types.ts. */
export interface WizardQuestion {
  id: string;
  stage: number;
  title: string;
  label: string;
  hint?: string;
  type: 'choice' | 'date' | 'number';
  options?: QuestionOption[];
  unknownLabel?: string;
  min?: number | string;
  max?: number | string;
  step?: string;
}

const YES_NO: QuestionOption[] = [
  { value: 'yes', label: 'Tak' },
  { value: 'no', label: 'Nie' },
  { value: 'unknown', label: 'Nie wiem / uzupełnię później' },
];
const INSURANCE_OPTIONS: QuestionOption[] = [
  { value: 'employment', label: 'Umowa o pracę' },
  { value: 'mandateContract', label: 'Umowa zlecenie' },
  { value: 'selfEmployed', label: 'Działalność gospodarcza' },
  { value: 'none', label: 'Brak tytułu do ubezpieczenia chorobowego' },
  { value: 'unknown', label: 'Nie wiem / uzupełnię później' },
];

export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parentRoles(answers: Record<string, string>): ParentRole[] {
  if (answers.family === 'both') return ['mother', 'father'];
  if (answers.family === 'motherOnly') return ['mother'];
  if (answers.family === 'fatherOnly') return ['father'];
  return [];
}

export function getQuestions(
  situation: SituationType,
  answers: Record<string, string>,
): WizardQuestion[] {
  const questions: WizardQuestion[] = [
    {
      id: 'family',
      stage: 0,
      type: 'choice',
      title: 'Dla kogo przygotowujemy plan?',
      label: 'Rodzina',
      hint: 'Wspólny plan obejmie dane obojga rodziców. Przy samodzielnej opiece zapytamy tylko o jedną osobę.',
      options: [
        {
          value: 'both',
          label: 'Dwoje rodziców',
          description: 'Wypełniamy wspólny plan mamy i taty.',
        },
        {
          value: 'motherOnly',
          label: 'Samodzielnie — mama',
          description: 'Przygotowujemy plan tylko dla mamy.',
        },
        {
          value: 'fatherOnly',
          label: 'Samodzielnie — tata',
          description: 'Przygotowujemy plan tylko dla taty.',
        },
      ],
    },
  ];

  if (situation === 'adoption') {
    questions.push(
      {
        id: 'adoptionType',
        stage: 1,
        type: 'choice',
        title: 'Jakiej formy opieki dotyczy plan?',
        label: 'Forma opieki',
        options: [
          { value: 'adoption', label: 'Adopcja (przysposobienie)' },
          { value: 'fosterFamily', label: 'Rodzina zastępcza' },
        ],
      },
      {
        id: 'adoptionStage',
        stage: 1,
        type: 'choice',
        title: 'Czy dziecko jest już przyjęte na wychowanie?',
        label: 'Etap przyjęcia dziecka',
        options: [
          { value: 'accepted', label: 'Tak, dziecko jest już pod opieką' },
          { value: 'planned', label: 'Dopiero planujemy przyjęcie dziecka' },
        ],
      },
    );
    if (answers.adoptionStage) {
      const accepted = answers.adoptionStage === 'accepted';
      questions.push(
        {
          id: 'childAcceptanceDate',
          stage: 1,
          type: 'date',
          title: accepted
            ? 'Kiedy przyjęto dziecko na wychowanie?'
            : 'Na kiedy planowane jest przyjęcie dziecka?',
          label: accepted ? 'Data przyjęcia dziecka' : 'Planowana data przyjęcia dziecka',
          ...(accepted
            ? { max: todayLocal() }
            : { min: todayLocal(), unknownLabel: 'Nie znamy jeszcze terminu' }),
        },
        {
          id: 'childAgeYears',
          stage: 1,
          type: 'number',
          title: accepted
            ? 'Ile lat ma dziecko?'
            : 'W jakim wieku będzie dziecko w dniu przyjęcia?',
          label: 'Wiek dziecka (pełne lata)',
          min: 0,
          step: '1',
          unknownLabel: 'Nie znamy jeszcze wieku',
        },
        {
          id: 'schoolObligationDeferred',
          stage: 1,
          type: 'choice',
          title: 'Czy dziecko ma odroczony obowiązek szkolny?',
          label: 'Odroczenie obowiązku szkolnego',
          options: YES_NO,
        },
      );
    }
  } else {
    const afterBirth = situation === 'afterBirth';
    questions.push({
      id: afterBirth ? 'birthDate' : 'expectedBirthDate',
      stage: 1,
      type: 'date',
      title: afterBirth
        ? 'Kiedy urodziło się dziecko?'
        : situation === 'planning'
          ? 'Czy znacie orientacyjny termin narodzin?'
          : 'Jaki jest przewidywany termin porodu?',
      label: afterBirth ? 'Data urodzenia dziecka' : 'Przewidywany termin porodu',
      ...(afterBirth ? { max: todayLocal() } : { unknownLabel: 'Nie znamy jeszcze terminu' }),
      hint: situation === 'planning' ? 'Możecie pominąć datę i wrócić do niej później.' : undefined,
    });
  }

  questions.push({
    id: 'childrenCount',
    stage: 1,
    type: 'number',
    min: 1,
    step: '1',
    label: 'Liczba dzieci',
    title:
      situation === 'planning'
        ? 'Dla ilu dzieci przygotować wstępną symulację?'
        : situation === 'pregnant'
          ? 'Ilu dzieci spodziewacie się z tego porodu?'
          : situation === 'afterBirth'
            ? 'Ile dzieci urodziło się z tego porodu?'
            : 'Ile dzieci przyjmujecie jednocześnie?',
    ...(situation === 'planning' || situation === 'pregnant' || answers.adoptionStage === 'planned'
      ? { unknownLabel: 'Jeszcze nie wiemy' }
      : {}),
  });

  // Dane faktycznego porodu są dostępne wyłącznie na ścieżce po narodzinach.
  if (situation === 'afterBirth') {
    questions.push({
      id: 'hospitalization',
      stage: 1,
      type: 'choice',
      title: 'Czy dziecko przebywało w szpitalu po porodzie?',
      label: 'Pobyt dziecka w szpitalu',
      options: YES_NO,
      hint: 'Ta odpowiedź pozwoli dopasować pytania o okoliczności porodu.',
    });
    if (answers.hospitalization === 'yes') {
      questions.push(
        {
          id: 'pregnancyWeekAtBirth',
          stage: 1,
          type: 'number',
          title: 'W którym tygodniu ciąży nastąpił poród?',
          label: 'Tydzień ciąży w chwili porodu',
          min: 1,
          max: 45,
          step: '1',
          unknownLabel: 'Nie znam tej informacji',
        },
        {
          id: 'birthWeightGrams',
          stage: 1,
          type: 'number',
          title: 'Jaka była masa urodzeniowa dziecka?',
          label: 'Masa urodzeniowa (gramy)',
          min: 1,
          step: '1',
          unknownLabel: 'Nie znam tej informacji',
        },
        {
          id: 'hospitalizationDays',
          stage: 1,
          type: 'number',
          title: 'Ile dni trwał pobyt dziecka w szpitalu?',
          label: 'Liczba dni w szpitalu',
          min: 1,
          step: '1',
          unknownLabel: 'Pobyt trwa lub nie znam liczby dni',
        },
      );
    }
    questions.push({
      id: 'zaZyciemCertificate',
      stage: 1,
      type: 'choice',
      title: 'Czy macie zaświadczenie „Za życiem”?',
      label: 'Zaświadczenie „Za życiem”',
      options: YES_NO,
    });
  }

  for (const role of parentRoles(answers)) {
    const person = role === 'mother' ? 'mamy' : 'taty';
    const title = answers[`${role}.insuranceTitle`];
    questions.push({
      id: `${role}.insuranceTitle`,
      stage: 2,
      type: 'choice',
      title: `Jaka jest sytuacja zawodowa ${person}?`,
      label: `Zatrudnienie ${person}`,
      options: INSURANCE_OPTIONS,
      hint: 'Wybierzcie tytuł ubezpieczenia, którego ma dotyczyć ten plan.',
    });
    if (title === 'mandateContract' || title === 'selfEmployed') {
      questions.push({
        id: `${role}.sicknessInsurance`,
        stage: 2,
        type: 'choice',
        title: `Czy za ${person === 'mamy' ? 'mamę' : 'tatę'} jest opłacana dobrowolna składka chorobowa?`,
        label: `Składka chorobowa ${person}`,
        options: YES_NO,
        hint: 'Jeśli nie macie pewności, możecie uzupełnić tę informację później.',
      });
    }
    if (title === 'employment' || answers[`${role}.sicknessInsurance`] === 'yes') {
      questions.push({
        id: `${role}.insuredSince`,
        stage: 2,
        type: 'date',
        title: `Od kiedy trwa obecne ubezpieczenie chorobowe ${person}?`,
        label: `Początek ubezpieczenia ${person}`,
        max: todayLocal(),
        unknownLabel: 'Sprawdzimy to później',
      });
    }
    if (title === 'employment' || title === 'mandateContract') {
      questions.push({
        id: `${role}.insuranceEndDate`,
        stage: 2,
        type: 'date',
        title: `Czy znana jest data końca umowy ${person}?`,
        label: `Koniec umowy ${person}`,
        min:
          answers[`${role}.insuredSince`] !== 'unknown'
            ? answers[`${role}.insuredSince`]
            : undefined,
        unknownLabel: 'Umowa bezterminowa lub data nie jest jeszcze znana',
      });
    }
    if (title === 'selfEmployed') {
      questions.push({
        id: `${role}.contributionDebt`,
        stage: 2,
        type: 'number',
        title: `Czy ${person === 'mamy' ? 'mama ma' : 'tata ma'} zaległości w składkach ZUS?`,
        label: `Zaległość w składkach ${person} (zł)`,
        min: 0,
        step: '0.01',
        hint: 'Wpiszcie kwotę zadłużenia albo 0, jeśli składki są rozliczone.',
        unknownLabel: 'Sprawdzimy to później',
      });
    }
  }

  for (const role of parentRoles(answers)) {
    const person = role === 'mother' ? 'mamy' : 'taty';
    questions.push({
      id: `${role}.wantsLeave`,
      stage: 3,
      type: 'choice',
      title: `Czy ${role === 'mother' ? 'mama' : 'tata'} planuje korzystać z urlopu lub zasiłku?`,
      label: `Plan urlopu ${person}`,
      options: YES_NO,
      hint: 'To wstępny plan. Możecie go zmienić później.',
    });
    if (
      ['employment', 'mandateContract', 'selfEmployed'].includes(answers[`${role}.insuranceTitle`])
    ) {
      questions.push({
        id: `${role}.benefitBase`,
        stage: 3,
        type: 'number',
        title: `Czy znacie podstawę wymiaru zasiłku ${person}?`,
        label: `Podstawa wymiaru zasiłku ${person} (zł)`,
        min: 0,
        step: '0.01',
        hint: 'Wpiszcie tylko znaną podstawę zasiłku. Jeśli znacie jedynie wynagrodzenie, wybierzcie uzupełnienie później.',
        unknownLabel: 'Podstawę ustalimy później',
      });
    }
  }
  return questions;
}

export function validateAnswer(question: WizardQuestion, value: string | undefined): string | null {
  if (!value) return 'Odpowiedz na pytanie, aby przejść dalej.';
  if (question.type === 'choice') {
    return question.options?.some((option) => option.value === value)
      ? null
      : 'Wybierz jedną z odpowiedzi.';
  }
  if (value === 'unknown') return question.unknownLabel ? null : 'Uzupełnij to pole.';
  if (question.type === 'number') {
    const amount = Number(value);
    if (!Number.isFinite(amount) || (question.step === '1' && !Number.isInteger(amount)))
      return 'Wpisz poprawną liczbę.';
    if (typeof question.min === 'number' && amount < question.min)
      return `Wpisz liczbę nie mniejszą niż ${question.min}.`;
    if (typeof question.max === 'number' && amount > question.max)
      return `Wpisz liczbę nie większą niż ${question.max}.`;
    return null;
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return 'Wpisz poprawną datę w formacie DD/MM/YYYY.';
  if (typeof question.min === 'string' && value < question.min)
    return 'Data jest wcześniejsza niż dozwolona.';
  if (typeof question.max === 'string' && value > question.max)
    return 'Ta data nie może być w przyszłości.';
  return null;
}

/** Usuwa odpowiedzi z gałęzi, która przestała obowiązywać. */
export function changeAnswer(
  situation: SituationType,
  answers: Record<string, string>,
  id: string,
  value: string,
): Record<string, string> {
  const next = { ...answers, [id]: value };
  if (id === 'adoptionStage' && answers[id] !== value) delete next.childAcceptanceDate;
  if (id.endsWith('.insuranceTitle') && answers[id] !== value) {
    const prefix = id.split('.')[0] + '.';
    for (const key of Object.keys(next)) {
      if (key.startsWith(prefix) && key !== id && !key.endsWith('.wantsLeave')) delete next[key];
    }
  }
  const active = new Set(getQuestions(situation, next).map((question) => question.id));
  return Object.fromEntries(Object.entries(next).filter(([key]) => active.has(key)));
}

function numberOrNull(value: string | undefined): number | null {
  return !value || value === 'unknown' || !Number.isFinite(Number(value)) ? null : Number(value);
}

function dateOrNull(value: string | undefined): string | null {
  return !value || value === 'unknown' ? null : value;
}

function knownBoolean(value: string | undefined): boolean | undefined {
  return value === 'yes' ? true : value === 'no' ? false : undefined;
}

export function buildScenario(
  situation: SituationType,
  answers: Record<string, string>,
): ScenarioDraft {
  const active = getQuestions(situation, answers);
  const values = Object.fromEntries(
    active
      .filter((question) => validateAnswer(question, answers[question.id]) === null)
      .map((question) => [question.id, answers[question.id]]),
  );
  const scenario: ScenarioDraft = {
    situation,
    referenceDate: todayLocal(),
    expectedBirthDate: dateOrNull(values.expectedBirthDate),
    birthDate: dateOrNull(values.birthDate),
    childAcceptanceDate: dateOrNull(values.childAcceptanceDate),
    childAgeYears: numberOrNull(values.childAgeYears),
    adoptionType:
      values.adoptionType === 'adoption' || values.adoptionType === 'fosterFamily'
        ? values.adoptionType
        : null,
    mother: null,
    father: null,
    special: {},
  };
  const childrenCount = numberOrNull(values.childrenCount);
  if (childrenCount !== null) scenario.childrenCount = childrenCount;
  const deferred = knownBoolean(values.schoolObligationDeferred);
  if (deferred !== undefined) scenario.schoolObligationDeferred = deferred;
  for (const role of parentRoles(values)) {
    const parent: Partial<ParentData> = { role };
    const title = values[`${role}.insuranceTitle`];
    if (title && title !== 'unknown') parent.insuranceTitle = title as InsuranceTitle;
    if (title === 'employment') parent.sicknessInsurance = 'mandatory';
    if (title === 'none') parent.sicknessInsurance = 'none';
    const voluntary = knownBoolean(values[`${role}.sicknessInsurance`]);
    if (voluntary !== undefined) parent.sicknessInsurance = voluntary ? 'voluntary' : 'none';
    parent.insuredSince = dateOrNull(values[`${role}.insuredSince`]);
    parent.insuranceEndDate = dateOrNull(values[`${role}.insuranceEndDate`]);
    parent.benefitBase = numberOrNull(values[`${role}.benefitBase`]);
    parent.contributionDebt = numberOrNull(values[`${role}.contributionDebt`]);
    const wantsLeave = knownBoolean(values[`${role}.wantsLeave`]);
    if (wantsLeave !== undefined) parent.wantsLeave = wantsLeave;
    scenario[role] = parent;
  }
  if (situation === 'afterBirth') {
    scenario.special = {
      pregnancyWeekAtBirth: numberOrNull(values.pregnancyWeekAtBirth),
      birthWeightGrams: numberOrNull(values.birthWeightGrams),
      hospitalizationDays:
        values.hospitalization === 'no' ? 0 : numberOrNull(values.hospitalizationDays),
    };
    const certificate = knownBoolean(values.zaZyciemCertificate);
    if (certificate !== undefined) scenario.special.zaZyciemCertificate = certificate;
  }
  return scenario;
}

/** Prezentacja dat jest niezależna od ustawień językowych przeglądarki. */
export function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
}

export function dateInputToIso(value: string): string {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value.split('/').reverse().join('-') : value;
}

export function formatAnswer(question: WizardQuestion, value: string | undefined): string {
  if (!value || value === 'unknown') return 'Do uzupełnienia później';
  if (question.type === 'choice')
    return (
      question.options?.find((option) => option.value === value)?.label ?? 'Do uzupełnienia później'
    );
  if (question.type === 'date') return displayDate(value);
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(Number(value));
}
