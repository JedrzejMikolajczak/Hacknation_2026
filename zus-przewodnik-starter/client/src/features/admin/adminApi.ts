import type { BenefitParams } from '@shared/types';
import defaultParamsJson from '@shared/params.json';
import { ApiError, apiGet, apiPut } from '../../api/client';

export const DEFAULT_BENEFIT_PARAMS: BenefitParams = defaultParamsJson as BenefitParams;

export interface ApiResultWithFallback<T> {
  data: T;
  isDemoFallback: boolean;
}

let sessionStoredParams: BenefitParams | null = null;

export function cloneBenefitParams(params: BenefitParams): BenefitParams {
  return JSON.parse(JSON.stringify(params)) as BenefitParams;
}

function isFallbackableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'NOT_FOUND' || error.code === 'INTERNAL_ERROR';
  }
  return true;
}

export async function fetchAdminParams(): Promise<ApiResultWithFallback<BenefitParams>> {
  try {
    const data = await apiGet<BenefitParams>('/params');
    return {
      data: cloneBenefitParams(sessionStoredParams ?? data),
      isDemoFallback: sessionStoredParams !== null,
    };
  } catch (error) {
    if (isFallbackableError(error)) {
      return {
        data: cloneBenefitParams(sessionStoredParams ?? DEFAULT_BENEFIT_PARAMS),
        isDemoFallback: true,
      };
    }
    throw error;
  }
}

export async function saveAdminParams(
  params: BenefitParams,
  adminToken: string,
): Promise<ApiResultWithFallback<BenefitParams>> {
  try {
    const data = await apiPut<BenefitParams>('/admin/params', params, {
      Authorization: `Bearer ${adminToken}`,
    });
    sessionStoredParams = null;
    return { data: cloneBenefitParams(data), isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      sessionStoredParams = cloneBenefitParams(params);
      return { data: cloneBenefitParams(params), isDemoFallback: true };
    }
    throw error;
  }
}

export function resetSessionAdminParams(): void {
  sessionStoredParams = null;
}
