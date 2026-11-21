import type { MockProfileSummary, UserProfile } from '@shared/types';

/**
 * Logowanie (dziś symulacja mObywatela – MockMObywatelProvider, Osoba 3).
 * Prawdziwa integracja = nowa implementacja tego interfejsu.
 */
export interface AuthProvider {
  listProfiles(): Promise<MockProfileSummary[]>;
  login(profileId: string): Promise<{ sessionToken: string; profile: UserProfile }>;
  /** Zwraca profil dla ważnej sesji albo null. */
  getProfileBySession(sessionToken: string): Promise<UserProfile | null>;
}
