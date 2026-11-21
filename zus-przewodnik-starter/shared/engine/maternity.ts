import type {
  BenefitParams,
  Explanation,
  LeavePeriod,
  MaternityCalculationResult,
  ParentRole,
  WizardScenario,
  SupplementaryCase,
} from '../types';
import {
  addDays,
  amount,
  calculateBenefitAmount,
  date,
  daysBetween,
  formatPercentPl,
  requireValue,
  roundPln,
} from './core';
import { checkEligibility, getAdoptionAgeLimit, type EligibilityInput } from './eligibility';

export type MaternityInput = EligibilityInput & {
  combinedApplicationDate?: string;
  /** Liczba dzieci pozostałych przy życiu w porodzie mnogim przy zgonie dziecka. */
  childrenAliveCount?: number;
  /** Porzucenie dziecka przez matkę (KP art. 180 § 13) – wcześniejsze przejęcie przez ojca. */
  motherAbandonedChild?: boolean;
  /** Liczba tygodni pobytu matki w szpitalu (do przejęcia urlopu przez ojca). */
  motherHospitalizationWeeks?: number;
  /** Liczba tygodni urlopu macierzyńskiego wykorzystanych przez matkę przed przejęciem przez ojca. */
  motherUsedWeeksBeforeTakeover?: number;
};

export interface SupplementaryResolution {
  weeks: number;
  matchedCase: SupplementaryCase | null;
  assumptionNote: string | null;
}

export function resolveSupplementaryMaternityLeave(
  input: WizardScenario,
  params: BenefitParams,
): SupplementaryResolution {
  const { pregnancyWeekAtBirth, birthWeightGrams, hospitalizationDays } = input.special;
  if (hospitalizationDays === null || hospitalizationDays <= 0) {
    return { weeks: 0, matchedCase: null, assumptionNote: null };
  }

  requireValue(
    Number.isInteger(hospitalizationDays) && hospitalizationDays > 0,
    'hospitalizationDays',
    'Liczba dni hospitalizacji (hospitalizationDays) musi być dodatnią liczbą całkowitą.',
  );

  // Jeśli nie podano tygodnia ciąży ani masy urodzeniowej, nie możemy dobrać przypadku z tabeli.
  const canMatchByWeightOnly =
    birthWeightGrams !== null &&
    params.supplementaryMaternityLeave.cases.some(
      (c) =>
        c.maxPregnancyWeekExclusive === null &&
        c.minPregnancyWeek === null &&
        c.maxBirthWeightGrams !== null &&
        birthWeightGrams <= c.maxBirthWeightGrams,
    );

  if (pregnancyWeekAtBirth === null && !canMatchByWeightOnly) {
    requireValue(
      false,
      'pregnancyWeekAtBirth',
      'Podaj tydzień ciąży w chwili porodu (pregnancyWeekAtBirth), aby ustalić wymiar uzupełniającego urlopu macierzyńskiego.',
    );
  }
  if (pregnancyWeekAtBirth !== null) {
    requireValue(
      Number.isInteger(pregnancyWeekAtBirth) && pregnancyWeekAtBirth > 0,
      'pregnancyWeekAtBirth',
      'Tydzień ciąży (pregnancyWeekAtBirth) musi być dodatnią liczbą całkowitą.',
    );
  }

  const strictMatches = params.supplementaryMaternityLeave.cases.filter((c) => {
    if (
      c.maxPregnancyWeekExclusive !== null &&
      (pregnancyWeekAtBirth === null || pregnancyWeekAtBirth >= c.maxPregnancyWeekExclusive)
    ) {
      return false;
    }
    if (
      c.minPregnancyWeek !== null &&
      (pregnancyWeekAtBirth === null || pregnancyWeekAtBirth < c.minPregnancyWeek)
    ) {
      return false;
    }
    if (
      c.maxBirthWeightGrams !== null &&
      (birthWeightGrams === null || birthWeightGrams > c.maxBirthWeightGrams)
    ) {
      return false;
    }
    if (
      c.minBirthWeightGramsExclusive !== null &&
      (birthWeightGrams === null || birthWeightGrams <= c.minBirthWeightGramsExclusive)
    ) {
      return false;
    }
    if (c.minHospitalizationDays !== null && hospitalizationDays < c.minHospitalizationDays) {
      return false;
    }
    return true;
  });

  let matchedCase: SupplementaryCase | null = null;
  let assumptionNote: string | null = null;

  if (strictMatches.length > 0) {
    matchedCase = strictMatches.reduce((best, current) =>
      current.limitWeekAfterBirth > best.limitWeekAfterBirth ? current : best,
    );
  } else if (pregnancyWeekAtBirth !== null && birthWeightGrams === null) {
    // Brak masy urodzeniowej przy wcześniaku (np. 28–36 tc) – dopasuj przypadek z założeniem masy powyżej progu
    const fallbackMatches = params.supplementaryMaternityLeave.cases.filter((c) => {
      if (
        c.maxPregnancyWeekExclusive !== null &&
        pregnancyWeekAtBirth >= c.maxPregnancyWeekExclusive
      ) {
        return false;
      }
      if (c.minPregnancyWeek !== null && pregnancyWeekAtBirth < c.minPregnancyWeek) {
        return false;
      }
      if (c.maxBirthWeightGrams !== null) return false;
      if (c.minHospitalizationDays !== null && hospitalizationDays < c.minHospitalizationDays) {
        return false;
      }
      return true;
    });
    if (fallbackMatches.length > 0) {
      matchedCase = fallbackMatches.reduce((best, current) =>
        current.limitWeekAfterBirth > best.limitWeekAfterBirth ? current : best,
      );
      assumptionNote = `Nie podano masy urodzeniowej dziecka – zastosowano limit ${matchedCase.limitWeekAfterBirth} tyg. (${matchedCase.description}). Jeśli masa urodzeniowa nie przekraczała progu dla skrajnego wcześniactwa, limit może być wyższy.`;
    }
  }

  if (!matchedCase) {
    return { weeks: 0, matchedCase: null, assumptionNote: null };
  }

  // KP art. 180² § 4: niepełny tydzień pobytu w szpitalu zaokrągla się w górę do pełnego tygodnia.
  const hospitalWeeks = Math.ceil(hospitalizationDays / 7);
  const weeks = Math.min(matchedCase.limitWeekAfterBirth, hospitalWeeks);

  return { weeks, matchedCase, assumptionNote };
}

