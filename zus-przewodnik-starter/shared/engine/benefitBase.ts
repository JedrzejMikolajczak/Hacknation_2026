import type { BenefitBaseInput, BenefitBaseResult, BenefitParams, Explanation, MonthlyBase } from '../types';
import {
  amount,
  date,
  formatPercentPl,
  monthIndex,
  requireValue,
  roundPln,
  validateParams,
} from './core';

export type BaseInput = BenefitBaseInput & {
  employmentFraction?: number;
  /** Początek aktualnego zatrudnienia/ubezpieczenia (opcjonalny – bez niego używamy podanej historii). */
  insuredSince?: string;
  absencesJustified?: boolean;
  employmentFractionChanged?: boolean;
  minimumContributionBases?: Record<string, number>;
  creditedPreviousMonths?: number;
};

export function hasPregnancyBaseIncrease(
  monthlyBases: readonly MonthlyBase[],
  pregnancyStart: string,
  pregnancyEnd: string,
  params: BenefitParams,
): boolean {
  if (monthlyBases.length < 2) return false;

  const { baseIncreasePercent, beforePregnancyMonths } = params.insuranceRisk;
  const firstPregnancyMonth = monthIndex(pregnancyStart.slice(0, 7));
  const lastPregnancyMonth = monthIndex(pregnancyEnd.slice(0, 7));
  const firstComparisonMonth = firstPregnancyMonth - beforePregnancyMonths;
  const amountsByMonth = new Map<number, number>();

  for (const { month, amount_pln, excluded_bonus_pln = 0 } of monthlyBases) {
    const index = monthIndex(month, 'monthlyBases.month');
    if (index < firstComparisonMonth || index > lastPregnancyMonth) continue;

    amount(amount_pln, 'monthlyBases.amount_pln');
    amount(excluded_bonus_pln, 'monthlyBases.excluded_bonus_pln');
    requireValue(!amountsByMonth.has(index), 'monthlyBases', `Powtórzony miesiąc podstawy: ${month}.`);
    amountsByMonth.set(index, Math.max(0, amount_pln - excluded_bonus_pln));
  }

  let earlierTotal = 0;
  let earlierCount = 0;
  for (const [index, monthlyAmount] of [...amountsByMonth].sort(([a], [b]) => a - b)) {
    if (monthlyAmount === 0) continue;
    if (index >= firstPregnancyMonth && earlierCount > 0) {
      const earlierAverage = earlierTotal / earlierCount;
      if (monthlyAmount * 100 >= earlierAverage * (100 + baseIncreasePercent)) return true;
    }
    earlierTotal += monthlyAmount;
    earlierCount++;
  }

  return false;
}

