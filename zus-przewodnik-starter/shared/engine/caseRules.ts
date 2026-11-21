import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseParentInsurance,
  CaseWarning,
} from '../types';
import { addDays, addMonths, daysBetween, formatPercentPl, requireValue, roundPln } from './core';

export const KP = {
  maternity: 'Kodeks pracy, art. 180 i 180¹',
  abandonment: 'Kodeks pracy, art. 180 § 13 i 15 oraz art. 182. Ustawa zasiłkowa, art. 29 ust. 7 i 9 oraz art. 29a ust. 2',
  unlawfulTermination: 'Ustawa zasiłkowa, art. 30 ust. 1 pkt 2 i art. 61 ust. 1 pkt 2',
  supplementary: 'Kodeks pracy, art. 180²',
  transitional: 'Ustawa z 6 grudnia 2024 r. o zmianie ustawy – Kodeks pracy, art. 17',
  parental: 'Kodeks pracy, art. 182¹ᵃ–182¹ᵈ',
  zaZyciem: 'Kodeks pracy, art. 182¹ᵃ § 2 i ustawa „Za życiem”, art. 4 ust. 3',
  work: 'Kodeks pracy, art. 182¹ᵉ–182¹ᶠ oraz ustawa zasiłkowa, art. 31 ust. 4a',
  paternity: 'Kodeks pracy, art. 182³',
  adoption: 'Kodeks pracy, art. 183',
  contractProtection: 'Kodeks pracy, art. 177 § 3',
  sickness: 'Ustawa zasiłkowa, art. 4, 8 i 11',
  waitingPeriod: 'Ustawa zasiłkowa, art. 4 ust. 1–3',
  sickPay: 'Kodeks pracy, art. 92',
  qualification: 'Ustawa zasiłkowa, art. 29–29a i 61',
  noInsurance: 'Ustawa zasiłkowa, art. 29 ust. 1',
  voluntaryInsurance:
    'Ustawa zasiłkowa, art. 29 ust. 1; ustawa o systemie ubezpieczeń społecznych, art. 11 ust. 2',
  combined: 'Ustawa zasiłkowa, art. 30a i 31',
  debt: 'Ustawa zasiłkowa, art. 2a',
  shamContract: 'Ustawa o systemie ubezpieczeń społecznych, art. 68 i 83; Kodeks cywilny, art. 83',
  baseIncrease: 'Ustawa o systemie ubezpieczeń społecznych, art. 41 ust. 12–13 i art. 83',
  multipleTitles: 'Ustawa o systemie ubezpieczeń społecznych, art. 9; ustawa zasiłkowa, art. 29 i 36',
  maternityEquivalent: 'Ustawa zasiłkowa, art. 30 ust. 1 i 3',
} as const;

