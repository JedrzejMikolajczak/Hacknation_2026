import { Router } from 'express';
import { ok } from '../lib/envelope';

/** Endpoint techniczny (monitoring, sprawdzenie proxy). */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json(ok({ status: 'ok' }));
});
