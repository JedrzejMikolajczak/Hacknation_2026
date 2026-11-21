import type {
  AdoptionType,
  BenefitType,
  InsuranceTitle,
  IsoDate,
  LeaveType,
  ParentData,
  ParentRole,
  Payer,
  RateVariant,
  ScenarioInput,
  SicknessInsurance,
  SituationType,
  SpecialCircumstances,
} from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import type { ScenarioDraft } from '../../app/scenarioDraft';
import { parseSituation } from '../../app/situation';

export type PlanTabId =
  'entitlements' | 'calculator' | 'leave-plan' | 'documents' | 'applications' | 'support';

export const PLAN_TABS: { id: PlanTabId; label: string }[] = [
  { id: 'entitlements', label: 'Uprawnienia' },
  { id: 'calculator', label: 'Kalkulator' },
  { id: 'leave-plan', label: 'Plan urlopów' },
  { id: 'documents', label: 'Dokumenty i terminy' },
  { id: 'applications', label: 'Wnioski' },
  { id: 'support', label: 'Wsparcie' },
];

export function isPlanTab(value: string | undefined): value is PlanTabId {
  return PLAN_TABS.some((tab) => tab.id === value);
}

const VALID_INSURANCE_TITLES: InsuranceTitle[] = [
  'employment',
  'mandateContract',
  'selfEmployed',
  'none',
];

