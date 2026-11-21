import { Router } from 'express';
import type { BenefitParams } from '@shared/types';
import paramsJson from '@shared/params.json';
import { ok } from '../lib/envelope';

const params: BenefitParams = paramsJson;

export const paramsRouter = Router();

paramsRouter.get('/params', (_req, res) => {
  res.json(ok(params));
});
