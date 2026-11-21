import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from '../client';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('unwraps data from the envelope and prefixes /api/v1', async () => {
    const fetchMock = mockFetch(200, { data: { status: 'ok' }, error: null });
    await expect(apiGet<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', expect.anything());
  });

  it('throws ApiError with code and message from the envelope', async () => {
    mockFetch(422, {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'birthDate is required' },
    });
    const error = await apiPost('/eligibility', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'birthDate is required' });
  });
});
