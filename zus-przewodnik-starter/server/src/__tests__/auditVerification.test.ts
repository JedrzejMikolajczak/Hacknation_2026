import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import params from '@shared/params.json';
import { birthInput } from '@shared/engine/__tests__/auditFixtures';
import type { CasePlan } from '@shared/types';
import { createApp } from '../app';
import { GeminiAssistantProvider } from '../adapters/GeminiAssistantProvider';

const api = '/api/v1';
const app = createApp();

describe('Kontrakt API w audycie', () => {
  it.each([
    ['pusty formularz', {}],
    ['nieistniejąca data', { ...birthInput(), due_or_birth_date: '2025-02-29' }],
    ['ujemna podstawa', { ...birthInput(), benefit_base_amount_pln: -1 }],
    ['kwota jako tekst', { ...birthInput(), benefit_base_amount_pln: '6000' }],
    ['pole spoza kontraktu', { ...birthInput(), unexpected: true }],
    [
      'odwrócone daty e-ZLA',
      {
        ...birthInput(),
        sickness_leave_start_date: '2026-04-30',
        sickness_leave_end_date: '2026-04-29',
      },
    ],
    [
      'powtórzony miesiąc',
      {
        ...birthInput(),
        monthly_bases: [
          { month: '2026-04', amount_pln: 6000 },
          { month: '2026-04', amount_pln: 8000 },
        ],
      },
    ],
    [
      'premia ponad przychód',
      {
        ...birthInput(),
        monthly_bases: [{ month: '2026-04', amount_pln: 1000, excluded_bonus_pln: 1100 }],
      },
    ],
    [
      'sprzeczny rozkład liczby dzieci',
      {
        ...birthInput(),
        children_count: 2,
        living_children_count: 2,
        deceased_children_count: 1,
      },
    ],
  ])('API-01 odrzuca: %s', async (_label, payload) => {
    const response = await request(app)
      .post(api + '/plan')
      .send(payload)
      .expect(422);
    expect(response.body).toMatchObject({ data: null, error: { code: 'VALIDATION_ERROR' } });
  });

  it('API-02 odrzuca niepoprawną składnię JSON i nieznane ID', async () => {
    const invalid = await request(app)
      .post(api + '/plan')
      .type('json')
      .send('{"stage":')
      .expect(422);
    const missing = await request(app)
      .get(api + '/cases/no-such-case')
      .expect(404);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('API-03 zgodność projekcji i terminu z weryfikowanym przykładem', async () => {
    const data = birthInput({
      parental_leave_parts: [{ start_date: '2026-11-18', end_date: '2026-11-24' }],
    });
    const [planResult, base, maternity, eligibility, sickness, documents, split, work] =
      await Promise.all(
        [
          '/plan',
          '/calculate/benefit-base',
          '/calculate/maternity',
          '/eligibility',
          '/calculate/sickness',
          '/documents',
          '/plan/parental-split',
          '/plan/parental-with-work',
        ].map((route) =>
          request(app)
            .post(api + route)
            .send(data)
            .expect(200),
        ),
      );
    const plan: CasePlan = planResult.body.data;
    expect(plan.outcome.calculated_amount_pln).toBe(28980);
    expect(plan.documents.find((doc) => doc.id === 'PARENTAL_REQUEST')).toMatchObject({
      deadline: '2026-10-28',
      start_date: '2026-11-18',
      end_date: '2026-11-24',
    });
    expect(base.body.data).toEqual({ benefit_base_pln: 6000 });
    expect(maternity.body.data).toEqual(plan.outcome);
    expect(eligibility.body.data).toEqual({
      entitlements: plan.entitlements,
      warnings: plan.outcome.warnings,
    });
    expect(sickness.body.data).toMatchObject({ periods: [], employer_sick_pay: [] });
    expect(documents.body.data).toEqual(plan.documents);
    expect(split.body.data).toEqual(plan);
    expect(work.body.data).toEqual(plan);
  });

  it('API-04 identyczne żądania i równoległe żądanie z innego roku', async () => {
    const body = birthInput();
    const leap = birthInput({ due_or_birth_date: '2024-02-29' });
    const [one, two, other] = await Promise.all(
      [body, body, leap].map((data) =>
        request(app)
          .post(api + '/plan')
          .send(data)
          .expect(200),
      ),
    );
    expect(one.body).toEqual(two.body);
    expect(one.body.data.outcome.periods[0]).toMatchObject({
      start_date: '2026-07-01',
      end_date: '2026-11-17',
    });
    expect(other.body.data.outcome.periods[0]).toMatchObject({
      start_date: '2024-02-29',
      end_date: '2024-07-17',
    });
  });

  it('API-05 profil publiczny zawiera etykietę, a pobranie mock danych wymaga sesji', async () => {
    const profiles = await request(app)
      .get(api + '/mock/profiles')
      .expect(200);
    expect(profiles.body.data).toHaveLength(2);
    expect(
      profiles.body.data.every(
        (row: Record<string, unknown>) => Object.keys(row).sort().join() === 'label,profileId',
      ),
    ).toBe(true);
    await request(app)
      .get(api + '/mock/zus-data')
      .expect(401);
  });

  it(
    'AUD-16 API odrzuca kwotę poza zakresem zamiast oddać zatwierdzony plan z kwotami null',
    async () => {
      const result = await request(app)
        .post(api + '/plan')
        .send(birthInput({ benefit_base_amount_pln: 1e308 }));
      expect(result.status).toBe(422);
    },
  );

  it(
    'AUD-17 API odrzuca zero żywych dzieci bez oznaczonej utraty przy porodzie',
    async () => {
      const result = await request(app)
        .post(api + '/plan')
        .send(birthInput({ living_children_count: 0 }));
      expect(result.status).toBe(422);
    },
  );

  it('AUD-18 panel admina nie pozwala zapisać ułamkowej długości tygodnia', async () => {
    const token = 'synthetic-audit-token-only-for-this-test';
    vi.stubEnv('ADMIN_TOKEN', token);
    const path = api + '/admin/params';
    try {
      const result = await request(app)
        .put(path)
        .set('Authorization', 'Bearer ' + token)
        .send({ ...params, calendar: { ...params.calendar, daysPerWeek: 6.5 } });
      expect(result.status).toBe(422);
    } finally {
      await request(app)
        .put(path)
        .set('Authorization', 'Bearer ' + token)
        .send(params)
        .expect(200);
      vi.unstubAllEnvs();
    }
  });
});

function modelResponse(text: string) {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

const assistant = (fetchImpl: typeof fetch) =>
  new GeminiAssistantProvider({ apiKey: 'audit-local-stub-key', fetchImpl, fallbackModel: null });

describe('Granica wiarygodności asystenta, adapter z zastępczą odpowiedzią HTTP', () => {
  it('AI-01 ciąg złożony z 11 cyfr w pytaniu i historii jest maskowany', async () => {
    const syntheticId = '12345678901';
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(JSON.stringify({ answer: 'Treść testowa.', sources: ['Źródło testowe'] })),
    );
    const provider = assistant(fetchImpl);
    await provider.ask(
      {
        question: 'Identyfikator testowy ' + syntheticId,
        history: [{ role: 'user', text: 'Historia testowa ' + syntheticId }],
      },
      params,
    );
    const outboundBody = fetchImpl.mock.calls[0][1]?.body;
    expect(outboundBody).toEqual(expect.any(String));
    expect(outboundBody).toContain('[PESEL_UKRYTY]');
    expect(outboundBody).not.toContain(syntheticId);
  });

  it(
    'AUD-19 wadliwy format odpowiedzi modelu nie dostaje domyślnego źródła prawnego',
    async () => {
      const text = 'Niezależna treść testowa, bez podanego źródła.';
      const provider = assistant(vi.fn<typeof fetch>(async () => modelResponse(text)));
      const reply = await provider.ask({ question: 'Kiedy otrzymam świadczenie?' }, params);
      expect(reply.is_demo_fallback || !reply.sources.length).toBe(true);
    },
  );

  it(
    'AUD-20 kontekst nie zleca modelowi przetwarzania dowolnego identyfikatora z pola etapu',
    async () => {
      const syntheticId = '12345678901';
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        modelResponse(JSON.stringify({ answer: 'Treść testowa.', sources: [] })),
      );
      const provider = assistant(fetchImpl);
      await provider.ask({ question: 'Pytanie testowe.', context: { stage: syntheticId } }, params);
      const outboundBody = fetchImpl.mock.calls[0]?.[1]?.body;
      expect(outboundBody ?? '').not.toContain(syntheticId);
    },
  );

  it('AUD-21 cache uwzględnia zmianę rodzicielskiej stawki w parametrach', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(JSON.stringify({ answer: 'Treść testowa.', sources: [] })),
    );
    const provider = assistant(fetchImpl);
    const prompt = { question: 'Jaka stawka obowiązuje na rodzicielskim?' };
    await provider.ask(prompt, params);
    await provider.ask(prompt, { ...params, rates: { ...params.rates, parental: 0.71 } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
