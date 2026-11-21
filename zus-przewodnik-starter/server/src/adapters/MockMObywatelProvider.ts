import { randomUUID } from 'node:crypto';
import type { AuthSession, MockProfileSummary, UserProfile } from '@shared/types';
import anna from '../../../data/profiles/anna.json';
import jan from '../../../data/profiles/jan.json';
import { UnknownProfileError, type AuthProvider } from './AuthProvider';

const profiles = [anna, jan];
const emptyInsurance: UserProfile['mother'] = {
  role: 'mother',
  insuranceTitle: 'none',
  sicknessInsurance: 'none',
  insuredSince: null,
  insuranceEndDate: null,
  benefitBase: null,
  employerInsuredCount: null,
  age: null,
  contributionDebt: null,
  wantsLeave: false,
};
const sessionDurationMs = 30 * 60 * 1000;
const sessionLimit = 1_000;

export class MockMObywatelProvider implements AuthProvider {
  private readonly sessions = new Map<string, { profile: UserProfile; expiresAt: number }>();

  async listProfiles(): Promise<MockProfileSummary[]> {
    return profiles.map(({ profileId, label }) => ({ profileId, label }));
  }

  async login(profileId: string): Promise<AuthSession> {
    const entry = profiles.find((profile) => profile.profileId === profileId);
    if (!entry) throw new UnknownProfileError('Nie znaleziono profilu testowego.');
    const { profileId: id, firstName, lastName, pesel, birthDate } = entry;
    const profile: UserProfile = {
      profileId: id,
      firstName,
      lastName,
      pesel,
      birthDate,
      mother: { ...emptyInsurance },
    };
    if (this.sessions.size >= sessionLimit) {
      const oldest = this.sessions.keys().next();
      if (!oldest.done) this.sessions.delete(oldest.value);
    }
    const sessionToken = randomUUID();
    this.sessions.set(sessionToken, { profile, expiresAt: Date.now() + sessionDurationMs });
    return { sessionToken, profile };
  }

  async getProfileBySession(sessionToken: string): Promise<UserProfile | null> {
    const session = this.sessions.get(sessionToken);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionToken);
      return null;
    }
    return session.profile;
  }
}
