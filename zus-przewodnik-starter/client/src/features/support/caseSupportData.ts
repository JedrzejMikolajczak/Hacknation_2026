import type { BenefitParams, CaseInputs, CaseWarning } from '@shared/types';
import { debtThresholdPln } from '@shared/engine/caseRules';
import { formatRate } from '../../app/benefitParams';
import { formatPln, formatPolishDate } from '../plan/planScenario';

export interface WarningGuide {
  title: string;
  action: string;
  isReminder?: boolean;
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

export function getDebtThresholdPln(params: BenefitParams): number {
  return debtThresholdPln(params);
}

function getSupplementaryThresholds(params: BenefitParams) {
  const cases = params.supplementaryMaternityLeave.cases;
  const maxWeeks = Math.max(...cases.map((c) => c.limitWeekAfterBirth));
  const standardWeeks = Math.min(...cases.map((c) => c.limitWeekAfterBirth));
  return { maxWeeks, standardWeeks };
}

export function getCaseWarningGuide(warning: CaseWarning, params: BenefitParams): WarningGuide {
  const combinedRate = formatRate(params.rates.combined);
  const maternityRate = formatRate(params.rates.maternity);
  const parentalRate = formatRate(params.rates.parental);
  const deadlineDays = params.combinedRateApplicationDeadlineDays;

  switch (warning.code) {
    case 'SELF_EMPLOYED_DEBT':
      return {
        title: 'Zadłużenie składkowe (JDG)',
        action: 'Sprawdź saldo składek w eZUS i próg obowiązujący w dniu powstania prawa. Spłać zaległość, jeśli przekracza próg.',
      };
    case 'NO_INSURANCE_ON_BIRTH_DATE':
      return {
        title: 'Brak ubezpieczenia chorobowego w dniu zdarzenia',
        action:
          'Bez czynnego ubezpieczenia chorobowego zasiłek macierzyński z ZUS nie przysługuje. Możesz sprawdzić prawo do świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy lub miasta.',
      };
    case 'CONTRACT_ENDS_BEFORE_BIRTH':
      return {
        title: 'Umowa lub ubezpieczenie kończy się przed zdarzeniem',
        action:
          'Umowa o pracę na czas określony albo na okres próbny powyżej 1 miesiąca, kończąca się po 3. miesiącu ciąży, przedłuża się z mocy prawa do dnia porodu. Przy umowie zlecenia i JDG ubezpieczenie nie przedłuża się automatycznie.',
      };
    case 'SHAM_CONTRACT_RISK':
      return {
        title: 'Możliwa weryfikacja tytułu ubezpieczenia przez ZUS',
        action:
          'Zachowaj dokumenty potwierdzające faktyczne wykonywanie pracy lub prowadzenie działalności (umowę, efekty pracy, ewidencję, faktury, przelewy). Sam sygnał nie pozbawia prawa do świadczenia.',
        isReminder: true,
      };
    case 'BASE_INCREASE_IN_PREGNANCY':
      return {
        title: 'Wyraźny wzrost podstawy składek w ciąży lub przed ciążą',
        action:
          'ZUS może poprosić o dokumenty uzasadniające zmianę wynagrodzenia lub podstawy składek. Zachowaj aneksy, zakres obowiązków lub potwierdzenia przychodów firmy.',
        isReminder: true,
      };
    case 'EMPLOYMENT_CONTEXT_RISK':
      return {
        title: 'Zatrudnienie u członka rodziny lub nowe stanowisko',
        action:
          'ZUS może przeprowadzić postępowanie wyjaśniające dotyczące faktycznego wykonywania pracy. Przygotuj dokumenty potwierdzające realizację obowiązków i wypłatę wynagrodzenia.',
        isReminder: true,
      };
    case 'MULTIPLE_INSURANCE_TITLES':
      return {
        title: 'Dwa równoległe tytuły ubezpieczenia',
        action:
          'Zasiłek przysługuje odrębnie z każdego tytułu objętego składką chorobową. Złóż osobny wniosek dla drugiego tytułu i zweryfikuj podstawę wymiaru na PUE/eZUS.',
        isReminder: true,
      };
    case 'COMBINED_RATE_DEADLINE': {
      const dateMatch = warning.message_pl.match(/\d{4}-\d{2}-\d{2}/);
      const formattedDate = dateMatch ? formatPolishDate(dateMatch[0]) : null;
      const missingDate = warning.message_pl.toLowerCase().includes('podaj datę');
      return {
        title: `Termin wniosku o stawkę ${combinedRate}`,
        action: missingDate
          ? `Uzupełnij datę złożenia wniosku u płatnika, aby potwierdzić stawkę ${combinedRate} (termin to ${deadlineDays} dni od porodu). Bez wniosku w terminie obowiązuje wariant ${maternityRate} + ${parentalRate}.`
          : `Sprawdź datę złożenia wniosku o pełny urlop (termin to ${deadlineDays} dni od porodu${formattedDate ? `, do ${formattedDate}` : ''}). Po terminie obowiązuje wariant ${maternityRate} za macierzyński i ${parentalRate} za rodzicielski.`,
        isReminder: missingDate,
      };
    }
    case 'WAITING_PERIOD_NOT_MET':
      return {
        title: 'Okres wyczekiwania na zasiłek chorobowy',
        action: `Zasiłek chorobowy w ciąży przysługuje po ${params.sickness.waitingPeriodDaysMandatory} dniach ubezpieczenia obowiązkowego lub ${params.sickness.waitingPeriodDaysVoluntary} dniach dobrowolnego. Sam zasiłek macierzyński przysługuje bez okresu wyczekiwania.`,
      };
    case 'SUPPLEMENTARY_TRANSITION':
      return {
        title: 'Przepisy przejściowe dla urlopu uzupełniającego',
        action:
          'Sprawdź datę zakończenia urlopu macierzyńskiego względem wejścia w życie przepisów o uzupełniającym urlopie macierzyńskim. Jeśli dziecko ma zaświadczenie „Za życiem”, sprawdź prawo do wydłużonego urlopu rodzicielskiego.',
      };
    case 'SUPPLEMENTARY_DATA':
      return {
        title: 'Brak danych do wyliczenia urlopu uzupełniającego',
        action:
          'Uzupełnij tydzień ciąży przy porodzie, masę urodzeniową oraz daty pobytu dziecka w szpitalu, aby ustalić dokładny wymiar uzupełniającego urlopu macierzyńskiego.',
        isReminder: true,
      };
    case 'QUALIFICATION_CHECK':
      return {
        title: 'Wymagana weryfikacja prawa do świadczenia',
        action: warning.message_pl,
      };
    default:
      return {
        title: 'Kwestia wymagająca uwagi w Twoim planie',
        action: warning.message_pl,
      };
  }
}

export function getGeneralRisks(params: BenefitParams): GeneralRiskItem[] {
  const debtThreshold = formatPln(getDebtThresholdPln(params));
  const debtShare = formatRate(params.selfEmployedDebtThresholdShareOfMinimumWage);
  const lookback = params.benefitBase.lookbackMonths;

  return [
    {
      id: 'sham-contract',
      title: 'Umowa o pracę lub działalność zawarta dla pozoru',
      consequence:
        'Jeśli ZUS uzna po postępowaniu, że umowa albo JDG powstały wyłącznie w celu uzyskania świadczeń, może wydać decyzję o niepodleganiu ubezpieczeniom i odmówić wypłaty zasiłków.',
      howToAvoid:
        'Przechowuj potwierdzenia faktycznego wykonywania pracy lub prowadzenia firmy (np. efekty zadań, korespondencję, faktury, potwierdzenia przelewów).',
      legalBasis: 'KC art. 83; ustawa o systemie ubezpieczeń społecznych art. 68, art. 83',
    },
    {
      id: 'base-increase-pregnancy',
      title: 'Podwyższenie podstawy wymiaru składek w okresie ciąży',
      consequence:
        'ZUS może zakwestionować podniesienie wynagrodzenia lub podstawy składek w ciąży, jeśli miało wyłącznie podwyższyć zasiłek, i wydać decyzję ustalającą niższą podstawę.',
      howToAvoid: `Zmiana wynagrodzenia lub podstawy powinna odpowiadać realnej zmianie zakresu obowiązków lub przychodów firmy. Przy JDG podstawa jest uśredniana z ${lookback} miesięcy.`,
      legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 41 ust. 12–13, art. 83',
    },
    {
      id: 'no-insurance-on-birth',
      title: 'Brak ubezpieczenia chorobowego w dniu porodu',
      consequence:
        'Niezgłoszenie się do dobrowolnego ubezpieczenia chorobowego (na zleceniu lub JDG) albo zakończenie umowy lub JDG przed porodem oznacza brak prawa do zasiłku macierzyńskiego z ZUS.',
      howToAvoid:
        'Sprawdź na PUE/eZUS aktywność składki chorobowej. Automatyczne przedłużenie umowy do dnia porodu dotyczy wyłącznie umowy o pracę (po 3. miesiącu ciąży), a nie zlecenia ani JDG.',
      legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1; KP art. 177 § 3',
    },
    {
      id: 'jdg-debt',
      title: 'Zadłużenie składkowe w działalności gospodarczej (JDG)',
      consequence: `Zaległość na koncie składek przekraczająca ${debtShare} minimalnego wynagrodzenia (${debtThreshold}) w dniu powstania prawa wstrzymuje wypłatę zasiłku do czasu pełnej spłaty.`,
      howToAvoid:
        'Zweryfikuj saldo rozliczeń w PUE/eZUS przed porodem i przed zwolnieniem lekarskim. Spłać zaległość możliwie szybko, aby odblokować wypłatę świadczenia.',
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

export function getMatchingSpecialSituationIds(input: CaseInputs): SpecialSituationId[] {
  const ids: SpecialSituationId[] = [];
  const special = input.special_circumstances;

  if (special.stillbirth_or_child_death !== 'NONE' || Boolean(input.child_death_date)) {
    ids.push('loss');
  }
  if (special.premature_or_hospitalized_newborn) {
    ids.push('premature');
  }
  if (special.za_zyciem_certificate) {
    ids.push('zaZyciem');
  }
  if (special.mother_hospitalized_or_incapable) {
    ids.push('motherIllness');
  }
  if (special.employer_bankruptcy_or_liquidation) {
    ids.push('bankruptcy');
  }
  if (input.stage === 'ADOPTION') {
    ids.push('adoption');
  }

  return ids;
}

export function isDifficultCase(input: CaseInputs): boolean {
  const special = input.special_circumstances;
  return (
    special.stillbirth_or_child_death !== 'NONE' ||
    Boolean(input.child_death_date) ||
    special.za_zyciem_certificate ||
    special.mother_hospitalized_or_incapable
  );
}
