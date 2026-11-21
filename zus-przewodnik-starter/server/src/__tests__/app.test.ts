import request from 'supertest';
import { describe, expect, it } from 'vitest';
import paramsJson from '@shared/params.json';
import { createApp } from '../app';

const app = createApp();

describe('API v1', () => {
  it('GET /api/v1/health returns ok in the envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null });
  });

  it('GET /api/v1/params returns params.json in the envelope', async () => {
    const res = await request(app).get('/api/v1/params');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual(paramsJson);
    expect(res.body.data.version).toBe(paramsJson.version);
  });

  it('unknown route returns 404 NOT_FOUND in the envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON body returns 422 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ data: null, error: { code: 'VALIDATION_ERROR' } });
  });

  it('allows CORS for the local client', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
