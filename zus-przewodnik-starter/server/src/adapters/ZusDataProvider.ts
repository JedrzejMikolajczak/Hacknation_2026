import type { ZusData } from '@shared/types';

/**
 * Dane z ZUS (dziś MockZusDataProvider, Osoba 3).
 * Jedyne miejsce, które może czytać data/profiles.
 */
export interface ZusDataProvider {
  getZusData(profileId: string): Promise<ZusData>;
}