export function todayIsoDate(): IsoDate {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultSicknessInsurance(title: InsuranceTitle): SicknessInsurance {
  if (title === 'employment') return 'mandatory';
  if (title === 'none') return 'none';
  return 'voluntary';
}

export function buildEmptyParent(
  role: ParentRole,
  partial?: Partial<ParentData> | null,
): ParentData {
  const insuranceTitle: InsuranceTitle = partial?.insuranceTitle ?? 'none';
  const sicknessInsurance: SicknessInsurance =
    partial?.sicknessInsurance ??
    (partial?.insuranceTitle !== undefined ? defaultSicknessInsurance(insuranceTitle) : 'none');

  return {
    role,
    insuranceTitle,
    sicknessInsurance,
    insuredSince: partial?.insuredSince ?? null,
    insuranceEndDate: partial?.insuranceEndDate ?? null,
    benefitBase: partial?.benefitBase ?? null,
    employerInsuredCount: partial?.employerInsuredCount ?? null,
    age: partial?.age ?? null,
    contributionDebt: partial?.contributionDebt ?? null,
    wantsLeave: partial?.wantsLeave ?? true,
  };
}

export function buildDefaultSpecial(partial?: Partial<SpecialCircumstances>): SpecialCircumstances {
  return {
    zaZyciemCertificate: partial?.zaZyciemCertificate ?? false,
    pregnancyWeekAtBirth: partial?.pregnancyWeekAtBirth ?? null,
    birthWeightGrams: partial?.birthWeightGrams ?? null,
    hospitalizationDays: partial?.hospitalizationDays ?? null,
    stillbirth: partial?.stillbirth ?? false,
    childDeathDate: partial?.childDeathDate ?? null,
    motherHospitalized: partial?.motherHospitalized ?? false,
    motherIncapableOfIndependentLiving: partial?.motherIncapableOfIndependentLiving ?? false,
    motherDeceased: partial?.motherDeceased ?? false,
    employerBankruptcyOrLiquidation: partial?.employerBankruptcyOrLiquidation ?? false,
  };
}

function parseIsoDateParam(value: string | null): IsoDate | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseNumberParam(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseInsuranceTitleParam(value: string | null): InsuranceTitle | null {
  if (!value) return null;
  if (value === 'uop') return 'employment';
  if (value === 'zlecenie') return 'mandateContract';
  if (value === 'jdg') return 'selfEmployed';
  if (value === 'brak') return 'none';
  return VALID_INSURANCE_TITLES.includes(value as InsuranceTitle)
    ? (value as InsuranceTitle)
    : null;
}

function parseAdoptionTypeParam(value: string | null): AdoptionType | null {
  if (value === 'adoption' || value === 'fosterFamily') return value;
  return null;
}

export interface ScenarioMeta {
  /** Czy matka jest uwzględniona w planie (false wyłącznie w ścieżce samodzielnego taty). */
  hasMotherInPlan: boolean;
  /** Czy użytkownik (w kreatorze lub URL) wskazał tytuł ubezpieczenia matki. */
  motherInsuranceKnown: boolean;
  /** Czy użytkownik wskazał tytuł ubezpieczenia ojca. */
  fatherInsuranceKnown: boolean;
}

export interface ResolvedPlanScenario {
  scenario: ScenarioInput;
  meta: ScenarioMeta;
}

/**
 * Buduje `ScenarioInput` oraz metadane kompletności z `ScenarioDraft` i parametrów URL.
 * Nie wymyśla fikcyjnych kwot, dat, stażu ani drugiego rodzica.
 */
export function resolvePlanContext(
  draft: ScenarioDraft,
  searchParams: URLSearchParams,
): ResolvedPlanScenario {
  const urlSituation = parseSituation(searchParams.get('situation'));
  const situation: SituationType = urlSituation ?? draft.situation ?? 'afterBirth';

  const urlEmployment =
    parseInsuranceTitleParam(searchParams.get('zatrudnienie')) ??
    parseInsuranceTitleParam(searchParams.get('employment'));
  const urlChildren =
    parseNumberParam(searchParams.get('dzieci')) ?? parseNumberParam(searchParams.get('children'));
  const urlBirthDate =
    parseIsoDateParam(searchParams.get('porod')) ??
    parseIsoDateParam(searchParams.get('birthDate'));
  const urlBase =
    parseNumberParam(searchParams.get('podstawa')) ?? parseNumberParam(searchParams.get('base'));
  const urlFatherBase =
    parseNumberParam(searchParams.get('podstawaOjca')) ??
    parseNumberParam(searchParams.get('fatherBase'));
  const urlVariant = searchParams.get('wariant') ?? searchParams.get('variant');
  const urlDebt =
    parseNumberParam(searchParams.get('zadluzenie')) ?? parseNumberParam(searchParams.get('debt'));
  const urlPayerCount = parseNumberParam(searchParams.get('platnik'));
  const urlFather = searchParams.get('ojciec') ?? searchParams.get('father');
  const urlZaZyciem = searchParams.get('zaZyciem');
  const urlAdoptionType = parseAdoptionTypeParam(searchParams.get('adopcja'));
  const urlChildAge = parseNumberParam(searchParams.get('wiekDziecka'));

  const isSingleFatherDraft =
    draft.mother === null &&
    draft.father !== null &&
    draft.father !== undefined &&
    urlEmployment === null;

  const hasMotherInPlan = !isSingleFatherDraft;
  const motherInsuranceKnown =
    hasMotherInPlan && (urlEmployment !== null || draft.mother?.insuranceTitle !== undefined);

  const baseMother = isSingleFatherDraft
    ? { ...buildEmptyParent('mother', null), wantsLeave: false }
    : buildEmptyParent('mother', draft.mother);

  const motherInsuranceTitle = urlEmployment ?? baseMother.insuranceTitle;
  const mother: ParentData = {
    ...baseMother,
    insuranceTitle: motherInsuranceTitle,
    sicknessInsurance:
      urlEmployment !== null
        ? defaultSicknessInsurance(motherInsuranceTitle)
        : baseMother.sicknessInsurance,
    benefitBase:
      urlBase !== null ? urlBase : motherInsuranceTitle === 'none' ? null : baseMother.benefitBase,
    contributionDebt:
      urlDebt !== null
        ? urlDebt
        : motherInsuranceTitle === 'selfEmployed'
          ? baseMother.contributionDebt
          : null,
    employerInsuredCount: urlPayerCount !== null ? urlPayerCount : baseMother.employerInsuredCount,
  };

  let father: ParentData | null = null;
  let fatherInsuranceKnown = false;
  if (urlFather === '0' || urlFather === 'false') {
    father = null;
  } else if (draft.father !== null && draft.father !== undefined) {
    father = buildEmptyParent('father', draft.father);
    if (urlFatherBase !== null) {
      father.benefitBase = urlFatherBase;
    }
    fatherInsuranceKnown = draft.father.insuranceTitle !== undefined;
  } else if (urlFather === '1' || urlFather === 'true') {
    father = {
      ...buildEmptyParent('father', {
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        benefitBase: urlFatherBase,
        wantsLeave: true,
      }),
    };
    fatherInsuranceKnown = true;
  }

  const special = buildDefaultSpecial(draft.special);
  if (urlZaZyciem === '1' || urlZaZyciem === 'true') {
    special.zaZyciemCertificate = true;
  } else if (urlZaZyciem === '0' || urlZaZyciem === 'false') {
    special.zaZyciemCertificate = false;
  }

  const rateVariant: RateVariant =
    urlVariant === 'standard' || urlVariant === 'combined'
      ? urlVariant
      : (draft.rateVariant ?? 'combined');

  const childrenCount = Math.min(
    Math.max(Math.round(urlChildren ?? draft.childrenCount ?? 1), 1),
    5,
  );

  const expectedBirthDate =
    situation === 'planning' || situation === 'pregnant'
      ? (urlBirthDate ?? draft.expectedBirthDate ?? null)
      : (draft.expectedBirthDate ?? null);

  const birthDate =
    situation === 'afterBirth'
      ? (urlBirthDate ?? draft.birthDate ?? null)
      : (draft.birthDate ?? null);

  const adoptionType: AdoptionType | null =
    situation === 'adoption' ? (urlAdoptionType ?? draft.adoptionType ?? null) : null;

  const childAcceptanceDate =
    situation === 'adoption' ? (urlBirthDate ?? draft.childAcceptanceDate ?? null) : null;

  const childAgeYears =
    situation === 'adoption' ? (urlChildAge ?? draft.childAgeYears ?? null) : null;

  return {
    scenario: {
      situation,
      referenceDate: draft.referenceDate ?? todayIsoDate(),
      expectedBirthDate,
      birthDate,
      childrenCount,
      adoptionType,
      childAcceptanceDate,
      childAgeYears,
      schoolObligationDeferred: draft.schoolObligationDeferred ?? false,
      rateVariant,
      mother,
      father,
      special,
    },
    meta: {
      hasMotherInPlan,
      motherInsuranceKnown,
      fatherInsuranceKnown,
    },
  };
}

/**
 * Buduje `ScenarioInput` z `ScenarioDraft` oraz parametrów URL (zachowana kompatybilność).
 */
export function resolveScenarioInput(
  draft: ScenarioDraft,
  searchParams: URLSearchParams,
): ScenarioInput {
  return resolvePlanContext(draft, searchParams).scenario;
}

/**
 * Zwraca faktycznie podaną przez użytkownika datę zdarzenia lub `null`, jeśli jej brakuje.
 */
export function getExplicitEventDate(scenario: ScenarioInput): IsoDate | null {
  if (scenario.situation === 'adoption') {
    return scenario.childAcceptanceDate;
  }
  if (scenario.situation === 'afterBirth') {
    return scenario.birthDate;
  }
  return scenario.expectedBirthDate;
}

/**
 * Zwraca datę zdarzenia albo `referenceDate` jako bezpieczny fallback dla komponentów osi czasu.
 */
export function getScenarioEventDate(scenario: ScenarioInput): IsoDate {
  return getExplicitEventDate(scenario) ?? scenario.referenceDate;
}

/**
 * Wykrywa brakujące dane wymagane do rzetelnego obliczenia w danej zakładce (bez zmyślania domyślnych).
 */
export function getMissingFieldsForTab(
  tab: 'entitlements' | 'calculator' | 'documents',
  scenario: ScenarioInput,
  meta: ScenarioMeta,
): string[] {
  const missing: string[] = [];
  const eventDate = getExplicitEventDate(scenario);

  if (!eventDate) {
    missing.push(
      scenario.situation === 'adoption'
        ? 'Data przyjęcia dziecka na wychowanie'
        : scenario.situation === 'afterBirth'
          ? 'Data porodu'
          : 'Przewidywana data porodu',
    );
  }

  if (scenario.situation === 'adoption' && scenario.adoptionType === null) {
    missing.push('Forma przyjęcia dziecka (adopcja lub rodzina zastępcza)');
  }

  if (meta.hasMotherInPlan && !meta.motherInsuranceKnown) {
    missing.push('Forma zatrudnienia / tytuł ubezpieczenia matki');
  }

  if (!meta.hasMotherInPlan && (!scenario.father || !meta.fatherInsuranceKnown)) {
    missing.push('Forma zatrudnienia / tytuł ubezpieczenia ojca');
  }

  if (tab === 'calculator') {
    const motherActive =
      meta.hasMotherInPlan &&
      meta.motherInsuranceKnown &&
      scenario.mother.insuranceTitle !== 'none' &&
      scenario.mother.sicknessInsurance !== 'none' &&
      !scenario.special.motherDeceased &&
      scenario.mother.wantsLeave;

    const fatherActive =
      scenario.father !== null &&
      scenario.father.insuranceTitle !== 'none' &&
      scenario.father.sicknessInsurance !== 'none' &&
      scenario.father.wantsLeave;

    if (motherActive && scenario.mother.benefitBase === null) {
      missing.push('Podstawa wymiaru zasiłku matki (lub przeciętne wynagrodzenie brutto)');
    }

    if (fatherActive && scenario.father && scenario.father.benefitBase === null) {
      missing.push('Podstawa wymiaru zasiłku ojca (lub przeciętne wynagrodzenie brutto)');
    }

    if (
      scenario.special.hospitalizationDays !== null &&
      scenario.special.hospitalizationDays > 0 &&
      scenario.special.pregnancyWeekAtBirth === null &&
      (scenario.special.birthWeightGrams === null || scenario.special.birthWeightGrams > 1000)
    ) {
      missing.push('Tydzień ciąży w chwili porodu (dla uzupełniającego urlopu macierzyńskiego)');
    }
  }

  return missing;
}

/**
 * Zapisuje kluczowe parametry scenariusza do URL (`/plan/:tab?situation=...`),
 * pomijając pola nieznane (bez wpisywania zmyślonych wartości).
 */
export function scenarioToSearchParams(
  scenario: ScenarioInput,
  meta?: ScenarioMeta,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('situation', scenario.situation);
  if (!meta || (meta.hasMotherInPlan && meta.motherInsuranceKnown)) {
    params.set('zatrudnienie', scenario.mother.insuranceTitle);
  }
  params.set('dzieci', String(scenario.childrenCount));
  const eventDate = getExplicitEventDate(scenario);
  if (eventDate) {
    params.set('porod', eventDate);
  }
  if (scenario.mother.benefitBase !== null) {
    params.set('podstawa', String(scenario.mother.benefitBase));
  }
  if (scenario.father?.benefitBase !== null && scenario.father?.benefitBase !== undefined) {
    params.set('podstawaOjca', String(scenario.father.benefitBase));
  }
  params.set('wariant', scenario.rateVariant);
  if (
    scenario.mother.insuranceTitle === 'selfEmployed' &&
    scenario.mother.contributionDebt !== null
  ) {
    params.set('zadluzenie', String(scenario.mother.contributionDebt));
  }
  if (scenario.mother.employerInsuredCount !== null) {
    params.set('platnik', String(scenario.mother.employerInsuredCount));
  }
  params.set('ojciec', scenario.father ? '1' : '0');
  if (scenario.special.zaZyciemCertificate) {
    params.set('zaZyciem', '1');
  }
  if (scenario.situation === 'adoption') {
    if (scenario.adoptionType) params.set('adopcja', scenario.adoptionType);
    if (scenario.childAgeYears !== null) params.set('wiekDziecka', String(scenario.childAgeYears));
  }
  return params;
}

export function scenarioToDraftPatch(
  scenario: ScenarioInput,
  meta?: ScenarioMeta,
): Partial<ScenarioDraft> {
  return {
    situation: scenario.situation,
    referenceDate: scenario.referenceDate,
    expectedBirthDate: scenario.expectedBirthDate,
    birthDate: scenario.birthDate,
    childrenCount: scenario.childrenCount,
    adoptionType: scenario.adoptionType,
    childAcceptanceDate: scenario.childAcceptanceDate,
    childAgeYears: scenario.childAgeYears,
    schoolObligationDeferred: scenario.schoolObligationDeferred,
    rateVariant: scenario.rateVariant,
    mother: meta && !meta.hasMotherInPlan ? null : scenario.mother,
    father: scenario.father,
    special: scenario.special,
  };
}

export function addDaysIso(isoDate: IsoDate, days: number): IsoDate {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function diffDaysIso(fromIso: IsoDate, toIso: IsoDate): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

const PLN_FORMATTER = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatPln(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Brak danych';
  }
  return PLN_FORMATTER.format(amount);
}

export function formatPolishDate(iso: IsoDate | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Brak daty';
  const [y, m, d] = iso.split('-').map(Number);
  return DATE_FORMATTER.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatInsuranceTitle(title: InsuranceTitle): string {
  switch (title) {
    case 'employment':
      return 'Umowa o pracę';
    case 'mandateContract':
      return 'Umowa zlecenie';
    case 'selfEmployed':
      return 'Działalność gospodarcza (JDG)';
    case 'none':
      return 'Brak ubezpieczenia chorobowego';
  }
}

export function formatBenefitName(benefit: BenefitType): string {
  switch (benefit) {
    case 'sicknessBenefit':
      return 'Zasiłek chorobowy w ciąży';
    case 'employerSickPay':
      return 'Wynagrodzenie chorobowe (od pracodawcy)';
    case 'maternityBenefit':
      return 'Zasiłek macierzyński';
    case 'maternityEquivalentBenefit':
      return 'Zasiłek w wysokości zasiłku macierzyńskiego';
    case 'rehabilitationBenefit':
      return 'Świadczenie rehabilitacyjne';
  }
}

export function formatLeaveType(leaveType: LeaveType): string {
  switch (leaveType) {
    case 'maternityLeave':
      return 'Urlop macierzyński';
    case 'adoptionMaternityLeave':
      return 'Urlop na warunkach macierzyńskiego';
    case 'supplementaryMaternityLeave':
      return 'Uzupełniający urlop macierzyński';
    case 'parentalLeave':
      return 'Urlop rodzicielski';
    case 'paternityLeave':
      return 'Urlop ojcowski';
  }
}

export function formatParentRole(role: ParentRole): string {
  return role === 'mother' ? 'Matka' : 'Ojciec / drugi rodzic';
}

export function formatPayer(payer: Payer | null): string {
  if (payer === 'employer') {
    return `Płatnik składek (> ${DEFAULT_PARAMS.payerThresholdInsuredCount} ubezpieczonych)`;
  }
  if (payer === 'zus') {
    return 'Zakład Ubezpieczeń Społecznych (ZUS)';
  }
  return 'Zależnie od liczby ubezpieczonych u płatnika (lub nie dotyczy)';
}

export function isDifficultSituation(scenario: ScenarioInput): boolean {
  return Boolean(
    scenario.special.stillbirth ||
    scenario.special.childDeathDate ||
    scenario.special.motherDeceased ||
    scenario.special.motherIncapableOfIndependentLiving,
  );
}
