import type {
  BenefitParams,
  EligibilityResult,
  ScenarioInput,
  Warning,
} from '@shared/types';
import defaultParamsJson from '@shared/params.json';
import type { ScenarioDraft } from '../../app/ScenarioContext';

export const DEFAULT_BENEFIT_PARAMS: BenefitParams = defaultParamsJson as BenefitParams;

export interface AssistantAnswer {
  answer: string;
  sources: string[];
}

export interface RiskGuideDetail {
  title: string;
  action: string;
}

export interface TailoredTip {
  id: string;
  title: string;
  description: string;
  action: string;
  legalBasis: string;
}

export interface SpecialSituationGuide {
  id:
    | 'premature'
    | 'zaZyciem'
    | 'motherHospitalized'
    | 'motherDeceased'
    | 'loss'
    | 'adoption'
    | 'bankruptcy';
  title: string;
  summary: string;
  steps: string[];
  legalBasis: string;
}

export interface HelpChannel {
  name: string;
  description: string;
  actionLabel: string;
  href: string;
  isExternal: boolean;
}

export const SUGGESTED_QUESTIONS: string[] = [
  'Co jeśli spóźnię się z wnioskiem o 81,5%?',
  'Mam działalność gospodarczą – czy mały dług blokuje zasiłek?',
  'Kończy mi się umowa w ciąży – co wtedy?',
  'Czy tata ma urlop, jeśli mama nie pracowała?',
  'Co przysługuje przy wcześniaku lub pobycie dziecka w szpitalu?',
];

export const WARNING_GUIDES: Record<Warning['code'], RiskGuideDetail> = {
  SELF_EMPLOYED_DEBT: {
    title: 'Zaległość w składkach ZUS (działalność gospodarcza)',
    action:
      'Sprawdź saldo składek na PUE/eZUS i spłać zadłużenie przed dniem porodu lub powstania prawa do zasiłku (dług powyżej 1% płacy minimalnej wstrzymuje wypłatę do czasu spłaty).',
  },
  NO_INSURANCE_ON_BIRTH_DATE: {
    title: 'Brak aktywnego ubezpieczenia chorobowego w dniu porodu',
    action:
      'Jeśli w dniu porodu nie podlegasz ubezpieczeniu chorobowemu, zasiłek macierzyński z ZUS może nie przysługiwać. Sprawdź jednak prawo do świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy lub miasta.',
  },
  CONTRACT_ENDS_BEFORE_BIRTH: {
    title: 'Umowa kończy się przed przewidywaną datą porodu',
    action:
      'Przy umowie o pracę na czas określony, która kończyłaby się po upływie 3. miesiąca ciąży, umowa przedłuża się z mocy prawa do dnia porodu. Po porodzie zasiłek wypłaca bezpośrednio ZUS.',
  },
  SHAM_CONTRACT_RISK: {
    title: 'Ryzyko weryfikacji tytułu ubezpieczenia przez ZUS',
    action:
      'Zadbaj o dokumenty potwierdzające faktyczne wykonywanie pracy lub prowadzenie firmy (efekty pracy, korespondencja, przelewy, faktury), ponieważ ZUS może przeprowadzić postępowanie wyjaśniające.',
  },
  BASE_INCREASE_IN_PREGNANCY: {
    title: 'Znaczne podwyższenie podstawy składek lub pensji w ciąży',
    action:
      'Nagły wzrost podstawy wymiaru tuż przed zwolnieniem lekarskim lub porodem bywa kontrolowany przez ZUS. Przy działalności warto pamiętać o zasadach uśredniania podstawy za 12 miesięcy.',
  },
  COMBINED_RATE_DEADLINE: {
    title: 'Pilnuj terminu 21 dni na wniosek o stawkę 81,5%',
    action:
      'Złóż wniosek o wypłatę 81,5% za cały okres najpóźniej do 21 dni po porodzie (u pracodawcy albo w ZUS). Po tym terminie otrzymasz 100% za macierzyński i 70% za rodzicielski.',
  },
  WAITING_PERIOD_NOT_MET: {
    title: 'Okres wyczekiwania na zasiłek chorobowy w ciąży',
    action:
      'Prawo do zasiłku chorobowego powstaje po 30 dniach nieprzerwanego ubezpieczenia obowiązkowego (umowa o pracę) lub po 90 dniach ubezpieczenia dobrowolnego (działalność, umowa zlecenie). Dla zasiłku macierzyńskiego nie ma okresu wyczekiwania.',
  },
};

function daysBetweenIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.floor((endMs - startMs) / 86_400_000);
}

/**
 * Dodatkowe przypomnienia dopasowane ściśle do profilu zalogowanego użytkownika
 * (np. JDG bez długu, zlecenie, drugi rodzic korzystający z urlopu).
 */
export function getTailoredTipsForScenario(
  scenario: ScenarioInput,
  params: BenefitParams,
): TailoredTip[] {
  const tips: TailoredTip[] = [];

  if (scenario.mother.insuranceTitle === 'selfEmployed') {
    const debtLimit =
      Math.round(
        params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
      ) / 100;
    tips.push({
      id: 'jdg-clean-account',
      title: 'Prowadzisz działalność (JDG) – pilnuj braku nawet drobnych niedopłat',
      description: `Dla osób na JDG zaległość powyżej ${debtLimit.toFixed(2).replace('.', ',')} zł w dniu powstania prawa do zasiłku wstrzymuje wypłatę świadczenia.`,
      action:
        'Przed porodem zaloguj się na PUE/eZUS i sprawdź rozliczenia składek oraz pamiętaj, że przy wyliczaniu podstawy bierze się średnią z 12 miesięcy.',
      legalBasis: 'Ustawa zasiłkowa art. 2a',
    });
  }

  if (scenario.mother.insuranceTitle === 'mandateContract') {
    tips.push({
      id: 'mandate-voluntary',
      title: 'Umowa zlecenie – ubezpieczenie chorobowe jest dobrowolne',
      description:
        'Na umowie zlecenie zasiłek chorobowy w ciąży przysługuje po 90 dniach opłacania dobrowolnej składki chorobowej (sam zasiłek macierzyński przysługuje od razu, jeśli składka jest aktywna w dniu porodu).',
      action:
        'Sprawdź na pasku wypłat lub w PUE/eZUS, czy zleceniodawca zgłosił Cię do dobrowolnego ubezpieczenia chorobowego i opłaca składki bez przerw.',
      legalBasis: 'Ustawa zasiłkowa art. 4 i art. 29',
    });
  }

  if (scenario.father && scenario.father.wantsLeave) {
    tips.push({
      id: 'second-parent-9-weeks',
      title: `Urlop drugiego rodzica (${params.parentalLeave.nonTransferableWeeksPerParent} tyg.) i ojcowski (${params.paternityLeave.weeks} tyg.)`,
      description: `Z puli urlopu rodzicielskiego ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni należy wyłącznie do drugiego rodzica i nie przechodzi na Mamę.`,
      action: `Zaplanuj te tygodnie w „Planie urlopów” (ojcowski do ${params.paternityLeave.deadlineChildAgeMonths}. mies. życia dziecka, a rodzicielski do końca roku, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat).`,
      legalBasis: 'KP art. 182^1a § 4 i art. 182^3',
    });
  }

  return tips;
}

