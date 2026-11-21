import type {
  BenefitParams,
  IsoDate,
  LeavePartRequest,
  LeavePeriod,
  MaternityCalculationResult,
  ParentalWithWorkResult,
  ParentRole,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../app/benefitParams';
import {
  addDaysIso,
  addMonthsIso,
  DAYS_IN_WEEK,
  formatIsoPl,
  getAnchorDate,
  getAnchorEventLabel,
  getParentalPoolSummary,
  isSingleChildLoss,
} from './leavePlanHelpers';

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  legalBasis: string | null;
}

export interface MaternityPlanOptions {
  weeksBeforeBirth: number;
  transferToFather: boolean;
  motherWeeksAfterBirth: number;
  supplementaryParent: ParentRole;
}

export interface PaternityPartPlan {
  startDate: IsoDate;
  weeks: number;
}

export interface SupplementaryPlanCheck {
  partsCount: number;
  hasGapAfterMaternity: boolean;
  usedByBothParents: boolean;
}

export interface TimelineMilestone {
  date: IsoDate;
  label: string;
  kind: 'event' | 'deadline';
  description: string;
  legalBasis: string | null;
  isPast: boolean;
}

/**
 * Maksymalny wiek dziecka przy urlopie na warunkach macierzyńskiego / rodzicielskim dla adopcji lub pieczy zastępczej.
 */
export function getAdoptionMaxChildAgeYears(
  scenario: ScenarioInput,
  params: BenefitParams,
): number {
  if (scenario.adoptionType === 'fosterFamily') {
    return scenario.schoolObligationDeferred
      ? params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYearsDeferredSchool
      : params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYears;
  }
  return params.adoptionMaternityLeave.adoptionMaxChildAgeYears;
}

/**
 * Graniczna data wykorzystania urlopu rodzicielskiego:
 * – przy urodzeniu: koniec roku kalendarzowego, w którym dziecko kończy `deadlineChildTurnsAgeYears` lat;
 * – przy adopcji / pieczy zastępczej: z uwzględnieniem maksymalnego wieku dziecka z `params.adoptionMaternityLeave`.
 */
export function getParentalDeadlineDate(
  scenario: ScenarioInput,
  params: BenefitParams,
): IsoDate | null {
  const anchorDate = getAnchorDate(scenario);
  if (!anchorDate) return null;

  const anchorYear = Number(anchorDate.slice(0, 4));
  if (scenario.situation === 'adoption') {
    const maxAge = getAdoptionMaxChildAgeYears(scenario, params);
    const currentAge = scenario.childAgeYears ?? 0;
    const yearsLeft = Math.max(0, maxAge - currentAge);
    return `${anchorYear + yearsLeft}-12-31`;
  }

  return `${anchorYear + params.parentalLeave.deadlineChildTurnsAgeYears}-12-31`;
}

const MONTHS_IN_YEAR = 12;

/**
 * Graniczna data wykorzystania urlopu ojcowskiego:
 * – przy urodzeniu: do ukończenia przez dziecko `deadlineChildAgeMonths` mies. życia;
 * – przy adopcji: w ciągu `adoptionDeadlineMonthsFromAdoption` mies. od przyjęcia, ale nie dłużej niż do `adoptionMaxChildAgeYears` r.ż.
 */
export function getPaternityDeadlineDate(
  scenario: ScenarioInput,
  params: BenefitParams,
): IsoDate | null {
  const anchorDate = getAnchorDate(scenario);
  if (!anchorDate) return null;

  if (scenario.situation === 'adoption') {
    const monthsDeadline = addMonthsIso(
      anchorDate,
      params.paternityLeave.adoptionDeadlineMonthsFromAdoption,
    );
    if (scenario.childAgeYears !== null) {
      const yearsUntilMax = Math.max(
        0,
        params.paternityLeave.adoptionMaxChildAgeYears - scenario.childAgeYears,
      );
      const ageDeadline = addMonthsIso(anchorDate, yearsUntilMax * MONTHS_IN_YEAR);
      return monthsDeadline <= ageDeadline ? monthsDeadline : ageDeadline;
    }
    return monthsDeadline;
  }

  return addMonthsIso(anchorDate, params.paternityLeave.deadlineChildAgeMonths);
}

