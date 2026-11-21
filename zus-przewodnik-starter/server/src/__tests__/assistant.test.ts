import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { GeminiAssistantProvider } from '../adapters/GeminiAssistantProvider';
import { errorHandler } from '../middleware/errorHandler';
import { createAssistantRouter } from '../routes/assistant';

function createTestApp(provider: GeminiAssistantProvider) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createAssistantRouter(provider));
  app.use(errorHandler);
  return app;
}

describe('Asystent AI (/api/v1/assistant/*)', () => {
  it('wywołuje Gemini API z kluczem w nagłówku x-goog-api-key, przekazuje kontekst i zwraca is_demo_fallback: false', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      answer: 'Przy JDG dług 500 zł przekracza 1% minimalnego wynagrodzenia i wstrzymuje wypłatę do czasu spłaty.',
                      sources: ['Ustawa zasiłkowa art. 2a', 'Poradnik dla rodziców ZUS 2026'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = new GeminiAssistantProvider({
      apiKey: 'test-gemini-key',
      model: 'gemini-flash-latest',
      fetchImpl: fetchMock,
    });
    const app = createTestApp(provider);

    const status = await request(app).get('/api/v1/assistant/status').expect(200);
    expect(status.body).toEqual({
      data: { ai_enabled: true, provider: 'gemini' },
      error: null,
    });

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .send({
        question: 'Czy mój dług w ZUS blokuje zasiłek?',
        context: {
          stage: 'POST_BIRTH',
          employment_type: 'B2B',
          has_b2b_arrears: true,
          debt_amount_pln: 500,
          warning_codes: ['SELF_EMPLOYED_DEBT'],
        },
        history: [{ role: 'user', text: 'Prowadzę działalność gospodarczą.' }],
      })
      .expect(200);

    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({
      answer:
        'Przy JDG dług 500 zł przekracza 1% minimalnego wynagrodzenia i wstrzymuje wypłatę do czasu spłaty.',
      sources: ['Ustawa zasiłkowa art. 2a', 'Poradnik dla rodziców ZUS 2026'],
      is_demo_fallback: false,
      model: 'gemini-flash-latest',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    );
    expect(calledInit.headers).toMatchObject({ 'x-goog-api-key': 'test-gemini-key' });
    const sentBody = JSON.parse(String(calledInit.body));
    expect(sentBody.systemInstruction.parts[0].text).toContain('SELF_EMPLOYED_DEBT');
    expect(sentBody.contents).toHaveLength(2);
  });

  it('przechodzi bezpiecznie na tryb awaryjny (is_demo_fallback: true), gdy brak klucza lub API Gemini zwróci błąd', async () => {
    const noKeyApp = createTestApp(new GeminiAssistantProvider({ apiKey: '' }));
    const noKeyStatus = await request(noKeyApp).get('/api/v1/assistant/status').expect(200);
    expect(noKeyStatus.body.data).toEqual({ ai_enabled: false, provider: 'demo' });

    const noKeyRes = await request(noKeyApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Co jeśli spóźnię się z wnioskiem o 81,5%?' })
      .expect(200);
    expect(noKeyRes.body.data.is_demo_fallback).toBe(true);
    expect(noKeyRes.body.data.answer).toContain('21 dni');

    const failingFetch = vi.fn(async () => new Response('upstream error', { status: 503 }));
    const failApp = createTestApp(
      new GeminiAssistantProvider({ apiKey: 'test-key', fetchImpl: failingFetch }),
    );
    const failRes = await request(failApp)
      .post('/api/v1/assistant/ask')
      .send({ question: 'Co z długiem w JDG?' })
      .expect(200);
    expect(failRes.body.data.is_demo_fallback).toBe(true);
    expect(failRes.body.data.answer).toContain('1% płacy minimalnej');
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