export function getSpecialSituations(params: BenefitParams): SpecialSituationGuide[] {
  return [
    {
      id: 'premature',
      title: 'Wcześniak lub dłuższy pobyt dziecka w szpitalu',
      summary:
        'Rodzicom dzieci przedwcześnie urodzonych lub hospitalizowanych przysługuje dodatkowy uzupełniający urlop macierzyński (płatny 100%).',
      steps: [
        'Wymiar to 1 tydzień urlopu za każdy tydzień pobytu dziecka w szpitalu — do 8 lub 15 tygodni (zależnie od tygodnia ciąży i masy urodzeniowej).',
        `Wniosek składasz jednorazowo najpóźniej ${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed końcem podstawowego urlopu macierzyńskiego.`,
        'Potrzebne będzie zaświadczenie ze szpitala o okresie pobytu dziecka, tygodniu ciąży i masie urodzeniowej.',
      ],
      legalBasis: 'KP art. 180^2',
    },
    {
      id: 'zaZyciem',
      title: 'Zaświadczenie z programu „Za życiem”',
      summary:
        'Przy ciężkim i nieodwracalnym upośledzeniu albo nieuleczalnej chorobie zagrażającej życiu dziecka przysługuje znacznie dłuższy urlop rodzicielski.',
      steps: [
        `Urlop rodzicielski wydłuża się z ${params.parentalLeave.weeksSingleChild} do ${params.parentalLeave.weeksSingleChildZaZyciem} tygodni (przy jednym dziecku) lub z ${params.parentalLeave.weeksMultipleChildren} do ${params.parentalLeave.weeksMultipleChildrenZaZyciem} tygodni (przy ciąży mnogiej).`,
        'Oprócz zasiłku z ZUS możesz złożyć wniosek w urzędzie gminy/OPS o jednorazowe wsparcie 4000 zł z programu „Za życiem” (do 12 miesięcy od narodzin).',
      ],
      legalBasis: 'KP art. 182^1a § 2',
    },
    {
      id: 'motherHospitalized',
      title: 'Pobyt mamy w szpitalu lub choroba uniemożliwiająca opiekę',
      summary:
        'Jeśli mama po 8 tygodniach od porodu przebywa w szpitalu albo ma orzeczenie o niezdolności do samodzielnej egzystencji, ojciec (lub inny ubezpieczony członek rodziny) może przejąć urlop i zasiłek.',
      steps: [
        'Mama przerywa swój urlop macierzyński na czas pobytu w szpitalu, a ojciec składa wniosek o swoją część.',
        'Do wniosku dołącza się zaświadczenie o terminie przyjęcia mamy do szpitala (a po wyjściu – zaświadczenie o dacie wypisu).',
      ],
      legalBasis: 'KP art. 180 § 6–10',
    },
    {
      id: 'motherDeceased',
      title: 'Zgon mamy dziecka',
      summary:
        'W sytuacji śmierci matki prawo do niewykorzystanej części urlopu macierzyńskiego i zasiłku przechodzi bezpośrednio na ubezpieczonego ojca dziecka albo innego ubezpieczonego członka najbliższej rodziny.',
      steps: [
        'Zasiłek przysługuje od następnego dnia po zgonie matki za pozostały wymiar urlopu macierzyńskiego i rodzicielskiego.',
        'Do wniosku dołącza się odpis aktu urodzenia dziecka oraz odpis aktu zgonu matki.',
      ],
      legalBasis: 'KP art. 180 § 12, Ustawa zasiłkowa art. 29a',
    },
    {
      id: 'adoption',
      title: 'Adopcja lub rodzina zastępcza',
      summary:
        'Rodzice adopcyjni i zastępczy mają prawo do urlopu na warunkach urlopu macierzyńskiego, urlopu rodzicielskiego oraz ojcowskiego.',
      steps: [
        `Wymiar urlopu na warunkach macierzyńskiego wynosi 20–37 tygodni (minimum ${params.adoptionMaternityLeave.minWeeks} tyg.) w zależności od liczby przyjętych dzieci.`,
        `Dla rodziny zastępczej limit wieku dziecka to ${params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYears} lat (${params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYearsDeferredSchool} lat przy odroczeniu obowiązku szkolnego), a dla przysposobienia – ${params.adoptionMaternityLeave.adoptionMaxChildAgeYears} lat.`,
        `Urlop ojcowski wynosi ${params.paternityLeave.weeks} tygodnie i można go wykorzystać w ciągu ${params.paternityLeave.adoptionDeadlineMonthsFromAdoption} miesięcy od uprawomocnienia postanowienia o przysposobieniu.`,
      ],
      legalBasis: 'KP art. 183, Ustawa zasiłkowa art. 29',
    },
    {
      id: 'bankruptcy',
      title: 'Upadłość lub likwidacja pracodawcy',
      summary:
        'Jeśli pracodawca ogłosił upadłość lub likwidację w czasie ciąży i nie zapewnił innego zatrudnienia, zachowujesz ciągłość wsparcia.',
      steps: [
        'Do dnia porodu przysługuje zasiłek w wysokości zasiłku macierzyńskiego (wypłacany bezpośrednio przez ZUS).',
        'Po porodzie zachowujesz prawo do normalnego zasiłku macierzyńskiego za pełny okres.',
      ],
      legalBasis: 'Ustawa zasiłkowa art. 30 ust. 3',
    },
    {
      id: 'loss',
      title: 'Utrata ciąży lub śmierć dziecka',
      summary:
        'W tej sytuacji również przysługuje skrócony urlop macierzyński oraz zasiłek macierzyński — formalności można załatwić spokojnie i bez pośpiechu.',
      steps: [
        `Przy martwym urodzeniu lub zgonie dziecka przed ${params.childDeath.thresholdWeeksOfLife}. tygodniem życia przysługuje ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni urlopu po porodzie (nie krócej niż ${params.childDeath.minDaysAfterDeath} dni od dnia zgonu dziecka).`,
        `Przy zgonie dziecka po ${params.childDeath.thresholdWeeksOfLife}. tygodniu życia zachowujesz prawo do zasiłku przez ${params.childDeath.minDaysAfterDeath} dni od dnia zgonu.`,
        'Do wniosku u pracodawcy lub w ZUS dołącza się odpis skrócony aktu urodzenia (z adnotacją o martwym urodzeniu, jeśli dotyczy).',
      ],
      legalBasis: 'KP art. 180^1',
    },
  ];
}

