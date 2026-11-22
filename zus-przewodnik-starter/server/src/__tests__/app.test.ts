import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CaseDocument, CaseInputs, CasePlan } from '@shared/types';
import fixture from '../../../data/cases/case-04.json';
import { createApp } from '../app';

const app = createApp();
const api = '/api/v1';
const input = fixture.inputs as CaseInputs;

describe('API v1', () => {
  it('udostępnia health, parametry i CORS', async () => {
    const health = await request(app)
      .get(`${api}/health`)
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(health.body).toEqual({ data: { status: 'ok' }, error: null });
    expect(health.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const params = await request(app).get(`${api}/params`).expect(200);
    expect(params.body.data.supplementaryMaternityLeave.transitionalEffectiveDate).toBe(
      '2025-03-19',
    );
  });
  it('nie ujawnia nagłówka X-Powered-By', async () => {
    const health = await request(app).get(`${api}/health`).expect(200);
    expect(health.headers['x-powered-by']).toBeUndefined();
  });
  it('zbyt duże ciało żądania zwraca 413 w kopercie zamiast 500', async () => {
    const { body } = await request(app)
      .post(`${api}/plan`)
      .send({ padding: 'a'.repeat(2 * 1024 * 1024) })
      .expect(413);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
  it('zwraca jeden wynik planu i zgodne projekcje', async () => {
    const { body } = await request(app).post(`${api}/plan`).send(input).expect(200);
    const plan: CasePlan = body.data;
    expect(plan.outcome.granted_duration_days).toBe(679);
    expect(plan.outcome.granted_rate_percent).toBe(81.5);
    const rights = await request(app).post(`${api}/eligibility`).send(input).expect(200);
    const docs = await request(app).post(`${api}/documents`).send(input).expect(200);
    const calculator = await request(app)
      .post(`${api}/calculate/maternity`)
      .send(input)
      .expect(200);
    const base = await request(app).post(`${api}/calculate/benefit-base`).send(input).expect(200);
    const sick = await request(app).post(`${api}/calculate/sickness`).send(input).expect(200);
    expect(sick.body.data.periods).toEqual([]);
    expect(rights.body.data.entitlements).toEqual(plan.entitlements);
    expect(docs.body.data).toEqual(plan.documents);
    expect(calculator.body.data).toEqual(plan.outcome);
    expect(base.body.data).toEqual({ benefit_base_pln: null });
  });
  it('zmienia termin ojca po zmianie rzeczywistego planu', async () => {
    const next = {
      ...input,
      other_parent: {
        employment_type: 'UOP',
        payer_insured_count_nov_30: '> 20',
        benefit_base_amount_pln: null,
        voluntary_sickness_insured: false,
      },
      parental_leave_parts: [
        {
          parent_role: 'FATHER',
          start_date: '2027-11-09',
          end_date: '2028-01-10',
        },
      ],
    };
    const { body } = await request(app).post(`${api}/documents`).send(next).expect(200);
    const documents: CaseDocument[] = body.data;
    expect(
      documents.find((doc) => doc.id === 'PARENTAL_REQUEST' && doc.parent_role === 'FATHER'),
    ).toMatchObject({
      deadline: '2027-10-19',
      submit_to: 'EMPLOYER',
    });
  });
  it('odrzuca stary kontrakt, złą datę, dodatkowe pola i niepoprawny JSON', async () => {
    for (const data of [
      { situation: 'afterBirth' },
      { ...input, due_or_birth_date: '2026-02-30' },
      { ...input, pesel: '00000000000' },
    ]) {
      const { body } = await request(app).post(`${api}/plan`).send(data).expect(422);
      expect(body).toMatchObject({ data: null, error: { code: 'VALIDATION_ERROR' } });
    }
    await request(app)
      .post(`${api}/plan`)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(422);
    await request(app).get(`${api}/missing`).expect(404);
  });

  it('wyjaśnia po polsku, jak poprawić odwrócone daty zwolnienia', async () => {
    const { body } = await request(app).post(`${api}/plan`).send({
      ...input,
      sickness_leave_start_date: '2026-11-10',
      sickness_leave_end_date: '2026-11-09',
    }).expect(422);
    expect(body.error.message).toMatch(/Koniec zwolnienia lekarskiego.*Ustaw koniec zwolnienia/);
    expect(body.error.message).not.toContain('sickness_leave_end_date');
    expect(body.error.details[0].path).toEqual(['sickness_leave_end_date']);
  });
});
