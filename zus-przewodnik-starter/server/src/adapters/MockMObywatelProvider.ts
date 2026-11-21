import { randomUUID } from 'node:crypto';
import type { AuthSession, MockProfileSummary, UserProfile } from '@shared/types';
import type { AuthProvider } from './AuthProvider';
import { defaultProfileStore, type ProfileStore } from './profileStore';

const SESSION_DURATION_MS = 30 * 60 * 1000;
const SESSION_LIMIT = 1_000;

/**
 * Symulacja logowania mObywatel (wersja demonstracyjna).
 * Przechowuje sesje wyłącznie w pamięci procesu.
 */
export class MockMObywatelProvider implements AuthProvider {
  private readonly store: ProfileStore;
  private readonly sessions = new Map<string, { profile: UserProfile; expiresAt: number }>();

  constructor(store: ProfileStore = defaultProfileStore) {
    this.store = store;
  }

  async listProfiles(): Promise<MockProfileSummary[]> {
    return this.store.listSummaries();
  }

  async login(profileId: string): Promise<AuthSession> {
    const record = this.store.getById(profileId);
    const profile = structuredClone(record.profile);

    if (this.sessions.size >= SESSION_LIMIT) {
      const oldest = this.sessions.keys().next();
      if (!oldest.done) this.sessions.delete(oldest.value);
    }
    const sessionToken = randomUUID();
    this.sessions.set(sessionToken, {
      profile,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    });

    return { sessionToken, profile };
  }

  async getProfileBySession(sessionToken: string): Promise<UserProfile | null> {
    if (!sessionToken) return null;
    const session = this.sessions.get(sessionToken);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionToken);
      return null;
    }
    return structuredClone(session.profile);
  }
}