/**
 * Walidacja limitów wieku dziecka w adopcji i rodzinie zastępczej niezawodowej.
 */
export function validateAdoptionAgeLimits(
  scenario: ScenarioInput,
  params: BenefitParams,
): ValidationIssue[] {
  if (scenario.situation !== 'adoption') return [];
  const issues: ValidationIssue[] = [];

  if (scenario.childAgeYears === null) return issues;

  const maxAge = getAdoptionMaxChildAgeYears(scenario, params);
  if (scenario.childAgeYears >= maxAge) {
    const roleDesc =
      scenario.adoptionType === 'fosterFamily'
        ? scenario.schoolObligationDeferred
          ? `rodzinie zastępczej (przy odroczeniu obowiązku szkolnego: do ${maxAge} lat)`
          : `rodzinie zastępczej niezawodowej (do ${maxAge} lat)`
        : `przysposobieniu (do ${maxAge} lat)`;
    issues.push({
      code: 'ADOPTION_CHILD_AGE_EXCEEDED',
      severity: 'error',
      message: `Wiek dziecka (${scenario.childAgeYears} lat) osiąga lub przekracza limit ustawowy w ${roleDesc}. Urlop na warunkach urlopu macierzyńskiego i rodzicielski nie przysługują po ukończeniu tego wieku.`,
      legalBasis: 'KP art. 183 § 1',
    });
  }

  return issues;
}

/**
 * Walidacja zasad urlopu macierzyńskiego:
 * – do `maxWeeksBeforeBirth` tyg. przed przewidywaną datą porodu,
 * – pierwsze `motherMandatoryWeeksAfterBirth` tyg. po porodzie tylko dla matki
 *   (wcześniejsze przejęcie przez ojca dopuszczalne w sytuacjach szczególnych z `scenario.special`:
 *    hospitalizacja matki, niezdolność do samodzielnej egzystencji, zgon matki),
 * – martwe urodzenie / zgon dziecka → skrócony urlop wg wyniku silnika.
 */
