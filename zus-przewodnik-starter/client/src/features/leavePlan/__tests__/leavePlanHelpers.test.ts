import { describe, expect, it } from 'vitest';
import type { LeavePeriod } from '@shared/types';
import {
  formatParentLeaveSummary,
  formatShortDeadlineLabel,
  mergeParentLeaveRanges,
} from '../leavePlanHelpers';

function makePeriod(overrides: Partial<LeavePeriod>): LeavePeriod {
  return {
    leaveType: 'maternityLeave',
    parentRole: 'mother',
    startDate: '2026-11-10',
    endDate: '2027-03-29',
    weeks: 20,
    days: 140,
    rate: 0.815,
    monthlyAmount: 4890,
    totalAmount: 22820,
    ...overrides,
  };
}

describe('leavePlanHelpers – podsumowanie planu i formatowanie terminów', () => {
  it('łączy sąsiadujące okresy jednego rodzica w jeden ciągły przedział', () => {
    const periods: LeavePeriod[] = [
      makePeriod({
        leaveType: 'maternityLeave',
        parentRole: 'mother',
        startDate: '2026-11-10',
        endDate: '2027-03-29',
      }),
      makePeriod({
        leaveType: 'parentalLeave',
        parentRole: 'mother',
        startDate: '2027-03-30',
        endDate: '2027-11-08',
        weeks: 32,
        days: 224,
      }),
    ];

    expect(mergeParentLeaveRanges(periods, 'mother')).toEqual([
      { startDate: '2026-11-10', endDate: '2027-11-08' },
    ]);
    expect(formatParentLeaveSummary('mother', periods, '2027-11-09')).toBe(
      'Mama: urlop od 10.11.2026 do 08.11.2027, powrót do pracy 09.11.2027.',
    );
  });

  it('zachowuje osobne przedziały, gdy między urlopami jest przerwa (np. ojcowski + rodzicielski)', () => {
    const periods: LeavePeriod[] = [
      makePeriod({
        leaveType: 'paternityLeave',
        parentRole: 'father',
        startDate: '2026-11-10',
        endDate: '2026-11-23',
        weeks: 2,
        days: 14,
      }),
      makePeriod({
        leaveType: 'parentalLeave',
        parentRole: 'father',
        startDate: '2027-11-09',
        endDate: '2028-01-10',
        weeks: 9,
        days: 63,
      }),
    ];

    expect(mergeParentLeaveRanges(periods, 'father')).toEqual([
      { startDate: '2026-11-10', endDate: '2026-11-23' },
      { startDate: '2027-11-09', endDate: '2028-01-10' },
    ]);
    expect(formatParentLeaveSummary('father', periods, '2028-01-11')).toBe(
      'Tata: urlop od 10.11.2026 do 23.11.2026 oraz od 09.11.2027 do 10.01.2028, powrót do pracy 11.01.2028.',
    );
  });

  it('informuje o pozostałych tygodniach rodzicielskiego, gdy rodzic nie ma zaplanowanych okresów', () => {
    expect(formatParentLeaveSummary('father', [], null, 9)).toBe(
      'Tata: brak zaplanowanego urlopu (zostało 9 tyg. rodzicielskiego).',
    );
    expect(formatParentLeaveSummary('father', [], null, 0)).toBeNull();
  });

  it('skraca etykiety terminów do czytelnej formy zdaniowej', () => {
    expect(formatShortDeadlineLabel('Wniosek o 81,5% za cały okres (do 21 dni)')).toBe(
      'wniosek o 81,5% za cały okres',
    );
    expect(formatShortDeadlineLabel('Wniosek o urlop ojcowski (7 dni przed startem)')).toBe(
      'wniosek o urlop ojcowski',
    );
  });
});
