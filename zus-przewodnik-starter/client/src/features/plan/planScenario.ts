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
  | 'entitlements'
  | 'calculator'
  | 'leave-plan'
  | 'documents'
  | 'applications'
  | 'support';

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

const DEFAULT_REFERENCE_DATE: IsoDate = '2026-11-21';
const DEFAULT_BIRTH_DATE: IsoDate = '2026-11-10';
const DEFAULT_EXPECTED_BIRTH_DATE: IsoDate = '2027-03-10';
const DEFAULT_BENEFIT_BASE = 6000;
const DEFAULT_FATHER_BASE = 7500;

export function defaultSicknessInsurance(title: InsuranceTitle): SicknessInsurance {
  if (title === 'employment') return 'mandatory';
  if (title === 'none') return 'none';
  return 'voluntary';
}

export function buildDefaultMother(partial?: Partial<ParentData> | null): ParentData {
  const insuranceTitle: InsuranceTitle = partial?.insuranceTitle ?? 'employment';
  return {
    role: 'mother',
    insuranceTitle,
    sicknessInsurance: partial?.sicknessInsurance ?? defaultSicknessInsurance(insuranceTitle),
    insuredSince:
      partial?.insuredSince !== undefined
        ? partial.insuredSince
        : insuranceTitle === 'none'
          ? null
          : '2024-01-01',
    insuranceEndDate: partial?.insuranceEndDate ?? null,
    benefitBase:
      partial?.benefitBase !== undefined
        ? partial.benefitBase
        : insuranceTitle === 'none'
          ? null
          : DEFAULT_BENEFIT_BASE,
    employerInsuredCount:
      partial?.employerInsuredCount !== undefined
        ? partial.employerInsuredCount
        : insuranceTitle === 'employment'
          ? 25
          : null,
    age: partial?.age !== undefined ? partial.age : 30,
    contributionDebt:
      partial?.contributionDebt !== undefined
        ? partial.contributionDebt
        : insuranceTitle === 'selfEmployed'
          ? 0
          : null,
    wantsLeave: partial?.wantsLeave ?? true,
  };
}

export function buildDefaultFather(partial?: Partial<ParentData> | null): ParentData | null {
  if (partial === null) return null;
  const insuranceTitle: InsuranceTitle = partial?.insuranceTitle ?? 'employment';
  return {
    role: 'father',
    insuranceTitle,
    sicknessInsurance: partial?.sicknessInsurance ?? defaultSicknessInsurance(insuranceTitle),
    insuredSince:
      partial?.insuredSince !== undefined
        ? partial.insuredSince
        : insuranceTitle === 'none'
          ? null
          : '2024-01-01',
    insuranceEndDate: partial?.insuranceEndDate ?? null,
    benefitBase:
      partial?.benefitBase !== undefined
        ? partial.benefitBase
        : insuranceTitle === 'none'
          ? null
          : DEFAULT_FATHER_BASE,
    employerInsuredCount:
      partial?.employerInsuredCount !== undefined
        ? partial.employerInsuredCount
        : insuranceTitle === 'employment'
          ? 30
          : null,
    age: partial?.age !== undefined ? partial.age : 32,
    contributionDebt:
      partial?.contributionDebt !== undefined
        ? partial.contributionDebt
        : insuranceTitle === 'selfEmployed'
          ? 0
          : null,
    wantsLeave: partial?.wantsLeave ?? true,
  };
}

