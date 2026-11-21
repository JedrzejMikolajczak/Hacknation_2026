import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('Przykładowe sprawy', () => {
  const app = request(createApp());
  it('zwraca dwa scenariusze i źródło danych w szczegółach', async () => {
    const list = await app.get('/api/v1/cases').expect(200);
    expect(list.body.data.map((item: { caseId: string }) => item.caseId)).toEqual([
      'etat-po-porodzie',
      'brak-ubezpieczenia',
    ]);
    const detail = await app.get('/api/v1/cases/etat-po-porodzie').expect(200);
    expect(detail.body.data).toMatchObject({ source: 'synthetic', expectedDays: 364 });
  });

  it.each([
    { id: 'etat-po-porodzie', expected: 85368.36, base: 8629 },
    { id: 'brak-ubezpieczenia', expected: 0, base: null },
  ])('przelicza $id i porównuje z ręcznie ustalonym wynikiem', async ({ id, expected, base }) => {
    const response = await app.post(`/api/v1/cases/${id}/evaluate`).expect(200);
    expect(response.body.data).toMatchObject({
      matchesZusDecision: true,
      differences: [],
      calculation: { totalAmount: expected },
    });
    expect(response.body.data.benefitBase?.benefitBase ?? null).toBe(base);
  });

  it('zwraca 404 dla nieznanej sprawy', async () => {
    const response = await app.post('/api/v1/cases/nie-istnieje/evaluate').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
