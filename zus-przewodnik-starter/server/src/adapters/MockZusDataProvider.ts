import type { ZusData } from '@shared/types';
import type { ZusDataProvider } from './ZusDataProvider';
import { defaultProfileStore, type ProfileStore } from './profileStore';

/**
 * Symulacja pobierania danych z ZUS (ubezpieczenie, miesięczne zarobki, e-ZLA, zadłużenie).
 * Jedyne źródło danych demonstracyjnych ZUS dla sesji po logowaniu mObywatel.
 */
export class MockZusDataProvider implements ZusDataProvider {
  private readonly store: ProfileStore;

  constructor(store: ProfileStore = defaultProfileStore) {
    this.store = store;
  }

  async getZusData(profileId: string): Promise<ZusData> {
    const record = this.store.getById(profileId);
    return {
      profile: structuredClone(record.profile),
      incomes: structuredClone(record.incomes),
      sickLeaveCertificates: structuredClone(record.sickLeaveCertificates),
      contributionDebt: record.contributionDebt,
    };
  }
}
