import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import employed from '../../../data/cases/etat-po-porodzie.json';

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

  it('przelicza wgraną sprawę JSON bez expectedDays i z null w kwocie oczekiwanej', async () => {
    const uploaded = {
      ...employed,
      caseId: 'wgrana-sprawa',
      expectedDays: undefined,
      zusDecision: {
        ...employed.zusDecision,
        amount: null,
      },
    };
    const response = await app.post('/api/v1/cases/evaluate').send(uploaded).expect(200);
    expect(response.body.data).toMatchObject({
      caseId: 'wgrana-sprawa',
      matchesZusDecision: true,
      differences: [],
      calculation: { totalAmount: 85368.36 },
    });
    expect(response.body.data.benefitBase?.benefitBase ?? null).toBe(8629);
  });

  it('zwraca 422 VALIDATION_ERROR dla niepoprawnej wgranej sprawy JSON', async () => {
    const response = await app
      .post('/api/v1/cases/evaluate')
      .send({ caseId: '', title: 'Brak scenariusza' })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('zwraca 404 dla nieznanej sprawy', async () => {
    const response = await app.post('/api/v1/cases/nie-istnieje/evaluate').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