export function calculateBenefitBase(input: BaseInput, params: BenefitParams): BenefitBaseResult {
  validateParams(params, input.rightArisesOn);
  requireValue(
    input.insuranceTitle !== 'none',
    'insuranceTitle',
    'Brak tytułu ubezpieczenia chorobowego do obliczenia podstawy wymiaru (insuranceTitle).',
  );
  requireValue(
    !input.employmentFractionChanged,
    'employmentFractionChanged',
    'Zmiana wymiaru czasu pracy wymaga podania wynagrodzenia po zmianie etatu (art. 40).',
  );

  const employee = input.insuranceTitle === 'employment';
  const explanations: Explanation[] = [];

  let fraction = 1;
  if (employee) {
    if (input.employmentFraction !== undefined) {
      requireValue(
        Number.isFinite(input.employmentFraction) &&
          input.employmentFraction > 0 &&
          input.employmentFraction <= 1,
        'employmentFraction',
        'Wymiar etatu (employmentFraction) musi być liczbą z przedziału (0, 1].',
      );
      fraction = input.employmentFraction;
    } else {
      explanations.push({
        message:
          'Nie podano wymiaru etatu – do sprawdzenia minimalnej podstawy wymiaru przyjęto pełny etat (1/1).',
        legalBasis: 'Ustawa zasiłkowa art. 45',
      });
    }
  }

  const deduction = 1 - params.benefitBase.socialContributionDeduction;
  const minimum = employee ? params.benefitBase.minimumWage * fraction * deduction : 0;

  function buildResult(
    rawBase: number,
    used: string[],
    excluded: string[],
    basis: string,
    extraNote?: string,
    forceMaxApplied = false,
  ): BenefitBaseResult {
    let effectiveBase = rawBase;
    let appliedMaximum = forceMaxApplied;
    if (!employee && effectiveBase > params.benefitBase.maxBaseNonEmployee) {
      effectiveBase = params.benefitBase.maxBaseNonEmployee;
      appliedMaximum = true;
    }
    const appliedMinimum = employee && effectiveBase < minimum;
    const finalBase = roundPln(Math.max(effectiveBase, minimum));

    const finalExplanations: Explanation[] = [
      ...explanations,
      {
        message:
          extraNote ??
          `Podstawa wymiaru po odliczeniu składek na ubezpieczenia społeczne (${formatPercentPl(params.benefitBase.socialContributionDeduction)})${appliedMinimum ? ' z zastosowaniem minimalnej podstawy dla etatu' : ''}${appliedMaximum ? ' z ograniczeniem do maksymalnej podstawy dla ubezpieczenia dobrowolnego' : ''}.`,
        legalBasis: basis,
      },
    ];

    return {
      benefitBase: finalBase,
      monthsUsed: used,
      monthsExcluded: excluded,
      appliedMinimum,
      appliedMaximum,
      explanations: finalExplanations,
    };
  }

  const currentMonth = monthIndex(input.rightArisesOn.slice(0, 7), 'rightArisesOn');

  // Ciągłość zasiłków (art. 43 ustawy zasiłkowej): brak pełnego miesiąca kalendarzowego przerwy → ta sama podstawa.
  if (input.previousBenefitEndDate !== null) {
    requireValue(
      date(input.previousBenefitEndDate, 'previousBenefitEndDate') <
        date(input.rightArisesOn, 'rightArisesOn'),
      'previousBenefitEndDate',
      'Data zakończenia poprzedniego świadczenia (previousBenefitEndDate) musi poprzedzać dzień powstania prawa.',
    );
    const previousMonth = monthIndex(
      input.previousBenefitEndDate.slice(0, 7),
      'previousBenefitEndDate',
    );
    if (currentMonth - previousMonth <= params.benefitBase.newBaseAfterGapMonths) {
      if (input.previousBenefitBase !== null) {
        amount(input.previousBenefitBase, 'previousBenefitBase');
        return buildResult(
          input.previousBenefitBase,
          [],
          [],
          'Ustawa zasiłkowa art. 43, art. 45',
          `Przerwa od poprzedniego świadczenia (zakończonego ${input.previousBenefitEndDate}) jest krótsza niż ${params.benefitBase.newBaseAfterGapMonths} pełny miesiąc kalendarzowy – zachowano dotychczasową podstawę wymiaru.`,
        );
      }
      explanations.push({
        message:
          'Przerwa od poprzedniego świadczenia wskazuje na ciągłość podstawy (art. 43), lecz nie podano poprzedniej podstawy – wyliczono podstawę na podstawie podanych przychodów.',
        legalBasis: 'Ustawa zasiłkowa art. 43',
      });
    }
  }

  // Walidacja listy przychodów (jeśli podana)
  const seen = new Set<string>();
  for (const row of input.incomes) {
    monthIndex(row.month, 'incomes.month');
    amount(row.grossAmount, 'grossAmount');
    requireValue(
      !seen.has(row.month),
      'incomes',
      `Powtórzony miesiąc wynagrodzenia: ${row.month}.`,
    );
    seen.add(row.month);
  }

  // JDG z zadeklarowaną podstawą składek bez rozbicia na miesiące (format z formularza)
  if (
    input.insuranceTitle === 'selfEmployed' &&
    input.incomes.length === 0 &&
    input.declaredContributionBase !== null
  ) {
    amount(input.declaredContributionBase, 'declaredContributionBase');
    const cappedContribution = Math.min(
      input.declaredContributionBase,
      params.benefitBase.maxVoluntaryContributionBase,
    );
    const hitCap = input.declaredContributionBase > params.benefitBase.maxVoluntaryContributionBase;
    const rawBase = hitCap ? params.benefitBase.maxBaseNonEmployee : cappedContribution * deduction;

    if (input.insuredSince) {
      requireValue(
        date(input.insuredSince, 'insuredSince') <= date(input.rightArisesOn, 'rightArisesOn'),
        'insuredSince',
        'Początek ubezpieczenia (insuredSince) nie może przypadać po dniu powstania prawa.',
      );
      const firstFull =
        monthIndex(input.insuredSince.slice(0, 7), 'insuredSince') +
        (input.insuredSince.endsWith('-01') ? 0 : 1);
      const fullMonthsCount = Math.max(0, currentMonth - firstFull);
      if (fullMonthsCount < params.benefitBase.lookbackMonths) {
        explanations.push({
          message: `Ubezpieczenie z tytułu JDG trwa krócej niż ${params.benefitBase.lookbackMonths} pełnych miesięcy (${fullMonthsCount} mies.). ZUS przelicza nadwyżkę ponad najniższą podstawę proporcjonalnie do liczby pełnych miesięcy ubezpieczenia (art. 48a) – wyliczenie ma charakter szacunkowy.`,
          legalBasis: 'Ustawa zasiłkowa art. 48a',
        });
      }
    }

    return buildResult(
      rawBase,
      [],
      [],
      'Ustawa zasiłkowa art. 3 pkt 4, art. 48–48a; u.s.u.s. art. 20 ust. 3',
      `Podstawa wymiaru dla działalności gospodarczej (JDG) obliczona od zadeklarowanej podstawy składek po odliczeniu ${formatPercentPl(params.benefitBase.socialContributionDeduction)}${hitCap ? ' (zastosowano ustawowy limit 250% przeciętnego wynagrodzenia)' : ''}.`,
      hitCap,
    );
  }

  const lookbackStart = currentMonth - params.benefitBase.lookbackMonths;
  let rows = input.incomes.filter((row) => {
    const idx = monthIndex(row.month);
    return idx >= lookbackStart && idx < currentMonth;
  });

  if (input.insuredSince !== undefined) {
    requireValue(
      date(input.insuredSince, 'insuredSince') <= date(input.rightArisesOn, 'rightArisesOn'),
      'insuredSince',
      'Ubezpieczenie (insuredSince) zaczyna się po dniu powstania prawa.',
    );
    const firstFull =
      monthIndex(input.insuredSince.slice(0, 7), 'insuredSince') +
      (input.insuredSince.endsWith('-01') ? 0 : 1);
    const firstMonth = Math.max(firstFull, lookbackStart);
    rows = input.incomes.filter((row) => {
      const idx = monthIndex(row.month);
      return idx >= firstMonth && idx < currentMonth;
    });
    const expectedFullMonths = Math.max(0, currentMonth - firstMonth);
    if (input.incomes.length > 0) {
      requireValue(
        rows.length === expectedFullMonths,
        'incomes',
        'Uzupełnij wszystkie pełne miesiące ubezpieczenia w okresie wyliczania podstawy (incomes).',
      );
    } else if (expectedFullMonths > 0 && input.contractMonthlySalary === null) {
      requireValue(
        false,
        'incomes',
        'Podaj przychody z pełnych miesięcy ubezpieczenia (incomes) lub wynagrodzenie z umowy (contractMonthlySalary).',
      );
    }
  } else if (rows.length > 0) {
    explanations.push({
      message: `Nie podano daty początku ubezpieczenia – do obliczenia podstawy przyjęto ${rows.length} przekazanych pełnych miesięcy z okresu ostatnich ${params.benefitBase.lookbackMonths} miesięcy.`,
      legalBasis: 'Ustawa zasiłkowa art. 36',
    });
  }

  // Brak pełnych miesięcy kalendarzowych (np. pierwszy miesiąc zatrudnienia) → uzupełnienie z umowy
  if (rows.length === 0) {
    if (input.contractMonthlySalary !== null) {
      amount(input.contractMonthlySalary, 'contractMonthlySalary');
      return buildResult(
        input.contractMonthlySalary * deduction,
        [],
        [],
        employee ? 'Ustawa zasiłkowa art. 37, art. 45' : 'Ustawa zasiłkowa art. 49',
        employee
          ? 'Brak pełnych miesięcy kalendarzowych przed powstaniem prawa – podstawę ustalono na podstawie wynagrodzenia z umowy o pracę.'
          : 'Brak pełnych miesięcy kalendarzowych przed powstaniem prawa – podstawę oszacowano na podstawie miesięcznego przychodu z umowy.',
      );
    }
    requireValue(
      false,
      employee ? 'contractMonthlySalary' : 'incomes',
      employee
        ? 'Brak pełnych miesięcy ubezpieczenia – podaj miesięczne wynagrodzenie z umowy (contractMonthlySalary).'
        : 'Brak pełnych miesięcy ubezpieczenia – podaj przychody (incomes), wynagrodzenie z umowy (contractMonthlySalary) albo zadeklarowaną podstawę składek (declaredContributionBase).',
    );
  }

  for (const row of rows) {
    requireValue(
      !row.components?.length,
      'components',
      'Składniki okresowe (components) wymagają przypisania do okresów z art. 41–42. Podaj zweryfikowane wynagrodzenie miesięczne.',
    );
    if (row.workedDays !== null || row.requiredWorkingDays !== null) {
      requireValue(
        Number.isInteger(row.workedDays) &&
          Number.isInteger(row.requiredWorkingDays) &&
          row.workedDays! >= 0 &&
          row.requiredWorkingDays! > 0 &&
          row.workedDays! <= row.requiredWorkingDays!,
        'workedDays',
        'Nieprawidłowa liczba dni przepracowanych (workedDays / requiredWorkingDays).',
      );
      if (row.workedDays !== row.requiredWorkingDays) {
        requireValue(
          employee && input.absencesJustified === true,
          'absencesJustified',
          'Potwierdź usprawiedliwione nieobecności (absencesJustified). Dla niepracowników wymagane są przesłanki art. 50.',
        );
      }
    }
  }

  const qualifying = rows.filter(
    (row) => row.workedDays === null || row.workedDays >= row.requiredWorkingDays! / 2,
  );
  const used = qualifying.length ? qualifying : rows;
  const excluded = rows.filter((row) => !used.includes(row)).map((row) => row.month);
  const values = used.map((row) => {
    if (row.workedDays === null || row.workedDays === row.requiredWorkingDays) {
      return row.grossAmount;
    }
    if (input.contractMonthlySalary !== null) {
      amount(input.contractMonthlySalary, 'contractMonthlySalary');
      return input.contractMonthlySalary;
    }
    requireValue(
      row.workedDays > 0,
      'workedDays',
      'Przy zerowej liczbie przepracowanych dni wymagane jest wynagrodzenie z umowy (contractMonthlySalary, art. 37 ust. 2 pkt 3).',
    );
    return (row.grossAmount / row.workedDays) * row.requiredWorkingDays!;
  });

  let average = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (input.insuranceTitle === 'selfEmployed' && rows.length < params.benefitBase.lookbackMonths) {
    const hasArt48aDetails =
      input.creditedPreviousMonths !== undefined && input.minimumContributionBases !== undefined;
    if (hasArt48aDetails) {
      const previous = input.creditedPreviousMonths!;
      requireValue(
        Number.isInteger(previous) && previous >= 0,
        'creditedPreviousMonths',
        'Liczba zaliczanych miesięcy z poprzedniego tytułu (creditedPreviousMonths) musi być nieujemną liczbą całkowitą.',
      );
      const minima = rows.map((row) => {
        const value = input.minimumContributionBases?.[row.month];
        amount(value, 'minimumContributionBases');
        requireValue(
          value <= row.grossAmount,
          'minimumContributionBases',
          'Podstawa zadeklarowana jest niższa od podanej podstawy minimalnej.',
        );
        return value;
      });
      const minimumAverage = minima.reduce((sum, value) => sum + value, 0) / minima.length;
      average =
        minimumAverage +
        ((average - minimumAverage) *
          Math.min(rows.length + previous, params.benefitBase.lookbackMonths)) /
          params.benefitBase.lookbackMonths;
    } else {
      explanations.push({
        message: `Dla działalności gospodarczej trwającej krócej niż ${params.benefitBase.lookbackMonths} miesięcy ZUS stosuje proporcjonalne przeliczenie nadwyżki ponad najniższą podstawę (art. 48a). Z powodu braku danych o najniższych podstawach w poszczególnych miesiącach wyliczono średnią z przekazanych kwot.`,
        legalBasis: 'Ustawa zasiłkowa art. 48a',
      });
    }
  }

  return buildResult(
    average * deduction,
    used.map((row) => row.month),
    excluded,
    employee
      ? 'Ustawa zasiłkowa art. 36–38, art. 45'
      : 'Ustawa zasiłkowa art. 3 pkt 4, art. 48–48a',
  );
}