export function validateMaternityOptions(
  scenario: ScenarioInput,
  maternity: MaternityCalculationResult,
  options: MaternityPlanOptions,
  params: BenefitParams,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isSingleChildLoss(scenario)) {
    const maternityPeriod = maternity.periods.find((p) => p.leaveType === 'maternityLeave');
    issues.push({
      code: 'CHILD_LOSS_SHORTENED_MATERNITY',
      severity: 'warning',
      message: maternityPeriod
        ? `W tej sytuacji przysługuje skrócony urlop macierzyński (${maternityPeriod.days} dni: ${formatIsoPl(maternityPeriod.startDate)} – ${formatIsoPl(maternityPeriod.endDate)}). Urlop rodzicielski nie przysługuje.`
        : `W przypadku martwego urodzenia lub zgonu dziecka przed upływem ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia przysługuje ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tyg. urlopu macierzyńskiego po porodzie (nie krócej niż ${params.childDeath.minDaysAfterDeath} dni od dnia zgonu), bez urlopu rodzicielskiego.`,
      legalBasis: 'KP art. 180¹',
    });
    return issues;
  }

  if (scenario.situation !== 'adoption') {
    if (options.weeksBeforeBirth < 0) {
      issues.push({
        code: 'MATERNITY_BEFORE_BIRTH_NEGATIVE',
        severity: 'error',
        message: 'Liczba tygodni urlopu macierzyńskiego przed porodem nie może być ujemna.',
        legalBasis: 'KP art. 180 § 2',
      });
    } else if (options.weeksBeforeBirth > params.maternityLeave.maxWeeksBeforeBirth) {
      issues.push({
        code: 'MATERNITY_BEFORE_BIRTH_EXCEEDED',
        severity: 'error',
        message: `Przed przewidywaną datą porodu można wykorzystać maksymalnie ${params.maternityLeave.maxWeeksBeforeBirth} tyg. urlopu macierzyńskiego (wybrano ${options.weeksBeforeBirth} tyg.).`,
        legalBasis: 'KP art. 180 § 2',
      });
    }
  }

  if (options.transferToFather && scenario.situation !== 'adoption') {
    if (!scenario.father) {
      issues.push({
        code: 'MATERNITY_TRANSFER_NO_FATHER',
        severity: 'error',
        message:
          'Aby ojciec mógł przejąć część urlopu macierzyńskiego, w planie musi być uwzględniony drugi rodzic.',
        legalBasis: 'KP art. 180 § 4',
      });
    } else {
      const mandatoryWeeks = params.maternityLeave.motherMandatoryWeeksAfterBirth;
      const incapacityMinWeeks =
        params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate;
      const maternityPeriod = maternity.periods.find((p) => p.leaveType === 'maternityLeave');
      const totalMaternityWeeks = maternityPeriod?.weeks ?? null;

      if (scenario.special.motherDeceased) {
        // Zgon matki – ojciec może przejąć całość pozostałego urlopu natychmiast
      } else if (scenario.special.motherHospitalized) {
        // Hospitalizacja matki – ojciec może przejąć urlop na okres pobytu matki w szpitalu
        if (options.motherWeeksAfterBirth < mandatoryWeeks) {
          issues.push({
            code: 'MATERNITY_TRANSFER_HOSPITALIZED_INFO',
            severity: 'warning',
            message: `Ze względu na pobyt matki w szpitalu ojciec może przejąć część urlopu macierzyńskiego na czas tej hospitalizacji także wcześniej niż po ${mandatoryWeeks} tygodniach (po wykorzystaniu przez matkę ${incapacityMinWeeks} tygodni po porodzie lub na okres pobytu w szpitalu).`,
            legalBasis: 'KP art. 180 § 10',
          });
        }
      } else if (scenario.special.motherIncapableOfIndependentLiving) {
        if (options.motherWeeksAfterBirth < incapacityMinWeeks) {
          issues.push({
            code: 'MATERNITY_TRANSFER_INCAPACITY_MIN',
            severity: 'error',
            message: `Przy orzeczeniu o niezdolności matki do samodzielnej egzystencji matka musi wykorzystać co najmniej ${incapacityMinWeeks} tyg. urlopu po porodzie, zanim ojciec przejmie pozostałą część.`,
            legalBasis: 'KP art. 180 § 6',
          });
        }
      } else if (options.motherWeeksAfterBirth < mandatoryWeeks) {
        issues.push({
          code: 'MATERNITY_MOTHER_MANDATORY_14_WEEKS',
          severity: 'error',
          message: `Pierwsze ${mandatoryWeeks} tygodni urlopu macierzyńskiego po porodzie musi wykorzystać osobiście matka (podano ${options.motherWeeksAfterBirth} tyg.). Wcześniejsze przejęcie przez ojca jest możliwe tylko w szczególnych sytuacjach (hospitalizacja matki, orzeczenie o niezdolności do samodzielnej egzystencji lub zgon matki).`,
          legalBasis: 'KP art. 180 § 4',
        });
      }

      if (totalMaternityWeeks !== null && options.motherWeeksAfterBirth >= totalMaternityWeeks) {
        issues.push({
          code: 'MATERNITY_TRANSFER_NOTHING_LEFT',
          severity: 'warning',
          message: `Matka wykorzystuje cały wymiar urlopu macierzyńskiego (${totalMaternityWeeks} tyg.), więc dla ojca nie pozostaje żadna część do przejęcia.`,
          legalBasis: 'KP art. 180 § 4',
        });
      }
    }
  }

  return issues;
}

/**
 * Walidacja uzupełniającego urlopu macierzyńskiego:
 * – wyłącznie 1 część (bez możliwości dzielenia),
 * – bezpośrednio po urlopie macierzyńskim,
 * – dla matki ALBO ojca (nie jednocześnie dla obojga).
 */
