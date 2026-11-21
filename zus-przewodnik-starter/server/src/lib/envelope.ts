import type { ApiErrorCode, ApiResponse } from '@shared/types';

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function fail(code: ApiErrorCode, message: string, details?: unknown): ApiResponse<never> {
  return {
    data: null,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
