import { Router } from 'express';
import { z } from 'zod';
import { UnknownProfileError, type AuthProvider } from '../adapters/AuthProvider';
import { MockMObywatelProvider } from '../adapters/MockMObywatelProvider';
import { MockZusDataProvider } from '../adapters/MockZusDataProvider';
import type { ZusDataProvider } from '../adapters/ZusDataProvider';
import { fail, ok } from '../lib/envelope';

const loginBodySchema = z
  .object({
    profile_id: z.string().trim().min(1).optional(),
    profileId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.profile_id || body.profileId), {
    message: 'Wybierz profil demonstracyjny.',
  });

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export function createMockRouter(
  authProvider: AuthProvider = new MockMObywatelProvider(),
  zusDataProvider: ZusDataProvider = new MockZusDataProvider(),
): Router {
  const router = Router();

  router.get('/mock/profiles', async (_req, res, next) => {
    try {
      const profiles = await authProvider.listProfiles();
      res.json(ok(profiles));
    } catch (error) {
      next(error);
    }
  });

  router.post('/mock/login', async (req, res, next) => {
    try {
      const parsed = loginBodySchema.parse(req.body);
      const profileId = (parsed.profile_id ?? parsed.profileId)!;
      const session = await authProvider.login(profileId);
      res.set('Cache-Control', 'no-store').json(ok(session));
    } catch (error) {
      if (error instanceof UnknownProfileError) {
        res.status(404).json(fail('NOT_FOUND', error.message));
        return;
      }
      next(error);
    }
  });

  router.get('/mock/zus-data', async (req, res, next) => {
    try {
      const token = extractBearerToken(req.get('Authorization'));
      if (!token) {
        res
          .status(401)
          .json(fail('UNAUTHORIZED', 'Wymagany token sesji (Authorization: Bearer <token>).'));
        return;
      }
      const profile = await authProvider.getProfileBySession(token);
      if (!profile) {
        res
          .status(401)
          .json(fail('UNAUTHORIZED', 'Sesja wygasła lub token logowania jest nieprawidłowy.'));
        return;
      }
      const zusData = await zusDataProvider.getZusData(profile.profileId);
      res.set('Cache-Control', 'no-store').json(ok(zusData));
    } catch (error) {
      if (error instanceof UnknownProfileError) {
        res.status(404).json(fail('NOT_FOUND', error.message));
        return;
      }
      next(error);
    }
  });

  return router;
}

export const mockRouter = createMockRouter();
