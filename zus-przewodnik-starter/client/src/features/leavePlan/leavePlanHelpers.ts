import type {
  BenefitParams,
  IsoDate,
  LeavePartRequest,
  LeavePeriod,
  LeaveType,
  MaternityCalculationResult,
  ParentData,
  ParentRole,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';

export const DAYS_IN_WEEK = 7;

const DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const PLN_FORMATTER = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

export function addDaysIso(isoDate: IsoDate, days: number): IsoDate {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function addMonthsIso(isoDate: IsoDate, months: number): IsoDate {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetFirst = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonthIndex = targetFirst.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfMonth);
  return new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay)).toISOString().slice(0, 10);
}

export function diffDaysIso(fromIso: IsoDate, toIso: IsoDate): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function formatIsoPl(isoDate: IsoDate | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'Brak daty';
  const [year, month, day] = isoDate.split('-').map(Number);
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPlnAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Brak danych';
  }
  return PLN_FORMATTER.format(amount);
}

export function getLeaveTypeLabel(leaveType: LeaveType): string {
  switch (leaveType) {
    case 'maternityLeave':
      return 'Urlop macierzyński';
    case 'adoptionMaternityLeave':
      return 'Urlop na warunkach urlopu macierzyńskiego';
    case 'supplementaryMaternityLeave':
      return 'Uzupełniający urlop macierzyński';
    case 'parentalLeave':
      return 'Urlop rodzicielski';
    case 'paternityLeave':
      return 'Urlop ojcowski';
  }
}

export function getShortLeaveTypeLabel(leaveType: LeaveType): string {
  switch (leaveType) {
    case 'maternityLeave':
      return 'Macierzyński';
    case 'adoptionMaternityLeave':
      return 'Na warunkach macierzyńskiego';
    case 'supplementaryMaternityLeave':
      return 'Uzupełniający';
    case 'parentalLeave':
      return 'Rodzicielski';
    case 'paternityLeave':
      return 'Ojcowski';
  }
}

export function getParentRoleLabel(role: ParentRole): string {
  return role === 'mother' ? 'Matka' : 'Ojciec / drugi rodzic';
}

export function getShortParentRoleLabel(role: ParentRole): string {
  return role === 'mother' ? 'Matka' : 'Ojciec';
}

export function getPlainParentLabel(role: ParentRole): string {
  return role === 'mother' ? 'Mama' : 'Tata';
}

export function formatWorkFraction(fraction: number): string {
  if (Math.abs(fraction - 0.5) < 0.001) return '1/2 etatu';
  if (Math.abs(fraction - 0.25) < 0.001) return '1/4 etatu';
  if (Math.abs(fraction - 1 / 3) < 0.01) return '1/3 etatu';
  return `${formatRate(fraction)} etatu`;
}

export function getWorkFractionOptions(params: BenefitParams): { value: number; label: string }[] {
  const max = params.parentalLeave.maxWorkTimeFraction;
  const halfOfMax = Math.round((max / 2) * 100) / 100;
  const options: { value: number; label: string }[] = [];

  if (halfOfMax > 0 && halfOfMax < max) {
    options.push({
      value: halfOfMax,
      label: `Praca ${formatWorkFraction(halfOfMax)} (${halfOfMax.toLocaleString('pl-PL')} etatu)`,
    });
  }
  options.push({
    value: max,
    label: `Praca ${formatWorkFraction(max)} (${max.toLocaleString('pl-PL')} – maksimum ustawowe)`,
  });

  return options;
}

export function getAnchorDate(scenario: ScenarioInput): IsoDate | null {
  if (scenario.situation === 'adoption') {
    return scenario.childAcceptanceDate;
  }
  if (scenario.situation === 'afterBirth') {
    return scenario.birthDate;
  }
  return scenario.expectedBirthDate;
}

export function getAnchorEventLabel(scenario: ScenarioInput): string {
  if (scenario.situation === 'adoption') {
    return 'Data przyjęcia dziecka na wychowanie';
  }
  if (scenario.situation === 'afterBirth') {
    return 'Data porodu';
  }
  return 'Przewidywana data porodu';
}

