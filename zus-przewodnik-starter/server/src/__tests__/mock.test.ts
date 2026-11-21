import { resolve } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MockMObywatelProvider } from '../adapters/MockMObywatelProvider';
import { MockZusDataProvider } from '../adapters/MockZusDataProvider';
import { ProfileStore } from '../adapters/profileStore';
import { createApp } from '../app';

describe('Symulacja logowania mObywatel i danych z ZUS (/api/v1/mock/*)', () => {
  it('ładuje profile demonstracyjne z katalogu data/profiles', async () => {
    const store = ProfileStore.fromDirectory(resolve(process.cwd(), '../data/profiles'));
    const auth = new MockMObywatelProvider(store);
    const zus = new MockZusDataProvider(store);

    const profiles = await auth.listProfiles();
    expect(profiles.map((item) => item.profileId)).toEqual(
      expect.arrayContaining([
        'anna-uop',
        'katarzyna-jdg-dlug',
        'magdalena-jdg-czysto',
        'maria-zlecenie',
      ]),
    );

    const { sessionToken, profile } = await auth.login('katarzyna-jdg-dlug');
    expect(sessionToken).toEqual(expect.any(String));
    expect(sessionToken.length).toBeGreaterThan(10);
    expect(await auth.getProfileBySession(sessionToken)).toEqual(profile);
    expect(await auth.getProfileBySession('nieprawidlowy-token')).toBeNull();

    const data = await zus.getZusData(profile.profileId);
    expect(data.contributionDebt).toBeGreaterThan(0);
    expect(data.sickLeaveCertificates.some((cert) => cert.pregnancyCode)).toBe(true);
    expect(data.incomes.length).toBe(12);
  });

  it('udostępnia listę profili, loguje przez POST /mock/login i zwraca dane ZUS po Bearer tokenie', async () => {
    const app = createApp();

    const listRes = await request(app).get('/api/v1/mock/profiles');
    expect(listRes.status).toBe(200);
    expect(listRes.body.error).toBeNull();
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(4);

    const loginRes = await request(app)
      .post('/api/v1/mock/login')
      .send({ profileId: 'anna-uop' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.error).toBeNull();
    expect(loginRes.body.data.sessionToken).toEqual(expect.any(String));
    expect(loginRes.body.data.profile).toMatchObject({
      profileId: 'anna-uop',
      firstName: 'Anna',
      lastName: 'Nowak',
      mother: {
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        employerInsuredCount: 150,
      },
    });

    const token = loginRes.body.data.sessionToken as string;
    const zusRes = await request(app)
      .get('/api/v1/mock/zus-data')
      .set('Authorization', `Bearer ${token}`);
    expect(zusRes.status).toBe(200);
    expect(zusRes.body.error).toBeNull();
    expect(zusRes.body.data).toMatchObject({
      profile: { profileId: 'anna-uop' },
      contributionDebt: 0,
    });
    expect(zusRes.body.data.incomes).toHaveLength(12);
    expect(zusRes.body.data.sickLeaveCertificates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'EZLA-2026-09-1042',
          startDate: '2026-09-14',
          pregnancyCode: true,
        }),
      ]),
    );
  });

  it('zwraca 401 bez lub z błędnym tokenem, 404 dla nieznanego profilu i 422 dla złego body', async () => {
    const app = createApp();

    const missingAuth = await request(app).get('/api/v1/mock/zus-data');
    expect(missingAuth.status).toBe(401);
    expect(missingAuth.body.error?.code).toBe('UNAUTHORIZED');

    const badAuth = await request(app)
      .get('/api/v1/mock/zus-data')
      .set('Authorization', 'Bearer bad-token');
    expect(badAuth.status).toBe(401);
    expect(badAuth.body.error?.code).toBe('UNAUTHORIZED');

    const notFound = await request(app)
      .post('/api/v1/mock/login')
      .send({ profileId: 'nie-istnieje' });
    expect(notFound.status).toBe(404);
    expect(notFound.body.error?.code).toBe('NOT_FOUND');

    const invalidBody = await request(app).post('/api/v1/mock/login').send({ profileId: '' });
    expect(invalidBody.status).toBe(422);
    expect(invalidBody.body.error?.code).toBe('VALIDATION_ERROR');
  });
});