function formatDatePl(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatPlnPl(value: number): string {
  return `${roundPln(value).toFixed(2).replace('.', ',')} zł`;
}

export function debtThresholdPln(params: BenefitParams): number {
  return roundPln(
    params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage,
  );
}

export function hasSelfEmployedDebt(
  parent: Pick<CaseParentInsurance, 'employment_type' | 'debt_amount_pln' | 'has_b2b_arrears'>,
  params: BenefitParams,
): boolean {
  if (parent.employment_type !== 'B2B') return false;
  if (parent.debt_amount_pln !== undefined && parent.debt_amount_pln !== null) {
    return parent.debt_amount_pln > debtThresholdPln(params);
  }
  return Boolean(parent.has_b2b_arrears);
}

export function isFixedTermExtendedToBirth(
  input: CaseInputs,
  on: string,
  params: BenefitParams,
): boolean {
  if (
    input.employment_type !== 'UOP' ||
    input.applicant_role !== 'MOTHER' ||
    input.stage === 'ADOPTION' ||
    !input.due_or_birth_date ||
    !input.contract_end_date ||
    input.contract_end_date >= on ||
    on > input.due_or_birth_date ||
    input.contract_type !== 'FIXED_TERM'
  ) {
    return false;
  }
  const pregnancyStart = addDays(
    input.due_or_birth_date,
    -params.insuranceRisk.estimatedPregnancyDays,
  );
  return (
    daysBetween(pregnancyStart, input.contract_end_date) >=
    params.maternityLeave.contractProtectionWeeksFrom * params.calendar.daysPerWeek
  );
}

export function eventDate(input: CaseInputs): string | null {
  return input.stage === 'ADOPTION'
    ? (input.adopted_or_foster_child_acceptance_date ?? null)
    : input.due_or_birth_date;
}

export function livingChildrenCount(input: CaseInputs): number {
  if (input.deceased_children_count !== undefined) {
    const deceased = input.deceased_children_count;
    requireValue(
      Number.isInteger(deceased) && deceased >= 0 && deceased <= input.children_count,
      'deceased_children_count',
      'Liczba zmarłych dzieci musi mieścić się w liczbie dzieci z porodu.',
    );
    const living = input.children_count - deceased;
    requireValue(
      input.living_children_count === undefined || input.living_children_count === living,
      'deceased_children_count',
      'Liczba żyjących i zmarłych dzieci musi odpowiadać liczbie dzieci z porodu.',
    );
    return living;
  }
  return (
    input.living_children_count ??
    (input.special_circumstances.stillbirth_or_child_death === 'NONE'
      ? input.children_count
      : Math.max(0, input.children_count - 1))
  );
}

export function hasChildLoss(input: CaseInputs): boolean {
  return (
    input.special_circumstances.stillbirth_or_child_death !== 'NONE' ||
    livingChildrenCount(input) < input.children_count
  );
}

export function qualifiesAfterUnlawfulTermination(
  input: CaseInputs,
  on: string,
  params: BenefitParams,
): boolean {
  const birth = input.due_or_birth_date;
  const end = input.contract_end_date;
  return Boolean(
    input.special_circumstances.unlawful_termination_confirmed_by_court &&
      input.applicant_role === 'MOTHER' &&
      input.employment_type === 'UOP' &&
      (input.stage === 'POST_BIRTH' || input.stage === 'PREGNANCY') &&
      birth &&
      end &&
      end >= addDays(birth, -params.insuranceRisk.estimatedPregnancyDays) &&
      end < birth &&
      on >= birth,
  );
}

export function abandonmentTakeover(input: CaseInputs, birth: string, params: BenefitParams) {
  const abandonment = input.mother_abandonment_date;
  if (!abandonment || input.stage !== 'POST_BIRTH' || abandonment < birth) {
    return { start: null, reason: 'Podaj datę porzucenia dziecka przypadającą od dnia porodu.' };
  }
  const father = input.applicant_role === 'FATHER' ? input : input.other_parent;
  if (!father) {
    return { start: null, reason: 'Podaj tytuł ubezpieczenia ojca, który przejmuje opiekę.' };
  }
  if (father.employment_type !== 'UOP' && !input.father_stops_gainful_activity) {
    return {
      start: null,
      reason: 'Potwierdź, że ojciec przerwie działalność zarobkową, aby osobiście opiekować się dzieckiem.',
    };
  }
  const motherInsured = input.mother_was_insured_at_abandonment;
  if (motherInsured === undefined) {
    return { start: null, reason: 'Ustal, czy matka była objęta ubezpieczeniem chorobowym.' };
  }
  const minimum =
    params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate * params.calendar.daysPerWeek;
  const usedDays = input.mother_maternity_days_used ?? 0;
  if (motherInsured && usedDays < minimum) {
    return {
      start: null,
      reason: `Ubezpieczona matka musi wykorzystać co najmniej ${minimum} dni zasiłku po porodzie. Jeśli porzuciła dziecko wcześniej, ojciec może sprawdzić prawo do dodatkowego zasiłku opiekuńczego za ten okres.`,
    };
  }
  const nextDay = addDays(abandonment, 1);
  const afterMother = motherInsured ? addDays(birth, usedDays) : nextDay;
  const earliest = nextDay > afterMother ? nextDay : afterMother;
  if (input.father_takeover_date && input.father_takeover_date < earliest) {
    return { start: null, reason: `Najwcześniejsza data przejęcia to ${formatDatePl(earliest)}.` };
  }
  return { start: input.father_takeover_date ?? earliest, reason: null };
}

export function otherRole(role: ApplicantRole): ApplicantRole {
  return role === 'MOTHER' ? 'FATHER' : 'MOTHER';
}

export function insured(parent: CaseParentInsurance): boolean | null {
  if (parent.employment_type === 'UOP') return true;
  if (parent.employment_type === 'NONE') return false;
  return parent.voluntary_sickness_insured;
}

export function payer(parent: CaseParentInsurance) {
  if (parent.employment_type === 'NONE') return null;
  if (parent.employment_type === 'B2B') return 'ZUS';
  if (parent.payer_insured_count_nov_30 === null) return null;
  return parent.payer_insured_count_nov_30 === '> 20' ? 'EMPLOYER' : 'ZUS';
}

export function applicantDenial(
  input: CaseInputs,
  on: string,
  params: BenefitParams,
): string | null {
  if (insured(input) === false) return 'Brak ubezpieczenia chorobowego.';
  if (hasSelfEmployedDebt(input, params)) {
    return 'Zadłużenie składkowe przekracza ustawowy próg. Do wypłaty potrzebna jest spłata.';
  }
  if (input.title_start_date && on < input.title_start_date)
    return 'Tytuł ubezpieczenia powstał po zdarzeniu.';
  if (input.contract_end_date && input.contract_end_date < on) {
    if (qualifiesAfterUnlawfulTermination(input, on, params)) return null;
    if (isFixedTermExtendedToBirth(input, on, params)) return null;
    if (
      input.employment_type === 'UOP' &&
      input.applicant_role === 'MOTHER' &&
      input.due_or_birth_date &&
      (input.special_circumstances.employer_bankruptcy_or_liquidation ||
        input.special_circumstances.unlawful_termination_confirmed_by_court)
    ) {
      return null;
    }
    return 'Umowa zakończyła się przed powstaniem prawa do tego świadczenia.';
  }
  return insured(input) === null ? 'Brakuje informacji o ubezpieczeniu chorobowym.' : null;
}

export function parentDenial(
  parent: CaseParentInsurance,
  on: string,
  params: BenefitParams,
): string | null {
  if (insured(parent) === false) return 'Brak ubezpieczenia chorobowego.';
  if (hasSelfEmployedDebt(parent, params)) {
    return 'Zadłużenie składkowe przekracza ustawowy próg. Do wypłaty potrzebna jest spłata.';
  }
  if (parent.title_start_date && on < parent.title_start_date)
    return 'Tytuł ubezpieczenia powstał po zdarzeniu.';
  if (parent.contract_end_date && parent.contract_end_date < on)
    return 'Umowa zakończyła się przed powstaniem prawa do tego świadczenia.';
  return insured(parent) === null ? 'Brakuje informacji o ubezpieczeniu chorobowym.' : null;
}

export function grossBasisForParent(
  parent: Pick<CaseParentInsurance, 'employment_type' | 'monthly_bases'>,
  from: string,
  params: BenefitParams,
): number | null {
  const months = (parent.monthly_bases ?? [])
    .filter(
      (item) =>
        item.month < from.slice(0, 7) &&
        item.month >= addMonths(from, -params.benefitBase.lookbackMonths).slice(0, 7),
    )
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!months.length) return null;
  const average =
    months.reduce((sum, item) => sum + item.amount_pln - (item.excluded_bonus_pln ?? 0), 0) /
    months.length;
  const afterDeduction = average * (1 - params.benefitBase.socialContributionDeduction);
  const capped =
    parent.employment_type === 'UOP'
      ? afterDeduction
      : Math.min(afterDeduction, params.benefitBase.maxBaseNonEmployee);
  // ZUS ustala podstawę wymiaru zasiłku w PLN (zaokrągloną do grosza) przed wyliczeniem stawki miesięcznej i dziennej.
  return roundPln(capped);
}

