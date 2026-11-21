import type {
  BenefitBaseResult,
  BenefitParams,
  DocumentChecklist,
  EligibilityResult,
  MaternityCalculationResult,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  ScenarioInput,
  SicknessResult,
} from '@shared/types';
import {
  calculateBenefitBase,
  calculateMaternity,
  calculateParentalLeaveWithWork,
  calculateSicknessInPregnancy,
  checkEligibility,
  getRequiredDocuments,
  planParentalSplit,
  type BaseInput,
  type EligibilityInput,
  type SicknessInput,
} from '@shared/engine';
import { ApiError, apiGet, apiPost } from '../../api/client';
import { DEFAULT_PARAMS, formatRate } from '../../app/benefitParams';
import type { ScenarioDraft } from '../../app/scenarioDraft';

export interface AssistantAnswer {
  answer: string;
  sources: { title: string; legalBasis: string }[];
  fromApi: boolean;
}

export interface PlanBundleResult {
  params: BenefitParams;
  eligibility: EligibilityResult;
  maternity: MaternityCalculationResult;
  sickness: SicknessResult;
  documents: DocumentChecklist;
  usingApi: boolean;
}

export interface PlanBundleOptions {
  sicknessStartDate?: string;
  sicknessBenefitBase?: number | null;
}

export interface ResolvedBasesResult {
  scenarioWithBases: ScenarioInput;
  motherBaseResult: BenefitBaseResult | null;
  fatherBaseResult: BenefitBaseResult | null;
  sicknessBaseResult: BenefitBaseResult | null;
  usingApi: boolean;
}

function isValidationApiError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'VALIDATION_ERROR';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Brak wymaganych danych do wyliczenia.';
}

function emptyEligibility(): EligibilityResult {
  return { entitlements: [], warnings: [] };
}

function emptyMaternity(
  message: string,
  warnings: EligibilityResult['warnings'] = [],
): MaternityCalculationResult {
  return {
    periods: [],
    totalAmount: 0,
    variants: null,
    explanations: [{ message, legalBasis: null }],
    warnings,
  };
}

function emptySickness(params: BenefitParams, message: string): SicknessResult {
  return {
    entitled: false,
    employerSickPayDays: 0,
    sicknessBenefitMaxDays: 0,
    rate: params.rates.sicknessPregnancy,
    dailyAmount: null,
    explanations: [{ message, legalBasis: null }],
  };
}

function emptyDocuments(): DocumentChecklist {
  return { payer: 'zus', documents: [], deadlines: [] };
}

function safeLocalEligibility(input: EligibilityInput, params: BenefitParams): EligibilityResult {
  try {
    return checkEligibility(input, params);
  } catch {
    return emptyEligibility();
  }
}

function safeLocalMaternity(
  input: EligibilityInput,
  params: BenefitParams,
  warnings: EligibilityResult['warnings'],
): MaternityCalculationResult {
  try {
    return calculateMaternity(input, params);
  } catch (err) {
    return emptyMaternity(errorMessage(err), warnings);
  }
}

function safeLocalSickness(input: SicknessInput, params: BenefitParams): SicknessResult {
  try {
    return calculateSicknessInPregnancy(input, params);
  } catch (err) {
    return emptySickness(params, errorMessage(err));
  }
}

function safeLocalDocuments(scenario: ScenarioInput, params: BenefitParams): DocumentChecklist {
  try {
    return getRequiredDocuments(scenario, params);
  } catch {
    return emptyDocuments();
  }
}

/**
 * Oblicza pakiet planu lokalnie tym samym czystym silnikiem `@shared/engine` (tryb awaryjny / inicjalny).
 */
export function computePlanBundleLocally(
  scenario: ScenarioInput,
  params: BenefitParams = DEFAULT_PARAMS,
  options?: PlanBundleOptions,
): PlanBundleResult {
  const eligInput: EligibilityInput = options?.sicknessStartDate
    ? { ...scenario, sicknessStartDate: options.sicknessStartDate }
    : scenario;
  const sickInput: SicknessInput = {
    ...eligInput,
    mother:
      options?.sicknessBenefitBase !== undefined && options.sicknessBenefitBase !== null
        ? { ...scenario.mother, benefitBase: options.sicknessBenefitBase }
        : scenario.mother,
  };

  const eligibility = safeLocalEligibility(eligInput, params);
  const maternity = safeLocalMaternity(eligInput, params, eligibility.warnings);
  const sickness = safeLocalSickness(sickInput, params);
  const documents = safeLocalDocuments(scenario, params);

  return {
    params,
    eligibility,
    maternity,
    sickness,
    documents,
    usingApi: false,
  };
}

