import { Router } from 'express';
import { z } from 'zod';
import { buildDemoAssistantAnswer } from '@shared/engine/assistantAnswers';
import {
  GeminiAssistantProvider,
  type AssistantProvider,
} from '../adapters/GeminiAssistantProvider';
import { ok } from '../lib/envelope';
import { getParams } from './params';

const assistantContextSchema = z
  .strictObject({
    stage: z.string().trim().max(40).optional(),
    employment_type: z.string().trim().max(40).optional(),
    applicant_role: z.string().trim().max(20).optional(),
    co_parenting: z.boolean().optional(),
    children_count: z.number().int().min(1).max(10).optional(),
    who_pays: z.string().trim().max(40).nullable().optional(),
    applied_payment_variant: z.string().trim().max(40).optional(),
    is_qualified: z.boolean().optional(),
    has_b2b_arrears: z.boolean().nullable().optional(),
    debt_amount_pln: z.number().nonnegative().nullable().optional(),
    warning_codes: z.array(z.string().trim().max(64)).max(12).optional(),
    difficult_case: z.boolean().optional(),
  })
  .optional();

const assistantHistorySchema = z
  .array(
    z.strictObject({
      role: z.enum(['user', 'assistant']),
      text: z.string().trim().min(1).max(2000),
    }),
  )
  .max(8)
  .optional();

const assistantAskSchema = z.strictObject({
  question: z.string().trim().min(1).max(1000),
  context: assistantContextSchema,
  history: assistantHistorySchema,
});

export interface AssistantRouterOptions {
  maxRequestsPerWindow?: number;
  windowMs?: number;
}

const DEFAULT_MAX_REQUESTS_PER_WINDOW = 20;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

export function createAssistantRouter(
  provider: AssistantProvider = new GeminiAssistantProvider(),
  options: AssistantRouterOptions = {},
): Router {
  const router = Router();
  const maxRequests = options.maxRequestsPerWindow ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const rateBuckets = new Map<string, number[]>();

  function isRateLimited(clientKey: string): boolean {
    const now = Date.now();
    const recent = (rateBuckets.get(clientKey) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      rateBuckets.set(clientKey, recent);
      return true;
    }
    recent.push(now);
    rateBuckets.set(clientKey, recent);
    if (rateBuckets.size > 1_000) {
      const oldest = rateBuckets.keys().next();
      if (!oldest.done) rateBuckets.delete(oldest.value);
    }
    return false;
  }

  router.get('/assistant/status', (_req, res) => {
    const aiEnabled = provider.isConfigured();
    res.json(
      ok({
        ai_enabled: aiEnabled,
        provider: aiEnabled ? 'gemini' : 'demo',
      }),
    );
  });

  router.post('/assistant/ask', async (req, res, next) => {
    try {
      const parsed = assistantAskSchema.parse(req.body);
      const clientKey = req.ip || 'unknown';
      if (isRateLimited(clientKey)) {
        res.json(
          ok({
            ...buildDemoAssistantAnswer(parsed.question, getParams()),
            is_demo_fallback: true,
          }),
        );
        return;
      }
      const reply = await provider.ask(parsed, getParams());
      res.json(ok(reply));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const assistantRouter = createAssistantRouter();
