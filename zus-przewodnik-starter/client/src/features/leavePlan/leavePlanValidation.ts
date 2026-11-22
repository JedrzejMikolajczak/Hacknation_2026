import type {
  ApplicantRole,
  BenefitParams,
  CaseDocument,
  CaseInputs,
  CasePlan,
  IsoDate,
  PlannedParentalPart,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import { payerLabel } from '../plan/caseLabels';
import {
  addDaysIso,
  addMonthsIso,
  diffDaysIso,
  formatPolishDate,
  formatWorkFraction,
  getEventDate,
  getEventLabel,
  getParentAvailability,
  getPartDays,
  getPlainParentLabel,
  getPreParentalEndDate,
} from './leavePlanHelpers';

export interface LeaveValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  legalBasis: string | null;
}

export interface CalendarMilestone {
  date: IsoDate;
  label: string;
  kind: 'event' | 'deadline';
  description: string;
  legalBasis: string | null;
  isPast: boolean;
  parentRole?: ApplicantRole;
}

const MONTHS_IN_YEAR = 12;

export function getPaternityDeadline(input: CaseInputs, params: BenefitParams): IsoDate | null {
  const event = getEventDate(input);
  if (!event) return null;

  if (input.stage === 'ADOPTION') {
    const monthsDeadline = addDaysIso(
      addMonthsIso(event, params.paternityLeave.adoptionDeadlineMonthsFromAdoption),
      -1,
    );
    const childAge = input.special_circumstances.adopted_or_foster_child_age_years;
    if (childAge !== null) {
      const yearsLeft = Math.max(0, params.paternityLeave.adoptionMaxChildAgeYears - childAge);
      const ageDeadline = addDaysIso(addMonthsIso(event, yearsLeft * MONTHS_IN_YEAR), -1);
      return monthsDeadline <= ageDeadline ? monthsDeadline : ageDeadline;
    }
    return monthsDeadline;
  }

  return addDaysIso(addMonthsIso(event, params.paternityLeave.deadlineChildAgeMonths), -1);
}

function getParentEmploymentType(input: CaseInputs, role: ApplicantRole) {
  return role === input.applicant_role
    ? input.employment_type
    : input.other_parent?.employment_type;
}

function extendedWorkDays(days: number, workFraction: number): number {
  if (workFraction <= 0 || workFraction >= 1) return 0;
  return Math.floor(days / (1 - workFraction)) - days;
}

/**
 * Waliduje plan urlopów na podstawie danych sprawy, wyniku silnika i parametrów z `params`.
 * Zawsze widoczne ostrzeżenia przy naruszeniu reguł Kodeksu pracy (14 tyg. matki,
 * 9 tyg. nieprzenoszalnych, maks. 5 części, granica roku 6. urodzin dziecka,
 * ojcowski w 12 mies., praca ≤ 1/2 etatu) oraz błędy zwrócone przez silnik.
 */