export function getAnchorJumpLabel(scenario: ScenarioInput): string {
  if (scenario.situation === 'adoption') return 'Przyjęcie dziecka';
  if (scenario.situation === 'afterBirth') return 'Poród';
  return 'Planowany poród';
}

export function isSingleChildLoss(scenario: ScenarioInput): boolean {
  return (
    (scenario.special.stillbirth || scenario.special.childDeathDate !== null) &&
    scenario.childrenCount <= 1
  );
}

export function isSensitiveSituation(scenario: ScenarioInput): boolean {
  return Boolean(
    scenario.special.stillbirth ||
    scenario.special.childDeathDate !== null ||
    scenario.special.motherDeceased ||
    scenario.special.motherIncapableOfIndependentLiving,
  );
}

export function isParentInsured(parent: Partial<ParentData> | null | undefined): boolean {
  return Boolean(
    parent &&
    parent.insuranceTitle &&
    parent.insuranceTitle !== 'none' &&
    parent.sicknessInsurance &&
    parent.sicknessInsurance !== 'none',
  );
}

export function hasFatherInPlan(scenario: ScenarioInput): boolean {
  return Boolean(scenario.father && scenario.father.wantsLeave);
}

export interface ScenarioDataIssues {
  missingAnchorDate: boolean;
  missingMotherBase: boolean;
  missingFatherBase: boolean;
  missingAdoptionAge: boolean;
  neitherParentInsured: boolean;
  blockingMessages: string[];
  warningMessages: string[];
}

export function getScenarioDataIssues(scenario: ScenarioInput): ScenarioDataIssues {
  const anchorDate = getAnchorDate(scenario);
  const missingAnchorDate = anchorDate === null;
  const motherInsured = isParentInsured(scenario.mother);
  const fatherInsured = isParentInsured(scenario.father);
  const neitherParentInsured = !motherInsured && !fatherInsured;

  const missingMotherBase = motherInsured && scenario.mother.benefitBase === null;
  const missingFatherBase = Boolean(
    scenario.father?.wantsLeave && fatherInsured && scenario.father.benefitBase === null,
  );
  const missingAdoptionAge = scenario.situation === 'adoption' && scenario.childAgeYears === null;

  const blockingMessages: string[] = [];
  const warningMessages: string[] = [];

  if (missingAnchorDate) {
    blockingMessages.push(
      scenario.situation === 'adoption'
        ? 'Brak daty przyjęcia dziecka na wychowanie. Uzupełnij ją, aby zaplanować urlopy w kalendarzu.'
        : scenario.situation === 'afterBirth'
          ? 'Brak daty porodu. Uzupełnij ją, aby przygotować oś czasu i kalendarz urlopów.'
          : 'Brak przewidywanej daty porodu. Uzupełnij ją, aby zaplanować urlopy w kalendarzu.',
    );
  }

  if (neitherParentInsured) {
    blockingMessages.push(
      'Żaden z rodziców nie podlega ubezpieczeniu chorobowemu, dlatego zasiłek macierzyński z ZUS nie przysługuje (możesz sprawdzić świadczenie rodzicielskie „Kosiniakowe” w urzędzie gminy albo uzupełnić dane o ubezpieczeniu w kreatorze).',
    );
  }

  if (!neitherParentInsured) {
    if (missingMotherBase) {
      warningMessages.push(
        'Brak podstawy wymiaru zasiłku dla Matki – okresy w kalendarzu są widoczne, ale kwoty zasiłku wymagają uzupełnienia podstawy.',
      );
    }
    if (missingFatherBase) {
      warningMessages.push(
        'Brak podstawy wymiaru zasiłku dla Ojca – kwoty dla części Ojca wymagają uzupełnienia podstawy.',
      );
    }
    if (missingAdoptionAge) {
      warningMessages.push(
        'Brak wieku dziecka przy przyjęciu na wychowanie – uzupełnij go, aby zweryfikować limity wieku dla urlopu na warunkach macierzyńskiego i rodzicielskiego.',
      );
    }
  }

  return {
    missingAnchorDate,
    missingMotherBase,
    missingFatherBase,
    missingAdoptionAge,
    neitherParentInsured,
    blockingMessages,
    warningMessages,
  };
}

export interface ParentalPoolSummary {
  totalWeeks: number;
  nonTransferable: number;
  maxSingleParentWeeks: number;
}