/**
 * Wybiera wyłącznie te sytuacje szczególne i trudne, które pasują do danych użytkownika.
 */
export function getMatchingSpecialSituationIds(
  scenario: ScenarioInput,
): SpecialSituationGuide['id'][] {
  const ids: SpecialSituationGuide['id'][] = [];
  const s = scenario.special;

  if (s.stillbirth || s.childDeathDate !== null) ids.push('loss');
  if (s.motherDeceased) ids.push('motherDeceased');
  if (s.zaZyciemCertificate) ids.push('zaZyciem');
  if (
    (s.pregnancyWeekAtBirth !== null && s.pregnancyWeekAtBirth < 37) ||
    (s.birthWeightGrams !== null && s.birthWeightGrams <= 1000) ||
    (s.hospitalizationDays !== null && s.hospitalizationDays > 0)
  ) {
    ids.push('premature');
  }
  if (s.motherHospitalized || s.motherIncapableOfIndependentLiving) {
    ids.push('motherHospitalized');
  }
  if (s.employerBankruptcyOrLiquidation) ids.push('bankruptcy');
  if (scenario.situation === 'adoption' || scenario.adoptionType !== null) {
    ids.push('adoption');
  }

  return ids;
}

export const HELP_CHANNELS: HelpChannel[] = [
  {
    name: 'e-wizyta w ZUS (wideorozmowa)',
    description:
      'Bezpłatna rozmowa online z doradcą ZUS bez wychodzenia z domu — przydatna przed wysłaniem wniosku.',
    actionLabel: 'Informacje na zus.pl',
    href: 'https://www.zus.pl/e-wizyta',
    isExternal: true,
  },
  {
    name: 'PUE / eZUS i Centrum Kontaktu (22 560 16 00)',
    description:
      'Sprawdzisz tu swoje składki, e-ZLA, stan zadłużenia JDG oraz wyślesz elektroniczne formularze ZAM / ZAS-53.',
    actionLabel: 'Przejdź do zus.pl',
    href: 'https://www.zus.pl',
    isExternal: true,
  },
  {
    name: 'Państwowa Inspekcja Pracy (PIP)',
    description:
      'Bezpłatne porady prawne z zakresu ochrony ciąży, terminów urlopów u pracodawcy i przedłużenia umowy.',
    actionLabel: 'Poradnik PIP dla rodziców',
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
    isExternal: true,
  },
];