export function getMaternityWeeksForChildren(childrenCount: number, params: BenefitParams): number {
  const keys = Object.keys(params.maternityLeave.weeksByChildrenCount).map(Number);
  const key = String(
    Math.min(Math.max(childrenCount, 1), Math.max(...keys)),
  ) as keyof BenefitParams['maternityLeave']['weeksByChildrenCount'];
  return params.maternityLeave.weeksByChildrenCount[key];
}

export function getParentalPoolWeeks(
  childrenCount: number,
  zaZyciem: boolean,
  params: BenefitParams,
): number {
  const p = params.parentalLeave;
  if (zaZyciem) {
    return childrenCount === 1 ? p.weeksSingleChildZaZyciem : p.weeksMultipleChildrenZaZyciem;
  }
  return childrenCount === 1 ? p.weeksSingleChild : p.weeksMultipleChildren;
}

export function calculateMaternity(
  input: MaternityInput,
  params: BenefitParams,
): MaternityCalculationResult {
  requireValue(
    Number.isInteger(input.childrenCount) && input.childrenCount > 0,
    'childrenCount',
    'Podaj dodatnią całkowitą liczbę dzieci (childrenCount).',
  );
  requireValue(
    input.rateVariant === 'standard' || input.rateVariant === 'combined',
    'rateVariant',
    'Nieprawidłowy wariant stawki (rateVariant: standard lub combined).',
  );

  const isAdoption = input.situation === 'adoption';
  if (isAdoption) {
    requireValue(
      input.childAcceptanceDate,
      'childAcceptanceDate',
      'Podaj datę przyjęcia dziecka na wychowanie (childAcceptanceDate).',
    );
    requireValue(
      input.adoptionType,
      'adoptionType',
      'Podaj formę przyjęcia dziecka na wychowanie (adoptionType).',
    );
  }

  const eligibility = checkEligibility(input, params);
  const start = isAdoption
    ? input.childAcceptanceDate!
    : (input.birthDate ?? input.expectedBirthDate!);

  const explanations: Explanation[] = [];
  const primaryLeaveType: LeavePeriod['leaveType'] = isAdoption
    ? 'adoptionMaternityLeave'
    : 'maternityLeave';

  // Sprawdzenie wieku dziecka przy adopcji / rodzinie zastępczej
  const maxAdoptionAge = getAdoptionAgeLimit(input, params);
  const adoptionOverAgeLimit =
    isAdoption &&
    maxAdoptionAge !== null &&
    input.childAgeYears !== null &&
    input.childAgeYears >= maxAdoptionAge;

  if (adoptionOverAgeLimit) {
    return {
      periods: [],
      totalAmount: 0,
      variants: null,
      warnings: eligibility.warnings,
      explanations: [
        {
          message: `Urlop na warunkach urlopu macierzyńskiego i urlop rodzicielski nie przysługują, ponieważ dziecko ukończyło ${maxAdoptionAge}. rok życia.`,
          legalBasis: 'KP art. 183 § 1, § 4; ustawa zasiłkowa art. 29 ust. 1 pkt 2–3',
        },
      ],
    };
  }

  // Sprawdzenie sytuacji utraty dziecka (KP art. 180¹)
  const hasChildLoss = input.special.stillbirth || input.special.childDeathDate !== null;
  let aliveChildrenCount = input.childrenCount;
  if (hasChildLoss) {
    if (input.childrenAliveCount !== undefined) {
      requireValue(
        Number.isInteger(input.childrenAliveCount) &&
          input.childrenAliveCount >= 0 &&
          input.childrenAliveCount <= input.childrenCount,
        'childrenAliveCount',
        'Liczba dzieci pozostałych przy życiu (childrenAliveCount) musi mieścić się między 0 a liczbą urodzonych dzieci.',
      );
      aliveChildrenCount = input.childrenAliveCount;
    } else if (input.special.stillbirth) {
      aliveChildrenCount = 0;
    } else {
      // Zgon dziecka przy porodzie pojedynczym → 0, przy mnogim bez podania liczby → zakładamy stratę 1 dziecka
      aliveChildrenCount = Math.max(0, input.childrenCount - 1);
      if (input.childrenCount > 1) {
        explanations.push({
          message: `Przy porodzie mnogim przyjęto, że przy życiu pozostało ${aliveChildrenCount} ${aliveChildrenCount === 1 ? 'dziecko' : 'dzieci'}. Wymiar urlopu ustalono stosownie do liczby dzieci pozostałych przy życiu.`,
          legalBasis: 'KP art. 180¹ § 1–2',
        });
      }
    }
  }

  // Walidacja terminu wniosku 81,5% (jeśli podano datę wniosku; bez niej zakładamy terminowe złożenie)
  const effectiveCombined = input.rateVariant === 'combined' && aliveChildrenCount > 0;
  if (effectiveCombined) {
    if (input.combinedApplicationDate !== undefined) {
      const delay = daysBetween(start, input.combinedApplicationDate);
      requireValue(
        delay >= 0 && delay <= params.combinedRateApplicationDeadlineDays,
        'combinedApplicationDate',
        `Wniosek o stawkę ${formatPercentPl(params.rates.combined)} (combinedApplicationDate) wykracza poza ustawowy termin ${params.combinedRateApplicationDeadlineDays} dni.`,
      );
    } else {
      explanations.push({
        message: `Przyjęto złożenie wniosku o pełny wymiar urlopu w terminie ${params.combinedRateApplicationDeadlineDays} dni od dnia zdarzenia (warunek stawki ${formatPercentPl(params.rates.combined)}).`,
        legalBasis: 'Ustawa zasiłkowa art. 30a ust. 1',
      });
    }
  }

  // Wymiar urlopu macierzyńskiego / na warunkach macierzyńskiego (w dniach i tygodniach)
  let maternityWeeks = getMaternityWeeksForChildren(
    aliveChildrenCount > 0 ? aliveChildrenCount : input.childrenCount,
    params,
  );
  let maternityDays = maternityWeeks * 7;

  if (isAdoption) {
    if (input.childAgeYears !== null && maxAdoptionAge !== null) {
      const remainingWeeksToAgeLimit = Math.floor((maxAdoptionAge - input.childAgeYears) * 52);
      if (remainingWeeksToAgeLimit < maternityWeeks) {
        maternityWeeks = Math.max(params.adoptionMaternityLeave.minWeeks, remainingWeeksToAgeLimit);
        maternityDays = maternityWeeks * 7;
        explanations.push({
          message: `Ze względu na zbliżający się limit wieku dziecka (do ${maxAdoptionAge} lat) wymiar urlopu na warunkach urlopu macierzyńskiego ograniczono z zachowaniem ustawowego minimum ${params.adoptionMaternityLeave.minWeeks} tygodni.`,
          legalBasis: 'KP art. 183 § 1, § 3',
        });
      } else {
        explanations.push({
          message: `Przyjęcie dziecka w wieku ${input.childAgeYears} lat mieści się w ustawowym limicie wieku dla ${input.adoptionType === 'fosterFamily' ? 'rodziny zastępczej niezawodowej' : 'adopcji'} (do ukończenia ${maxAdoptionAge}. roku życia). Urlop rodzicielski przysługuje z uwzględnieniem tego limitu wieku.`,
          legalBasis: 'KP art. 183 § 1, § 4',
        });
      }
    } else {
      maternityWeeks = Math.max(maternityWeeks, params.adoptionMaternityLeave.minWeeks);
      maternityDays = maternityWeeks * 7;
    }
  }

  if (hasChildLoss) {
    const thresholdDays = params.childDeath.thresholdWeeksOfLife * 7;
    const minBeforeThresholdDays = params.childDeath.weeksAfterBirthIfBeforeThreshold * 7;
    const minDaysAfterDeath = params.childDeath.minDaysAfterDeath;
    const normalMaternityDays = getMaternityWeeksForChildren(input.childrenCount, params) * 7;

    let lossMinimumDays: number;
    if (input.special.stillbirth) {
      lossMinimumDays = minBeforeThresholdDays;
      explanations.push({
        message: `W przypadku urodzenia martwego dziecka przysługuje zasiłek macierzyński przez ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni po porodzie w wysokości ${formatPercentPl(params.rates.maternity)} podstawy wymiaru. Urlop rodzicielski nie przysługuje.`,
        legalBasis: 'KP art. 180¹ § 1; ustawa zasiłkowa art. 31 ust. 1',
      });
    } else {
      const deathDate = input.special.childDeathDate!;
      requireValue(
        date(deathDate, 'childDeathDate') >= date(start),
        'childDeathDate',
        'Data zgonu dziecka (childDeathDate) nie może poprzedzać daty porodu.',
      );
      const daysLived = daysBetween(start, deathDate);
      // 7 dni od dnia zgonu dziecka = dzień porodu..dzień zgonu (daysLived + 1) + 7 kolejnych dni
      const daysUntilSevenAfterDeath = daysLived + 1 + minDaysAfterDeath;

      if (daysLived < thresholdDays) {
        lossMinimumDays = Math.max(minBeforeThresholdDays, daysUntilSevenAfterDeath);
        explanations.push({
          message:
            aliveChildrenCount === 0
              ? `W razie zgonu dziecka przed upływem ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia przysługuje zasiłek macierzyński przez ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni po porodzie, nie krócej niż ${minDaysAfterDeath} dni od dnia zgonu (${lossMinimumDays} dni łącznie, ${formatPercentPl(params.rates.maternity)}). Urlop rodzicielski nie przysługuje.`
              : `W razie zgonu jednego z dzieci przed upływem ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia urlop macierzyński przysługuje w wymiarze stosownym do liczby dzieci pozostałych przy życiu (${aliveChildrenCount}), nie krócej niż ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni po porodzie i ${minDaysAfterDeath} dni od dnia zgonu.`,
          legalBasis: 'KP art. 180¹ § 1',
        });
      } else {
        lossMinimumDays = Math.min(normalMaternityDays, daysUntilSevenAfterDeath);
        explanations.push({
          message:
            aliveChildrenCount === 0
              ? `W razie zgonu dziecka po upływie ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia zachowane jest prawo do zasiłku macierzyńskiego przez ${minDaysAfterDeath} dni od dnia zgonu (${lossMinimumDays} dni od dnia porodu, ${formatPercentPl(params.rates.maternity)}). Urlop rodzicielski nie przysługuje.`
              : `W razie zgonu jednego z dzieci po upływie ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia przysługuje urlop macierzyński w wymiarze stosownym do liczby dzieci pozostałych przy życiu (${aliveChildrenCount}), nie krócej niż ${minDaysAfterDeath} dni od dnia zgonu.`,
          legalBasis: 'KP art. 180¹ § 2',
        });
      }
    }

    if (aliveChildrenCount === 0) {
      maternityDays = lossMinimumDays;
      maternityWeeks = Math.ceil(maternityDays / 7);
    } else {
      const aliveWeeks = getMaternityWeeksForChildren(aliveChildrenCount, params);
      maternityDays = Math.max(aliveWeeks * 7, lossMinimumDays);
      maternityWeeks = Math.ceil(maternityDays / 7);
    }
  }

  // Uzupełniający urlop macierzyński (tylko gdy dziecko żyje)
  let supplementaryWeeks = 0;
  if (aliveChildrenCount > 0 && !isAdoption) {
    const supp = resolveSupplementaryMaternityLeave(input, params);
    supplementaryWeeks = supp.weeks;
    if (supp.assumptionNote) {
      explanations.push({
        message: supp.assumptionNote,
        legalBasis: 'KP art. 180²',
      });
    }
    if (supp.matchedCase && supplementaryWeeks > 0) {
      explanations.push({
        message: `Uzupełniający urlop macierzyński (${supplementaryWeeks} tyg., ${formatPercentPl(params.rates.supplementaryMaternity)}) przysługuje w jednej części bezpośrednio po urlopie macierzyńskim matce albo ojcu. Zastosowano przypadek: „${supp.matchedCase.description}” – 1 tydzień za każdy rozpoczęty tydzień pobytu w szpitalu, maksymalnie do upływu ${supp.matchedCase.limitWeekAfterBirth}. tygodnia po porodzie (limit ${supp.matchedCase.limitWeekAfterBirth} tyg.).`,
        legalBasis: 'KP art. 180²; ustawa zasiłkowa art. 29a, art. 31 ust. 1',
      });
    }
  }

  // Pula urlopu rodzicielskiego
  const parental = params.parentalLeave;
  const nonTransferable = parental.nonTransferableWeeksPerParent;
  const pool =
    aliveChildrenCount > 0
      ? getParentalPoolWeeks(aliveChildrenCount, input.special.zaZyciemCertificate, params)
      : 0;

  const motherEligible = eligibility.entitlements.some(
    (item) => item.benefit === 'maternityBenefit' && item.parentRole === 'mother' && item.entitled,
  );
  const fatherEligible = eligibility.entitlements.some(
    (item) => item.benefit === 'maternityBenefit' && item.parentRole === 'father' && item.entitled,
  );

  const motherDeceasedOrAbandoned = Boolean(
    input.special.motherDeceased || input.motherAbandonedChild,
  );
  const motherTakesSpecialTransfer = Boolean(
    input.special.motherHospitalized || input.special.motherIncapableOfIndependentLiving,
  );

  const motherUses = motherEligible && !input.special.motherDeceased && input.mother.wantsLeave;
  const fatherUses = fatherEligible && Boolean(input.father?.wantsLeave);

  // Czy ojciec kwalifikuje się do urlopu ojcowskiego (tylko dla żywego dziecka, nie dla rodziny zastępczej)
  const fatherEligibleForPaternity =
    fatherUses &&
    aliveChildrenCount > 0 &&
    !(isAdoption && input.adoptionType === 'fosterFamily') &&
    !(
      isAdoption &&
      input.childAgeYears !== null &&
      input.childAgeYears >= params.paternityLeave.adoptionMaxChildAgeYears
    );

  if (isAdoption && input.adoptionType === 'fosterFamily' && fatherUses) {
    explanations.push({
      message:
        'Urlop ojcowski nie przysługuje w ramach rodziny zastępczej – dotyczy wyłącznie ojców biologicznych i adopcyjnych.',
      legalBasis: 'KP art. 182³ § 1',
    });
  }

  const periods: LeavePeriod[] = [];

  function appendDays(
    role: ParentRole,
    type: LeavePeriod['leaveType'],
    from: string,
    days: number,
    rate: number,
  ) {
    if (days <= 0) return;
    const parent = role === 'mother' ? input.mother : input.father!;
    amount(parent.benefitBase, `${role}.benefitBase`);
    const money = calculateBenefitAmount(parent.benefitBase, rate, days);
    periods.push({
      parentRole: role,
      leaveType: type,
      startDate: from,
      endDate: addDays(from, days - 1),
      weeks: Math.ceil(days / 7),
      days,
      rate,
      monthlyAmount: roundPln(parent.benefitBase * rate),
      totalAmount: money.totalAmount,
    });
  }

  function appendWeeks(
    role: ParentRole,
    type: LeavePeriod['leaveType'],
    from: string,
    weeks: number,
    rate: number,
  ) {
    appendDays(role, type, from, weeks * 7, rate);
  }

  let currentDate = start;
  let supplementaryOwner: ParentRole | null = null;
  const motherMaternityRate = effectiveCombined ? params.rates.combined : params.rates.maternity;
  const motherParentalRate = effectiveCombined ? params.rates.combined : params.rates.parental;
  const fatherParentalRate =
    effectiveCombined && motherUses
      ? params.rates.secondParentNonTransferableInCombined
      : params.rates.parental;

  // --- 1. Urlop macierzyński / na warunkach macierzyńskiego (z uwzględnieniem przejęcia przez ojca) ---
  if (motherDeceasedOrAbandoned && fatherUses) {
    const motherUsedWeeks = Math.min(
      maternityWeeks,
      Math.max(0, input.motherUsedWeeksBeforeTakeover ?? 0),
    );
    if (motherUsedWeeks > 0 && motherEligible) {
      appendWeeks('mother', primaryLeaveType, currentDate, motherUsedWeeks, params.rates.maternity);
      currentDate = addDays(currentDate, motherUsedWeeks * 7);
    }
    const fatherTakeoverDays = Math.max(0, maternityDays - motherUsedWeeks * 7);
    appendDays('father', primaryLeaveType, currentDate, fatherTakeoverDays, params.rates.maternity);
    currentDate = addDays(currentDate, fatherTakeoverDays);
    supplementaryOwner = 'father';
    explanations.push({
      message: input.special.motherDeceased
        ? `W związku ze śmiercią matki ubezpieczony ojciec przejmuje pozostałą część urlopu macierzyńskiego (${formatPercentPl(params.rates.maternity)} podstawy wymiaru).`
        : `W związku z porzuceniem dziecka przez matkę ubezpieczony ojciec przejmuje pozostałą część urlopu macierzyńskiego (${formatPercentPl(params.rates.maternity)} podstawy wymiaru).`,
      legalBasis: 'KP art. 180 § 12–13; ustawa zasiłkowa art. 29 ust. 5',
    });
  } else if (motherEligible && motherTakesSpecialTransfer && fatherUses && aliveChildrenCount > 0) {
    const mandatorySpecial = params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate;
    if (input.special.motherHospitalized) {
      const motherBefore = Math.min(
        maternityWeeks,
        Math.max(0, input.motherUsedWeeksBeforeTakeover ?? mandatorySpecial),
      );
      const remainingAfterBefore = Math.max(0, maternityWeeks - motherBefore);
      const hospWeeks =
        input.motherHospitalizationWeeks !== undefined
          ? Math.min(remainingAfterBefore, Math.max(1, input.motherHospitalizationWeeks))
          : remainingAfterBefore;
      const motherAfter = Math.max(0, remainingAfterBefore - hospWeeks);

      if (motherBefore > 0) {
        appendWeeks('mother', primaryLeaveType, currentDate, motherBefore, motherMaternityRate);
        currentDate = addDays(currentDate, motherBefore * 7);
      }
      if (hospWeeks > 0) {
        appendWeeks('father', primaryLeaveType, currentDate, hospWeeks, params.rates.maternity);
        currentDate = addDays(currentDate, hospWeeks * 7);
      }
      if (motherAfter > 0) {
        appendWeeks('mother', primaryLeaveType, currentDate, motherAfter, motherMaternityRate);
        currentDate = addDays(currentDate, motherAfter * 7);
      }
      supplementaryOwner = motherAfter > 0 ? 'mother' : 'father';
      explanations.push({
        message:
          input.motherHospitalizationWeeks !== undefined
            ? `W czasie pobytu matki w szpitalu (${hospWeeks} tyg.) urlop macierzyński przejmuje ojciec dziecka (${formatPercentPl(params.rates.maternity)} podstawy wymiaru).`
            : `Ze względu na pobyt matki w szpitalu ojciec może przejąć urlop macierzyński na okres hospitalizacji (przyjęto przejęcie po ${motherBefore} tyg. na pozostałe ${hospWeeks} tyg., ${formatPercentPl(params.rates.maternity)} podstawy).`,
        legalBasis: 'KP art. 180 § 10; ustawa zasiłkowa art. 29 ust. 5',
      });
    } else {
      // Niezdolność matki do samodzielnej egzystencji (po min. 8 tyg.)
      const motherPart = Math.min(
        maternityWeeks,
        Math.max(mandatorySpecial, input.motherUsedWeeksBeforeTakeover ?? mandatorySpecial),
      );
      const fatherPart = Math.max(0, maternityWeeks - motherPart);
      appendWeeks('mother', primaryLeaveType, currentDate, motherPart, motherMaternityRate);
      currentDate = addDays(currentDate, motherPart * 7);
      if (fatherPart > 0) {
        appendWeeks('father', primaryLeaveType, currentDate, fatherPart, params.rates.maternity);
        currentDate = addDays(currentDate, fatherPart * 7);
      }
      supplementaryOwner = fatherPart > 0 ? 'father' : 'mother';
      explanations.push({
        message: `Przy orzeczeniu o niezdolności matki do samodzielnej egzystencji matka wykorzystuje ${motherPart} tyg. urlopu macierzyńskiego, a pozostałe ${fatherPart} tyg. przejmuje ojciec dziecka.`,
        legalBasis: 'KP art. 180 § 6–7; ustawa zasiłkowa art. 29 ust. 5',
      });
    }
  } else if (motherEligible && !input.mother.wantsLeave && fatherUses && aliveChildrenCount > 0) {
    // Rezygnacja matki po obowiązkowych 14 tygodniach – przejęcie reszty przez ojca
    const mandatory = Math.min(
      maternityWeeks,
      Math.max(
        params.maternityLeave.motherMandatoryWeeksAfterBirth,
        input.motherUsedWeeksBeforeTakeover ?? params.maternityLeave.motherMandatoryWeeksAfterBirth,
      ),
    );
    const fatherTakeover = Math.max(0, maternityWeeks - mandatory);
    appendWeeks('mother', primaryLeaveType, currentDate, mandatory, params.rates.maternity);
    currentDate = addDays(currentDate, mandatory * 7);
    if (fatherTakeover > 0) {
      appendWeeks('father', primaryLeaveType, currentDate, fatherTakeover, params.rates.maternity);
      currentDate = addDays(currentDate, fatherTakeover * 7);
    }
    supplementaryOwner = 'father';
    explanations.push({
      message: `Pierwsze ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodni urlopu macierzyńskiego po porodzie matka musi wykorzystać osobiście; pozostałe ${fatherTakeover} tygodni przejmuje ojciec dziecka bezpośrednio po zakończeniu części matki.`,
      legalBasis: 'KP art. 180 § 4–5',
    });
  } else if (motherUses) {
    appendDays('mother', primaryLeaveType, currentDate, maternityDays, motherMaternityRate);
    currentDate = addDays(currentDate, maternityDays);
    supplementaryOwner = 'mother';
    if (input.special.motherHospitalized || input.special.motherIncapableOfIndependentLiving) {
      explanations.push({
        message: `W obecnej sytuacji (hospitalizacja lub niezdolność do samodzielnej egzystencji) ubezpieczony ojciec mógłby przejąć część urlopu macierzyńskiego wcześniej niż po ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodniach (po ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tyg.), lecz drugi rodzic nie jest włączony do planu.`,
        legalBasis: 'KP art. 180 § 6–10',
      });
    }
  } else if (motherEligible && !input.mother.wantsLeave && !fatherUses) {
    explanations.push({
      message: `Matka zadeklarowała brak korzystania z urlopu. Uwaga: zgodnie z Kodeksem pracy pracownica nie może zrezygnować z pierwszych ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodni urlopu macierzyńskiego po porodzie.`,
      legalBasis: 'KP art. 180 § 4',
    });
  }

  // --- 2. Uzupełniający urlop macierzyński (1 część, bezpośrednio po macierzyńskim, 100%) ---
  if (supplementaryWeeks > 0 && supplementaryOwner !== null) {
    appendWeeks(
      supplementaryOwner,
      'supplementaryMaternityLeave',
      currentDate,
      supplementaryWeeks,
      params.rates.supplementaryMaternity,
    );
    currentDate = addDays(currentDate, supplementaryWeeks * 7);
  }

  // --- 3. Urlop rodzicielski ---
  const parentalStartDate = currentDate;
  const maxOneParentParental = Math.max(0, pool - nonTransferable);

  if (pool > 0) {
    if (motherUses && !motherDeceasedOrAbandoned) {
      appendWeeks(
        'mother',
        'parentalLeave',
        parentalStartDate,
        maxOneParentParental,
        motherParentalRate,
      );
      if (fatherUses) {
        appendWeeks(
          'father',
          'parentalLeave',
          parentalStartDate,
          nonTransferable,
          fatherParentalRate,
        );
      } else {
        explanations.push({
          message: `Z łącznej puli ${pool} tygodni urlopu rodzicielskiego jeden rodzic może wykorzystać maksymalnie ${maxOneParentParental} tygodni. Pozostałe ${nonTransferable} tygodni stanowi wyłączną, nieprzenoszalną część drugiego rodzica – zgodnie z Kodeksem pracy nie przechodzi na pierwszego rodzica (również w planie samodzielnego rodzica) i przepada, jeśli drugi rodzic z niej nie skorzysta.`,
          legalBasis: 'KP art. 182¹a § 4',
        });
      }
    } else if (fatherUses) {
      // Ojciec korzysta samodzielnie (matka nieubezpieczona w dniu porodu albo zmarła / zrezygnowała)
      const fatherParentalStart =
        motherDeceasedOrAbandoned || motherEligible ? parentalStartDate : start;
      appendWeeks(
        'father',
        'parentalLeave',
        fatherParentalStart,
        maxOneParentParental,
        params.rates.parental,
      );
      if (!motherEligible) {
        explanations.push({
          message: `Mimo braku ubezpieczenia chorobowego matki na dzień zdarzenia, ubezpieczonemu ojcu przysługuje urlop rodzicielski (${maxOneParentParental} tyg., ${formatPercentPl(params.rates.parental)}). Pozostałe ${nonTransferable} tygodni stanowi nieprzenoszalną część drugiego rodzica.`,
          legalBasis: 'KP art. 182¹a § 4; ustawa zasiłkowa art. 29a',
        });
      } else {
        explanations.push({
          message: `Ojciec może wykorzystać maksymalnie ${maxOneParentParental} z ${pool} tygodni urlopu rodzicielskiego; ${nonTransferable} tygodni pozostaje nieprzenoszalną częścią drugiego rodzica.`,
          legalBasis: 'KP art. 182¹a § 4',
        });
      }
    }
  }

  // --- 4. Urlop ojcowski (2 tygodnie, 100%) ---
  if (fatherEligibleForPaternity) {
    appendWeeks(
      'father',
      'paternityLeave',
      start,
      params.paternityLeave.weeks,
      params.rates.paternity,
    );
  }

  // --- 5. Porównanie wariantów 100%+70% vs 81,5% ---
  let variants: MaternityCalculationResult['variants'] = null;
  if (
    motherUses &&
    !motherDeceasedOrAbandoned &&
    input.mother.benefitBase !== null &&
    pool > 0 &&
    aliveChildrenCount > 0
  ) {
    const motherBase = input.mother.benefitBase;
    const fatherBase = fatherUses ? (input.father?.benefitBase ?? 0) : 0;
    const suppAmount =
      supplementaryWeeks > 0 && supplementaryOwner !== null
        ? calculateBenefitAmount(
            supplementaryOwner === 'mother' ? motherBase : fatherBase,
            params.rates.supplementaryMaternity,
            supplementaryWeeks * 7,
          ).totalAmount
        : 0;
    const paternityAmount = fatherEligibleForPaternity
      ? calculateBenefitAmount(fatherBase, params.rates.paternity, params.paternityLeave.weeks * 7)
          .totalAmount
      : 0;

    // Zlicz dni urlopu macierzyńskiego matki i ojca (przy ewentualnym przejęciu)
    const motherMatDays = periods
      .filter((p) => p.leaveType === primaryLeaveType && p.parentRole === 'mother')
      .reduce((sum, p) => sum + p.days, 0);
    const fatherMatDays = periods
      .filter((p) => p.leaveType === primaryLeaveType && p.parentRole === 'father')
      .reduce((sum, p) => sum + p.days, 0);

    const fatherMatAmount =
      fatherMatDays > 0
        ? calculateBenefitAmount(fatherBase, params.rates.maternity, fatherMatDays).totalAmount
        : 0;
    const fatherParStd = fatherUses
      ? calculateBenefitAmount(fatherBase, params.rates.parental, nonTransferable * 7).totalAmount
      : 0;
    const fatherParComb = fatherUses
      ? calculateBenefitAmount(
          fatherBase,
          params.rates.secondParentNonTransferableInCombined,
          nonTransferable * 7,
        ).totalAmount
      : 0;

    const stdTotal = roundPln(
      calculateBenefitAmount(motherBase, params.rates.maternity, motherMatDays).totalAmount +
        fatherMatAmount +
        suppAmount +
        calculateBenefitAmount(motherBase, params.rates.parental, maxOneParentParental * 7)
          .totalAmount +
        fatherParStd +
        paternityAmount,
    );

    const combTotal = roundPln(
      calculateBenefitAmount(motherBase, params.rates.combined, motherMatDays).totalAmount +
        fatherMatAmount +
        suppAmount +
        calculateBenefitAmount(motherBase, params.rates.combined, maxOneParentParental * 7)
          .totalAmount +
        fatherParComb +
        paternityAmount,
    );

    variants = { standard: stdTotal, combined: combTotal };
  }

  if (periods.length > 0 && !hasChildLoss) {
    explanations.push({
      message: `Kwoty brutto obliczone z ustawowym dzielnikiem dziennym 30. W wariancie ${formatPercentPl(params.rates.combined)} pełny urlop macierzyński i rodzicielski matki wypłacany jest w jednolitej stawce, natomiast ${nonTransferable} tygodni nieprzenoszalnych drugiego rodzica zawsze wynosi ${formatPercentPl(params.rates.secondParentNonTransferableInCombined)}.`,
      legalBasis:
        'KP art. 180, art. 182¹a, art. 182¹c, art. 182³; ustawa zasiłkowa art. 30a–31, art. 36 ust. 3',
    });
  } else if (periods.length === 0 && explanations.length === 0) {
    explanations.push({
      message: 'Brak uprawnionych okresów zasiłku macierzyńskiego dla podanego scenariusza.',
      legalBasis: 'Ustawa zasiłkowa art. 29',
    });
  }

  return {
    periods,
    totalAmount: roundPln(periods.reduce((sum, period) => sum + period.totalAmount, 0)),
    variants,
    warnings: eligibility.warnings,
    explanations,
  };
}
