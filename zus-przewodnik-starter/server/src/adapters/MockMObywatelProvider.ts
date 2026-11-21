import { randomBytes } from 'node:crypto';
import type { MockProfileSummary, UserProfile } from '@shared/types';
import type { AuthProvider } from './AuthProvider';
import { defaultProfileStore, type ProfileStore } from './profileStore';

const MAX_ACTIVE_SESSIONS = 500;

/**
 * Symulacja logowania mObywatel (wersja demonstracyjna).
 * Przechowuje sesje wyłącznie w pamięci procesu.
 */
export class MockMObywatelProvider implements AuthProvider {
  private readonly store: ProfileStore;
  private readonly sessions = new Map<string, string>();

  constructor(store: ProfileStore = defaultProfileStore) {
    this.store = store;
  }

  async listProfiles(): Promise<MockProfileSummary[]> {
    return this.store.listSummaries();
  }

  async login(profileId: string): Promise<{ sessionToken: string; profile: UserProfile }> {
    const record = this.store.getById(profileId);
    const sessionToken = `mock-mobywatel-${randomBytes(24).toString('hex')}`;

    if (this.sessions.size >= MAX_ACTIVE_SESSIONS) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) this.sessions.delete(oldest);
    }
    this.sessions.set(sessionToken, record.profile.profileId);

    return {
      sessionToken,
      profile: structuredClone(record.profile),
    };
  }

  async getProfileBySession(sessionToken: string): Promise<UserProfile | null> {
    if (!sessionToken) return null;
    const profileId = this.sessions.get(sessionToken);
    if (!profileId) return null;
    try {
      const record = this.store.getById(profileId);
      return structuredClone(record.profile);
    } catch {
      return null;
    }
  }
}
