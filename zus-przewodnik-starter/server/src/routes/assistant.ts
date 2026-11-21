import { Router } from 'express';
import { z } from 'zod';
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

export function createAssistantRouter(
  provider: AssistantProvider = new GeminiAssistantProvider(),
): Router {
  const router = Router();

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
      const reply = await provider.ask(parsed, getParams());
      res.json(ok(reply));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const assistantRouter = createAssistantRouter();