/* ---------- Warstwa API z pojedynczym źródłem prawdy (@shared/engine jako fallback) ---------- */

export async function fetchBenefitBase(
  input: BaseInput,
  params: BenefitParams = DEFAULT_PARAMS,
): Promise<{ result: BenefitBaseResult; usingApi: boolean }> {
  try {
    const result = await apiPost<BenefitBaseResult>('/calculate/benefit-base', input);
    return { result, usingApi: true };
  } catch (err) {
    if (isValidationApiError(err)) {
      throw err;
    }
    return { result: calculateBenefitBase(input, params), usingApi: false };
  }
}

/**
 * Gdy podstawa wymiaru mamy lub ojca nie jest podana wprost, wylicza ją przez
 * `POST /api/v1/calculate/benefit-base` (najpierw chorobowy, potem macierzyński z ciągłością art. 43).
 */
export async function resolveBenefitBasesForPlan(
  draft: ScenarioDraft,
  scenario: ScenarioInput,
  params: BenefitParams = DEFAULT_PARAMS,
): Promise<ResolvedBasesResult> {
  let usingApi = true;
  let sicknessBaseResult: BenefitBaseResult | null = null;
  let motherBaseResult: BenefitBaseResult | null = null;
  let fatherBaseResult: BenefitBaseResult | null = null;

  let nextMotherBase = scenario.mother.benefitBase;
  let nextFatherBase = scenario.father?.benefitBase ?? null;

  if (nextMotherBase === null && draft.sicknessBenefitBaseInput) {
    try {
      const sickPayload: BaseInput = {
        ...draft.sicknessBenefitBaseInput,
        insuredSince: scenario.mother.insuredSince ?? undefined,
      };
      const res = await fetchBenefitBase(sickPayload, params);
      sicknessBaseResult = res.result;
      if (!res.usingApi) usingApi = false;
    } catch {
      sicknessBaseResult = null;
    }
  }

  if (nextMotherBase === null && draft.benefitBaseInputs?.mother) {
    try {
      const motherPayload: BaseInput = {
        ...draft.benefitBaseInputs.mother,
        insuredSince: scenario.mother.insuredSince ?? undefined,
        previousBenefitBase:
          draft.benefitBaseInputs.mother.previousBenefitBase ??
          sicknessBaseResult?.benefitBase ??
          null,
      };
      const res = await fetchBenefitBase(motherPayload, params);
      motherBaseResult = res.result;
      nextMotherBase = res.result.benefitBase;
      if (!res.usingApi) usingApi = false;
    } catch {
      motherBaseResult = null;
    }
  } else if (
    nextMotherBase === null &&
    sicknessBaseResult !== null &&
    draft.pregnancySickLeave?.untilBirth === true
  ) {
    nextMotherBase = sicknessBaseResult.benefitBase;
    motherBaseResult = sicknessBaseResult;
  }

  if (scenario.father && nextFatherBase === null && draft.benefitBaseInputs?.father) {
    try {
      const fatherPayload: BaseInput = {
        ...draft.benefitBaseInputs.father,
        insuredSince: scenario.father.insuredSince ?? undefined,
      };
      const res = await fetchBenefitBase(fatherPayload, params);
      fatherBaseResult = res.result;
      nextFatherBase = res.result.benefitBase;
      if (!res.usingApi) usingApi = false;
    } catch {
      fatherBaseResult = null;
    }
  }

  const scenarioWithBases: ScenarioInput = {
    ...scenario,
    mother: { ...scenario.mother, benefitBase: nextMotherBase },
    father: scenario.father ? { ...scenario.father, benefitBase: nextFatherBase } : null,
  };

  return {
    scenarioWithBases,
    motherBaseResult,
    fatherBaseResult,
    sicknessBaseResult,
    usingApi,
  };
}

