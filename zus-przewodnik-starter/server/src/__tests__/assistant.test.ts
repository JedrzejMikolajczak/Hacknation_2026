import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  GeminiAssistantProvider,
  redactSensitiveInput,
} from '../adapters/GeminiAssistantProvider';
import { errorHandler } from '../middleware/errorHandler';
import { createAssistantRouter, type AssistantRouterOptions } from '../routes/assistant';

function createTestApp(
  provider: GeminiAssistantProvider,
  options?: AssistantRouterOptions,
) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createAssistantRouter(provider, options));
  app.use(errorHandler);
  return app;
}

function geminiOkResponse(answer: string, sources: string[]) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ answer, sources }) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('Asystent AI (/api/v1/assistant/*)', () => {
  it('wywołuje Gemini API z kluczem w nagłówku x-goog-api-key, maskuje PII, przekazuje kontekst i cachuje powtarzalne pytania', async () => {
    expect(redactSensitiveInput('Mój PESEL 92031400006 i konto 12345678901234567890123456')).toBe(
      'Mój PESEL [PESEL_UKRYTY] i konto [NUMER_KONTA_UKRYTY]',
    );

    const fetchMock = vi.fn(async () =>
      geminiOkResponse(
        'Przy JDG dług 500 zł przekracza 1% minimalnego wynagrodzenia i wstrzymuje wypłatę do czasu spłaty.',
        ['ZASILKOWA_2A', 'ZUS_PORADNIK_2026'],
      ),
    );

    const provider = new GeminiAssistantProvider({
      apiKey: 'test-gemini-key',
      model: 'gemini-3.1-flash-lite',
      fetchImpl: fetchMock,
    });
    const app = createTestApp(provider);

    const status = await request(app).get('/api/v1/assistant/status').expect(200);
    expect(status.body).toEqual({
      data: { ai_enabled: true, provider: 'gemini' },
      error: null,
    });

    const payload = {
      question: 'Mój PESEL 92031400006 – czy mój dług w ZUS blokuje zasiłek?',
      context: {
        stage: 'POST_BIRTH',
        employment_type: 'B2B',
        has_b2b_arrears: true,
        debt_amount_pln: 500,
        warning_codes: ['SELF_EMPLOYED_DEBT'],
      },
    };

    const res = await request(app).post('/api/v1/assistant/ask').send(payload).expect(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({
      answer:
        'Przy JDG dług 500 zł przekracza 1% minimalnego wynagrodzenia i wstrzymuje wypłatę do czasu spłaty.',
      sources: ['Ustawa zasiłkowa art. 2a', 'Poradnik dla rodziców ZUS 2026'],
      is_demo_fallback: false,
      model: 'gemini-3.1-flash-lite',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    );
    expect(calledInit.headers).toMatchObject({ 'x-goog-api-key': 'test-gemini-key' });
    const sentBody = JSON.parse(String(calledInit.body));
    expect(sentBody.systemInstruction.parts[0].text).not.toContain('SELF_EMPLOYED_DEBT');
    expect(sentBody.contents[0].parts[1].text).toContain('SELF_EMPLOYED_DEBT');
    expect(sentBody.contents[0].parts[1].text).not.toContain('debt_amount_pln');
    expect(sentBody.contents[0].parts[0].text).not.toContain('92031400006');
    expect(sentBody.contents[0].parts[0].text).toContain('[PESEL_UKRYTY]');

    // Drugie identyczne pytanie bez historii trafia w cache (0 dodatkowych wywołań Gemini API)
    const cached = await request(app).post('/api/v1/assistant/ask').send(payload).expect(200);
    expect(cached.body.data.is_demo_fallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('przełącza się na model zapasowy przy 503/429, a gdy oba zawiodą lub przekroczono limit zapytań – zwraca tryb awaryjny', async () => {
    // 1) Główny model 503 → automatyczny fallback na model zapasowy (200)
    const fallbackFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        geminiOkResponse('Odpowiedź z modelu zapasowego.', ['KP_180']),
      );
    const fallbackApp = createTestApp(
      new GeminiAssistantProvider({
        apiKey: 'test-key',
        model: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-flash-latest',
        fetchImpl: fallbackFetch,
      }),
    );
    const recovered = await request(fallbackApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Ile trwa urlop macierzyński?' })
      .expect(200);
    expect(recovered.body.data).toMatchObject({
      answer: 'Odpowiedź z modelu zapasowego.',
      is_demo_fallback: false,
      model: 'gemini-flash-latest',
    });
    expect(fallbackFetch).toHaveBeenCalledTimes(2);

    // 2) Brak klucza → lokalna baza ZUS
    const noKeyApp = createTestApp(new GeminiAssistantProvider({ apiKey: '' }));
    const noKeyRes = await request(noKeyApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Co jeśli spóźnię się z wnioskiem o 81,5%?' })
      .expect(200);
    expect(noKeyRes.body.data.is_demo_fallback).toBe(true);
    expect(noKeyRes.body.data.answer).toContain('21 dni');

    // 3) Rate limit chroni pulę tokenów i zwraca odpowiedź z lokalnej bazy
    const limitedFetch = vi.fn(async () =>
      geminiOkResponse('Odpowiedź AI.', ['ZUS_PORADNIK_2026']),
    );
    const limitedApp = createTestApp(
      new GeminiAssistantProvider({ apiKey: 'test-key', fetchImpl: limitedFetch }),
      { maxRequestsPerWindow: 1, windowMs: 60_000 },
    );
    const first = await request(limitedApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Pytanie 1 o 81,5%' })
      .expect(200);
    expect(first.body.data.is_demo_fallback).toBe(false);
    const second = await request(limitedApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Pytanie 2 o 81,5%' })
      .expect(200);
    expect(second.body.data.is_demo_fallback).toBe(true);
    expect(limitedFetch).toHaveBeenCalledTimes(1);
  });

  it('zwraca 422 VALIDATION_ERROR dla pustego pytania lub nieznanych pól', async () => {
    const app = createTestApp(new GeminiAssistantProvider({ apiKey: '' }));

    const empty = await request(app).post('/api/v1/assistant/ask').send({ question: '   ' }).expect(422);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const extra = await request(app)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Pytanie', pesel: '92031400006' })
      .expect(422);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');
  });
});