export function validateLeavePlan(
  input: CaseInputs,
  plan: CasePlan,
  parts: PlannedParentalPart[],
  params: BenefitParams,
): LeaveValidationIssue[] {
  const issues: LeaveValidationIssue[] = [];
  const coveredEngineCodes = new Set<string>();
  const eventDate = getEventDate(input);
  const daysPerWeek = params.calendar.daysPerWeek;
  const availability = getParentAvailability(input, plan);

  // 1. Początek urlopu macierzyńskiego przed porodem (maks. 6 tyg.)
  if (
    eventDate &&
    input.stage !== 'ADOPTION' &&
    input.applicant_role === 'MOTHER' &&
    input.maternity_leave_start_date &&
    !input.parental_only
  ) {
    const start = input.maternity_leave_start_date;
    if (start > eventDate) {
      coveredEngineCodes.add('MATERNITY_START');
      issues.push({
        code: 'MATERNITY_AFTER_BIRTH',
        severity: 'error',
        message: `Urlop macierzyński nie może rozpocząć się po dacie porodu (${formatPolishDate(eventDate)}).`,
        legalBasis: 'KP art. 180 § 2',
      });
    } else {
      const daysBefore = diffDaysIso(start, eventDate);
      const maxBeforeDays = params.maternityLeave.maxWeeksBeforeBirth * daysPerWeek;
      if (daysBefore > maxBeforeDays) {
        coveredEngineCodes.add('MATERNITY_START');
        issues.push({
          code: 'MATERNITY_BEFORE_BIRTH_EXCEEDED',
          severity: 'error',
          message: `Przed porodem można wykorzystać maksymalnie ${params.maternityLeave.maxWeeksBeforeBirth} tyg. urlopu macierzyńskiego.`,
          legalBasis: 'KP art. 180 § 2',
        });
      }
    }
  }

  // 2. Przejęcie części macierzyńskiego przez ojca – min. 14 tyg. matki (8 tyg. przy niezdolności)
  if (
    eventDate &&
    input.stage !== 'ADOPTION' &&
    input.applicant_role === 'MOTHER' &&
    input.father_takeover_date &&
    !input.parental_only
  ) {
    const takeover = input.father_takeover_date;
    const mandatoryWeeks = input.special_circumstances.mother_hospitalized_or_incapable
      ? params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate
      : params.maternityLeave.motherMandatoryWeeksAfterBirth;
    const earliestTakeover = addDaysIso(eventDate, mandatoryWeeks * daysPerWeek);

    if (takeover < earliestTakeover) {
      coveredEngineCodes.add('FATHER_TAKEOVER');
      issues.push({
        code: 'MATERNITY_MOTHER_MANDATORY_WEEKS',
        severity: 'error',
        message: input.special_circumstances.mother_hospitalized_or_incapable
          ? `Matka musi wykorzystać co najmniej ${mandatoryWeeks} tyg. urlopu macierzyńskiego po porodzie (przejęcie najwcześniej od ${formatPolishDate(earliestTakeover)}).`
          : `Pierwsze ${mandatoryWeeks} tygodni urlopu macierzyńskiego po porodzie musi wykorzystać osobiście matka (przejęcie przez ojca najwcześniej od ${formatPolishDate(earliestTakeover)}).`,
        legalBasis: input.special_circumstances.mother_hospitalized_or_incapable
          ? 'KP art. 180 § 6'
          : 'KP art. 180 § 4',
      });
    }
    if (!availability.otherInsured) {
      coveredEngineCodes.add('FATHER_TAKEOVER');
      issues.push({
        code: 'FATHER_TAKEOVER_UNINSURED',
        severity: 'error',
        message:
          'Aby ojciec mógł przejąć część urlopu macierzyńskiego, musi podlegać ubezpieczeniu chorobowemu.',
        legalBasis: 'KP art. 180 § 4',
      });
    }
  }

  // 3. Urlop rodzicielski: maks. 5 części, 9 tyg. nieprzenoszalnych, limit puli, granica 6 lat, praca ≤ 1/2
  const poolWeeks = plan.outcome.parental_pool_weeks;
  const individualLimitWeeks = plan.outcome.parental_applicant_limit_weeks;
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const parentalDeadline = plan.outcome.parental_deadline;
  const preParentalEnd = getPreParentalEndDate(plan);
  const earliestParental =
    input.parental_only || input.applicant_role === 'FATHER'
      ? eventDate
      : preParentalEnd
        ? addDaysIso(preParentalEnd, 1)
        : eventDate;

  if (parts.length > params.parentalLeave.maxParts) {
    coveredEngineCodes.add('PARENTAL_PARTS');
    issues.push({
      code: 'PARENTAL_MAX_PARTS',
      severity: 'error',
      message: `Urlop rodzicielski można podzielić maksymalnie na ${params.parentalLeave.maxParts} części (zaplanowano ${parts.length}).`,
      legalBasis: 'KP art. 182¹c § 2',
    });
  }

  const usedDays: Record<ApplicantRole, number> = { MOTHER: 0, FATHER: 0 };
  const lastEndByRole: Partial<Record<ApplicantRole, IsoDate>> = {};

  const sortedParts = [...parts].sort((a, b) => a.start_date.localeCompare(b.start_date));

  for (const part of sortedParts) {
    const role = part.parent_role ?? input.applicant_role;
    const days = getPartDays(part);
    const work = part.work_fraction ?? 0;

    if (
      (role === 'FATHER' && !availability.fatherAvailable) ||
      (role === 'MOTHER' && !availability.motherAvailable)
    ) {
      coveredEngineCodes.add('PARENTAL_INSURANCE');
      issues.push({
        code: 'PARENTAL_UNAVAILABLE_PARENT',
        severity: 'error',
        message: `${getPlainParentLabel(role)} nie ma potwierdzonego ubezpieczenia w tym planie — nie można przypisać tej osobie części urlopu rodzicielskiego.`,
        legalBasis: 'KP art. 182¹a',
      });
    }

    if (days <= 0) {
      coveredEngineCodes.add('PARENTAL_DATES');
      issues.push({
        code: 'PARENTAL_INVALID_RANGE',
        severity: 'error',
        message: `Data końca części (${formatPolishDate(part.end_date)}) nie może być wcześniejsza niż początek (${formatPolishDate(part.start_date)}).`,
        legalBasis: 'KP art. 182¹c',
      });
      continue;
    }

    if (work < 0 || work > params.parentalLeave.maxWorkTimeFraction) {
      coveredEngineCodes.add('PARENTAL_WORK');
      issues.push({
        code: 'PARENTAL_WORK_FRACTION_EXCEEDED',
        severity: 'error',
        message: `Łączenie urlopu rodzicielskiego z pracą jest możliwe maksymalnie do ${formatWorkFraction(params.parentalLeave.maxWorkTimeFraction)} (podano ${formatRate(work)} etatu).`,
        legalBasis: 'KP art. 182¹e § 1',
      });
    } else if (work > 0) {
      const empType = getParentEmploymentType(input, role);
      if (empType && empType !== 'UOP') {
        coveredEngineCodes.add('PARENTAL_WORK');
        issues.push({
          code: 'PARENTAL_WORK_REQUIRES_UOP',
          severity: 'error',
          message: `Łączenie urlopu rodzicielskiego z pracą przysługuje wyłącznie pracownikowi na umowie o pracę (${getPlainParentLabel(role)}).`,
          legalBasis: 'KP art. 182¹e § 1',
        });
      }
    }

    const extraDays =
      work > 0 && work <= params.parentalLeave.maxWorkTimeFraction
        ? extendedWorkDays(days, work)
        : 0;
    const effectiveEnd = addDaysIso(part.end_date, extraDays);

    if (earliestParental && part.start_date < earliestParental) {
      coveredEngineCodes.add('PARENTAL_DATES');
      issues.push({
        code: 'PARENTAL_TOO_EARLY',
        severity: 'error',
        message: `Część urlopu rodzicielskiego (${formatPolishDate(part.start_date)}) nie może rozpocząć się przed ${formatPolishDate(earliestParental)}.`,
        legalBasis: 'KP art. 182¹a',
      });
    }

    if (parentalDeadline && effectiveEnd > parentalDeadline) {
      coveredEngineCodes.add('PARENTAL_DATES');
      coveredEngineCodes.add('PARENTAL_DEADLINE');
      issues.push({
        code: 'PARENTAL_DEADLINE_EXCEEDED',
        severity: 'error',
        message: `Część urlopu rodzicielskiego kończy się ${formatPolishDate(effectiveEnd)}, czyli po końcu roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat (granica: ${formatPolishDate(parentalDeadline)}).`,
        legalBasis: 'KP art. 182¹c § 1',
      });
    }

    const prevEnd = lastEndByRole[role];
    if (prevEnd && part.start_date <= prevEnd) {
      coveredEngineCodes.add('PARENTAL_DATES');
      issues.push({
        code: 'PARENTAL_SAME_PARENT_OVERLAP',
        severity: 'error',
        message: `Części urlopu rodzicielskiego tego samego rodzica (${getPlainParentLabel(role)}) nie mogą się nakładać.`,
        legalBasis: 'KP art. 182¹c',
      });
    }

    lastEndByRole[role] = effectiveEnd;
    usedDays[role] += days;
  }

  if (poolWeeks > 0) {
    const limitDays = individualLimitWeeks * daysPerWeek;
    const poolDays = poolWeeks * daysPerWeek;

    if (usedDays.MOTHER > limitDays) {
      coveredEngineCodes.add('PARENTAL_POOL');
      const motherWeeks = Math.round((usedDays.MOTHER / daysPerWeek) * 10) / 10;
      issues.push({
        code: 'PARENTAL_MOTHER_NON_TRANSFERABLE',
        severity: 'error',
        message: `Matka może wykorzystać maksymalnie ${individualLimitWeeks} tyg. urlopu rodzicielskiego (zaplanowano ${motherWeeks} tyg.). Pozostałe ${nonTransferable} tyg. jest nieprzenoszalne dla drugiego rodzica.`,
        legalBasis: 'KP art. 182¹a § 4',
      });
    }

    if (usedDays.FATHER > limitDays) {
      coveredEngineCodes.add('PARENTAL_POOL');
      const fatherWeeks = Math.round((usedDays.FATHER / daysPerWeek) * 10) / 10;
      issues.push({
        code: 'PARENTAL_FATHER_NON_TRANSFERABLE',
        severity: 'error',
        message: `Ojciec może wykorzystać maksymalnie ${individualLimitWeeks} tyg. urlopu rodzicielskiego (zaplanowano ${fatherWeeks} tyg.). Pozostałe ${nonTransferable} tyg. jest nieprzenoszalne dla drugiego rodzica.`,
        legalBasis: 'KP art. 182¹a § 4',
      });
    }

    if (usedDays.MOTHER + usedDays.FATHER > poolDays) {
      coveredEngineCodes.add('PARENTAL_POOL');
      const totalWeeks = Math.round(((usedDays.MOTHER + usedDays.FATHER) / daysPerWeek) * 10) / 10;
      issues.push({
        code: 'PARENTAL_POOL_EXCEEDED',
        severity: 'error',
        message: `Łączny wymiar urlopu rodzicielskiego (${totalWeeks} tyg.) przekracza wspólną pulę ${poolWeeks} tyg.`,
        legalBasis: 'KP art. 182¹a § 1',
      });
    }
  }

  // 4. Urlop ojcowski w ciągu 12 miesięcy od porodu / adopcji
  if (input.paternity_leave_start_date) {
    const patStart = input.paternity_leave_start_date;
    const patEnd = addDaysIso(patStart, params.paternityLeave.weeks * daysPerWeek - 1);
    const patDeadline = getPaternityDeadline(input, params);

    if (eventDate && patStart < eventDate) {
      coveredEngineCodes.add('PATERNITY_DATES');
      issues.push({
        code: 'PATERNITY_BEFORE_EVENT',
        severity: 'error',
        message: `Urlop ojcowski (${formatPolishDate(patStart)}) nie może rozpocząć się przed ${input.stage === 'ADOPTION' ? 'datą przyjęcia dziecka' : 'datą porodu'} (${formatPolishDate(eventDate)}).`,
        legalBasis: 'KP art. 182³ § 1',
      });
    }

    if (patDeadline && patEnd > patDeadline) {
      coveredEngineCodes.add('PATERNITY_DATES');
      issues.push({
        code: 'PATERNITY_DEADLINE_EXCEEDED',
        severity: 'error',
        message:
          input.stage === 'ADOPTION'
            ? `Urlop ojcowski kończy się ${formatPolishDate(patEnd)}, czyli po upływie ${params.paternityLeave.adoptionDeadlineMonthsFromAdoption} mies. od przyjęcia dziecka lub po ukończeniu przez dziecko ${params.paternityLeave.adoptionMaxChildAgeYears} lat (granica: ${formatPolishDate(patDeadline)}).`
            : `Urlop ojcowski kończy się ${formatPolishDate(patEnd)}, czyli po ukończeniu przez dziecko ${params.paternityLeave.deadlineChildAgeMonths} miesięcy życia (granica: ${formatPolishDate(patDeadline)}).`,
        legalBasis: 'KP art. 182³ § 1',
      });
    }

    if (!availability.fatherAvailable) {
      coveredEngineCodes.add('PATERNITY_DATES');
      issues.push({
        code: 'PATERNITY_UNINSURED',
        severity: 'error',
        message:
          'Urlop ojcowski przysługuje wyłącznie ojcu podlegającemu ubezpieczeniu chorobowemu.',
        legalBasis: 'KP art. 182³ § 1',
      });
    }
  }

  // 5. Dołączenie pozostałych błędów zwróconych przez silnik (bez dublowania)
  const seenMessages = new Set(issues.map((item) => item.message));
  for (const engineError of plan.validation_errors) {
    if (coveredEngineCodes.has(engineError.code)) continue;
    if (seenMessages.has(engineError.message_pl)) continue;
    seenMessages.add(engineError.message_pl);
    issues.push({
      code: engineError.code,
      severity: 'error',
      message: engineError.message_pl,
      legalBasis: engineError.legal_basis,
    });
  }

  return issues;
}