export function getParentalPoolSummary(
  scenario: ScenarioInput,
  params: BenefitParams,
): ParentalPoolSummary {
  const multiple = scenario.childrenCount > 1;
  const totalWeeks = scenario.special.zaZyciemCertificate
    ? multiple
      ? params.parentalLeave.weeksMultipleChildrenZaZyciem
      : params.parentalLeave.weeksSingleChildZaZyciem
    : multiple
      ? params.parentalLeave.weeksMultipleChildren
      : params.parentalLeave.weeksSingleChild;
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  return {
    totalWeeks,
    nonTransferable,
    maxSingleParentWeeks: Math.max(0, totalWeeks - nonTransferable),
  };
}

export function getMaternityBlockEndDate(
  scenario: ScenarioInput,
  maternity: MaternityCalculationResult,
): IsoDate | null {
  const preParentalPeriods = maternity.periods.filter(
    (period) =>
      period.leaveType === 'maternityLeave' ||
      period.leaveType === 'adoptionMaternityLeave' ||
      period.leaveType === 'supplementaryMaternityLeave',
  );
  if (preParentalPeriods.length > 0) {
    return (
      preParentalPeriods
        .map((period) => period.endDate)
        .sort()
        .at(-1) ?? null
    );
  }
  return null;
}

export function getDefaultParentalStartDate(
  scenario: ScenarioInput,
  maternity: MaternityCalculationResult,
): IsoDate | null {
  const preParentalEnd = getMaternityBlockEndDate(scenario, maternity);
  if (preParentalEnd) {
    return addDaysIso(preParentalEnd, 1);
  }
  return getAnchorDate(scenario);
}

export type LeavePlanPresetId = 'classic' | 'equal' | 'simultaneous' | 'onlyMother' | 'onlyFather';

export interface LeavePlanPreset {
  id: LeavePlanPresetId;
  title: string;
  description: string;
  requiresFather: boolean;
}

export function getLeavePlanPresets(params: BenefitParams): LeavePlanPreset[] {
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  return [
    {
      id: 'classic',
      title: 'Najpierw Mama, potem Tata',
      description: `Mama wykorzystuje maksymalną część dla jednego rodzica, a Tata swoje ${nonTransferable} tyg. bezpośrednio po niej.`,
      requiresFather: true,
    },
    {
      id: 'equal',
      title: 'Po połowie (naprzemiennie)',
      description: 'Rodzice dzielą wspólną pulę urlopu rodzicielskiego równo między siebie.',
      requiresFather: true,
    },
    {
      id: 'simultaneous',
      title: 'Jednocześnie (wspólna opieka)',
      description: `Mama i Tata rozpoczynają urlop rodzicielski w tym samym dniu (Tata bierze ${nonTransferable} tyg. równolegle z Mamą).`,
      requiresFather: true,
    },
    {
      id: 'onlyMother',
      title: 'Tylko Mama',
      description: `Mama wykorzystuje maksimum dla jednego rodzica (${nonTransferable} tyg. drugiego rodzica pozostaje niewykorzystane).`,
      requiresFather: false,
    },
    {
      id: 'onlyFather',
      title: 'Tylko Tata',
      description: `Tata wykorzystuje maksimum dla jednego rodzica (${nonTransferable} tyg. Matki pozostaje niewykorzystane).`,
      requiresFather: true,
    },
  ];
}

/**
 * Buduje wyłącznie części urlopu rodzicielskiego (bez duplikowania macierzyńskiego i ojcowskiego).
 */
