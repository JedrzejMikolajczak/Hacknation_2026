import type { BenefitParams } from '@shared/types';
import paramsJson from '@shared/params.json';

/**
 * Parametry świadczeń dla UI (teksty pytań, przygotowanie danych do silnika).
 * Liczby zawsze stąd – nigdy wpisane w kod (CONVENTIONS §4).
 * TODO(api): pobierać z GET /api/v1/params, gdy panel admina będzie zmieniał je w trakcie działania.
 */
export const DEFAULT_PARAMS: BenefitParams = paramsJson;

const PERCENT = new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 1 });

/** 0.815 → „81,5%”. */
export function formatRate(rate: number): string {
  return PERCENT.format(rate);
}
