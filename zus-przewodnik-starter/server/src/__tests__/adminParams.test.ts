import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import paramsJson from '@shared/params.json';
import { createApp } from '../app';
import { isUsableAdminToken } from '../routes/params';

const STRONG_TOKEN = 'a'.repeat(16) + 'B'.repeat(16) + '1234';
const originalToken = process.env.ADMIN_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = originalToken;
});

describe('admin token', () => {
  it('rejects empty, short and placeholder tokens', () => {
    expect(isUsableAdminToken(undefined)).toBe(false);
    expect(isUsableAdminToken('')).toBe(false);
    expect(isUsableAdminToken('short-token')).toBe(false);
    expect(isUsableAdminToken('change-me')).toBe(false);
    expect(isUsableAdminToken(STRONG_TOKEN)).toBe(true);
  });

  it('refuses PUT /admin/params when the server token is the placeholder, even with that token', async () => {
    process.env.ADMIN_TOKEN = 'change-me';
    const res = await request(createApp())
      .put('/api/v1/admin/params')
      .set('Authorization', 'Bearer change-me')
      .send(paramsJson);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts a strong server token sent in the Authorization header', async () => {
    process.env.ADMIN_TOKEN = STRONG_TOKEN;
    const res = await request(createApp())
      .put('/api/v1/admin/params')
      .set('Authorization', `Bearer ${STRONG_TOKEN}`)
      .send(paramsJson);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
  });

  it('rejects a wrong token when the server token is strong', async () => {
    process.env.ADMIN_TOKEN = STRONG_TOKEN;
    const res = await request(createApp())
      .put('/api/v1/admin/params')
      .set('Authorization', 'Bearer change-me')
      .send(paramsJson);
    expect(res.status).toBe(401);
  });
});