export function buildPresetParentalParts(
  presetId: LeavePlanPresetId,
  scenario: ScenarioInput,
  maternity: MaternityCalculationResult,
  params: BenefitParams,
): LeavePartRequest[] {
  if (isSingleChildLoss(scenario)) {
    return [];
  }

  const parentalStart = getDefaultParentalStartDate(scenario, maternity);
  if (!parentalStart) {
    return [];
  }

  const pool = getParentalPoolSummary(scenario, params);
  const fatherAvailable = hasFatherInPlan(scenario) && isParentInsured(scenario.father);
  const motherAvailable = isParentInsured(scenario.mother) && !scenario.special.motherDeceased;

  if (!motherAvailable && fatherAvailable) {
    return [
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: pool.maxSingleParentWeeks,
      },
    ];
  }

  if (!motherAvailable && !fatherAvailable) {
    return [];
  }

  const effectivePreset: LeavePlanPresetId =
    !fatherAvailable && presetId !== 'onlyMother' ? 'onlyMother' : presetId;

  if (effectivePreset === 'onlyMother') {
    return [
      {
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: pool.maxSingleParentWeeks,
      },
    ];
  }

  if (effectivePreset === 'onlyFather') {
    return [
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: pool.maxSingleParentWeeks,
      },
    ];
  }

  if (effectivePreset === 'equal') {
    const motherWeeks = Math.ceil(pool.totalWeeks / 2);
    const fatherWeeks = pool.totalWeeks - motherWeeks;
    const fatherStart = addDaysIso(parentalStart, motherWeeks * DAYS_IN_WEEK);
    return [
      {
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: motherWeeks,
      },
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: fatherStart,
        weeks: fatherWeeks,
      },
    ];
  }

  if (effectivePreset === 'simultaneous') {
    return [
      {
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: pool.maxSingleParentWeeks,
      },
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: pool.nonTransferable,
      },
    ];
  }

  // 'classic': najpierw Mama, potem Tata
  const motherWeeks = pool.maxSingleParentWeeks;
  const fatherStart = addDaysIso(parentalStart, motherWeeks * DAYS_IN_WEEK);
  return [
    {
      parentRole: 'mother',
      leaveType: 'parentalLeave',
      startDate: parentalStart,
      weeks: motherWeeks,
    },
    {
      parentRole: 'father',
      leaveType: 'parentalLeave',
      startDate: fatherStart,
      weeks: pool.nonTransferable,
    },
  ];
}

export interface PartLimitInfo {
  maxWeeks: number;
  maxPartsReached: boolean;
  limitReason: string | null;
}

export function getPartLimitInfo(
  parts: LeavePartRequest[],
  targetRole: ParentRole,
  scenario: ScenarioInput,
  params: BenefitParams,
  editingIndex: number | null = null,
): PartLimitInfo {
  const otherParts = parts.filter((_, idx) => idx !== editingIndex);
  const pool = getParentalPoolSummary(scenario, params);
  const otherParentalParts = otherParts.filter((p) => p.leaveType === 'parentalLeave');
  const maxPartsReached =
    editingIndex === null && otherParentalParts.length >= params.parentalLeave.maxParts;

  const totalUsed = otherParentalParts.reduce((sum, p) => sum + p.weeks, 0);
  const sameParentUsed = otherParentalParts
    .filter((p) => p.parentRole === targetRole)
    .reduce((sum, p) => sum + p.weeks, 0);

  const remainingTotal = Math.max(0, pool.totalWeeks - totalUsed);
  const remainingForParent = Math.max(0, pool.maxSingleParentWeeks - sameParentUsed);
  const maxWeeks = Math.min(remainingTotal, remainingForParent);
  const otherRoleLabel = targetRole === 'mother' ? 'Ojca' : 'Matki';
  const roleLabel = targetRole === 'mother' ? 'Matki' : 'Ojca';

  let limitReason: string | null = null;
  if (maxPartsReached) {
    limitReason = `Osiągnięto limit ${params.parentalLeave.maxParts} części urlopu rodzicielskiego.`;
  } else if (remainingTotal === 0) {
    limitReason = `Wykorzystano całą wspólną pulę ${pool.totalWeeks} tyg. urlopu rodzicielskiego.`;
  } else if (remainingForParent === 0) {
    limitReason = `Osiągnięto limit dla ${roleLabel} (${pool.maxSingleParentWeeks} tyg.) – pozostałe ${pool.nonTransferable} tyg. jest nieprzenoszalne dla ${otherRoleLabel}.`;
  } else if (remainingForParent < remainingTotal) {
    limitReason = `Dla ${roleLabel} możesz dodać maksymalnie ${maxWeeks} tyg. (${pool.nonTransferable} tyg. jest zarezerwowane wyłącznie dla ${otherRoleLabel}).`;
  } else {
    limitReason = `Pozostało jeszcze ${maxWeeks} tyg. ze wspólnej puli ${pool.totalWeeks} tyg.`;
  }

  return { maxWeeks, maxPartsReached, limitReason };
}

