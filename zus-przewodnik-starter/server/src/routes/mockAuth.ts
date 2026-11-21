import { Router } from 'express';
import { z } from 'zod';
import { UnknownProfileError, type AuthProvider } from '../adapters/AuthProvider';
import { fail, ok } from '../lib/envelope';

const loginInput = z.object({ profile_id: z.string().trim().min(1) });

export function createMockAuthRouter(auth: AuthProvider) {
  const router = Router();

  router.get('/mock/profiles', async (_req, res, next) => {
    try {
      res.json(ok(await auth.listProfiles()));
    } catch (error) {
      next(error);
    }
  });

  router.post('/mock/login', async (req, res, next) => {
    try {
      const { profile_id } = loginInput.parse(req.body);
      res.set('Cache-Control', 'no-store').json(ok(await auth.login(profile_id)));
    } catch (error) {
      if (error instanceof UnknownProfileError) {
        res.status(404).json(fail('NOT_FOUND', error.message));
      } else {
        next(error);
      }
    }
  });

  return router;
}
