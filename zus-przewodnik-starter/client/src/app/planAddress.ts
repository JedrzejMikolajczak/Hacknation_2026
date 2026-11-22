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

const PLAN_STORAGE_PREFIX = 'zus-plan-session-v1:';
const inMemoryPlans = new Map<string, CaseInputs | null>();

export function readSessionPlan(key: string): CaseInputs | null {
  if (inMemoryPlans.has(key)) return inMemoryPlans.get(key) ?? null;
  try {
    return readPlanAddress(window.sessionStorage.getItem(PLAN_STORAGE_PREFIX + key));
  } catch {
    return null;
  }
}

export function writeSessionPlan(key: string, inputs: CaseInputs | null) {
  try {
    const storageKey = PLAN_STORAGE_PREFIX + key;
    if (inputs) window.sessionStorage.setItem(storageKey, JSON.stringify(inputs));
    else window.sessionStorage.removeItem(storageKey);
    inMemoryPlans.delete(key);
  } catch {
    inMemoryPlans.set(key, inputs);
  }
}

export function clearSessionPlans() {
  inMemoryPlans.clear();
  try {
    const storage = window.sessionStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(PLAN_STORAGE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Session storage is optional.
  }
}