export async function fetchPlanBundle(
  scenario: ScenarioInput,
  options?: PlanBundleOptions,
): Promise<PlanBundleResult> {
  let params: BenefitParams = DEFAULT_PARAMS;
  let apiReachable = true;

  try {
    params = await apiGet<BenefitParams>('/params');
  } catch {
    params = DEFAULT_PARAMS;
    apiReachable = false;
  }

  const eligPayload: EligibilityInput = options?.sicknessStartDate
    ? { ...scenario, sicknessStartDate: options.sicknessStartDate }
    : scenario;

  const sickPayload: SicknessInput = {
    ...eligPayload,
    mother:
      options?.sicknessBenefitBase !== undefined && options.sicknessBenefitBase !== null
        ? { ...scenario.mother, benefitBase: options.sicknessBenefitBase }
        : scenario.mother,
  };

  if (!apiReachable) {
    return computePlanBundleLocally(scenario, params, options);
  }

  const [eligRes, matRes, sickRes, docRes] = await Promise.allSettled([
    apiPost<EligibilityResult>('/eligibility', eligPayload),
    apiPost<MaternityCalculationResult>('/calculate/maternity', eligPayload),
    apiPost<SicknessResult>('/calculate/sickness', sickPayload),
    apiPost<DocumentChecklist>('/documents', scenario),
  ]);

  let usedLocalFallback = false;

  let eligibility: EligibilityResult;
  if (eligRes.status === 'fulfilled') {
    eligibility = eligRes.value;
  } else if (isValidationApiError(eligRes.reason)) {
    eligibility = emptyEligibility();
  } else {
    usedLocalFallback = true;
    eligibility = safeLocalEligibility(eligPayload, params);
  }

  let maternity: MaternityCalculationResult;
  if (matRes.status === 'fulfilled') {
    maternity = matRes.value;
  } else if (isValidationApiError(matRes.reason)) {
    maternity = emptyMaternity(matRes.reason.message, eligibility.warnings);
  } else {
    usedLocalFallback = true;
    maternity = safeLocalMaternity(eligPayload, params, eligibility.warnings);
  }

  let sickness: SicknessResult;
  if (sickRes.status === 'fulfilled') {
    sickness = sickRes.value;
  } else if (isValidationApiError(sickRes.reason)) {
    sickness = emptySickness(params, sickRes.reason.message);
  } else {
    usedLocalFallback = true;
    sickness = safeLocalSickness(sickPayload, params);
  }

  let documents: DocumentChecklist;
  if (docRes.status === 'fulfilled') {
    documents = docRes.value;
  } else if (isValidationApiError(docRes.reason)) {
    documents = emptyDocuments();
  } else {
    usedLocalFallback = true;
    documents = safeLocalDocuments(scenario, params);
  }

  return {
    params,
    eligibility,
    maternity,
    sickness,
    documents,
    usingApi: !usedLocalFallback,
  };
}

export async function fetchParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): Promise<ParentalSplitResult> {
  try {
    return await apiPost<ParentalSplitResult>('/plan/parental-split', input);
  } catch (err) {
    if (isValidationApiError(err)) {
      return {
        valid: false,
        errors: [{ message: err.message, legalBasis: null }],
        periods: [],
        remainingWeeks: { mother: 0, father: 0 },
      };
    }
    try {
      return planParentalSplit(input, params);
    } catch (localErr) {
      return {
        valid: false,
        errors: [{ message: errorMessage(localErr), legalBasis: null }],
        periods: [],
        remainingWeeks: { mother: 0, father: 0 },
      };
    }
  }
}

export async function fetchParentalWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): Promise<ParentalWithWorkResult> {
  try {
    return await apiPost<ParentalWithWorkResult>('/plan/parental-with-work', input);
  } catch (err) {
    if (isValidationApiError(err)) {
      return {
        extendedWeeks: 0,
        extendedDays: 0,
        periods: [],
        explanations: [{ message: err.message, legalBasis: null }],
      };
    }
    try {
      return calculateParentalLeaveWithWork(input, params);
    } catch (localErr) {
      return {
        extendedWeeks: 0,
        extendedDays: 0,
        periods: [],
        explanations: [{ message: errorMessage(localErr), legalBasis: null }],
      };
    }
  }
}

