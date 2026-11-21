import type { BenefitParams, ScenarioInput, Warning } from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { formatPln, formatPolishDate } from '../plan/planScenario';

export interface WarningGuide {
  title: string;
  action: string;
}

export interface GeneralRiskItem {
  id: string;
  title: string;
  consequence: string;
  howToAvoid: string;
  legalBasis: string;
}

export type SpecialSituationId =
  | 'loss'
  | 'motherDeceased'
  | 'premature'
  | 'zaZyciem'
  | 'motherIllness'
  | 'bankruptcy'
  | 'adoption';

export interface SpecialSituationGuide {
  id: SpecialSituationId;
  title: string;
  whatChanges: string;
  whatToDo: string[];
  legalBasis: string;
  calmTone: boolean;
}

export interface CharitableOrganization {
  id: string;
  name: string;
  legalForm: string;
  helpsWith: string;
  description: string;
  url: string;
  relatedSituations: SpecialSituationId[];
}

export interface OfficialLinkItem {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface FaqAnswer {
  answer: string;
  sources: { title: string; legalBasis: string }[];
}

export function getDebtThresholdPln(params: BenefitParams): number {
  return (
    Math.round(
      params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
    ) / 100
  );
}

function getSupplementaryThresholds(params: BenefitParams) {
  const cases = params.supplementaryMaternityLeave.cases;
  const pretermWeekExclusive = Math.max(...cases.map((c) => c.maxPregnancyWeekExclusive ?? 0));
  const veryPretermWeekExclusive = Math.min(
    ...cases.map((c) => c.maxPregnancyWeekExclusive).filter((v): v is number => v !== null),
  );
  const lowWeightGrams = Math.max(...cases.map((c) => c.maxBirthWeightGrams ?? 0));
  const maxWeeks = Math.max(...cases.map((c) => c.limitWeekAfterBirth));
  const standardWeeks = Math.min(...cases.map((c) => c.limitWeekAfterBirth));
  return {
    pretermWeekExclusive,
    veryPretermWeekExclusive,
    lowWeightGrams,
    maxWeeks,
    standardWeeks,
  };
}

export function getWarningGuide(warning: Warning, params: BenefitParams): WarningGuide {
  const debtThreshold = formatPln(getDebtThresholdPln(params));
  const combinedRate = formatRate(params.rates.combined);
  const maternityRate = formatRate(params.rates.maternity);
  const parentalRate = formatRate(params.rates.parental);
  const deadlineDays = params.combinedRateApplicationDeadlineDays;

  switch (warning.code) {
    case 'SELF_EMPLOYED_DEBT':
      return {
        title: 'Zadłużenie składkowe (JDG)',
        action: `Sprawdź saldo składek na PUE/eZUS i spłać całość zaległości. Dług powyżej ${formatRate(params.selfEmployedDebtThresholdShareOfMinimumWage)} płacy minimalnej (${debtThreshold}) wstrzymuje wypłatę zasiłku do czasu spłaty.`,
      };
    case 'NO_INSURANCE_ON_BIRTH_DATE':
      return {
        title: 'Brak ubezpieczenia chorobowego na dzień porodu',
        action:
          'Bez czynnego ubezpieczenia chorobowego zasiłek macierzyński z ZUS nie przysługuje. Możesz sprawdzić prawo do świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy lub miasta.',
      };
    case 'CONTRACT_ENDS_BEFORE_BIRTH':
      return {
        title: 'Ubezpieczenie kończy się przed datą zdarzenia',
        action:
          'Umowa o pracę na czas określony lub na okres próbny powyżej 1 miesiąca, kończąca się po 3. miesiącu ciąży, przedłuża się z mocy prawa do dnia porodu. Przy umowie zlecenia i JDG ubezpieczenie nie przedłuża się automatycznie.',
      };
    case 'SHAM_CONTRACT_RISK':
      return {
        title: 'Możliwa kontrola tytułu ubezpieczenia przez ZUS',
        action:
          'Zachowaj dokumenty potwierdzające faktyczne wykonywanie pracy lub prowadzenie działalności (np. efekty pracy, korespondencję, faktury, przelewy), ponieważ ZUS może wszcząć postępowanie wyjaśniające.',
      };
    case 'BASE_INCREASE_IN_PREGNANCY':
      return {
        title: 'Podwyższenie podstawy składek w ciąży',
        action:
          'ZUS może zweryfikować nagłe podwyższenie podstawy wymiaru składek w ciąży i ustalić niższą podstawę, jeśli wzrost nie miał realnego uzasadnienia zawodowego lub przychodowego. Zachowaj dokumentację uzasadniającą zmianę.',
      };
    case 'COMBINED_RATE_DEADLINE': {
      const dateMatch = warning.message.match(/\d{4}-\d{2}-\d{2}/);
      const formattedDate = dateMatch ? formatPolishDate(dateMatch[0]) : null;
      const passed = warning.message.includes('upłynął');
      return {
        title: `Termin wniosku o stawkę ${combinedRate}`,
        action: passed
          ? `Termin ${deadlineDays} dni (${formattedDate ?? 'po porodzie'}) już minął. Obowiązuje wariant standardowy: ${maternityRate} za macierzyński i ${parentalRate} za rodzicielski.`
          : `Złóż wniosek o pełny wymiar urlopu macierzyńskiego i rodzicielskiego w ciągu ${deadlineDays} dni od porodu${formattedDate ? ` (do ${formattedDate})` : ''}, aby otrzymać ${combinedRate}.`,
      };
    }
    case 'WAITING_PERIOD_NOT_MET':
      return {
        title: 'Okres wyczekiwania na zasiłek chorobowy',
        action: `Zasiłek chorobowy w ciąży przysługuje po ${params.sickness.waitingPeriodDaysMandatory} dniach ubezpieczenia obowiązkowego lub ${params.sickness.waitingPeriodDaysVoluntary} dniach dobrowolnego. Sam zasiłek macierzyński przysługuje bez okresu wyczekiwania.`,
      };
  }
}

export function getGeneralRisks(params: BenefitParams): GeneralRiskItem[] {
  const debtThreshold = formatPln(getDebtThresholdPln(params));
  const debtShare = formatRate(params.selfEmployedDebtThresholdShareOfMinimumWage);

  return [
    {
      id: 'sham-contract',
      title: 'Umowa o pracę lub działalność zawarta dla pozoru',
      consequence:
        'Jeśli ZUS uzna po postępowaniu, że umowa albo JDG powstały wyłącznie w celu uzyskania świadczeń, może wydać decyzję o niepodleganiu ubezpieczeniom i odmówić wypłaty zasiłków.',
      howToAvoid:
        'Przechowuj potwierdzenia faktycznego wykonywania pracy lub prowadzenia firmy (np. efekty zadań, e-maile, faktury, potwierdzenia przelewów).',
      legalBasis: 'KC art. 83; ustawa o systemie ubezpieczeń społecznych art. 68, art. 83',
    },
    {
      id: 'base-increase-pregnancy',
      title: 'Podwyższenie podstawy wymiaru składek w okresie ciąży',
      consequence:
        'ZUS może zakwestionować podniesienie wynagrodzenia lub podstawy składek w ciąży, jeśli miało wyłącznie podwyższyć zasiłek, i wydać decyzję ustalającą niższą podstawę.',
      howToAvoid:
        'Zmiana wynagrodzenia lub podstawy powinna odpowiadać realnej zmianie zakresu obowiązków lub przychodów firmy. Przy JDG pamiętaj też o uśrednianiu podstawy z 12 miesięcy.',
      legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 41 ust. 12–13, art. 83',
    },
    {
      id: 'no-insurance-on-birth',
      title: 'Brak ubezpieczenia chorobowego w dniu porodu',
      consequence:
        'Niezgłoszenie się do dobrowolnego ubezpieczenia chorobowego (na zleceniu lub JDG) albo zakończenie umowy lub JDG przed porodem oznacza brak prawa do zasiłku macierzyńskiego z ZUS.',
      howToAvoid:
        'Sprawdź na PUE/eZUS aktywność składki chorobowej. Pamiętaj, że automatyczne przedłużenie umowy do dnia porodu dotyczy wyłącznie umowy o pracę (po 3. miesiącu ciąży), a nie zlecenia ani JDG.',
      legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1; KP art. 177 § 3',
    },
    {
      id: 'jdg-debt',
      title: 'Zadłużenie składkowe w działalności gospodarczej (JDG)',
      consequence: `Zaległość na koncie składek przekraczająca ${debtShare} minimalnego wynagrodzenia (${debtThreshold}) na dzień powstania prawa wstrzymuje wypłatę zasiłku do czasu pełnej spłaty.`,
      howToAvoid:
        'Zweryfikuj saldo rozliczeń w PUE/eZUS przed porodem i przed zwolnieniem lekarskim. Na uregulowanie zadłużenia bez utraty prawa do świadczenia masz 6 miesięcy.',
      legalBasis: 'Ustawa zasiłkowa art. 2a',
    },
  ];
}

export function getSpecialSituations(params: BenefitParams): SpecialSituationGuide[] {
  const sup = getSupplementaryThresholds(params);
  const maternityRate = formatRate(params.rates.maternity);
  const supplementaryRate = formatRate(params.rates.supplementaryMaternity);
  const maxMaternityWeeks = params.maternityLeave.weeksByChildrenCount['5'];

  return [
    {
      id: 'loss',
      title: 'Martwe urodzenie lub zgon dziecka',
      whatChanges: `Przy martwym urodzeniu lub zgonie dziecka przed ${params.childDeath.thresholdWeeksOfLife}. tygodniem życia przysługuje ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni urlopu i zasiłku macierzyńskiego po porodzie (nie krócej niż ${params.childDeath.minDaysAfterDeath} dni od dnia zgonu). Przy zgonie po ${params.childDeath.thresholdWeeksOfLife}. tygodniu – ${params.childDeath.minDaysAfterDeath} dni od zgonu. Przy porodzie mnogim wymiar odpowiada liczbie dzieci pozostałych przy życiu.`,
      whatToDo: [
        'Złóż u pracodawcy lub w ZUS (przez PUE/eZUS) odpis skrócony aktu urodzenia (z adnotacją o martwym urodzeniu, jeśli dotyczy).',
        'Formalności można załatwić elektronicznie, bez wizyty w placówce. Poniżej znajdziesz fundacje oferujące bezpłatną pomoc psychologiczną i prawną.',
      ],
      legalBasis: 'KP art. 180¹; ustawa zasiłkowa art. 29a',
      calmTone: true,
    },
    {
      id: 'motherDeceased',
      title: 'Śmierć matki dziecka',
      whatChanges: `Prawo do niewykorzystanej części urlopu macierzyńskiego i rodzicielskiego oraz zasiłku przechodzi bezpośrednio na ubezpieczonego ojca dziecka lub innego ubezpieczonego członka najbliższej rodziny, bez wymogu wykorzystania ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodni przez matkę.`,
      whatToDo: [
        'Złóż wniosek do pracodawcy lub do ZUS (formularz ZAM) o przejęcie pozostałej części urlopu i zasiłku.',
        'Dołącz odpis skrócony aktu urodzenia dziecka oraz odpis aktu zgonu matki.',
      ],
      legalBasis: 'KP art. 180 § 12; ustawa zasiłkowa art. 29 ust. 5, art. 29a',
      calmTone: true,
    },
    {
      id: 'premature',
      title: 'Wcześniak lub hospitalizacja dziecka po porodzie',
      whatChanges: `Przysługuje uzupełniający urlop macierzyński płatny ${supplementaryRate} podstawy wymiaru: 1 tydzień za każdy tydzień pobytu dziecka w szpitalu, maksymalnie do ${sup.standardWeeks} lub ${sup.maxWeeks} tygodni (zależnie od tygodnia ciąży i masy urodzeniowej).`,
      whatToDo: [
        `Złóż jednorazowy wniosek najpóźniej ${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed zakończeniem podstawowego urlopu macierzyńskiego.`,
        'Dołącz zaświadczenie ze szpitala o okresie hospitalizacji dziecka, tygodniu ciąży w chwili porodu i masie urodzeniowej.',
      ],
      legalBasis: 'KP art. 180²; ustawa zasiłkowa art. 29a',
      calmTone: false,
    },
    {
      id: 'zaZyciem',
      title: 'Zaświadczenie „Za życiem” (ciężka choroba dziecka)',
      whatChanges: `Urlop rodzicielski wydłuża się z ${params.parentalLeave.weeksSingleChild} do ${params.parentalLeave.weeksSingleChildZaZyciem} tygodni przy jednym dziecku oraz z ${params.parentalLeave.weeksMultipleChildren} do ${params.parentalLeave.weeksMultipleChildrenZaZyciem} tygodni przy porodzie mnogim.`,
      whatToDo: [
        'Uzyskaj zaświadczenie lekarskie potwierdzające ciężkie i nieodwracalne upośledzenie albo nieuleczalną chorobę zagrażającą życiu (art. 4 ust. 3 ustawy „Za życiem”).',
        'Dołącz zaświadczenie do wniosku o urlop rodzicielski i zasiłek składanego u pracodawcy lub w ZUS.',
      ],
      legalBasis: 'KP art. 182¹a § 2; ustawa z 4.11.2016 r. „Za życiem” art. 4 ust. 3',
      calmTone: true,
    },
    {
      id: 'motherIllness',
      title: 'Choroba, pobyt w szpitalu lub niezdolność matki do opieki',
      whatChanges: `Po wykorzystaniu przez matkę co najmniej ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tygodni urlopu macierzyńskiego po porodzie (zamiast standardowych ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodni) ubezpieczony ojciec lub inny ubezpieczony członek najbliższej rodziny może przejąć pozostałą część urlopu lub część na czas pobytu matki w szpitalu.`,
      whatToDo: [
        'Matka przerywa urlop macierzyński na czas hospitalizacji albo składa rezygnację z dalszej części przy orzeczeniu o niezdolności do samodzielnej egzystencji.',
        'Ojciec składa wniosek o przejęcie części urlopu wraz z zaświadczeniem ze szpitala (data przyjęcia i wypisu) lub orzeczeniem.',
      ],
      legalBasis: 'KP art. 180 § 6–10; ustawa zasiłkowa art. 29 ust. 5',
      calmTone: true,
    },
    {
      id: 'bankruptcy',
      title: 'Upadłość lub likwidacja pracodawcy w ciąży',
      whatChanges: `Do dnia porodu przysługuje z ZUS zasiłek w wysokości zasiłku macierzyńskiego (${maternityRate} podstawy wymiaru), a po porodzie pełny zasiłek macierzyński wypłacany bezpośrednio przez ZUS.`,
      whatToDo: [
        'Przygotuj świadectwo pracy lub dokument potwierdzający rozwiązanie umowy z powodu upadłości lub likwidacji pracodawcy oraz zaświadczenie lekarskie o ciąży.',
        'Złóż wniosek do ZUS (przez PUE/eZUS lub w placówce) o wypłatę świadczenia po ustaniu zatrudnienia.',
      ],
      legalBasis: 'Ustawa zasiłkowa art. 30 ust. 1 i 3',
      calmTone: false,
    },
    {
      id: 'adoption',
      title: 'Adopcja lub rodzina zastępcza niezawodowa',
      whatChanges: `Przysługuje urlop na warunkach urlopu macierzyńskiego (od ${params.adoptionMaternityLeave.minWeeks} do ${maxMaternityWeeks} tygodni), urlop rodzicielski oraz urlop ojcowski (${params.paternityLeave.weeks} tyg.). Limit wieku dziecka to ${params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYears} lat (${params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYearsDeferredSchool} lat przy odroczeniu obowiązku szkolnego) dla rodziny zastępczej i ${params.adoptionMaternityLeave.adoptionMaxChildAgeYears} lat przy przysposobieniu.`,
      whatToDo: [
        'Dołącz do wniosku oświadczenie o dacie przyjęcia dziecka oraz zaświadczenie sądu o wystąpieniu o przysposobienie albo orzeczenie o ustanowieniu rodziny zastępczej.',
        `Urlop ojcowski przy przysposobieniu można wykorzystać w ciągu ${params.paternityLeave.adoptionDeadlineMonthsFromAdoption} miesięcy od uprawomocnienia postanowienia sądu, nie dłużej niż do ${params.paternityLeave.adoptionMaxChildAgeYears}. roku życia dziecka.`,
      ],
      legalBasis: 'KP art. 183; ustawa zasiłkowa art. 29 ust. 1 pkt 2–3',
      calmTone: false,
    },
  ];
}

export function getMatchingSpecialSituationIds(
  scenario: ScenarioInput,
  params: BenefitParams,
): SpecialSituationId[] {
  const ids: SpecialSituationId[] = [];
  const s = scenario.special;
  const sup = getSupplementaryThresholds(params);

  if (s.stillbirth || s.childDeathDate !== null) ids.push('loss');
  if (s.motherDeceased) ids.push('motherDeceased');
  if (
    (s.pregnancyWeekAtBirth !== null && s.pregnancyWeekAtBirth < sup.pretermWeekExclusive) ||
    (s.birthWeightGrams !== null && s.birthWeightGrams <= sup.lowWeightGrams) ||
    (s.hospitalizationDays !== null && s.hospitalizationDays > 0)
  ) {
    ids.push('premature');
  }
  if (s.zaZyciemCertificate) ids.push('zaZyciem');
  if (s.motherHospitalized || s.motherIncapableOfIndependentLiving) {
    ids.push('motherIllness');
  }
  if (s.employerBankruptcyOrLiquidation) ids.push('bankruptcy');
  if (scenario.situation === 'adoption' || scenario.adoptionType !== null) {
    ids.push('adoption');
  }

  return ids;
}

/**
 * Wyłącznie podmioty o charakterze charytatywnym (fundacje / stowarzyszenia non-profit),
 * zgodnie z pkt 3i treści zadania.
 */
export const CHARITABLE_ORGANIZATIONS: CharitableOrganization[] = [
  {
    id: 'nagle-sami',
    name: 'Fundacja Nagle Sami',
    legalForm: 'Fundacja (OPP)',
    helpsWith: 'Śmierć dziecka, poronienie, żałoba',
    description:
      'Bezpłatna linia wsparcia psychologicznego, konsultacje ze specjalistami oraz grupy wsparcia dla rodziców w żałobie po stracie dziecka.',
    url: 'https://naglesami.org.pl',
    relatedSituations: ['loss', 'motherDeceased'],
  },
  {
    id: 'ernest',
    name: 'Fundacja Ernest',
    legalForm: 'Fundacja',
    helpsWith: 'Poronienie, martwe urodzenie, trudna ciąża',
    description:
      'Bezpłatna pomoc psychologiczna i prawna dla kobiet i rodzin po poronieniu, martwym urodzeniu lub po diagnozie choroby dziecka w ciąży.',
    url: 'https://fundacjaernest.pl',
    relatedSituations: ['loss', 'zaZyciem'],
  },
  {
    id: 'wczesniak',
    name: 'Fundacja Wcześniak Rodzice-Rodzicom',
    legalForm: 'Fundacja (OPP)',
    helpsWith: 'Przedwczesny poród i narodziny wcześniaka',
    description:
      'Bezpłatne wsparcie informacyjne i opiekuńcze dla rodziców dzieci urodzonych przedwcześnie oraz hospitalizowanych po porodzie.',
    url: 'https://wczesniak.pl',
    relatedSituations: ['premature'],
  },
  {
    id: 'gajusz',
    name: 'Fundacja Gajusz',
    legalForm: 'Fundacja (OPP)',
    helpsWith: 'Urodzenie dziecka ciężko chorego',
    description:
      'Bezpłatna opieka hospicjum perinatalnego i domowego oraz wsparcie psychologiczne i socjalne dla rodzin dzieci ciężko i nieuleczalnie chorych.',
    url: 'https://gajusz.org.pl',
    relatedSituations: ['zaZyciem', 'premature'],
  },
  {
    id: 'rodzic-po-ludzku',
    name: 'Fundacja Rodzić po Ludzku',
    legalForm: 'Fundacja (OPP)',
    helpsWith: 'Wsparcie okołoporodowe i bezpłatna pomoc prawna',
    description:
      'Bezpłatne konsultacje prawne i informacyjne dotyczące praw kobiety w ciąży, w trakcie porodu, hospitalizacji oraz po narodzinach dziecka.',
    url: 'https://rodzicpoludzku.pl',
    relatedSituations: ['motherIllness', 'premature', 'loss'],
  },
];

export function getOrderedOrganizations(
  matchingSpecialIds: SpecialSituationId[],
): CharitableOrganization[] {
  if (matchingSpecialIds.length === 0) {
    return CHARITABLE_ORGANIZATIONS;
  }
  const matched = CHARITABLE_ORGANIZATIONS.filter((org) =>
    org.relatedSituations.some((sit) => matchingSpecialIds.includes(sit)),
  );
  const rest = CHARITABLE_ORGANIZATIONS.filter(
    (org) => !org.relatedSituations.some((sit) => matchingSpecialIds.includes(sit)),
  );
  return [...matched, ...rest];
}

export const OFFICIAL_LINKS: OfficialLinkItem[] = [
  {
    id: 'zus-main',
    label: 'ZUS – świadczenia i wzory formularzy (www.zus.pl)',
    description: 'Aktualne informacje o zasiłkach oraz formularze ZAM, Z-3, Z-3a i ZAS-53.',
    href: 'https://www.zus.pl',
  },
  {
    id: 'zus-ezus',
    label: 'PUE / eZUS – elektroniczne konto ubezpieczonego',
    description: 'Sprawdzanie składek, zwolnień e-ZLA, salda JDG i wysyłka wniosków online.',
    href: 'https://www.zus.pl/ezus',
  },
  {
    id: 'zus-ewizyta',
    label: 'e-wizyta w ZUS – bezpłatna wideorozmowa z doradcą',
    description: 'Indywidualna konsultacja online przed złożeniem dokumentów o zasiłek.',
    href: 'https://www.zus.pl/e-wizyta',
  },
  {
    id: 'mrpips-parental',
    label: 'Ministerstwo Rodziny, Pracy i Polityki Społecznej – urlop rodzicielski',
    description: 'Oficjalne zestawienie zasad urlopów rodzicielskich i opiekuńczych.',
    href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
  },
  {
    id: 'pip-parenting',
    label: 'Państwowa Inspekcja Pracy – porady prawne (rodzicielstwo)',
    description: 'Ochrona stosunku pracy w ciąży, przedłużenie umowy i zasady udzielania urlopów.',
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
  },
  {
    id: 'usc-birth-cert',
    label: 'Rejestr Stanu Cywilnego – odpis aktu urodzenia online (gov.pl)',
    description:
      'Oficjalna usługa złożenia wniosku o odpis skrócony lub zupełny aktu stanu cywilnego.',
    href: 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego',
  },
];

export const FAQ_SUGGESTIONS: string[] = [
  'Kiedy opłaca się wariant 81,5% i jaki jest termin?',
  'Jak zadłużenie w JDG wpływa na zasiłek macierzyński?',
  'Kończy mi się umowa w ciąży – co wtedy?',
  'Ile trwa urlop ojcowski i 9 tygodni dla drugiego rodzica?',
  'Komu przysługuje uzupełniający urlop macierzyński dla wcześniaka?',
];

export function answerFaqQuestion(rawQuestion: string, params: BenefitParams): FaqAnswer {
  const q = rawQuestion.toLowerCase();
  const combinedRate = formatRate(params.rates.combined);
  const maternityRate = formatRate(params.rates.maternity);
  const parentalRate = formatRate(params.rates.parental);
  const secondParentRate = formatRate(params.rates.secondParentNonTransferableInCombined);
  const supplementaryRate = formatRate(params.rates.supplementaryMaternity);
  const sup = getSupplementaryThresholds(params);

  if (q.includes('81') || q.includes('21') || q.includes('stawk') || q.includes('spóźni')) {
    return {
      answer: `Jeśli matka złoży wniosek o pełny wymiar urlopu macierzyńskiego i rodzicielskiego w ciągu ${params.combinedRateApplicationDeadlineDays} dni po porodzie, otrzyma ujednoliconą stawkę ${combinedRate} za cały okres. Nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni drugiego rodzica zawsze wynosi ${secondParentRate}. Bez wniosku w terminie ${params.combinedRateApplicationDeadlineDays} dni obowiązuje wariant ${maternityRate} (macierzyński) + ${parentalRate} (rodzicielski).`,
      sources: [
        {
          title: 'Poradnik dla rodziców ZUS 2026',
          legalBasis: 'Ustawa zasiłkowa art. 30a, art. 31',
        },
      ],
    };
  }

  if (
    q.includes('jdg') ||
    q.includes('działalno') ||
    q.includes('zaleg') ||
    q.includes('zadłuż') ||
    q.includes('dług')
  ) {
    const threshold = formatPln(getDebtThresholdPln(params));
    const share = formatRate(params.selfEmployedDebtThresholdShareOfMinimumWage);
    return {
      answer: `Przy działalności gospodarczej (JDG) zadłużenie przekraczające ${share} minimalnego wynagrodzenia (${threshold}) w dniu powstania prawa do zasiłku wstrzymuje wypłatę świadczenia. Po pełnej spłacie zaległości w ciągu 6 miesięcy prawo do zasiłku zostaje odblokowane. Po zakończeniu zasiłku macierzyńskiego pamiętaj o ponownym zgłoszeniu się do dobrowolnego ubezpieczenia chorobowego.`,
      sources: [
        {
          title: 'Poradnik dla rodziców ZUS 2026',
          legalBasis: 'Ustawa zasiłkowa art. 2a; art. 14 u.s.u.s.',
        },
      ],
    };
  }

  if (q.includes('umow') || q.includes('kończy') || q.includes('ciąży')) {
    return {
      answer:
        'Umowa o pracę zawarta na czas określony albo na okres próbny przekraczający 1 miesiąc, która uległaby rozwiązaniu po upływie 3. miesiąca ciąży, przedłuża się z mocy prawa do dnia porodu. Po porodzie zasiłek macierzyński wypłaca bezpośrednio ZUS. Ta zasada nie dotyczy umowy zlecenia ani działalności gospodarczej.',
      sources: [
        {
          title: 'Kodeks pracy i Poradnik dla rodziców ZUS 2026',
          legalBasis: 'KP art. 177 § 3; ustawa zasiłkowa art. 29–30',
        },
      ],
    };
  }

  if (
    q.includes('ojc') ||
    q.includes('9 tyg') ||
    q.includes('tat') ||
    q.includes('drugiego rodzica')
  ) {
    return {
      answer: `Ojciec ma prawo do ${params.paternityLeave.weeks} tygodni urlopu ojcowskiego (${formatRate(params.rates.paternity)}, do ${params.paternityLeave.deadlineChildAgeMonths}. miesiąca życia dziecka, w maksymalnie ${params.paternityLeave.maxParts} częściach) oraz do ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni nieprzenoszalnego urlopu rodzicielskiego (${parentalRate}, do końca roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat). Urlop rodzicielski i ojcowski przysługują ubezpieczonemu ojcu również wtedy, gdy matka nie miała ubezpieczenia chorobowego.`,
      sources: [
        {
          title: 'Kodeks pracy – uprawnienia związane z rodzicielstwem',
          legalBasis: 'KP art. 182¹a § 4, art. 182³',
        },
      ],
    };
  }

  if (q.includes('wcześni') || q.includes('szpital') || q.includes('uzupełnia')) {
    return {
      answer: `Rodzicom wcześniaków i dzieci hospitalizowanych po porodzie przysługuje uzupełniający urlop macierzyński (${supplementaryRate} podstawy wymiaru): 1 tydzień za każdy tydzień pobytu dziecka w szpitalu — do ${sup.maxWeeks} tygodni (urodzenie przed ${sup.veryPretermWeekExclusive}. tygodniem ciąży lub masa do ${sup.lowWeightGrams} g) albo do ${sup.standardWeeks} tygodni (od ${sup.veryPretermWeekExclusive}. do ${sup.pretermWeekExclusive}. tygodnia z masą powyżej ${sup.lowWeightGrams} g lub od ${sup.pretermWeekExclusive}. tygodnia przy hospitalizacji po porodzie).`,
      sources: [
        {
          title: 'Poradnik dla rodziców ZUS 2026',
          legalBasis: 'KP art. 180²',
        },
      ],
    };
  }

  return {
    answer: `W celu uzyskania zasiłku macierzyńskiego składa się wniosek ZUS ZAM (od 24.10.2026 r. zastępuje dawne ZUR i ZAO) wraz ze skróconym odpisem aktu urodzenia. Jeśli płatnik zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, zasiłek wypłaca pracodawca; w pozostałych przypadkach – ZUS. Możesz wpisać słowo kluczowe, np. „81,5%”, „JDG”, „umowa”, „ojcowski” lub „wcześniak”.`,
    sources: [
      {
        title: 'Poradnik dla rodziców ZUS 2026',
        legalBasis: 'Ustawa zasiłkowa art. 29–31, art. 61',
      },
    ],
  };
}
