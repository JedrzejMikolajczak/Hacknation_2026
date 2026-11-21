import type {
  BenefitBaseInput,
  BenefitParams,
  InsuranceTitle,
  IsoDate,
  MonthlyIncome,
  ParentData,
  ParentRole,
  SituationType,
} from '@shared/types';
import { DEFAULT_PARAMS, formatRate } from '../../app/benefitParams';
import type { ScenarioDraft } from '../../app/scenarioDraft';
import { addDaysIso, formatPolishDate } from '../plan/planScenario';

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
  type: 'choice' | 'multiple' | 'date' | 'number';
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

function rateDeadlinePassed(
  event: string | null | undefined,
  reference: string,
  params: BenefitParams,
): boolean {
  return (
    !!event &&
    isIsoCalendarDate(event) &&
    reference > addDaysIso(event, params.combinedRateApplicationDeadlineDays)
  );
}

function applicableParents(
  situation: SituationType,
  answers: Record<string, string>,
): ParentRole[] {
  const roles = parentRoles(answers);
  return situation === 'afterBirth' &&
    answers.motherSituation === 'deceased' &&
    roles.includes('father')
    ? roles.filter((role) => role !== 'mother')
    : roles;
}

export function getQuestions(
  situation: SituationType,
  answers: Record<string, string>,
  params: BenefitParams = DEFAULT_PARAMS,
): WizardQuestion[] {
  const today = todayLocal();
  const roles = applicableParents(situation, answers);
  const motherDeceased =
    situation === 'afterBirth' &&
    answers.motherSituation === 'deceased' &&
    roles.includes('father');
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

  // Martwe urodzenie / zgon dziecka zmieniają wymiar urlopu; pytamy spokojnie, bez nacisku (CONVENTIONS §7).
  const childLost =
    situation === 'afterBirth' &&
    (answers.birthOutcome === 'stillbirth' || answers.birthOutcome === 'childDeath');

  // Dane faktycznego porodu są dostępne wyłącznie na ścieżce po narodzinach.
  if (situation === 'afterBirth') {
    questions.push({
      id: 'birthOutcome',
      stage: 1,
      type: 'choice',
      title: 'Czy dotyczy Was któraś z tych sytuacji?',
      label: 'Szczególne okoliczności',
      hint: 'Pytamy, ponieważ w takiej sytuacji przysługuje urlop w innym wymiarze. Uwzględnimy to w planie.',
      options: [
        { value: 'none', label: 'Nie dotyczy' },
        { value: 'stillbirth', label: 'Dziecko urodziło się martwe' },
        { value: 'childDeath', label: 'Dziecko zmarło po porodzie' },
      ],
    });
    if (answers.birthOutcome === 'childDeath') {
      questions.push({
        id: 'childDeathDate',
        stage: 1,
        type: 'date',
        title: 'Kiedy zmarło dziecko?',
        label: 'Data śmierci dziecka',
        min: answers.birthDate && answers.birthDate !== 'unknown' ? answers.birthDate : undefined,
        max: todayLocal(),
      });
    }
  }

  if (situation === 'afterBirth' && !childLost) {
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
  }

  // Zaświadczenie „Za życiem” wydaje się także w czasie ciąży – wydłuża urlop rodzicielski.
  if (situation === 'pregnant' || (situation === 'afterBirth' && !childLost)) {
    questions.push({
      id: 'zaZyciemCertificate',
      stage: 1,
      type: 'choice',
      title: 'Czy macie zaświadczenie „Za życiem”?',
      label: 'Zaświadczenie „Za życiem”',
      hint: 'Lekarz wystawia je w ciąży albo po porodzie. Wydłuża urlop rodzicielski.',
      options: YES_NO,
    });
  }

  // Sytuacja mamy decyduje, czy tata może przejąć część urlopu macierzyńskiego.
  if (
    (situation === 'pregnant' || situation === 'afterBirth') &&
    parentRoles(answers).includes('father')
  ) {
    questions.push({
      id: 'motherSituation',
      stage: 1,
      type: 'multiple',
      title: 'Czy któraś z tych sytuacji dotyczy mamy?',
      label: 'Sytuacja mamy',
      hint: 'Możesz zaznaczyć pobyt w szpitalu i orzeczenie jednocześnie. Te informacje pomagają ustalić, czy tata może przejąć część urlopu macierzyńskiego.',
      options: [
        { value: 'none', label: 'Nie dotyczy' },
        { value: 'hospitalized', label: 'Mama przebywa w szpitalu' },
        {
          value: 'incapable',
          label: 'Mama ma orzeczenie o niezdolności do samodzielnej egzystencji',
        },
        ...(situation === 'afterBirth' ? [{ value: 'deceased', label: 'Mama zmarła' }] : []),
      ],
    });
    if (motherDeceased) {
      questions.push({
        id: 'motherDeathDate',
        stage: 1,
        type: 'date',
        title: 'Kiedy zmarła mama dziecka?',
        label: 'Data zgonu mamy',
        min: answers.birthDate,
        max: today,
        hint: 'Ta data jest potrzebna do ustalenia początku urlopu taty.',
      });
    }
  }

  for (const role of roles) {
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
    if (title === 'employment' || title === 'mandateContract') {
      const payerName = title === 'employment' ? 'pracodawca' : 'zleceniodawca';
      questions.push({
        id: `${role}.employerInsuredCount`,
        stage: 2,
        type: 'number',
        title: `Ile osób ${payerName} ${person} zgłasza do ubezpieczenia chorobowego?`,
        label: `Liczba osób zgłoszonych przez płatnika ${person}`,
        min: 1,
        step: '1',
        hint: `Jeśli więcej niż ${DEFAULT_PARAMS.payerThresholdInsuredCount}, zasiłek wypłaca ${payerName}. W innym przypadku wypłaca ZUS. Wystarczy przybliżona liczba.`,
        unknownLabel: 'Nie wiem – sprawdzimy to później',
      });
    }
    if (role === 'mother' && title === 'employment' && situation !== 'adoption') {
      questions.push({
        id: 'mother.age',
        stage: 2,
        type: 'number',
        title: 'Ile lat ma mama?',
        label: 'Wiek mamy',
        min: 15,
        max: 70,
        step: '1',
        hint: 'Od 50. roku życia pracodawca wypłaca wynagrodzenie chorobowe przez krótszy okres, a potem zasiłek wypłaca ZUS.',
        unknownLabel: 'Wolę nie podawać',
      });
    }
    if (
      role === 'mother' &&
      title === 'employment' &&
      (situation === 'pregnant' || situation === 'afterBirth')
    ) {
      questions.push({
        id: 'employerBankruptcyOrLiquidation',
        stage: 2,
        type: 'choice',
        title:
          'Czy umowa mamy rozwiązała się (albo rozwiąże) z powodu upadłości lub likwidacji pracodawcy?',
        label: 'Upadłość lub likwidacja pracodawcy',
        hint: 'W takiej sytuacji ZUS może wypłacać zasiłek w wysokości zasiłku macierzyńskiego.',
        options: YES_NO,
      });
    }
    const motherSicknessInsured =
      title === 'employment' || answers['mother.sicknessInsurance'] === 'yes';
    if (
      role === 'mother' &&
      motherSicknessInsured &&
      (situation === 'pregnant' || situation === 'afterBirth')
    ) {
      const pregnant = situation === 'pregnant';
      questions.push({
        id: 'mother.pregnancySickLeave',
        stage: 2,
        type: 'choice',
        title: pregnant
          ? 'Czy mama jest albo była na zwolnieniu lekarskim w tej ciąży?'
          : 'Czy mama była na zwolnieniu lekarskim w ciąży?',
        label: 'Zwolnienie lekarskie w ciąży',
        hint: 'Od daty zwolnienia zależy zasiłek chorobowy. Gdy zwolnienie trwa do porodu, wpływa też na podstawę zasiłku macierzyńskiego.',
        options: YES_NO,
      });
      if (answers['mother.pregnancySickLeave'] === 'yes') {
        const start = answers['mother.sickLeaveStart'];
        questions.push(
          {
            id: 'mother.sickLeaveStart',
            stage: 2,
            type: 'date',
            title: pregnant
              ? 'Od kiedy trwa (lub trwało) zwolnienie?'
              : 'Od kiedy trwało zwolnienie?',
            label: 'Początek zwolnienia w ciąży',
            max: todayLocal(),
            unknownLabel: 'Nie pamiętam dokładnej daty',
          },
          {
            id: 'mother.sickLeaveUntilBirth',
            stage: 2,
            type: 'choice',
            title: pregnant
              ? 'Czy zwolnienie potrwa aż do porodu?'
              : 'Czy zwolnienie trwało aż do porodu?',
            label: 'Zwolnienie do porodu',
            options: YES_NO,
          },
        );
        if (answers['mother.sickLeaveUntilBirth'] === 'no') {
          questions.push({
            id: 'mother.sickLeaveEnd',
            stage: 2,
            type: 'date',
            title: pregnant
              ? 'Do kiedy trwa (lub trwało) zwolnienie?'
              : 'Do kiedy trwało zwolnienie?',
            label: 'Koniec zwolnienia w ciąży',
            min: start && start !== 'unknown' ? start : undefined,
            max:
              !pregnant && answers.birthDate && answers.birthDate !== 'unknown'
                ? answers.birthDate
                : undefined,
            unknownLabel: 'Nie znam jeszcze daty',
          });
        }
      }
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

  for (const role of roles) {
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
    // Bez znanej podstawy pytamy o zarobki – z nich silnik policzy podstawę wymiaru.
    const lookback = DEFAULT_PARAMS.benefitBase.lookbackMonths;
    if (answers[`${role}.benefitBase`] === 'unknown') {
      const title = answers[`${role}.insuranceTitle`];
      if (title === 'employment' || title === 'mandateContract') {
        questions.push({
          id: `${role}.averageGross`,
          stage: 3,
          type: 'number',
          title: `Ile wynosiło przeciętne miesięczne wynagrodzenie brutto ${person} w ostatnich ${lookback} miesiącach?`,
          label: `Przeciętne wynagrodzenie brutto ${person} (zł)`,
          min: 0,
          step: '0.01',
          hint: `Na tej podstawie policzymy podstawę wymiaru zasiłku. Jeśli zarobki się zmieniały, podajcie średnią. Przy zatrudnieniu krótszym niż ${lookback} miesięcy – średnią z przepracowanych miesięcy.`,
          unknownLabel: 'Uzupełnię później',
        });
        questions.push({
          id: `${role}.contractSalary`,
          stage: 3,
          type: 'number',
          title: `Jakie jest miesięczne wynagrodzenie brutto ${person} według umowy?`,
          label: `Wynagrodzenie z umowy ${person} (zł)`,
          min: 0,
          step: '0.01',
          hint: 'Potrzebne, gdy ubezpieczenie trwa krócej niż pełny miesiąc albo któryś miesiąc nie był przepracowany w całości.',
          unknownLabel: 'Uzupełnię później',
        });
      }
      if (title === 'selfEmployed') {
        questions.push({
          id: `${role}.declaredContributionBase`,
          stage: 3,
          type: 'number',
          title: `Od jakiej miesięcznej kwoty ${person} opłaca składkę chorobową?`,
          label: `Zadeklarowana podstawa składek ${person} (zł)`,
          min: 0,
          step: '0.01',
          hint: 'To zadeklarowana podstawa wymiaru składek, np. z deklaracji rozliczeniowej ZUS DRA.',
          unknownLabel: 'Uzupełnię później',
        });
      }
    }
  }

  if (
    !childLost &&
    !motherDeceased &&
    roles.length > 0 &&
    (roles.includes('mother') || situation === 'adoption')
  ) {
    const { rates, combinedRateApplicationDeadlineDays: deadline } = params;
    const event =
      situation === 'afterBirth'
        ? answers.birthDate
        : situation === 'adoption' && answers.adoptionStage === 'accepted'
          ? answers.childAcceptanceDate
          : undefined;
    const expired = rateDeadlinePassed(event, today, params);
    const standard = {
      value: 'standard',
      label: `${formatRate(rates.maternity)}, a potem ${formatRate(rates.parental)}`,
      description: `${formatRate(rates.maternity)} za urlop macierzyński, ${formatRate(rates.parental)} za rodzicielski.`,
    };
    questions.push({
      id: 'rateVariant',
      stage: 3,
      type: 'choice',
      title: expired
        ? 'Obowiązują stawki rozdzielone'
        : 'Jak chcecie otrzymywać zasiłek macierzyński?',
      label: 'Wariant wysokości zasiłku',
      hint: expired
        ? `Termin na złożenie nowego wniosku o ${formatRate(rates.combined)} upłynął ${formatPolishDate(addDaysIso(event!, deadline))}.`
        : `Wariant ${formatRate(rates.combined)} wymaga wniosku w ciągu ${deadline} dni od porodu lub przyjęcia dziecka. Drugi rodzic za swoje tygodnie urlopu rodzicielskiego dostaje zawsze ${formatRate(rates.secondParentNonTransferableInCombined)}.`,
      options: expired
        ? [standard]
        : [
            {
              value: 'combined',
              label: `${formatRate(rates.combined)} przez cały okres`,
              description: 'Ta sama kwota co miesiąc przez urlop macierzyński i rodzicielski.',
            },
            standard,
            { value: 'unknown', label: 'Jeszcze nie wiemy – pokażcie porównanie' },
          ],
    });
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
  if (question.type === 'multiple') {
    const selected = value.split(',');
    const valid = selected.every((entry) =>
      question.options?.some((option) => option.value === entry),
    );
    return valid &&
      new Set(selected).size === selected.length &&
      (selected.length === 1 || !selected.some((entry) => entry === 'none' || entry === 'deceased'))
      ? null
      : 'Wybierz sytuacje, które mają zastosowanie.';
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
  if (!isIsoCalendarDate(value)) return 'Wpisz poprawną datę w formacie DD/MM/YYYY.';
  if (typeof question.min === 'string' && value < question.min)
    return 'Data jest wcześniejsza niż dozwolona.';
  if (typeof question.max === 'string' && value > question.max)
    return 'Ta data nie może być w przyszłości.';
  return null;
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
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
  const questions = getQuestions(situation, next);
  const active = new Set(questions.map((question) => question.id));
  const rate = questions.find((question) => question.id === 'rateVariant');
  if (rate?.options?.length === 1) next.rateVariant = 'standard';
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

/** 'YYYY-MM' miesiąca przesuniętego o `offset` względem miesiąca daty ISO. */
function shiftMonth(date: IsoDate, offset: number): string {
  const [year, month] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function addDays(date: IsoDate, days: number): IsoDate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Przygotowuje dane do wyliczenia podstawy wymiaru (bez liczenia – to robi silnik).
 * Miesiące: pełne miesiące kalendarzowe przed miesiącem powstania prawa, nie dawniej niż
 * `lookbackMonths` i nie wcześniej niż od początku ubezpieczenia.
 */
function buildBenefitBaseInput(
  parent: Partial<ParentData>,
  values: Record<string, string>,
  role: ParentRole,
  params: BenefitParams,
  rightArisesOn: IsoDate,
  previousBenefitEndDate: IsoDate | null,
): BenefitBaseInput | null {
  if (parent.benefitBase !== null || !parent.insuranceTitle) return null;
  const averageGross = numberOrNull(values[`${role}.averageGross`]);
  const declaredBase = numberOrNull(values[`${role}.declaredContributionBase`]);
  const contractSalary = numberOrNull(values[`${role}.contractSalary`]);
  if (averageGross === null && declaredBase === null && contractSalary === null) return null;

  const insuredSince = parent.insuredSince ?? null;
  const firstFullMonth = insuredSince
    ? shiftMonth(insuredSince, insuredSince.endsWith('-01') ? 0 : 1)
    : null;

  const incomes: MonthlyIncome[] = [];
  if (averageGross !== null) {
    for (let offset = params.benefitBase.lookbackMonths; offset >= 1; offset -= 1) {
      const month = shiftMonth(rightArisesOn, -offset);
      if (firstFullMonth && month < firstFullMonth) continue;
      incomes.push({
        month,
        grossAmount: averageGross,
        workedDays: null,
        requiredWorkingDays: null,
      });
    }
  }

  return {
    insuranceTitle: parent.insuranceTitle,
    rightArisesOn,
    incomes,
    contractMonthlySalary: contractSalary,
    declaredContributionBase: declaredBase,
    previousBenefitEndDate,
    previousBenefitBase: null,
  };
}

export function buildScenario(
  situation: SituationType,
  answers: Record<string, string>,
  params: BenefitParams = DEFAULT_PARAMS,
): ScenarioDraft {
  const active = getQuestions(situation, answers, params);
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
  if (active.find((question) => question.id === 'rateVariant')?.options?.length === 1)
    scenario.rateVariant = 'standard';
  else if (values.rateVariant === 'combined' || values.rateVariant === 'standard')
    scenario.rateVariant = values.rateVariant;

  // Zwolnienie w ciąży: koniec przy zwolnieniu do porodu = dzień przed (przewidywanym) porodem.
  const birth = scenario.birthDate ?? scenario.expectedBirthDate ?? null;
  if (values['mother.pregnancySickLeave'] === 'yes') {
    const untilBirth = knownBoolean(values['mother.sickLeaveUntilBirth']) ?? null;
    scenario.pregnancySickLeave = {
      startDate: dateOrNull(values['mother.sickLeaveStart']),
      untilBirth,
      endDate:
        untilBirth === true
          ? birth && addDays(birth, -1)
          : untilBirth === false
            ? dateOrNull(values['mother.sickLeaveEnd'])
            : null,
    };
  } else if (values['mother.pregnancySickLeave'] === 'no') {
    scenario.pregnancySickLeave = null;
  }
  const maternityRightArisesOn =
    birth ?? scenario.childAcceptanceDate ?? scenario.referenceDate ?? todayLocal();

  for (const role of applicableParents(situation, values)) {
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
    parent.employerInsuredCount = numberOrNull(values[`${role}.employerInsuredCount`]);
    if (role === 'mother') parent.age = numberOrNull(values['mother.age']);
    const wantsLeave = knownBoolean(values[`${role}.wantsLeave`]);
    if (wantsLeave !== undefined) parent.wantsLeave = wantsLeave;
    scenario[role] = parent;

    // Zasiłek macierzyński: przy ciągłości ze zwolnieniem silnik może przejąć podstawę chorobowego.
    const previousEnd = role === 'mother' ? (scenario.pregnancySickLeave?.endDate ?? null) : null;
    const baseInput = buildBenefitBaseInput(
      parent,
      values,
      role,
      params,
      maternityRightArisesOn,
      previousEnd,
    );
    if (baseInput)
      scenario.benefitBaseInputs = { ...scenario.benefitBaseInputs, [role]: baseInput };

    // Zasiłek chorobowy w ciąży: prawo powstaje w dniu rozpoczęcia zwolnienia.
    const sickLeaveStart = role === 'mother' ? scenario.pregnancySickLeave?.startDate : null;
    if (sickLeaveStart) {
      const sicknessInput = buildBenefitBaseInput(
        parent,
        values,
        role,
        params,
        sickLeaveStart,
        null,
      );
      if (sicknessInput) scenario.sicknessBenefitBaseInput = sicknessInput;
    }
  }
  const special: NonNullable<ScenarioDraft['special']> = {};
  if (situation === 'afterBirth') {
    const lost = values.birthOutcome === 'stillbirth' || values.birthOutcome === 'childDeath';
    if (values.birthOutcome) {
      special.stillbirth = values.birthOutcome === 'stillbirth';
      special.childDeathDate =
        values.birthOutcome === 'childDeath' ? dateOrNull(values.childDeathDate) : null;
    }
    if (!lost) {
      special.pregnancyWeekAtBirth = numberOrNull(values.pregnancyWeekAtBirth);
      special.birthWeightGrams = numberOrNull(values.birthWeightGrams);
      special.hospitalizationDays =
        values.hospitalization === 'no' ? 0 : numberOrNull(values.hospitalizationDays);
    }
  }
  const certificate = knownBoolean(values.zaZyciemCertificate);
  if (certificate !== undefined) special.zaZyciemCertificate = certificate;
  if (values.motherSituation) {
    const situations = values.motherSituation.split(',');
    special.motherHospitalized = situations.includes('hospitalized');
    special.motherIncapableOfIndependentLiving = situations.includes('incapable');
    special.motherDeceased = values.motherSituation === 'deceased';
    if (special.motherDeceased) scenario.motherDeathDate = dateOrNull(values.motherDeathDate);
  }
  const bankruptcy = knownBoolean(values.employerBankruptcyOrLiquidation);
  if (bankruptcy !== undefined) special.employerBankruptcyOrLiquidation = bankruptcy;
  scenario.special = special;
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
  if (question.type === 'multiple')
    return (
      question.options
        ?.filter((option) => value.split(',').includes(option.value))
        .map((option) => option.label)
        .join(', ') || 'Do uzupełnienia później'
    );
  if (question.type === 'choice')
    return (
      question.options?.find((option) => option.value === value)?.label ?? 'Do uzupełnienia później'
    );
  if (question.type === 'date') return displayDate(value);
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(Number(value));
}