export function sortPartsWithWork(
  rawParts: LeavePartRequest[],
  rawWorkMap: Record<number, number>,
): { sortedParts: LeavePartRequest[]; sortedWorkMap: Record<number, number> } {
  const tagged = rawParts.map((part, oldIndex) => ({
    part,
    workFraction: rawWorkMap[oldIndex],
  }));

  tagged.sort((a, b) => {
    const dateCmp = a.part.startDate.localeCompare(b.part.startDate);
    if (dateCmp !== 0) return dateCmp;
    return a.part.parentRole.localeCompare(b.part.parentRole);
  });

  const sortedWorkMap: Record<number, number> = {};
  tagged.forEach((entry, newIndex) => {
    if (entry.workFraction !== undefined && entry.part.leaveType === 'parentalLeave') {
      sortedWorkMap[newIndex] = entry.workFraction;
    }
  });

  return {
    sortedParts: tagged.map((entry) => entry.part),
    sortedWorkMap,
  };
}

export interface ReturnToWorkDates {
  mother: IsoDate | null;
  father: IsoDate | null;
}

export function computeReturnToWorkDates(periods: LeavePeriod[]): ReturnToWorkDates {
  const motherEnds = periods
    .filter((p) => p.parentRole === 'mother')
    .map((p) => p.endDate)
    .sort();
  const fatherEnds = periods
    .filter((p) => p.parentRole === 'father')
    .map((p) => p.endDate)
    .sort();

  const lastMotherEnd = motherEnds.at(-1) ?? null;
  const lastFatherEnd = fatherEnds.at(-1) ?? null;

  return {
    mother: lastMotherEnd ? addDaysIso(lastMotherEnd, 1) : null,
    father: lastFatherEnd ? addDaysIso(lastFatherEnd, 1) : null,
  };
}

export interface DateRange {
  startDate: IsoDate;
  endDate: IsoDate;
}

/**
 * Łączy sąsiadujące lub nakładające się okresy urlopu jednego rodzica w ciągłe przedziały.
 */
export function mergeParentLeaveRanges(periods: LeavePeriod[], role: ParentRole): DateRange[] {
  const sorted = periods
    .filter((p) => p.parentRole === role)
    .map((p) => ({ startDate: p.startDate, endDate: p.endDate }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const merged: DateRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || diffDaysIso(last.endDate, range.startDate) > 1) {
      merged.push({ ...range });
    } else if (range.endDate > last.endDate) {
      last.endDate = range.endDate;
    }
  }
  return merged;
}

/**
 * Buduje jednozdaniowe podsumowanie urlopu i daty powrotu do pracy dla rodzica w prostym języku.
 */
export function formatParentLeaveSummary(
  role: ParentRole,
  periods: LeavePeriod[],
  returnDate: IsoDate | null,
  remainingParentalWeeks?: number | null,
): string | null {
  const name = getPlainParentLabel(role);
  const ranges = mergeParentLeaveRanges(periods, role);

  if (ranges.length === 0) {
    if (remainingParentalWeeks && remainingParentalWeeks > 0) {
      return `${name}: brak zaplanowanego urlopu (zostało ${remainingParentalWeeks} tyg. rodzicielskiego).`;
    }
    return null;
  }

  const formattedRanges = ranges.map(
    (r) => `od ${formatIsoPl(r.startDate)} do ${formatIsoPl(r.endDate)}`,
  );
  let rangeText: string;
  if (formattedRanges.length === 1) {
    rangeText = formattedRanges[0];
  } else if (formattedRanges.length === 2) {
    rangeText = `${formattedRanges[0]} oraz ${formattedRanges[1]}`;
  } else {
    rangeText = `${formattedRanges.slice(0, -1).join(', ')} oraz ${formattedRanges.at(-1)}`;
  }

  return `${name}: urlop ${rangeText}${returnDate ? `, powrót do pracy ${formatIsoPl(returnDate)}` : ''}.`;
}

/**
 * Skraca etykietę terminu do zwięzłej formy zdaniowej (bez dopisków w nawiasie).
 */
export function formatShortDeadlineLabel(label: string): string {
  const trimmed = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!trimmed) return label;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
