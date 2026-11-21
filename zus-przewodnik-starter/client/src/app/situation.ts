import type { SituationType } from '@shared/types';

// Record wymusza obecność każdej wartości SituationType (błąd kompilacji po rozszerzeniu typu).
const SITUATION_SET: Record<SituationType, true> = {
  planning: true,
  pregnant: true,
  afterBirth: true,
  adoption: true,
};

export function isSituationType(value: unknown): value is SituationType {
  return typeof value === 'string' && Object.hasOwn(SITUATION_SET, value);
}

/** Wartość z query stringu → SituationType albo null (nieprawidłowa wartość nie jest błędem). */
export function parseSituation(value: string | null): SituationType | null {
  return isSituationType(value) ? value : null;
}