export function validateSupplementaryLeave(
  check: SupplementaryPlanCheck,
  scenario: ScenarioInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (check.partsCount > 1) {
    issues.push({
      code: 'SUPPLEMENTARY_SINGLE_PART_ONLY',
      severity: 'error',
      message:
        'Uzupełniający urlop macierzyński jest udzielany jednorazowo w jednej części – nie można go dzielić.',
      legalBasis: 'KP art. 180² § 4',
    });
  }

  if (check.hasGapAfterMaternity) {
    issues.push({
      code: 'SUPPLEMENTARY_MUST_FOLLOW_MATERNITY',
      severity: 'error',
      message:
        'Uzupełniający urlop macierzyński musi rozpocząć się bezpośrednio po zakończeniu urlopu macierzyńskiego.',
      legalBasis: 'KP art. 180² § 4',
    });
  }

  if (check.usedByBothParents) {
    issues.push({
      code: 'SUPPLEMENTARY_ONE_PARENT_ONLY',
      severity: 'error',
      message:
        'Z uzupełniającego urlopu macierzyńskiego może skorzystać tylko jedno z rodziców – matka albo ojciec.',
      legalBasis: 'KP art. 180² § 1',
    });
  }

  if (check.partsCount > 0 && !scenario.father && check.usedByBothParents) {
    issues.push({
      code: 'SUPPLEMENTARY_NO_FATHER',
      severity: 'error',
      message: 'Drugi rodzic nie jest uwzględniony w planie.',
      legalBasis: 'KP art. 180² § 1',
    });
  }

  return issues;
}

/**
 * Walidacja urlopu ojcowskiego:
 * – max `weeks` (2) tyg.,
 * – w całości albo w max `maxParts` (2) częściach po min. `minPartWeeks` (1) tyg.,
 * – do ukończenia `deadlineChildAgeMonths` (12) mies. życia dziecka
 *   (przy adopcji: w ciągu `adoptionDeadlineMonthsFromAdoption` mies. i przed ukończeniem `adoptionMaxChildAgeYears` lat).
 */
export function validatePaternityPlan(
  scenario: ScenarioInput,
  paternityParts: PaternityPartPlan[],
  params: BenefitParams,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (paternityParts.length === 0) return issues;

  if (!scenario.father) {
    issues.push({
      code: 'PATERNITY_NO_FATHER',
      severity: 'error',
      message: 'Urlop ojcowski jest wyłącznym prawem ojca dziecka.',
      legalBasis: 'KP art. 182³ § 1',
    });
    return issues;
  }

  if (isSingleChildLoss(scenario)) {
    issues.push({
      code: 'PATERNITY_CHILD_LOSS',
      severity: 'error',
      message: 'W tej sytuacji urlop ojcowski nie przysługuje.',
      legalBasis: 'KP art. 182³ § 1',
    });
    return issues;
  }

  if (
    scenario.situation === 'adoption' &&
    scenario.childAgeYears !== null &&
    scenario.childAgeYears >= params.paternityLeave.adoptionMaxChildAgeYears
  ) {
    issues.push({
      code: 'PATERNITY_ADOPTION_AGE_EXCEEDED',
      severity: 'error',
      message: `Przy adopcji urlop ojcowski przysługuje wyłącznie do ukończenia przez dziecko ${params.paternityLeave.adoptionMaxChildAgeYears} roku życia (wiek dziecka: ${scenario.childAgeYears} lat).`,
      legalBasis: 'KP art. 182³ § 1 pkt 2',
    });
  }

  if (paternityParts.length > params.paternityLeave.maxParts) {
    issues.push({
      code: 'PATERNITY_MAX_PARTS',
      severity: 'error',
      message: `Urlop ojcowski można wykorzystać w całości lub maksymalnie w ${params.paternityLeave.maxParts} częściach (zaplanowano ${paternityParts.length}).`,
      legalBasis: 'KP art. 182³ § 1¹',
    });
  }

  const totalWeeks = paternityParts.reduce((sum, part) => sum + part.weeks, 0);
  if (totalWeeks > params.paternityLeave.weeks) {
    issues.push({
      code: 'PATERNITY_MAX_WEEKS',
      severity: 'error',
      message: `Wymiar urlopu ojcowskiego wynosi maksymalnie ${params.paternityLeave.weeks} tyg. (zaplanowano ${totalWeeks} tyg.).`,
      legalBasis: 'KP art. 182³ § 1',
    });
  }

  const anchorDate = getAnchorDate(scenario);
  const deadline = getPaternityDeadlineDate(scenario, params);

  for (const part of paternityParts) {
    if (part.weeks < params.paternityLeave.minPartWeeks) {
      issues.push({
        code: 'PATERNITY_MIN_PART_WEEKS',
        severity: 'error',
        message: `Żadna część urlopu ojcowskiego nie może być krótsza niż ${params.paternityLeave.minPartWeeks} tydzień.`,
        legalBasis: 'KP art. 182³ § 1¹',
      });
    }

    if (anchorDate && part.startDate < anchorDate) {
      issues.push({
        code: 'PATERNITY_BEFORE_EVENT',
        severity: 'error',
        message: `Urlop ojcowski (${formatIsoPl(part.startDate)}) nie może rozpocząć się przed ${scenario.situation === 'adoption' ? 'datą przyjęcia dziecka' : 'datą porodu'} (${formatIsoPl(anchorDate)}).`,
        legalBasis: 'KP art. 182³ § 1',
      });
    }

    const endDate = addDaysIso(part.startDate, part.weeks * DAYS_IN_WEEK - 1);
    if (deadline && endDate > deadline) {
      issues.push({
        code: 'PATERNITY_DEADLINE_EXCEEDED',
        severity: 'error',
        message:
          scenario.situation === 'adoption'
            ? `Urlop ojcowski kończy się ${formatIsoPl(endDate)}, czyli po upływie ${params.paternityLeave.adoptionDeadlineMonthsFromAdoption} mies. od przyjęcia dziecka lub po ukończeniu przez dziecko ${params.paternityLeave.adoptionMaxChildAgeYears} lat (granica: ${formatIsoPl(deadline)}).`
            : `Urlop ojcowski kończy się ${formatIsoPl(endDate)}, czyli po ukończeniu przez dziecko ${params.paternityLeave.deadlineChildAgeMonths} miesięcy życia (granica: ${formatIsoPl(deadline)}).`,
        legalBasis: 'KP art. 182³ § 1',
      });
    }
  }

  return issues;
}

