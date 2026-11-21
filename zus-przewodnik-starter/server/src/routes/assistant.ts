import { Router } from 'express';
import { z } from 'zod';
import params from '@shared/params.json';
import { buildDemoAssistantAnswer } from '@shared/engine/assistantAnswers';
import { ok } from '../lib/envelope';

export const assistantRouter = Router();

assistantRouter.post('/assistant/ask', (req, res, next) => {
  try {
    const { question } = z.strictObject({ question: z.string().trim().min(1).max(1000) }).parse(req.body);
    res.json(ok({ ...buildDemoAssistantAnswer(question, params), is_demo_fallback: true }));
  } catch (error) {
    next(error);
  }
});
