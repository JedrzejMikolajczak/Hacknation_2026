import type {
  ApplicantRole,
  BenefitParams,
  CaseInputs,
  CaseLeaveType,
  CaseParentInsurance,
  CasePeriod,
  CasePlan,
  IsoDate,
  PlannedParentalPart,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { addDaysIso, diffDaysIso, formatPln, formatPolishDate } from '../plan/planScenario';

export { addDaysIso, diffDaysIso, formatPln, formatPolishDate };

export function formatDaysPl(days: number): string {
  return `${days} ${days === 1 ? 'dzień' : 'dni'}`;
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

export function getEventDate(input: CaseInputs): IsoDate | null {
  return input.stage === 'ADOPTION'
    ? (input.adopted_or_foster_child_acceptance_date ?? null)
    : input.due_or_birth_date;
}

export function getEventLabel(input: CaseInputs): string {
  if (input.stage === 'ADOPTION') return 'Data przyjęcia dziecka na wychowanie';
  if (input.stage === 'POST_BIRTH') return 'Data porodu';
  return 'Przewidywana data porodu';
}

export function getEventJumpLabel(input: CaseInputs): string {
  if (input.stage === 'ADOPTION') return 'Przyjęcie dziecka';
  if (input.stage === 'POST_BIRTH') return 'Poród';
  return 'Planowany poród';
}

export function isParentInsured(parent: CaseParentInsurance | null | undefined): boolean {
  if (!parent) return false;
  if (parent.employment_type === 'UOP') return true;
  if (parent.employment_type === 'NONE') return false;
  return parent.voluntary_sickness_insured === true;
}

export interface ParentAvailability {
  motherAvailable: boolean;
  fatherAvailable: boolean;
  otherInsured: boolean;
}

export function getParentAvailability(input: CaseInputs, plan: CasePlan): ParentAvailability {
  const applicantInsured = isParentInsured(input);
  const otherInsured = input.co_parenting
    ? input.other_parent
      ? isParentInsured(input.other_parent)
      : input.other_parent_insured === true
    : false;
  const leavePeriods = getLeavePeriods(plan);
  const hasMotherPeriods = leavePeriods.some((p) => p.parent_role === 'MOTHER');
  const hasFatherPeriods = leavePeriods.some((p) => p.parent_role === 'FATHER');

  if (input.applicant_role === 'MOTHER') {
    return {
      motherAvailable: applicantInsured || hasMotherPeriods,
      fatherAvailable: otherInsured || hasFatherPeriods,
      otherInsured,
    };
  }

  return {
    motherAvailable: otherInsured || hasMotherPeriods,
    fatherAvailable: applicantInsured || hasFatherPeriods,
    otherInsured,
  };
}

export function isSensitiveSituation(input: CaseInputs): boolean {
  return Boolean(
    input.special_circumstances.stillbirth_or_child_death !== 'NONE' ||
    input.special_circumstances.mother_hospitalized_or_incapable,
  );
}

export function isChildLossNoParental(input: CaseInputs, plan: CasePlan): boolean {
  return (
    input.special_circumstances.stillbirth_or_child_death !== 'NONE' &&
    plan.outcome.parental_pool_weeks === 0
  );
}

export function getLeavePeriods(plan: CasePlan): CasePeriod[] {
  return plan.outcome.periods.filter(
    (period) => !period.denied && period.leave_type !== 'SICKNESS',
  );
}

export function getEditableParentalParts(input: CaseInputs, plan: CasePlan): PlannedParentalPart[] {
  if (input.parental_leave_parts !== undefined) {
    return input.parental_leave_parts;
  }
  return plan.outcome.periods
    .filter(
      (period) =>
        !period.denied &&
        (period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION'),
    )
    .map(({ start_date, end_date, parent_role, work_fraction }) => ({
      start_date,
      end_date,
      parent_role,
      work_fraction,
    }));
}

export function getPlainParentLabel(role: ApplicantRole): string {
  return role === 'MOTHER' ? 'Mama' : 'Tata';
}

export function getShortLeaveLabel(leaveType: CaseLeaveType): string {
  switch (leaveType) {
    case 'MATERNITY':
      return 'Macierzyński';
    case 'ADOPTION_MATERNITY':
      return 'Na warunkach macierzyńskiego';
    case 'SUPPLEMENTARY_MATERNITY':
      return 'Uzupełniający';
    case 'PARENTAL':
      return 'Rodzicielski';
    case 'PARENTAL_ZA_ZYCIEM_EXTENSION':
      return 'Rodzicielski (Za życiem)';
    case 'PARENTAL_WORK_EXTENSION':
      return 'Rodzicielski (wydłużenie)';
    case 'PATERNITY':
      return 'Ojcowski';
    case 'SICKNESS':
      return 'Chorobowy';
  }
}

export function formatWorkFraction(fraction: number): string {
  if (Math.abs(fraction - 0.5) < 0.001) return '1/2 etatu';
  if (Math.abs(fraction - 0.25) < 0.001) return '1/4 etatu';
  if (Math.abs(fraction - 1 / 3) < 0.01) return '1/3 etatu';
  return `${formatRate(fraction)} etatu`;
}

export function formatWeeksPl(weeks: number): string {
  const formatted = weeks.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  return `${formatted} tyg.`;
}

export function formatRatePercent(ratePercent: number | null): string {
  if (ratePercent === null) return '—';
  return `${ratePercent.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

export function getWorkFractionQuickOptions(
  params: BenefitParams,
): { value: number; label: string }[] {
  const max = params.parentalLeave.maxWorkTimeFraction;
  const half = Math.round((max / 2) * 100) / 100;
  const options: { value: number; label: string }[] = [{ value: 0, label: 'Bez pracy (0)' }];
  if (half > 0 && half < max) {
    options.push({ value: half, label: formatWorkFraction(half) });
  }
  options.push({ value: max, label: `${formatWorkFraction(max)} (maks.)` });
  return options;
}

export function getPreParentalEndDate(plan: CasePlan): IsoDate | null {
  const preParental = plan.outcome.periods.filter(
    (period) =>
      !period.denied &&
      (period.leave_type === 'MATERNITY' ||
        period.leave_type === 'ADOPTION_MATERNITY' ||
        period.leave_type === 'SUPPLEMENTARY_MATERNITY'),
  );
  if (!preParental.length) return null;
  return (
    preParental
      .map((period) => period.end_date)
      .sort()
      .at(-1) ?? null
  );
}

export function getParentalStartDate(input: CaseInputs, plan: CasePlan): IsoDate | null {
  const preEnd = getPreParentalEndDate(plan);
  if (preEnd) return addDaysIso(preEnd, 1);

  const eventDate = getEventDate(input);
  if (input.parental_only) {
    const earliestExisting = [...(input.parental_leave_parts ?? [])]
      .map((part) => part.start_date)
      .sort()[0];
    if (earliestExisting) return earliestExisting;
    if (input.reference_date && (!eventDate || input.reference_date >= eventDate)) {
      return input.reference_date;
    }
  }
  return eventDate;
}

export function getPartDays(part: PlannedParentalPart): number {
  if (!part.start_date || !part.end_date) return 0;
  return diffDaysIso(part.start_date, part.end_date) + 1;
}

export interface ParentalUsageSummary {
  poolWeeks: number;
  individualLimitWeeks: number;
  nonTransferableWeeks: number;
  motherDays: number;
  fatherDays: number;
  motherWeeks: number;
  fatherWeeks: number;
  totalWeeks: number;
  remainingTotalWeeks: number;
  remainingByRole: Record<ApplicantRole, number>;
}

export function computeParentalUsage(
  parts: PlannedParentalPart[],
  input: CaseInputs,
  plan: CasePlan,
  params: BenefitParams,
): ParentalUsageSummary {
  const daysPerWeek = params.calendar.daysPerWeek;
  const poolWeeks = plan.outcome.parental_pool_weeks;
  const individualLimitWeeks = plan.outcome.parental_applicant_limit_weeks;
  const nonTransferableWeeks = params.parentalLeave.nonTransferableWeeksPerParent;

  let motherDays = 0;
  let fatherDays = 0;

  for (const part of parts) {
    const days = Math.max(0, getPartDays(part));
    const role = part.parent_role ?? input.applicant_role;
    if (role === 'MOTHER') motherDays += days;
    else fatherDays += days;
  }

  const motherWeeks = Math.round((motherDays / daysPerWeek) * 10) / 10;
  const fatherWeeks = Math.round((fatherDays / daysPerWeek) * 10) / 10;
  const totalDays = motherDays + fatherDays;
  const totalWeeks = Math.round((totalDays / daysPerWeek) * 10) / 10;

  const poolDays = poolWeeks * daysPerWeek;
  const limitDays = individualLimitWeeks * daysPerWeek;

  const remainingTotalDays = Math.max(0, poolDays - totalDays);
  const remainingMotherDays = Math.min(remainingTotalDays, Math.max(0, limitDays - motherDays));
  const remainingFatherDays = Math.min(remainingTotalDays, Math.max(0, limitDays - fatherDays));

  return {
    poolWeeks,
    individualLimitWeeks,
    nonTransferableWeeks,
    motherDays,
    fatherDays,
    motherWeeks,
    fatherWeeks,
    totalWeeks,
    remainingTotalWeeks: Math.floor(remainingTotalDays / daysPerWeek),
    remainingByRole: {
      MOTHER: Math.floor(remainingMotherDays / daysPerWeek),
      FATHER: Math.floor(remainingFatherDays / daysPerWeek),
    },
  };
}

export type LeavePlanPresetId = 'classic' | 'equal' | 'simultaneous' | 'onlyMother' | 'onlyFather';

export interface LeavePlanPreset {
  id: LeavePlanPresetId;
  title: string;
  description: string;
  requiresMother: boolean;
  requiresFather: boolean;
}

export function getLeavePlanPresets(params: BenefitParams): LeavePlanPreset[] {
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  return [
    {
      id: 'classic',
      title: 'Najpierw mama, potem tata',
      description: `Mama bierze maksimum dla jednego rodzica, a tata swoje ${nonTransferable} tyg. zaraz po niej.`,
      requiresMother: true,
      requiresFather: true,
    },
    {
      id: 'equal',
      title: 'Po połowie',
      description: 'Rodzice dzielą wspólną pulę urlopu rodzicielskiego równo między siebie.',
      requiresMother: true,
      requiresFather: true,
    },
    {
      id: 'simultaneous',
      title: 'Jednocześnie',
      description: `Mama i tata zaczynają w tym samym dniu (tata bierze ${nonTransferable} tyg. równolegle z mamą).`,
      requiresMother: true,
      requiresFather: true,
    },
    {
      id: 'onlyMother',
      title: 'Tylko mama',
      description: `Mama wykorzystuje maksimum dla jednego rodzica (${nonTransferable} tyg. taty pozostaje niewykorzystane).`,
      requiresMother: true,
      requiresFather: false,
    },
    {
      id: 'onlyFather',
      title: 'Tylko tata',
      description: `Tata wykorzystuje maksimum dla jednego rodzica (${nonTransferable} tyg. mamy pozostaje niewykorzystane).`,
      requiresMother: false,
      requiresFather: true,
    },
  ];
}

export function buildPresetParentalParts(
  presetId: LeavePlanPresetId,
  input: CaseInputs,
  plan: CasePlan,
  params: BenefitParams,
): PlannedParentalPart[] {
  const pool = plan.outcome.parental_pool_weeks;
  const maxSingle = plan.outcome.parental_applicant_limit_weeks;
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const daysPerWeek = params.calendar.daysPerWeek;
  const parentalStart = getParentalStartDate(input, plan);

  if (!parentalStart || pool <= 0 || maxSingle <= 0) {
    return [];
  }

  const makePart = (
    parent_role: ApplicantRole,
    start_date: IsoDate,
    weeks: number,
  ): PlannedParentalPart => ({
    parent_role,
    start_date,
    end_date: addDaysIso(start_date, weeks * daysPerWeek - 1),
    work_fraction: 0,
  });

  if (presetId === 'onlyMother') {
    return [makePart('MOTHER', parentalStart, maxSingle)];
  }

  if (presetId === 'onlyFather') {
    return [makePart('FATHER', parentalStart, maxSingle)];
  }

  if (presetId === 'equal') {
    const motherWeeks = Math.min(maxSingle, Math.ceil(pool / 2));
    const fatherWeeks = Math.min(maxSingle, pool - motherWeeks);
    const fatherStart = addDaysIso(parentalStart, motherWeeks * daysPerWeek);
    return [
      makePart('MOTHER', parentalStart, motherWeeks),
      makePart('FATHER', fatherStart, fatherWeeks),
    ];
  }

  if (presetId === 'simultaneous') {
    const fatherWeeks = Math.min(maxSingle, nonTransferable);
    return [
      makePart('MOTHER', parentalStart, maxSingle),
      makePart('FATHER', parentalStart, fatherWeeks),
    ];
  }

  // 'classic': Najpierw mama, potem tata
  const fatherWeeks = Math.min(maxSingle, nonTransferable);
  const fatherStart = addDaysIso(parentalStart, maxSingle * daysPerWeek);
  return [
    makePart('MOTHER', parentalStart, maxSingle),
    makePart('FATHER', fatherStart, fatherWeeks),
  ];
}

function normalizePartsForCompare(
  parts: PlannedParentalPart[],
  fallbackRole: ApplicantRole,
): string {
  return [...parts]
    .map((part) => ({
      role: part.parent_role ?? fallbackRole,
      start: part.start_date,
      end: part.end_date,
      work: part.work_fraction ?? 0,
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.role.localeCompare(b.role))
    .map((p) => `${p.role}:${p.start}:${p.end}:${p.work}`)
    .join('|');
}

export function detectActivePreset(
  parts: PlannedParentalPart[],
  input: CaseInputs,
  plan: CasePlan,
  params: BenefitParams,
): LeavePlanPresetId | null {
  if (!parts.length) return null;
  const currentKey = normalizePartsForCompare(parts, input.applicant_role);
  const presets = getLeavePlanPresets(params);
  for (const preset of presets) {
    const candidate = buildPresetParentalParts(preset.id, input, plan, params);
    if (
      candidate.length > 0 &&
      normalizePartsForCompare(candidate, input.applicant_role) === currentKey
    ) {
      return preset.id;
    }
  }
  return null;
}

export function computeReturnToWorkDates(
  periods: CasePeriod[],
): Record<ApplicantRole, IsoDate | null> {
  const motherEnds = periods
    .filter((p) => p.parent_role === 'MOTHER')
    .map((p) => p.end_date)
    .sort();
  const fatherEnds = periods
    .filter((p) => p.parent_role === 'FATHER')
    .map((p) => p.end_date)
    .sort();

  const lastMotherEnd = motherEnds.at(-1) ?? null;
  const lastFatherEnd = fatherEnds.at(-1) ?? null;

  return {
    MOTHER: lastMotherEnd ? addDaysIso(lastMotherEnd, 1) : null,
    FATHER: lastFatherEnd ? addDaysIso(lastFatherEnd, 1) : null,
  };
}

export interface MergedDateRange {
  startDate: IsoDate;
  endDate: IsoDate;
}

export function mergeParentLeaveRanges(
  periods: CasePeriod[],
  role: ApplicantRole,
): MergedDateRange[] {
  const sorted = periods
    .filter((p) => p.parent_role === role)
    .map((p) => ({ startDate: p.start_date, endDate: p.end_date }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const merged: MergedDateRange[] = [];
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

export function formatParentLeaveSummary(
  role: ApplicantRole,
  periods: CasePeriod[],
  returnDate: IsoDate | null,
  remainingParentalWeeks: number | null,
): string | null {
  const name = getPlainParentLabel(role);
  const ranges = mergeParentLeaveRanges(periods, role);

  if (ranges.length === 0) {
    if (remainingParentalWeeks !== null && remainingParentalWeeks > 0) {
      return `${name}: brak zaplanowanego urlopu (zostało ${remainingParentalWeeks} tyg. rodzicielskiego).`;
    }
    return null;
  }

  const formattedRanges = ranges.map(
    (range) => `od ${formatPolishDate(range.startDate)} do ${formatPolishDate(range.endDate)}`,
  );
  let rangeText: string;
  if (formattedRanges.length === 1) {
    rangeText = formattedRanges[0];
  } else if (formattedRanges.length === 2) {
    rangeText = `${formattedRanges[0]} oraz ${formattedRanges[1]}`;
  } else {
    rangeText = `${formattedRanges.slice(0, -1).join(', ')} oraz ${formattedRanges.at(-1)}`;
  }

  return `${name}: urlop ${rangeText}${returnDate ? `, powrót do pracy ${formatPolishDate(returnDate)}` : ''}.`;
}

export function formatShortDeadlineLabel(label: string): string {
  const trimmed = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!trimmed) return label;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