export async function askGuideAssistant(
  question: string,
  params: BenefitParams,
): Promise<AssistantAnswer> {
  try {
    const res = await apiPost<{ answer: string; sources: string[] }>('/assistant/ask', {
      question,
    });
    return {
      answer: res.answer,
      sources: res.sources.map((src) => ({ title: src, legalBasis: 'Poradnik ZUS 2026' })),
      fromApi: true,
    };
  } catch {
    const lower = question.toLowerCase();
    if (lower.includes('81') || lower.includes('21') || lower.includes('stawk')) {
      return {
        answer: `Jeśli matka złoży wniosek o cały wymiar urlopu macierzyńskiego i rodzicielskiego w ciągu ${params.combinedRateApplicationDeadlineDays} dni od porodu, otrzyma ujednoliconą stawkę ${formatRate(params.rates.combined)} za cały okres. Uwaga: nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni drugiego rodzica zawsze wynosi ${formatRate(params.rates.secondParentNonTransferableInCombined)}. Bez wniosku w 21 dni obowiązuje wariant ${formatRate(params.rates.maternity)} (macierzyński) + ${formatRate(params.rates.parental)} (rodzicielski).`,
        sources: [
          {
            title: 'Poradnik dla rodziców ZUS 2026',
            legalBasis: 'Ustawa zasiłkowa art. 30a, art. 31',
          },
        ],
        fromApi: false,
      };
    }
    if (
      lower.includes('jdg') ||
      lower.includes('działalno') ||
      lower.includes('zaleg') ||
      lower.includes('zadłuż')
    ) {
      return {
        answer: `Przy działalności gospodarczej (JDG) zasiłek macierzyński i chorobowy przysługują pod warunkiem opłacania dobrowolnego ubezpieczenia chorobowego i braku zadłużenia przekraczającego 1% minimalnego wynagrodzenia (art. 2a ustawy zasiłkowej). Po zakończeniu zasiłku macierzyńskiego pamiętaj o ponownym zgłoszeniu się do dobrowolnego ubezpieczenia chorobowego (ZUS ZUA).`,
        sources: [
          {
            title: 'Poradnik dla rodziców ZUS 2026',
            legalBasis: 'Ustawa zasiłkowa art. 2a; art. 14 u.s.u.s.',
          },
        ],
        fromApi: false,
      };
    }
    if (
      lower.includes('ojc') ||
      lower.includes('9 tyg') ||
      lower.includes('ojca') ||
      lower.includes('tat')
    ) {
      return {
        answer: `Ojciec ma prawo do ${params.paternityLeave.weeks} tygodni urlopu ojcowskiego (${formatRate(params.rates.paternity)}, do ${params.paternityLeave.deadlineChildAgeMonths}. miesiąca życia dziecka, w maksymalnie ${params.paternityLeave.maxParts} częściach) oraz do ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni nieprzenoszalnego urlopu rodzicielskiego (${formatRate(params.rates.parental)}, do końca roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat).`,
        sources: [
          {
            title: 'Kodeks pracy – urlopy rodzicielskie',
            legalBasis: 'KP art. 182¹a § 4, art. 182³',
          },
        ],
        fromApi: false,
      };
    }
    if (lower.includes('wcześni') || lower.includes('szpital') || lower.includes('uzupełnia')) {
      return {
        answer: `Rodzicom wcześniaków i dzieci hospitalizowanych po porodzie przysługuje uzupełniający urlop macierzyński (${formatRate(params.rates.supplementaryMaternity)} podstawy wymiaru): 1 tydzień za każdy tydzień pobytu dziecka w szpitalu — do 15 tygodni (urodzenie przed 28. tyg. lub masa ≤ 1000 g) albo do 8 tygodni (od 28. do 37. tyg. z masą > 1000 g lub po 37. tyg. przy hospitalizacji min. 2 kolejne dni między 5. a 28. dniem).`,
        sources: [{ title: 'Poradnik dla rodziców ZUS 2026', legalBasis: 'KP art. 180²' }],
        fromApi: false,
      };
    }
    return {
      answer: `W celu uzyskania zasiłku macierzyńskiego złóż wniosek ZUS ZAM (od 24.10.2026 zastępuje dawne ZUR i ZAO) wraz ze skróconym odpisem aktu urodzenia. Jeśli pracodawca zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, zasiłek wypłaca pracodawca; w pozostałych przypadkach – ZUS. Możesz też zapytać o stawkę 81,5%, JDG, urlop ojcowski lub urlop uzupełniający.`,
      sources: [
        {
          title: 'Poradnik dla rodziców ZUS 2026',
          legalBasis: 'Ustawa zasiłkowa art. 29–31, art. 61',
        },
      ],
      fromApi: false,
    };
  }
}