export function buildDefaultSpecial(
  partial?: Partial<SpecialCircumstances>,
): SpecialCircumstances {
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

/**
 * Buduje kompletny `ScenarioInput` z `ScenarioDraft` oraz parametrów URL (query string ma pierwszeństwo).
 */
export function resolveScenarioInput(
  draft: ScenarioDraft,
  searchParams: URLSearchParams,
): ScenarioInput {
  const urlSituation = parseSituation(searchParams.get('situation'));
  const situation: SituationType = urlSituation ?? draft.situation ?? 'afterBirth';

  const urlEmployment =
    parseInsuranceTitleParam(searchParams.get('zatrudnienie')) ??
    parseInsuranceTitleParam(searchParams.get('employment'));
  const urlChildren =
    parseNumberParam(searchParams.get('dzieci')) ?? parseNumberParam(searchParams.get('children'));
  const urlBirthDate =
    parseIsoDateParam(searchParams.get('porod')) ?? parseIsoDateParam(searchParams.get('birthDate'));
  const urlBase =
    parseNumberParam(searchParams.get('podstawa')) ?? parseNumberParam(searchParams.get('base'));
  const urlVariant = searchParams.get('wariant') ?? searchParams.get('variant');
  const urlDebt =
    parseNumberParam(searchParams.get('zadluzenie')) ?? parseNumberParam(searchParams.get('debt'));
  const urlPayerCount = parseNumberParam(searchParams.get('platnik'));
  const urlFather = searchParams.get('ojciec') ?? searchParams.get('father');
  const urlZaZyciem = searchParams.get('zaZyciem');

  const baseMother = buildDefaultMother(draft.mother);
  const motherInsuranceTitle = urlEmployment ?? baseMother.insuranceTitle;
  const mother: ParentData = {
    ...baseMother,
    insuranceTitle: motherInsuranceTitle,
    sicknessInsurance:
      urlEmployment !== null
        ? defaultSicknessInsurance(motherInsuranceTitle)
        : baseMother.sicknessInsurance,
    benefitBase:
      urlBase !== null
        ? urlBase
        : motherInsuranceTitle === 'none'
          ? null
          : baseMother.benefitBase,
    contributionDebt:
      urlDebt !== null
        ? urlDebt
        : motherInsuranceTitle === 'selfEmployed'
          ? (baseMother.contributionDebt ?? 0)
          : null,
    employerInsuredCount:
      urlPayerCount !== null ? urlPayerCount : baseMother.employerInsuredCount,
  };

  let father: ParentData | null;
  if (urlFather === '0' || urlFather === 'false') {
    father = null;
  } else if (urlFather === '1' || urlFather === 'true') {
    father = buildDefaultFather(draft.father ?? undefined);
  } else {
    father = draft.father === null ? null : buildDefaultFather(draft.father);
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

  const childrenCount = Math.min(Math.max(Math.round(urlChildren ?? draft.childrenCount ?? 1), 1), 5);

  const expectedBirthDate =
    situation === 'planning' || situation === 'pregnant'
      ? (urlBirthDate ?? draft.expectedBirthDate ?? DEFAULT_EXPECTED_BIRTH_DATE)
      : (draft.expectedBirthDate ?? null);

  const birthDate =
    situation === 'afterBirth'
      ? (urlBirthDate ?? draft.birthDate ?? DEFAULT_BIRTH_DATE)
      : (draft.birthDate ?? null);

  const adoptionType: AdoptionType | null =
    situation === 'adoption' ? (draft.adoptionType ?? 'adoption') : null;
  const childAcceptanceDate =
    situation === 'adoption'
      ? (urlBirthDate ?? draft.childAcceptanceDate ?? DEFAULT_BIRTH_DATE)
      : null;

  return {
    situation,
    referenceDate: draft.referenceDate ?? DEFAULT_REFERENCE_DATE,
    expectedBirthDate,
    birthDate,
    childrenCount,
    adoptionType,
    childAcceptanceDate,
    childAgeYears: situation === 'adoption' ? (draft.childAgeYears ?? 2) : null,
    schoolObligationDeferred: draft.schoolObligationDeferred ?? false,
    rateVariant,
    mother,
    father,
    special,
  };
}

/**
 * Zapisuje kluczowe parametry scenariusza do URL (`/plan/:tab?situation=...&zatrudnienie=...`),
 * aby link do wyliczenia był udostępnialny (CONVENTIONS §7).
 */
export function scenarioToSearchParams(scenario: ScenarioInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('situation', scenario.situation);
  params.set('zatrudnienie', scenario.mother.insuranceTitle);
  params.set('dzieci', String(scenario.childrenCount));
  const eventDate = getScenarioEventDate(scenario);
  if (eventDate) {
    params.set('porod', eventDate);
  }
  if (scenario.mother.benefitBase !== null) {
    params.set('podstawa', String(scenario.mother.benefitBase));
  }
  params.set('wariant', scenario.rateVariant);
  if (scenario.mother.insuranceTitle === 'selfEmployed' && scenario.mother.contributionDebt !== null) {
    params.set('zadluzenie', String(scenario.mother.contributionDebt));
  }
  if (scenario.mother.employerInsuredCount !== null) {
    params.set('platnik', String(scenario.mother.employerInsuredCount));
  }
  params.set('ojciec', scenario.father ? '1' : '0');
  if (scenario.special.zaZyciemCertificate) {
    params.set('zaZyciem', '1');
  }
  return params;
}

export function scenarioToDraftPatch(scenario: ScenarioInput): Partial<ScenarioDraft> {
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
    mother: scenario.mother,
    father: scenario.father,
    special: scenario.special,
  };
}

export function getScenarioEventDate(scenario: ScenarioInput): IsoDate {
  if (scenario.situation === 'adoption') {
    return scenario.childAcceptanceDate ?? scenario.referenceDate;
  }
  if (scenario.situation === 'afterBirth') {
    return scenario.birthDate ?? scenario.referenceDate;
  }
  return scenario.expectedBirthDate ?? DEFAULT_EXPECTED_BIRTH_DATE;
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
    return `Pracodawca (> ${DEFAULT_PARAMS.payerThresholdInsuredCount} ubezpieczonych)`;
  }
  if (payer === 'zus') {
    return 'Zakład Ubezpieczeń Społecznych (ZUS)';
  }
  return 'Nie dotyczy';
}

export function isDifficultSituation(scenario: ScenarioInput): boolean {
  return Boolean(
    scenario.special.stillbirth ||
      scenario.special.childDeathDate ||
      scenario.special.motherDeceased ||
      scenario.special.motherIncapableOfIndependentLiving,
  );
}
