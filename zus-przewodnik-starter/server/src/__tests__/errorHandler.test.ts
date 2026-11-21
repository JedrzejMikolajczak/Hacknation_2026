import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../middleware/errorHandler';

function appThrowing(error: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps ZodError to 422 VALIDATION_ERROR with details', async () => {
    const result = z.object({ birthDate: z.string() }).safeParse({});
    const res = await request(appThrowing(result.error)).get('/boom');
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking the message', async () => {
    const res = await request(appThrowing(new Error('secret'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