/**
 * Walidacja urlopu rodzicielskiego i łączenia go z pracą:
 * – brak urlopu rodzicielskiego po śmierci jedynego dziecka,
 * – pula 41/43 tyg. (65/67 z „Za życiem”),
 * – 9 tyg. nieprzenoszalnych na każdego rodzica,
 * – max 5 części,
 * – wykorzystanie do końca roku kalendarzowego, w którym dziecko kończy 6 lat (lub limit wieku adopcji),
 * – rodzice mogą korzystać jednocześnie lub naprzemiennie (nakładanie M + O jest dozwolone!),
 * – łączenie z pracą wyłącznie ≤ maxWorkTimeFraction (0,5 etatu).
 */
export function validateParentalParts(
  scenario: ScenarioInput,
  parts: LeavePartRequest[],
  workByPartIndex: Record<number, number>,
  withWorkResults: Record<number, ParentalWithWorkResult>,
  params: BenefitParams,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parentalParts = parts.filter((part) => part.leaveType === 'parentalLeave');

  if (isSingleChildLoss(scenario)) {
    if (parentalParts.length > 0) {
      issues.push({
        code: 'PARENTAL_NOT_ALLOWED_CHILD_LOSS',
        severity: 'error',
        message:
          'Po stracie jedynego dziecka urlop rodzicielski nie przysługuje. Przysługuje wyłącznie skrócony urlop macierzyński.',
        legalBasis: 'KP art. 180¹',
      });
    }
    return issues;
  }

  issues.push(...validateAdoptionAgeLimits(scenario, params));

  const pool = getParentalPoolSummary(scenario, params);

  if (parentalParts.length > params.parentalLeave.maxParts) {
    issues.push({
      code: 'PARENTAL_MAX_PARTS',
      severity: 'error',
      message: `Urlop rodzicielski można podzielić maksymalnie na ${params.parentalLeave.maxParts} części (zaplanowano ${parentalParts.length}).`,
      legalBasis: 'KP art. 182¹c § 2',
    });
  }

  const motherWeeks = parentalParts
    .filter((p) => p.parentRole === 'mother')
    .reduce((sum, p) => sum + p.weeks, 0);
  const fatherWeeks = parentalParts
    .filter((p) => p.parentRole === 'father')
    .reduce((sum, p) => sum + p.weeks, 0);
  const totalWeeks = motherWeeks + fatherWeeks;

  if (totalWeeks > pool.totalWeeks) {
    issues.push({
      code: 'PARENTAL_POOL_EXCEEDED',
      severity: 'error',
      message: `Łączny wymiar urlopu rodzicielskiego (${totalWeeks} tyg.) przekracza dostępną pulę ${pool.totalWeeks} tyg.`,
      legalBasis: 'KP art. 182¹a § 1',
    });
  }

  if (motherWeeks > pool.maxSingleParentWeeks) {
    issues.push({
      code: 'PARENTAL_MOTHER_NON_TRANSFERABLE',
      severity: 'error',
      message: `Matka może wykorzystać maksymalnie ${pool.maxSingleParentWeeks} tyg. urlopu rodzicielskiego (${motherWeeks} tyg. zaplanowano). Pozostałe ${pool.nonTransferable} tyg. jest nieprzenoszalne dla drugiego rodzica.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  if (fatherWeeks > pool.maxSingleParentWeeks) {
    issues.push({
      code: 'PARENTAL_FATHER_NON_TRANSFERABLE',
      severity: 'error',
      message: `Ojciec może wykorzystać maksymalnie ${pool.maxSingleParentWeeks} tyg. urlopu rodzicielskiego (${fatherWeeks} tyg. zaplanowano). Pozostałe ${pool.nonTransferable} tyg. jest nieprzenoszalne dla matki.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }

  const anchorDate = getAnchorDate(scenario);
  const parentalDeadline = getParentalDeadlineDate(scenario, params);

  parts.forEach((part, index) => {
    if (part.leaveType !== 'parentalLeave') return;

    if (part.weeks < 1) {
      issues.push({
        code: 'PARENTAL_MIN_WEEKS',
        severity: 'error',
        message: 'Każda część urlopu rodzicielskiego musi trwać co najmniej 1 tydzień.',
        legalBasis: 'KP art. 182¹c',
      });
    }

    if (anchorDate && part.startDate < anchorDate) {
      issues.push({
        code: 'PARENTAL_BEFORE_EVENT',
        severity: 'error',
        message: `Część urlopu rodzicielskiego (${formatIsoPl(part.startDate)}) nie może zaczynać się przed ${scenario.situation === 'adoption' ? 'datą przyjęcia dziecka' : 'datą porodu'} (${formatIsoPl(anchorDate)}).`,
        legalBasis: 'KP art. 182¹a',
      });
    }

    const workFraction = workByPartIndex[index];
    if (workFraction !== undefined) {
      if (workFraction <= 0 || workFraction > params.parentalLeave.maxWorkTimeFraction) {
        issues.push({
          code: 'PARENTAL_WORK_FRACTION_EXCEEDED',
          severity: 'error',
          message: `Łączenie urlopu rodzicielskiego z pracą jest możliwe maksymalnie do ${formatRate(params.parentalLeave.maxWorkTimeFraction)} etatu (podano ${formatRate(workFraction)}).`,
          legalBasis: 'KP art. 182¹e § 1',
        });
      }
    }

    const workRes = withWorkResults[index];
    const effectiveEndDate =
      workRes && workRes.periods.length > 0
        ? workRes.periods[workRes.periods.length - 1].endDate
        : addDaysIso(part.startDate, part.weeks * DAYS_IN_WEEK - 1);

    if (parentalDeadline && effectiveEndDate > parentalDeadline) {
      issues.push({
        code: 'PARENTAL_DEADLINE_EXCEEDED',
        severity: 'error',
        message:
          scenario.situation === 'adoption'
            ? `Część urlopu rodzicielskiego kończy się ${formatIsoPl(effectiveEndDate)}, co przekracza graniczną datę dla wieku dziecka (${formatIsoPl(parentalDeadline)}).`
            : `Część urlopu rodzicielskiego kończy się ${formatIsoPl(effectiveEndDate)}, czyli po końcu roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat (granica: ${formatIsoPl(parentalDeadline)}).`,
        legalBasis: 'KP art. 182¹c § 1',
      });
    }
  });

  return issues;
}

/**
 * Buduje kamienie milowe i terminy złożenia wniosków na oś czasu oraz kalendarz miesięczny.
 * Każdy termin ma flagę `isPast` względem `scenario.referenceDate`.
 */
export function buildMilestones(
  scenario: ScenarioInput,
  periods: LeavePeriod[],
  maternityOptions: MaternityPlanOptions,
  params: BenefitParams,
): TimelineMilestone[] {
  const anchorDate = getAnchorDate(scenario);
  if (!anchorDate) return [];

  const referenceDate = scenario.referenceDate;
  const list: TimelineMilestone[] = [
    {
      date: anchorDate,
      label: getAnchorEventLabel(scenario),
      kind: 'event',
      description:
        scenario.situation === 'adoption'
          ? 'Początek uprawnień do urlopu na warunkach urlopu macierzyńskiego.'
          : 'Dzień porodu – początek urlopu macierzyńskiego po porodzie.',
      legalBasis: scenario.situation === 'adoption' ? 'KP art. 183 § 1' : 'KP art. 180 § 1',
      isPast: false,
    },
  ];

  if (
    scenario.situation !== 'adoption' &&
    maternityOptions.weeksBeforeBirth > 0 &&
    maternityOptions.weeksBeforeBirth <= params.maternityLeave.maxWeeksBeforeBirth
  ) {
    const preBirthStart = addDaysIso(anchorDate, -maternityOptions.weeksBeforeBirth * DAYS_IN_WEEK);
    list.push({
      date: preBirthStart,
      label: `Start urlopu macierzyńskiego przed porodem (${maternityOptions.weeksBeforeBirth} tyg.)`,
      kind: 'event',
      description: `Planowane rozpoczęcie urlopu macierzyńskiego przed przewidywaną datą porodu (wymagane zaświadczenie lekarskie o przewidywanej dacie porodu; maks. ${params.maternityLeave.maxWeeksBeforeBirth} tyg.).`,
      legalBasis: 'KP art. 180 § 2',
      isPast: false,
    });
  }

  if (isSingleChildLoss(scenario)) {
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Termin wniosku o 81,5% (do 21 dni po porodzie / przyjęciu dziecka)
  if (scenario.rateVariant === 'combined') {
    const combinedDeadline = addDaysIso(anchorDate, params.combinedRateApplicationDeadlineDays);
    list.push({
      date: combinedDeadline,
      label: `Wniosek o ${formatRate(params.rates.combined)} za cały okres (do ${params.combinedRateApplicationDeadlineDays} dni)`,
      kind: 'deadline',
      description: `Ostatni dzień na złożenie wniosku (u pracodawcy albo do ZUS na druku ZAM) o jednolitą stawkę ${formatRate(params.rates.combined)}. Nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica zawsze wynosi ${formatRate(params.rates.secondParentNonTransferableInCombined)}.`,
      legalBasis: 'Ustawa zasiłkowa art. 30a',
      isPast: combinedDeadline < referenceDate,
    });
  }

  // Termin wniosku przy rodzinie zastępczej (7 dni od przyjęcia)
  if (scenario.situation === 'adoption' && scenario.adoptionType === 'fosterFamily') {
    const fosterDeadline = addDaysIso(
      anchorDate,
      params.applicationDeadlinesDays.fosterFamilyAfterAcceptance,
    );
    list.push({
      date: fosterDeadline,
      label: `Wniosek o urlop dla rodziny zastępczej (do ${params.applicationDeadlinesDays.fosterFamilyAfterAcceptance} dni od przyjęcia)`,
      kind: 'deadline',
      description: `Termin na złożenie wniosku o urlop na warunkach urlopu macierzyńskiego dla rodziny zastępczej niezawodowej.`,
      legalBasis: 'KP art. 183',
      isPast: fosterDeadline < referenceDate,
    });
  }

  // Termin wniosku o uzupełniający urlop macierzyński (21 dni przed końcem macierzyńskiego)
  const supplementaryPeriod = periods.find((p) => p.leaveType === 'supplementaryMaternityLeave');
  if (supplementaryPeriod) {
    const suppDeadline = addDaysIso(
      supplementaryPeriod.startDate,
      -params.applicationDeadlinesDays.supplementaryMaternityLeave,
    );
    list.push({
      date: suppDeadline,
      label: `Wniosek o uzupełniający urlop macierzyński (${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed startem)`,
      kind: 'deadline',
      description:
        'Najpóźniejszy termin na złożenie wniosku wraz z zaświadczeniem ze szpitala o okresie hospitalizacji, tygodniu ciąży i masie urodzeniowej dziecka.',
      legalBasis: 'KP art. 180² § 5',
      isPast: suppDeadline < referenceDate,
    });
  }

  // Terminy przy przejęciu części macierzyńskiego przez ojca
  if (maternityOptions.transferToFather && scenario.father && scenario.situation !== 'adoption') {
    const takeoverStart = addDaysIso(
      anchorDate,
      maternityOptions.motherWeeksAfterBirth * DAYS_IN_WEEK,
    );
    const fatherAppDate = addDaysIso(
      takeoverStart,
      -params.applicationDeadlinesDays.fatherTakeoverPart,
    );
    const motherResignDate = addDaysIso(
      takeoverStart,
      -params.applicationDeadlinesDays.resignFromMaternityPart,
    );
    list.push({
      date: fatherAppDate,
      label: `Wniosek ojca o przejęcie części macierzyńskiego (${params.applicationDeadlinesDays.fatherTakeoverPart} dni przed)`,
      kind: 'deadline',
      description: `Ojciec składa wniosek o przejęcie pozostałej części urlopu macierzyńskiego najpóźniej ${params.applicationDeadlinesDays.fatherTakeoverPart} dni przed rozpoczęciem swojej części.`,
      legalBasis: 'KP art. 180 § 9',
      isPast: fatherAppDate < referenceDate,
    });
    list.push({
      date: motherResignDate,
      label: `Rezygnacja matki z pozostałej części macierzyńskiego (${params.applicationDeadlinesDays.resignFromMaternityPart} dni przed)`,
      kind: 'deadline',
      description: `Matka składa wniosek o rezygnację z pozostałej części urlopu macierzyńskiego najpóźniej ${params.applicationDeadlinesDays.resignFromMaternityPart} dni przed powrotem do pracy.`,
      legalBasis: 'KP art. 180 § 4',
      isPast: motherResignDate < referenceDate,
    });
  }

  // Terminy wniosków o urlop rodzicielski (21 dni przed startem pierwszej części każdego rodzica)
  const seenParentalStarts = new Set<string>();
  periods
    .filter((p) => p.leaveType === 'parentalLeave')
    .forEach((period) => {
      const key = `${period.parentRole}-${period.startDate}`;
      if (seenParentalStarts.has(key)) return;
      seenParentalStarts.add(key);

      const deadlineDate = addDaysIso(
        period.startDate,
        -params.applicationDeadlinesDays.parentalLeave,
      );
      const roleShort = period.parentRole === 'mother' ? 'Matka' : 'Ojciec';
      list.push({
        date: deadlineDate,
        label: `Wniosek o urlop rodzicielski – ${roleShort} (${params.applicationDeadlinesDays.parentalLeave} dni przed startem)`,
        kind: 'deadline',
        description: `Najpóźniejszy dzień na złożenie wniosku o tę część urlopu rodzicielskiego (start ${formatIsoPl(period.startDate)}). Wniosek składa się u pracodawcy albo do ZUS (ZAM).`,
        legalBasis: 'KP art. 182¹d § 1',
        isPast: deadlineDate < referenceDate,
      });
    });

  // Terminy wniosków o urlop ojcowski (7 dni przed startem)
  const seenPaternityStarts = new Set<string>();
  periods
    .filter((p) => p.leaveType === 'paternityLeave')
    .forEach((period) => {
      if (seenPaternityStarts.has(period.startDate)) return;
      seenPaternityStarts.add(period.startDate);

      const deadlineDate = addDaysIso(
        period.startDate,
        -params.applicationDeadlinesDays.paternityLeave,
      );
      list.push({
        date: deadlineDate,
        label: `Wniosek o urlop ojcowski (${params.applicationDeadlinesDays.paternityLeave} dni przed startem)`,
        kind: 'deadline',
        description: `Ostatni dzień na złożenie wniosku o urlop ojcowski rozpoczynający się ${formatIsoPl(period.startDate)} (u pracodawcy lub w ZUS na druku ZAM).`,
        legalBasis: 'KP art. 182³ § 2',
        isPast: deadlineDate < referenceDate,
      });
    });

  return list.sort((a, b) => a.date.localeCompare(b.date));
}
