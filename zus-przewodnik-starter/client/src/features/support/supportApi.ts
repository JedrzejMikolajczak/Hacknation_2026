import type { BenefitParams, EligibilityResult, ScenarioInput, Warning } from '@shared/types';
import { checkEligibility, type EligibilityInput } from '@shared/engine';
import { ApiError, apiPost } from '../../api/client';

export interface SupportWarningsOptions {
  hasMotherInPlan: boolean;
  sicknessStartDate?: string;
}

function filterWarningsForPlan(warnings: Warning[], hasMotherInPlan: boolean): Warning[] {
  if (hasMotherInPlan) return warnings;
  return warnings.filter((warning) => warning.code !== 'NO_INSURANCE_ON_BIRTH_DATE');
}

function buildEligibilityPayload(
  scenario: ScenarioInput,
  sicknessStartDate?: string,
): EligibilityInput {
  return sicknessStartDate ? { ...scenario, sicknessStartDate } : scenario;
}

/**
 * Wylicza ostrzeżenia bezpośrednio silnikiem `@shared/engine` (bez zmyślonych reguł).
 * Gdy brakuje daty zdarzenia, zwraca pustą listę zamiast rzucać wyjątek.
 */
export function computeScenarioWarningsLocally(
  scenario: ScenarioInput,
  params: BenefitParams,
  options: SupportWarningsOptions,
): Warning[] {
  try {
    const result = checkEligibility(
      buildEligibilityPayload(scenario, options.sicknessStartDate),
      params,
    );
    return filterWarningsForPlan(result.warnings, options.hasMotherInPlan);
  } catch {
    return [];
  }
}

/**
 * Pobiera ostrzeżenia z `POST /api/v1/eligibility` z bezpiecznym fallbackiem na `@shared/engine`.
 */
export async function fetchScenarioWarnings(
  scenario: ScenarioInput,
  params: BenefitParams,
  options: SupportWarningsOptions,
): Promise<Warning[]> {
  const payload = buildEligibilityPayload(scenario, options.sicknessStartDate);
  try {
    const result = await apiPost<EligibilityResult>('/eligibility', payload);
    return filterWarningsForPlan(result.warnings, options.hasMotherInPlan);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
      return [];
    }
    return computeScenarioWarningsLocally(scenario, params, options);
  }
}