export function grossBasis(input: CaseInputs, from: string, params: BenefitParams) {
  return grossBasisForParent(input, from, params);
}

function warningSeverity(warning: CaseWarning): number {
  switch (warning.code) {
    case 'NO_INSURANCE_ON_BIRTH_DATE':
      return 10;
    case 'CONTRACT_ENDS_BEFORE_BIRTH':
      return 11;
    case 'SELF_EMPLOYED_DEBT':
      return 12;
    case 'QUALIFICATION_CHECK':
      return 15;
    case 'WAITING_PERIOD_NOT_MET':
      return 20;
    case 'COMBINED_RATE_DEADLINE':
      return /upłynął|minął/i.test(warning.message_pl) ? 25 : 42;
    case 'SUPPLEMENTARY_TRANSITION':
      return 28;
    case 'SHAM_CONTRACT_RISK':
      return 30;
    case 'BASE_INCREASE_IN_PREGNANCY':
      return 31;
    case 'EMPLOYMENT_CONTEXT_RISK':
      return 32;
    case 'CONTRACT_EXTENDED_TO_BIRTH':
      return 40;
    case 'SUPPLEMENTARY_DATA':
      return 41;
    case 'FATHER_PARENTAL_MOTHER_UNINSURED':
      return 43;
    case 'NON_TRANSFERABLE_PARENTAL_PART':
      return 44;
    case 'MULTIPLE_INSURANCE_TITLES':
      return 45;
    default:
      return 50;
  }
}

