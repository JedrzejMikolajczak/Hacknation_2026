import type { BenefitParams, EligibilityResult, ScenarioInput } from '@shared/types';
import { ApiError, apiGet, apiPost } from '../../api/client';
import {
  type AssistantAnswer,
  buildDemoAssistantAnswer,
  buildDemoEligibility,
  DEFAULT_BENEFIT_PARAMS,
} from './supportMock';

export interface ApiResultWithFallback<T> {
  data: T;
  isDemoFallback: boolean;
}

function isFallbackableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'NOT_FOUND' || error.code === 'INTERNAL_ERROR';
  }
  return true;
}

export async function fetchSupportParams(): Promise<ApiResultWithFallback<BenefitParams>> {
  try {
    const data = await apiGet<BenefitParams>('/params');
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: DEFAULT_BENEFIT_PARAMS, isDemoFallback: true };
    }
    throw error;
  }
}

export async function fetchScenarioWarnings(
  scenario: ScenarioInput,
  params: BenefitParams,
): Promise<ApiResultWithFallback<EligibilityResult>> {
  try {
    const data = await apiPost<EligibilityResult>('/eligibility', scenario);
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: buildDemoEligibility(scenario, params), isDemoFallback: true };
    }
    throw error;
  }
}

export async function askSupportAssistant(
  question: string,
  params: BenefitParams,
): Promise<ApiResultWithFallback<AssistantAnswer>> {
  try {
    const data = await apiPost<AssistantAnswer>('/assistant/ask', { question });
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: buildDemoAssistantAnswer(question, params), isDemoFallback: true };
    }
    throw error;
  }
}