export function buildSupportScenario(draft: ScenarioDraft): ScenarioInput {
  const referenceDate = draft.referenceDate ?? '2026-11-21';
  const situation = draft.situation ?? 'pregnant';
  const birthDate = draft.birthDate ?? '2026-12-15';

  return {
    situation,
    referenceDate,
    expectedBirthDate: draft.expectedBirthDate ?? birthDate,
    birthDate,
    childrenCount: draft.childrenCount ?? 1,
    adoptionType: draft.adoptionType ?? null,
    childAcceptanceDate: draft.childAcceptanceDate ?? null,
    childAgeYears: draft.childAgeYears ?? null,
    schoolObligationDeferred: draft.schoolObligationDeferred ?? false,
    rateVariant: draft.rateVariant ?? 'combined',
    mother: draft.mother ?? {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2023-05-01',
      insuranceEndDate: null,
      benefitBase: 5500,
      employerInsuredCount: 45,
      age: 30,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: draft.father ?? {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2022-01-10',
      insuranceEndDate: null,
      benefitBase: 6200,
      employerInsuredCount: 30,
      age: 32,
      contributionDebt: null,
      wantsLeave: true,
    },
    special: draft.special ?? {
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

export function buildDemoEligibility(
  scenario: ScenarioInput,
  params: BenefitParams,
): EligibilityResult {
  const warnings: Warning[] = [];
  const debtThreshold =
    params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage;

  if (
    scenario.mother.insuranceTitle === 'selfEmployed' &&
    (scenario.mother.contributionDebt ?? 0) > debtThreshold
  ) {
    warnings.push({
      code: 'SELF_EMPLOYED_DEBT',
      message: `Wykryto zadłużenie składkowe na działalności (${(scenario.mother.contributionDebt ?? 0).toFixed(2).replace('.', ',')} zł), które przekracza 1% płacy minimalnej.`,
      legalBasis: 'Ustawa zasiłkowa art. 2a',
    });
  }

  if (scenario.mother.sicknessInsurance === 'none') {
    warnings.push({
      code: 'NO_INSURANCE_ON_BIRTH_DATE',
      message: 'W profilu wskazano brak aktywnego ubezpieczenia chorobowego.',
      legalBasis: 'Ustawa zasiłkowa art. 29',
    });
  }

  const birthRef = scenario.birthDate ?? scenario.expectedBirthDate ?? scenario.referenceDate;
  if (scenario.mother.insuranceEndDate && scenario.mother.insuranceEndDate < birthRef) {
    warnings.push({
      code: 'CONTRACT_ENDS_BEFORE_BIRTH',
      message: `Umowa kończy się (${scenario.mother.insuranceEndDate}) przed przewidywaną datą porodu (${birthRef}).`,
      legalBasis: 'KP art. 177 § 3',
    });
  }

  if (scenario.mother.insuredSince) {
    const insuredDays = daysBetweenIso(scenario.mother.insuredSince, scenario.referenceDate);
    const requiredDays =
      scenario.mother.sicknessInsurance === 'voluntary'
        ? params.sickness.waitingPeriodDaysVoluntary
        : scenario.mother.sicknessInsurance === 'mandatory'
          ? params.sickness.waitingPeriodDaysMandatory
          : 0;

    if (requiredDays > 0 && insuredDays < requiredDays) {
      warnings.push({
        code: 'WAITING_PERIOD_NOT_MET',
        message: `Obecny staż ubezpieczenia chorobowego (${insuredDays} dni) jest krótszy niż wymagany okres wyczekiwania (${requiredDays} dni) dla zasiłku chorobowego.`,
        legalBasis: 'Ustawa zasiłkowa art. 4',
      });
    }
  }

  if (
    scenario.rateVariant === 'combined' &&
    !scenario.special.stillbirth &&
    scenario.special.childDeathDate === null
  ) {
    warnings.push({
      code: 'COMBINED_RATE_DEADLINE',
      message: `Wybrano równą stawkę 81,5% — wymaga ona złożenia wniosku w ciągu ${params.combinedRateApplicationDeadlineDays} dni po porodzie.`,
      legalBasis: 'Ustawa zasiłkowa art. 30a',
    });
  }

  return {
    entitlements: [],
    warnings,
  };
}

export function buildDemoAssistantAnswer(
  rawQuestion: string,
  params: BenefitParams,
): AssistantAnswer {
  const q = rawQuestion.toLowerCase();

  if (q.includes('81,5') || q.includes('81.5') || q.includes('spóźni') || q.includes('wnios')) {
    return {
      answer: `Wniosek o wypłatę zasiłku w wysokości ${Math.round(params.rates.combined * 1000) / 10}% za cały okres trzeba złożyć najpóźniej w ciągu ${params.combinedRateApplicationDeadlineDays} dni po porodzie. Jeśli spóźnisz się choćby o jeden dzień, otrzymasz ${Math.round(params.rates.maternity * 100)}% za urlop macierzyński oraz ${Math.round(params.rates.parental * 100)}% za urlop rodzicielski. Uwaga: 9 tygodni drugiego rodzica w obu wariantach jest płatne ${Math.round(params.rates.secondParentNonTransferableInCombined * 100)}%.`,
      sources: ['Poradnik dla rodziców ZUS 2026', 'Ustawa zasiłkowa art. 30a'],
    };
  }

  if (q.includes('dług') || q.includes('działalnoś') || q.includes('jdg') || q.includes('zaległ')) {
    const threshold =
      Math.round(
        params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
      ) / 100;
    return {
      answer: `Przy własnej działalności gospodarczej zadłużenie przekraczające 1% płacy minimalnej (obecnie ok. ${threshold.toFixed(2).replace('.', ',')} zł) w dniu powstania prawa do zasiłku wstrzymuje wypłatę. Prawo do zasiłku nie przepada na stałe — po całkowitej spłacie zadłużenia ZUS uruchomi wypłatę (jeśli uregulujesz dług w ciągu 6 miesięcy od powstania prawa).`,
      sources: ['Ustawa zasiłkowa art. 2a', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  if (q.includes('umow') || q.includes('kończy') || q.includes('ciąży')) {
    return {
      answer:
        'Jeśli pracujesz na umowę o pracę na czas określony, która kończyłaby się po upływie 3. miesiąca ciąży, umowa automatycznie przedłuża się do dnia porodu. W dniu porodu podlegasz więc ubezpieczeniu i ZUS wypłaci Ci zasiłek macierzyński również po zakończeniu umowy.',
      sources: ['Kodeks pracy art. 177 § 3', 'Ustawa zasiłkowa art. 29'],
    };
  }

  if (q.includes('ojc') || q.includes('tata') || q.includes('nie pracowała')) {
    return {
      answer: `Jeśli mama nie podlega ubezpieczeniu chorobowemu, ale ubezpieczony jest tata, może on skorzystać z urlopu ojcowskiego (${params.paternityLeave.weeks} tyg. do 12. miesiąca życia dziecka, płatne 100%) oraz z urlopu rodzicielskiego. Ponadto matka bez ubezpieczenia w ZUS może ubiegać się w gminie o świadczenie rodzicielskie (tzw. Kosiniakowe).`,
      sources: ['Kodeks pracy art. 182^1a i 182^3', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  if (q.includes('wcześni') || q.includes('szpital') || q.includes('uzupełniając')) {
    return {
      answer:
        'Rodzicom wcześniaków oraz dzieci wymagających dłuższej hospitalizacji po narodzinach przysługuje uzupełniający urlop macierzyński płatny 100%. Przysługuje 1 tydzień za każdy tydzień pobytu dziecka w szpitalu — maksymalnie do 8 lub 15 tygodni, zależnie od tygodnia ciąży i masy urodzeniowej.',
      sources: ['Kodeks pracy art. 180^2', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  return {
    answer:
      'Na podstawie zasad ZUS na 2026 rok możesz sprawdzić w swoim planie przysługujące urlopy: macierzyński (od 20 do 37 tyg., 100%), rodzicielski (41 lub 43 tyg., w tym po 9 tyg. wyłącznie dla każdego rodzica) oraz ojcowski (2 tyg.). Jeśli Twoje pytanie dotyczy konkretnej sytuacji z umowy lub działalności, porównaj swoje dane w zakładkach Uprawnienia i Dokumenty lub skonsultuj sprawę na e-wizycie w ZUS.',
    sources: ['Poradnik dla rodziców ZUS 2026', 'Kodeks pracy art. 180–182^3'],
  };
}