export function finalizeWarnings(warnings: CaseWarning[]): CaseWarning[] {
  const unique = new Map<string, CaseWarning>();
  for (const item of warnings) {
    const existing = unique.get(item.code);
    if (!existing || warningSeverity(item) < warningSeverity(existing)) {
      unique.set(item.code, item);
    }
  }
  return [...unique.values()].sort((a, b) => warningSeverity(a) - warningSeverity(b));
}

export function insuranceRisks(input: CaseInputs, params: BenefitParams): CaseWarning[] {
  const warnings: CaseWarning[] = [];
  const birth = input.due_or_birth_date;
  const event = eventDate(input);
  const firstParentalPart = [...(input.parental_leave_parts ?? [])].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  )[0];
  const fatherTakeover =
    event && input.applicant_role === 'FATHER' && input.mother_abandonment_date
      ? abandonmentTakeover(input, event, params).start
      : null;
  const rightOn = input.parental_only
    ? (firstParentalPart?.start_date ?? input.application_date)
    : (fatherTakeover ?? event);
  const isInsured = insured(input);

  // 1. Brak ubezpieczenia chorobowego na dzień zdarzenia (sekcja H pkt 3)
  if (input.employment_type === 'NONE') {
    warnings.push({
      code: 'NO_INSURANCE_ON_BIRTH_DATE',
      legal_basis: KP.noInsurance,
      message_pl:
        'Brak ubezpieczenia chorobowego oznacza brak prawa do zasiłku macierzyńskiego i chorobowego z ZUS. Co zrobić: sprawdź prawo do świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy lub miasta; jeśli drugi rodzic podlega ubezpieczeniu chorobowemu, może skorzystać z urlopu rodzicielskiego i ojcowskiego.',
    });
  } else if (
    (input.employment_type === 'B2B' || input.employment_type === 'ZLECENIE') &&
    input.voluntary_sickness_insured === false
  ) {
    const titleLabel =
      input.employment_type === 'B2B' ? 'działalności gospodarczej (JDG)' : 'umowy zlecenia';
    const action =
      input.stage === 'POST_BIRTH'
        ? 'Co zrobić: sprawdź prawo do świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy lub miasta albo urlop rodzicielski ubezpieczonego drugiego rodzica.'
        : 'Co zrobić: zgłoś się do dobrowolnego ubezpieczenia chorobowego (ZUS ZUA) przed porodem — zasiłek macierzyński przysługuje bez okresu wyczekiwania.';
    warnings.push({
      code: 'NO_INSURANCE_ON_BIRTH_DATE',
      legal_basis: KP.voluntaryInsurance,
      message_pl: `Nie zgłoszono dobrowolnego ubezpieczenia chorobowego z tytułu ${titleLabel} — bez aktywnej składki chorobowej w dniu zdarzenia zasiłek macierzyński z ZUS nie przysługuje. ${action}`,
    });
  } else if (
    isInsured === true &&
    input.title_start_date &&
    rightOn &&
    rightOn < input.title_start_date
  ) {
    warnings.push({
      code: 'NO_INSURANCE_ON_BIRTH_DATE',
      legal_basis: KP.noInsurance,
      message_pl: `Ubezpieczenie chorobowe rozpoczęło się (${formatDatePl(input.title_start_date)}) po dniu zdarzenia (${formatDatePl(rightOn)}), więc w dniu zdarzenia nie było aktywne. Co zrobić: sprawdź daty zgłoszenia do ubezpieczeń na PUE/eZUS; w razie braku ubezpieczenia na dzień porodu sprawdź świadczenie rodzicielskie („Kosiniakowe”) lub urlop drugiego rodzica.`,
    });
  }

  // 2. Zakończenie umowy / JDG przed porodem lub przyjęcie ochrony z KP art. 177 § 3 (sekcja H pkt 3 i sekcja I)
  if (
    isInsured !== false &&
    input.contract_end_date &&
    rightOn &&
    input.contract_end_date < rightOn
  ) {
    if (qualifiesAfterUnlawfulTermination(input, rightOn, params)) {
      warnings.push({
        code: 'MATERNITY_AFTER_UNLAWFUL_TERMINATION',
        legal_basis: KP.unlawfulTermination,
        message_pl:
          'Prawomocny wyrok potwierdza ustanie ubezpieczenia z naruszeniem prawa w okresie ciąży. ZUS może wypłacić zasiłek macierzyński od dnia porodu. Przygotuj wyrok i zaświadczenie o ciąży w okresie zatrudnienia.',
      });
    } else if (isFixedTermExtendedToBirth(input, rightOn, params)) {
      warnings.push({
        code: 'CONTRACT_EXTENDED_TO_BIRTH',
        legal_basis: KP.contractProtection,
        message_pl: `Umowa o pracę na czas określony kończąca się po 3. miesiącu ciąży (${formatDatePl(input.contract_end_date)}) przedłuża się z mocy prawa do dnia porodu — prawo do zasiłku macierzyńskiego zostaje zachowane (nie dotyczy umowy na zastępstwo ani okresu próbnego do 1 miesiąca). Co zrobić: przekaż pracodawcy zaświadczenie lekarskie o ciąży; po dniu porodu zasiłek macierzyński wypłaci ZUS.`,
      });
    } else if (
      !(
        input.employment_type === 'UOP' &&
        input.applicant_role === 'MOTHER' &&
        input.due_or_birth_date &&
        input.special_circumstances.employer_bankruptcy_or_liquidation
      )
    ) {
      if (input.employment_type === 'UOP') {
        if (
          input.applicant_role === 'MOTHER' &&
          input.stage !== 'ADOPTION' &&
          input.due_or_birth_date
        ) {
          if (input.contract_type === 'FIXED_TERM') {
            warnings.push({
              code: 'CONTRACT_ENDS_BEFORE_BIRTH',
              legal_basis: `${KP.contractProtection}; ${KP.noInsurance}`,
              message_pl: `Umowa o pracę kończy się (${formatDatePl(input.contract_end_date)}) przed upływem 3. miesiąca ciąży i nie ulega automatycznemu przedłużeniu do dnia porodu — brak ubezpieczenia w dniu porodu oznacza brak zasiłku macierzyńskiego z ZUS. Co zrobić: sprawdź możliwość przedłużenia umowy lub podjęcia innego tytułu ubezpieczenia chorobowego przed porodem; w przeciwnym razie sprawdź świadczenie rodzicielskie („Kosiniakowe”).`,
            });
          } else if (input.contract_type === 'REPLACEMENT') {
            warnings.push({
              code: 'CONTRACT_ENDS_BEFORE_BIRTH',
              legal_basis: `${KP.contractProtection}; ${KP.noInsurance}`,
              message_pl: `Umowa o pracę na zastępstwo kończy się (${formatDatePl(input.contract_end_date)}) przed porodem i nie przedłuża się automatycznie do dnia porodu. Co zrobić: sprawdź możliwość zawarcia innej umowy lub zgłoszenia do ubezpieczenia chorobowego przed porodem; w przeciwnym razie sprawdź świadczenie rodzicielskie („Kosiniakowe”).`,
            });
          } else {
            warnings.push({
              code: 'CONTRACT_ENDS_BEFORE_BIRTH',
              legal_basis: `${KP.contractProtection}; ${KP.noInsurance}`,
              message_pl: `Umowa o pracę kończy się (${formatDatePl(input.contract_end_date)}) przed porodem (${formatDatePl(rightOn)}). Umowa na czas określony albo na okres próbny przekraczający 1 miesiąc, kończąca się po 3. miesiącu ciąży, przedłuża się z mocy prawa do dnia porodu; pozostałe umowy wygasają bez prawa do zasiłku z ZUS. Co zrobić: sprawdź rodzaj swojej umowy i przekaż pracodawcy zaświadczenie lekarskie o ciąży.`,
            });
          }
        } else {
          warnings.push({
            code: 'CONTRACT_ENDS_BEFORE_BIRTH',
            legal_basis: KP.noInsurance,
            message_pl: `Umowa o pracę kończy się (${formatDatePl(input.contract_end_date)}) przed datą zdarzenia (${formatDatePl(rightOn)}), co oznacza brak ubezpieczenia chorobowego w dniu powstania prawa do świadczenia. Co zrobić: sprawdź możliwość przedłużenia zatrudnienia lub podjęcia innego tytułu ubezpieczenia przed tą datą.`,
          });
        }
      } else {
        const kindLabel =
          input.employment_type === 'B2B' ? 'Działalność gospodarcza (JDG)' : 'Umowa zlecenie';
        const kindGenitive =
          input.employment_type === 'B2B' ? 'działalności gospodarczej' : 'umowy zlecenia';
        warnings.push({
          code: 'CONTRACT_ENDS_BEFORE_BIRTH',
          legal_basis: `${KP.noInsurance}; ${KP.contractProtection}`,
          message_pl: `${kindLabel} kończy się (${formatDatePl(input.contract_end_date)}) przed datą zdarzenia (${formatDatePl(rightOn)}). Automatyczne przedłużenie do dnia porodu z Kodeksu pracy dotyczy wyłącznie umowy o pracę, a nie ${kindGenitive} — zakończenie ubezpieczenia przed porodem oznacza brak zasiłku macierzyńskiego z ZUS. Co zrobić: utrzymaj aktywne ubezpieczenie chorobowe do dnia zdarzenia albo sprawdź prawo do świadczenia rodzicielskiego („Kosiniakowe”).`,
        });
      }
    }
  }

  // 3. Zadłużenie składkowe w JDG > 1% płacy minimalnej (ustawa zasiłkowa art. 2a)
  const threshold = debtThresholdPln(params);
  const debtShare = formatPercentPl(params.selfEmployedDebtThresholdShareOfMinimumWage);
  if (hasSelfEmployedDebt(input, params)) {
    warnings.push({
      code: 'SELF_EMPLOYED_DEBT',
      legal_basis: KP.debt,
      message_pl: `Zadłużenie składkowe w JDG przekracza próg ${debtShare} minimalnego wynagrodzenia (${formatPlnPl(threshold)}) na dzień powstania prawa — ZUS nie wypłaci zasiłku do czasu spłaty zaległości. Co zrobić: sprawdź saldo rozliczeń na PUE/eZUS i spłać całość zadłużenia, aby odblokować wypłatę świadczenia.`,
    });
  } else if (
    input.co_parenting &&
    input.other_parent &&
    hasSelfEmployedDebt(input.other_parent, params)
  ) {
    warnings.push({
      code: 'SELF_EMPLOYED_DEBT',
      legal_basis: KP.debt,
      message_pl: `Zadłużenie składkowe drugiego rodzica w JDG przekracza próg ${debtShare} minimalnego wynagrodzenia (${formatPlnPl(threshold)}) — ZUS nie wypłaci mu zasiłku do czasu spłaty zaległości. Co zrobić: sprawdź saldo rozliczeń na PUE/eZUS drugiego rodzica i spłać zadłużenie przed skorzystaniem z urlopu.`,
    });
  }

  if (isInsured !== true) return finalizeWarnings(warnings);

  // 4. Okres wyczekiwania na zasiłek chorobowy w ciąży (30 dni obowiązkowe / 90 dni dobrowolne)
  const waitingCheckDate =
    input.sickness_leave_start_date ??
    (input.stage === 'PREGNANCY' || input.stage === 'PLANNING'
      ? (input.reference_date ?? null)
      : null);
  if (
    input.applicant_role === 'MOTHER' &&
    input.stage !== 'ADOPTION' &&
    !input.sickness_waiting_period_confirmed &&
    waitingCheckDate
  ) {
    const waitDays =
      input.employment_type === 'UOP'
        ? params.sickness.waitingPeriodDaysMandatory
        : params.sickness.waitingPeriodDaysVoluntary;
    const duration = input.title_start_date
      ? daysBetween(input.title_start_date, waitingCheckDate)
      : input.insurance_duration_days;
    if (duration !== null && duration >= 0 && duration < waitDays) {
      const insuranceKind = input.employment_type === 'UOP' ? 'obowiązkowe' : 'dobrowolne';
      const eligibleFrom = input.title_start_date
        ? addDays(input.title_start_date, waitDays)
        : null;
      warnings.push({
        code: 'WAITING_PERIOD_NOT_MET',
        legal_basis: KP.waitingPeriod,
        message_pl: `Okres wyczekiwania na zasiłek chorobowy w ciąży wynosi ${waitDays} dni (ubezpieczenie ${insuranceKind}; obecny staż: ${duration} dni${eligibleFrom ? `, okres upłynie ${formatDatePl(eligibleFrom)}` : ''}). Sam zasiłek macierzyński przysługuje bez okresu wyczekiwania. Co zrobić: sprawdź na PUE/eZUS, czy możesz doliczyć poprzednie okresy ubezpieczenia chorobowego lub skorzystać z ustawowych wyjątków bez okresu wyczekiwania.`,
      });
    }
  }

  // 5. Pozorność tytułu ubezpieczenia / krótki staż przed porodem (sekcja H pkt 1)
  const { insuranceRisk: risk } = params;
  const pregnancy =
    birth && input.stage !== 'ADOPTION' ? addDays(birth, -risk.estimatedPregnancyDays) : null;
  const riskEvent =
    input.sickness_leave_start_date ??
    event ??
    (input.stage === 'PREGNANCY' ? (input.reference_date ?? null) : null);
  const title = input.title_start_date;
  const durationThresholdDays =
    input.stage !== 'ADOPTION' && !input.parental_only
      ? risk.estimatedPregnancyDays
      : risk.shortTitleMonths * params.calendar.dailyBenefitDivisor;
  const startedDuringPregnancyOrShort = title
    ? Boolean(
        (pregnancy && birth && title >= pregnancy && title <= birth) ||
        (riskEvent && title <= riskEvent && title > addMonths(riskEvent, -risk.shortTitleMonths)),
      )
    : input.insurance_duration_days !== null &&
      input.insurance_duration_days < durationThresholdDays;

  if (startedDuringPregnancyOrShort) {
    warnings.push({
      code: 'SHAM_CONTRACT_RISK',
      legal_basis: KP.shamContract,
      message_pl:
        'Ubezpieczenie rozpoczęło się w trakcie ciąży lub krótko przed porodem. ZUS może przeprowadzić postępowanie wyjaśniające i uznać umowę lub działalność za zawartą dla pozoru — w skrajnym przypadku może wydać decyzję o niepodleganiu ubezpieczeniom i odmówić zasiłku. Co zrobić: zachowaj dokumenty potwierdzające faktyczne wykonywanie pracy lub prowadzenie działalności (umowę, efekty pracy, ewidencję czasu pracy, korespondencję, faktury i przelewy). Sam sygnał nie odbiera prawa do świadczeń.',
    });
  }

  // 6. Wyraźne podwyższenie podstawy składek w ciąży (tylko gdy znane są miesięczne podstawy) (sekcja H pkt 2)
  const months = [...(input.monthly_bases ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  if (
    pregnancy &&
    birth &&
    months.some((item, index) => {
      if (
        index === 0 ||
        item.month < addMonths(pregnancy, -risk.beforePregnancyMonths).slice(0, 7) ||
        item.month > birth.slice(0, 7)
      )
        return false;
      const preceding = months.slice(0, index).map((base) => base.amount_pln);
      const average = preceding.reduce((sum, value) => sum + value, 0) / preceding.length;
      return average > 0 && item.amount_pln >= average * (1 + risk.baseIncreasePercent / 100);
    })
  ) {
    warnings.push({
      code: 'BASE_INCREASE_IN_PREGNANCY',
      legal_basis: KP.baseIncrease,
      message_pl:
        'Podstawa wymiaru składek wyraźnie wzrosła w okresie ciąży lub bezpośrednio przed nią. ZUS może przeprowadzić postępowanie wyjaśniające i ustalić niższą podstawę zasiłku, jeśli uzna, że podwyżka miała na celu wyłącznie wyższe świadczenia. Co zrobić: zachowaj dokumenty uzasadniające zmianę wynagrodzenia lub podstawy (aneks do umowy, zakres obowiązków, potwierdzenia przychodów firmy). Sam sygnał nie przesądza o obniżeniu zasiłku.',
    });
  }

  // 7. Kontekst zatrudnienia (członek rodziny / nowe stanowisko)
  if (input.employer_is_family_member || input.newly_created_position) {
    warnings.push({
      code: 'EMPLOYMENT_CONTEXT_RISK',
      legal_basis: KP.shamContract,
      message_pl:
        'Wskazano zatrudnienie u członka rodziny lub na nowo utworzonym stanowisku. ZUS może przeprowadzić postępowanie wyjaśniające dotyczące faktycznego wykonywania pracy i wysokości wynagrodzenia. Co zrobić: zachowaj umowę, zakres obowiązków, ewidencję czasu pracy, efekty zadań oraz potwierdzenia wypłaty wynagrodzenia. Sam sygnał nie odbiera prawa do świadczeń.',
    });
  }

  // 8. Zbieg dwóch tytułów ubezpieczenia naraz
  if (input.additional_insurance_titles?.length ||
      (input.secondary_employment_type && input.secondary_employment_type !== 'NONE')) {
    const secondaryInsured = input.additional_insurance_titles?.length
      ? input.additional_insurance_titles.some((title) => title.sickness_insured === true)
      : input.secondary_employment_type !== 'UOP' &&
        input.secondary_voluntary_sickness_insured === true;
    warnings.push({
      code: 'MULTIPLE_INSURANCE_TITLES',
      legal_basis: KP.multipleTitles,
      message_pl: secondaryInsured
        ? 'Wskazano dwa równoległe tytuły ubezpieczenia chorobowego — zasiłek przysługuje odrębnie z każdego tytułu, z którego opłacana jest składka chorobowa (osobne podstawy wymiaru i wnioski). Co zrobić: złóż osobny wniosek o zasiłek dla drugiego tytułu (np. ZUS ZAM dla JDG lub zlecenia albo u drugiego pracodawcy).'
        : 'Wskazano dodatkowy tytuł ubezpieczenia bez potwierdzonej składki chorobowej — zasiłek przysługuje wyłącznie z tytułu objętego ubezpieczeniem chorobowym. Co zrobić: sprawdź na PUE/eZUS, czy z drugiego tytułu odprowadzana jest składka chorobowa.',
    });
  }

  return finalizeWarnings(warnings);
}