function buildDocumentMilestoneDescription(doc: CaseDocument): string {
  const parts: string[] = [];
  if (doc.start_date && doc.end_date) {
    parts.push(`Okres: ${formatPolishDate(doc.start_date)}–${formatPolishDate(doc.end_date)}.`);
  }
  if (doc.submit_to) {
    parts.push(`Złóż do: ${payerLabel(doc.submit_to)}.`);
  }
  return parts.join(' ') || doc.name_pl;
}

export function buildCalendarMilestones(
  input: CaseInputs,
  plan: CasePlan,
  returnDates: Record<ApplicantRole, IsoDate | null>,
): CalendarMilestone[] {
  const milestones: CalendarMilestone[] = [];
  const eventDate = getEventDate(input);

  if (eventDate) {
    milestones.push({
      date: eventDate,
      label: getEventLabel(input),
      kind: 'event',
      description:
        input.stage === 'ADOPTION'
          ? 'Początek uprawnień do urlopu na warunkach urlopu macierzyńskiego.'
          : 'Dzień porodu – początek urlopu macierzyńskiego po porodzie.',
      legalBasis: input.stage === 'ADOPTION' ? 'KP art. 183 § 1' : 'KP art. 180 § 1',
      isPast: false,
    });
  }

  if (
    eventDate &&
    input.stage !== 'ADOPTION' &&
    input.maternity_leave_start_date &&
    input.maternity_leave_start_date < eventDate
  ) {
    milestones.push({
      date: input.maternity_leave_start_date,
      label: 'Start urlopu macierzyńskiego przed porodem',
      kind: 'event',
      description: 'Rozpoczęcie urlopu macierzyńskiego przed przewidywaną datą porodu.',
      legalBasis: 'KP art. 180 § 2',
      isPast: false,
    });
  }

  for (const doc of plan.documents) {
    if (!doc.deadline) continue;
    const roleTag = getPlainParentLabel(doc.parent_role);
    milestones.push({
      date: doc.deadline,
      label: `${doc.name_pl} (${roleTag})`,
      kind: 'deadline',
      description: buildDocumentMilestoneDescription(doc),
      legalBasis: doc.legal_basis || null,
      isPast: doc.is_overdue,
      parentRole: doc.parent_role,
    });
  }

  for (const role of ['MOTHER', 'FATHER'] as const) {
    const returnDate = returnDates[role];
    if (!returnDate) continue;
    milestones.push({
      date: returnDate,
      label: `Powrót do pracy (${getPlainParentLabel(role)})`,
      kind: 'event',
      description: `Pierwszy dzień po zakończeniu zaplanowanych okresów urlopu (${getPlainParentLabel(role)}).`,
      legalBasis: null,
      isPast: false,
      parentRole: role,
    });
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}
