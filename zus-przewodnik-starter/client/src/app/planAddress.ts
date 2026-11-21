import type { CaseInputs } from '@shared/types';

export function readPlanAddress(serialized: string | null): CaseInputs | null {
  if (!serialized) return null;
  try {
    const data: unknown = JSON.parse(serialized);
    return data &&
      typeof data === 'object' &&
      'stage' in data &&
      'special_circumstances' in data &&
      typeof data.special_circumstances === 'object' &&
      data.special_circumstances !== null
      ? (data as CaseInputs)
      : null;
  } catch {
    return null;
  }
}
