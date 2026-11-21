import type { ApiErrorCode, ApiResponse } from '@shared/types';

/** Jedyne miejsce, z którego frontend woła API (CONVENTIONS §6). */
export const API_BASE_URL = '/api/v1';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value && 'error' in value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch (cause) {
    throw new ApiError('INTERNAL_ERROR', 'Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.', cause);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isEnvelope(body)) {
    throw new ApiError('INTERNAL_ERROR', 'Serwer zwrócił nieprawidłową odpowiedź. Spróbuj ponownie.');
  }
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, body.error.details);
  }
  if (!response.ok) {
    throw new ApiError('INTERNAL_ERROR', 'Serwer nie przetworzył danych. Spróbuj ponownie.');
  }
  return body.data as T;
}

export function apiGet<T>(path: string, headers?: HeadersInit): Promise<T> {
  return request<T>(path, headers ? { method: 'GET', headers } : { method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
