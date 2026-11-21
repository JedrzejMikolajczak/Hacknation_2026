import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MockMObywatelProvider } from '../adapters/MockMObywatelProvider';
import { createApp } from '../app';

const app = createApp();
const api = '/api/v1/mock';

describe('Symulacja logowania mObywatela', () => {
  it('udostępnia etykiety bez danych identyfikacyjnych i zwraca profil po logowaniu', async () => {
    const list = await request(app).get(`${api}/profiles`).expect(200);
    expect(list.body.error).toBeNull();
    expect(list.body.data).toEqual(
      expect.arrayContaining([
        { profileId: 'anna', label: 'Anna Testowa' },
        { profileId: 'jan', label: 'Jan Testowy' },
      ]),
    );

    const login = await request(app)
      .post(`${api}/login`)
      .send({ profile_id: 'anna' })
      .expect('Cache-Control', 'no-store')
      .expect(200);
    expect(login.body.error).toBeNull();
    expect(login.body.data.sessionToken).toEqual(expect.any(String));
    expect(login.body.data.profile).toMatchObject({
      profileId: 'anna',
      firstName: 'Anna',
      lastName: 'Testowa',
      pesel: '92031400006',
      birthDate: '1992-03-14',
    });
  });

  it('zwraca 422 dla błędnego żądania i 404 dla nieznanego profilu', async () => {
    const invalid = await request(app).post(`${api}/login`).send({}).expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    const missing = await request(app)
      .post(`${api}/login`)
      .send({ profile_id: 'nieznany' })
      .expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('wiąże odrębne tokeny z właściwymi profilami', async () => {
    const provider = new MockMObywatelProvider();
    const anna = await provider.login('anna');
    const jan = await provider.login('jan');
    expect(anna.sessionToken).not.toBe(jan.sessionToken);
    expect(await provider.getProfileBySession(anna.sessionToken)).toEqual(anna.profile);
    expect(await provider.getProfileBySession(jan.sessionToken)).toEqual(jan.profile);
    expect(await provider.getProfileBySession('nieznana-sesja')).toBeNull();
  });
});
