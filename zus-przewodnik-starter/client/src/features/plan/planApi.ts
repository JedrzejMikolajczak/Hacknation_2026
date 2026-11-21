import type {
  BenefitParams,
  DocumentChecklist,
  EligibilityResult,
  Entitlement,
  Explanation,
  LeavePeriod,
  MaternityCalculationResult,
  ParentData,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  Payer,
  RequiredDocument,
  ScenarioInput,
  SicknessResult,
  Warning,
} from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { DEFAULT_PARAMS, formatRate } from '../../app/benefitParams';
import { addDaysIso, diffDaysIso, getScenarioEventDate } from './planScenario';

export interface AssistantAnswer {
  answer: string;
  sources: { title: string; legalBasis: string }[];
  fromApi: boolean;
}

export interface PlanBundleResult {
  params: BenefitParams;
  eligibility: EligibilityResult;
  maternity: MaternityCalculationResult;
  sickness: SicknessResult;
  documents: DocumentChecklist;
  usingApi: boolean;
}

function roundPln(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolvePayer(parent: ParentData, params: BenefitParams): Payer {
  if (
    parent.insuranceTitle === 'employment' &&
    parent.employerInsuredCount !== null &&
    parent.employerInsuredCount > params.payerThresholdInsuredCount
  ) {
    return 'employer';
  }
  return 'zus';
}

function getMaternityWeeks(childrenCount: number, params: BenefitParams): number {
  const key = String(Math.min(Math.max(childrenCount, 1), 5)) as '1' | '2' | '3' | '4' | '5';
  return params.maternityLeave.weeksByChildrenCount[key];
}

function getTotalParentalWeeks(scenario: ScenarioInput, params: BenefitParams): number {
  if (scenario.special.zaZyciemCertificate) {
    return scenario.childrenCount > 1
      ? params.parentalLeave.weeksMultipleChildrenZaZyciem
      : params.parentalLeave.weeksSingleChildZaZyciem;
  }
  return scenario.childrenCount > 1
    ? params.parentalLeave.weeksMultipleChildren
    : params.parentalLeave.weeksSingleChild;
}

function getSupplementaryWeeks(scenario: ScenarioInput, params: BenefitParams): number {
  const { pregnancyWeekAtBirth, birthWeightGrams, hospitalizationDays } = scenario.special;
  if (hospitalizationDays === null || hospitalizationDays <= 0) return 0;

  const matchingCase = params.supplementaryMaternityLeave.cases.find((item) => {
    if (
      item.maxPregnancyWeekExclusive !== null &&
      (pregnancyWeekAtBirth === null || pregnancyWeekAtBirth >= item.maxPregnancyWeekExclusive)
    ) {
      return false;
    }
    if (
      item.minPregnancyWeek !== null &&
      (pregnancyWeekAtBirth === null || pregnancyWeekAtBirth < item.minPregnancyWeek)
    ) {
      return false;
    }
    if (
      item.maxBirthWeightGrams !== null &&
      (birthWeightGrams === null || birthWeightGrams > item.maxBirthWeightGrams)
    ) {
      return false;
    }
    if (
      item.minBirthWeightGramsExclusive !== null &&
      (birthWeightGrams === null || birthWeightGrams <= item.minBirthWeightGramsExclusive)
    ) {
      return false;
    }
    if (
      item.minHospitalizationDays !== null &&
      hospitalizationDays < item.minHospitalizationDays
    ) {
      return false;
    }
    return true;
  });

  if (!matchingCase) return 0;
  const hospitalWeeks = Math.ceil(hospitalizationDays / 7);
  return Math.min(hospitalWeeks, matchingCase.limitWeekAfterBirth);
}

function calculatePeriodMoney(benefitBase: number, rate: number, days: number) {
  const monthlyAmount = roundPln(benefitBase * rate);
  const dailyAmount = roundPln((benefitBase / 30) * rate);
  const totalAmount = roundPln(dailyAmount * days);
  return { monthlyAmount, totalAmount };
}

/* ---------- Fallback obliczeń z shared/params.json (gdy backend nie ma jeszcze tras silnika) ---------- */

export function fallbackEligibility(
  scenario: ScenarioInput,
  params: BenefitParams,
): EligibilityResult {
  const warnings: Warning[] = [];
  const entitlements: Entitlement[] = [];
  const eventDate = getScenarioEventDate(scenario);
  const mother = scenario.mother;
  const payer = resolvePayer(mother, params);

  const debtThreshold = roundPln(
    params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage,
  );
  const hasBlockingDebt =
    mother.insuranceTitle === 'selfEmployed' &&
    mother.contributionDebt !== null &&
    mother.contributionDebt > debtThreshold;

  if (hasBlockingDebt) {
    warnings.push({
      code: 'SELF_EMPLOYED_DEBT',
      message: `Zadłużenie składkowe w JDG (${mother.contributionDebt} zł) przekracza próg 1% minimalnego wynagrodzenia (${debtThreshold} zł). Zasiłek nie zostanie wypłacony do czasu spłaty zaległości.`,
      legalBasis: 'Ustawa zasiłkowa art. 2a',
    });
  }

  const contractEndsBeforeBirth =
    mother.insuranceEndDate !== null && diffDaysIso(mother.insuranceEndDate, eventDate) > 0;
  if (contractEndsBeforeBirth) {
    warnings.push({
      code: 'CONTRACT_ENDS_BEFORE_BIRTH',
      message: `Koniec ubezpieczenia (${mother.insuranceEndDate}) przypada przed przewidywaną datą porodu (${eventDate}). Sprawdź ochronę z KP art. 177 § 3 (przedłużenie umowy do dnia porodu po 3. miesiącu ciąży).`,
      legalBasis: 'KP art. 177 § 3; ustawa zasiłkowa art. 30',
    });
  }

  const hasInsurance =
    mother.insuranceTitle !== 'none' && mother.sicknessInsurance !== 'none';

  if (!hasInsurance) {
    warnings.push({
      code: 'NO_INSURANCE_ON_BIRTH_DATE',
      message:
        'Brak aktywnego ubezpieczenia chorobowego w dniu porodu lub przyjęcia dziecka oznacza brak prawa do zasiłku macierzyńskiego z ZUS (można jednak ubiegać się o świadczenie rodzicielskie „Kosiniakowe” z urzędu gminy).',
      legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1',
    });
  }

  const waitingRequiredDays =
    mother.sicknessInsurance === 'mandatory'
      ? params.sickness.waitingPeriodDaysMandatory
      : mother.sicknessInsurance === 'voluntary'
        ? params.sickness.waitingPeriodDaysVoluntary
        : 0;

  const insuredDays =
    mother.insuredSince !== null
      ? Math.max(0, diffDaysIso(mother.insuredSince, scenario.referenceDate))
      : 0;
  const waitingNotMet = hasInsurance && waitingRequiredDays > 0 && insuredDays < waitingRequiredDays;

  if (waitingNotMet) {
    warnings.push({
      code: 'WAITING_PERIOD_NOT_MET',
      message: `Okres wyczekiwania na zasiłek chorobowy wynosi ${waitingRequiredDays} dni (obecny staż: ${insuredDays} dni). Okres wyczekiwania nie dotyczy jednak zasiłku macierzyńskiego.`,
      legalBasis: 'Ustawa zasiłkowa art. 4 ust. 1',
    });
  }

  if (scenario.situation === 'afterBirth' && scenario.rateVariant === 'combined') {
    const deadline = addDaysIso(eventDate, params.combinedRateApplicationDeadlineDays);
    warnings.push({
      code: 'COMBINED_RATE_DEADLINE',
      message: `Aby otrzymać jednolitą stawkę ${formatRate(params.rates.combined)}, wniosek o pełny wymiar urlopu trzeba złożyć najpóźniej w ciągu ${params.combinedRateApplicationDeadlineDays} dni od porodu (do ${deadline}).`,
      legalBasis: 'Ustawa zasiłkowa art. 30a',
    });
  }

  // 1. Zasiłek macierzyński – matka
  const motherMaternityEntitled = hasInsurance && !hasBlockingDebt && !contractEndsBeforeBirth;
  entitlements.push({
    benefit: 'maternityBenefit',
    parentRole: 'mother',
    entitled: motherMaternityEntitled,
    payer: motherMaternityEntitled ? payer : null,
    reason: motherMaternityEntitled
      ? {
          message:
            'Przysługuje na podstawie czynnego ubezpieczenia chorobowego w dniu porodu lub przyjęcia dziecka (bez okresu wyczekiwania).',
          legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1',
        }
      : {
          message: hasBlockingDebt
            ? 'Nie przysługuje do czasu uregulowania zadłużenia składkowego w JDG powyżej 1% płacy minimalnej.'
            : contractEndsBeforeBirth
              ? 'Nie przysługuje, ponieważ ubezpieczenie wygasa przed datą porodu (chyba że umowa podlega przedłużeniu z mocy KP art. 177 § 3).'
              : 'Nie przysługuje z powodu braku ubezpieczenia chorobowego.',
          legalBasis: hasBlockingDebt
            ? 'Ustawa zasiłkowa art. 2a'
            : 'Ustawa zasiłkowa art. 29 ust. 1',
        },
  });

  // 2. Zasiłek chorobowy w ciąży – matka
  const sicknessEntitled = hasInsurance && !hasBlockingDebt && !waitingNotMet;
  entitlements.push({
    benefit: 'sicknessBenefit',
    parentRole: 'mother',
    entitled: sicknessEntitled,
    payer: sicknessEntitled ? payer : null,
    reason: sicknessEntitled
      ? {
          message: `Przysługuje w wysokości ${formatRate(params.rates.sicknessPregnancy)} podstawy wymiaru (kod „B”) maksymalnie do ${params.sickness.maxBenefitPeriodDays} dni.`,
          legalBasis: 'Ustawa zasiłkowa art. 4, art. 8, art. 11 ust. 2 pkt 1',
        }
      : {
          message: hasBlockingDebt
            ? 'Wstrzymane z powodu zadłużenia składkowego JDG.'
            : waitingNotMet
              ? `Wymagany okres wyczekiwania (${waitingRequiredDays} dni) nie został jeszcze osiągnięty.`
              : 'Brak czynnego ubezpieczenia chorobowego.',
          legalBasis: 'Ustawa zasiłkowa art. 4 ust. 1',
        },
  });

  // 3. Zasiłek w wysokości zasiłku macierzyńskiego (upadłość/likwidacja pracodawcy)
  if (scenario.special.employerBankruptcyOrLiquidation) {
    entitlements.push({
      benefit: 'maternityEquivalentBenefit',
      parentRole: 'mother',
      entitled: mother.insuranceTitle === 'employment',
      payer: 'zus',
      reason: {
        message:
          'W przypadku upadłości lub likwidacji pracodawcy w trakcie ciąży ZUS wypłaca zasiłek w wysokości zasiłku macierzyńskiego do dnia porodu.',
        legalBasis: 'Ustawa zasiłkowa art. 30 ust. 3',
      },
    });
  }

  // 4. Drugi rodzic (urlop ojcowski i nieprzenoszalna część rodzicielskiego)
  if (scenario.father) {
    const fatherInsured =
      scenario.father.insuranceTitle !== 'none' && scenario.father.sicknessInsurance !== 'none';
    const fatherDebtBlocked =
      scenario.father.insuranceTitle === 'selfEmployed' &&
      scenario.father.contributionDebt !== null &&
      scenario.father.contributionDebt > debtThreshold;
    const fatherEntitled = fatherInsured && !fatherDebtBlocked;

    entitlements.push({
      benefit: 'maternityBenefit',
      parentRole: 'father',
      entitled: fatherEntitled,
      payer: fatherEntitled ? resolvePayer(scenario.father, params) : null,
      reason: fatherEntitled
        ? {
            message: `Przysługuje ${params.paternityLeave.weeks} tyg. urlopu ojcowskiego (${formatRate(params.rates.paternity)}) oraz min. ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. nieprzenoszalnego urlopu rodzicielskiego (${formatRate(params.rates.secondParentNonTransferableInCombined)}).`,
            legalBasis: 'KP art. 182¹a § 4, art. 182³',
          }
        : {
            message: fatherDebtBlocked
              ? 'Zadłużenie składkowe ojca w JDG blokuje wypłatę świadczenia do czasu spłaty.'
              : 'Drugi rodzic nie podlega ubezpieczeniu chorobowemu.',
            legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1',
          },
    });
  }

  return { entitlements, warnings };
}

export function fallbackMaternityCalculation(
  scenario: ScenarioInput,
  params: BenefitParams,
): MaternityCalculationResult {
  const eligibility = fallbackEligibility(scenario, params);
  const motherBase = scenario.mother.benefitBase ?? 0;
  const fatherBase = scenario.father?.benefitBase ?? motherBase;
  const startDate = getScenarioEventDate(scenario);
  const periods: LeavePeriod[] = [];
  const explanations: Explanation[] = [];

  const motherEntitled = eligibility.entitlements.some(
    (item) => item.benefit === 'maternityBenefit' && item.parentRole === 'mother' && item.entitled,
  );

  if (!motherEntitled || motherBase <= 0) {
    return {
      periods: [],
      totalAmount: 0,
      variants: null,
      explanations: [
        {
          message:
            'Brak prawa do zasiłku macierzyńskiego dla matki lub nie podano podstawy wymiaru zasiłku.',
          legalBasis: 'Ustawa zasiłkowa art. 29',
        },
      ],
      warnings: eligibility.warnings,
    };
  }

  // Sytuacja trudna: martwe urodzenie / zgon dziecka
  if (scenario.special.stillbirth || scenario.special.childDeathDate) {
    const deathDate = scenario.special.childDeathDate ?? startDate;
    const daysAfterBirth = Math.max(0, diffDaysIso(startDate, deathDate));
    const thresholdDays = params.childDeath.thresholdWeeksOfLife * 7;
    let totalDays: number;
    if (scenario.special.stillbirth || daysAfterBirth < thresholdDays) {
      const eightWeeksEnd = addDaysIso(
        startDate,
        params.childDeath.weeksAfterBirthIfBeforeThreshold * 7 - 1,
      );
      const sevenDaysAfterDeathEnd = addDaysIso(deathDate, params.childDeath.minDaysAfterDeath - 1);
      const endDate = eightWeeksEnd >= sevenDaysAfterDeathEnd ? eightWeeksEnd : sevenDaysAfterDeathEnd;
      totalDays = diffDaysIso(startDate, endDate) + 1;
    } else {
      totalDays = daysAfterBirth + params.childDeath.minDaysAfterDeath;
    }
    const endDate = addDaysIso(startDate, totalDays - 1);
    const money = calculatePeriodMoney(motherBase, params.rates.maternity, totalDays);
    periods.push({
      leaveType: 'maternityLeave',
      parentRole: 'mother',
      startDate,
      endDate,
      weeks: Math.ceil(totalDays / 7),
      days: totalDays,
      rate: params.rates.maternity,
      ...money,
    });
    explanations.push({
      message: `W przypadku martwego urodzenia lub zgonu dziecka przed upływem ${params.childDeath.thresholdWeeksOfLife}. tygodnia życia przysługuje ${params.childDeath.weeksAfterBirthIfBeforeThreshold} tygodni urlopu macierzyńskiego po porodzie, nie krócej niż ${params.childDeath.minDaysAfterDeath} dni od dnia zgonu.`,
      legalBasis: 'KP art. 180¹',
    });
    return {
      periods,
      totalAmount: money.totalAmount,
      variants: null,
      explanations,
      warnings: eligibility.warnings,
    };
  }

  const maternityWeeks = getMaternityWeeks(scenario.childrenCount, params);
  const supplementaryWeeks = getSupplementaryWeeks(scenario, params);
  const totalParentalWeeks = getTotalParentalWeeks(scenario, params);
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const motherParentalWeeks = totalParentalWeeks - nonTransferable;
  const fatherEligible =
    Boolean(scenario.father) &&
    eligibility.entitlements.some(
      (item) => item.benefit === 'maternityBenefit' && item.parentRole === 'father' && item.entitled,
    );

  const isCombined = scenario.rateVariant === 'combined';
  const maternityRate = isCombined ? params.rates.combined : params.rates.maternity;
  const motherParentalRate = isCombined ? params.rates.combined : params.rates.parental;
  const fatherParentalRate = isCombined
    ? params.rates.secondParentNonTransferableInCombined
    : params.rates.parental;

  let cursor = startDate;
  const matDays = maternityWeeks * 7;
  const matEnd = addDaysIso(cursor, matDays - 1);
  periods.push({
    leaveType:
      scenario.situation === 'adoption' ? 'adoptionMaternityLeave' : 'maternityLeave',
    parentRole: 'mother',
    startDate: cursor,
    endDate: matEnd,
    weeks: maternityWeeks,
    days: matDays,
    rate: maternityRate,
    ...calculatePeriodMoney(motherBase, maternityRate, matDays),
  });
  cursor = addDaysIso(matEnd, 1);

  if (supplementaryWeeks > 0) {
    const suppDays = supplementaryWeeks * 7;
    const suppEnd = addDaysIso(cursor, suppDays - 1);
    periods.push({
      leaveType: 'supplementaryMaternityLeave',
      parentRole: 'mother',
      startDate: cursor,
      endDate: suppEnd,
      weeks: supplementaryWeeks,
      days: suppDays,
      rate: params.rates.supplementaryMaternity,
      ...calculatePeriodMoney(motherBase, params.rates.supplementaryMaternity, suppDays),
    });
    cursor = addDaysIso(suppEnd, 1);
    explanations.push({
      message: `Uwzględniono uzupełniający urlop macierzyński (${supplementaryWeeks} tyg., ${formatRate(params.rates.supplementaryMaternity)}) ze względu na wcześniactwo lub hospitalizację dziecka.`,
      legalBasis: 'KP art. 180²',
    });
  }

  const motherParDays = motherParentalWeeks * 7;
  const motherParEnd = addDaysIso(cursor, motherParDays - 1);
  periods.push({
    leaveType: 'parentalLeave',
    parentRole: 'mother',
    startDate: cursor,
    endDate: motherParEnd,
    weeks: motherParentalWeeks,
    days: motherParDays,
    rate: motherParentalRate,
    ...calculatePeriodMoney(motherBase, motherParentalRate, motherParDays),
  });
  cursor = addDaysIso(motherParEnd, 1);

  if (fatherEligible && scenario.father?.wantsLeave) {
    const fatherParDays = nonTransferable * 7;
    const fatherParEnd = addDaysIso(cursor, fatherParDays - 1);
    periods.push({
      leaveType: 'parentalLeave',
      parentRole: 'father',
      startDate: cursor,
      endDate: fatherParEnd,
      weeks: nonTransferable,
      days: fatherParDays,
      rate: fatherParentalRate,
      ...calculatePeriodMoney(fatherBase, fatherParentalRate, fatherParDays),
    });

    const patDays = params.paternityLeave.weeks * 7;
    const patStart = addDaysIso(startDate, 14);
    const patEnd = addDaysIso(patStart, patDays - 1);
    periods.push({
      leaveType: 'paternityLeave',
      parentRole: 'father',
      startDate: patStart,
      endDate: patEnd,
      weeks: params.paternityLeave.weeks,
      days: patDays,
      rate: params.rates.paternity,
      ...calculatePeriodMoney(fatherBase, params.rates.paternity, patDays),
    });
  }

  const totalAmount = roundPln(periods.reduce((acc, item) => acc + item.totalAmount, 0));

  // Porównanie obu wariantów dla mamy + taty
  const suppMoney =
    supplementaryWeeks > 0
      ? calculatePeriodMoney(motherBase, params.rates.supplementaryMaternity, supplementaryWeeks * 7)
          .totalAmount
      : 0;
  const fatherCommonMoney =
    fatherEligible && scenario.father?.wantsLeave
      ? calculatePeriodMoney(fatherBase, params.rates.parental, nonTransferable * 7).totalAmount +
        calculatePeriodMoney(fatherBase, params.rates.paternity, params.paternityLeave.weeks * 7)
          .totalAmount
      : 0;

  const standardTotal = roundPln(
    calculatePeriodMoney(motherBase, params.rates.maternity, matDays).totalAmount +
      suppMoney +
      calculatePeriodMoney(motherBase, params.rates.parental, motherParDays).totalAmount +
      fatherCommonMoney,
  );
  const combinedTotal = roundPln(
    calculatePeriodMoney(motherBase, params.rates.combined, matDays + motherParDays).totalAmount +
      suppMoney +
      fatherCommonMoney,
  );

  explanations.push({
    message: `Wymiar urlopu dla ${scenario.childrenCount} ${scenario.childrenCount === 1 ? 'dziecka' : 'dzieci'}: ${maternityWeeks} tyg. macierzyńskiego oraz ${totalParentalWeeks} tyg. rodzicielskiego (w tym ${nonTransferable} tyg. nieprzenoszalnych dla każdego rodzica).`,
    legalBasis: 'KP art. 180 § 1, art. 182¹a',
  });
  explanations.push({
    message: `W wariancie ${formatRate(params.rates.combined)} nieprzenoszalne ${nonTransferable} tygodni drugiego rodzica pozostaje płatne w wysokości ${formatRate(params.rates.secondParentNonTransferableInCombined)} podstawy wymiaru.`,
    legalBasis: 'Ustawa zasiłkowa art. 31 ust. 4a',
  });

  return {
    periods,
    totalAmount,
    variants: { standard: standardTotal, combined: combinedTotal },
    explanations,
    warnings: eligibility.warnings,
  };
}

export function fallbackSicknessCalculation(
  scenario: ScenarioInput,
  params: BenefitParams,
): SicknessResult {
  const eligibility = fallbackEligibility(scenario, params);
  const sicknessEnt = eligibility.entitlements.find((item) => item.benefit === 'sicknessBenefit');
  const entitled = Boolean(sicknessEnt?.entitled);
  const mother = scenario.mother;
  const employerSickPayDays =
    mother.insuranceTitle === 'employment'
      ? (mother.age ?? 30) >= 50
        ? params.sickness.employerPaidDaysFrom50
        : params.sickness.employerPaidDaysUnder50
      : 0;
  const dailyAmount =
    entitled && mother.benefitBase !== null
      ? roundPln((mother.benefitBase / 30) * params.rates.sicknessPregnancy)
      : null;

  return {
    entitled,
    employerSickPayDays,
    sicknessBenefitMaxDays: params.sickness.maxBenefitPeriodDays,
    rate: params.rates.sicknessPregnancy,
    dailyAmount,
    explanations: [
      {
        message: entitled
          ? mother.insuranceTitle === 'employment'
            ? `Pracodawca wypłaca wynagrodzenie chorobowe przez pierwsze ${employerSickPayDays} dni w roku, a następnie przysługuje zasiłek chorobowy 100% (kod „B”) do ${params.sickness.maxBenefitPeriodDays} dni.`
            : `Zasiłek chorobowy w ciąży (kod „B”) wynosi ${formatRate(params.rates.sicknessPregnancy)} podstawy wymiaru i przysługuje od 1. dnia niezdolności do pracy, maksymalnie ${params.sickness.maxBenefitPeriodDays} dni.`
          : sicknessEnt?.reason.message ?? 'Brak prawa do zasiłku chorobowego.',
        legalBasis: 'KP art. 92; ustawa zasiłkowa art. 8, art. 11 ust. 2 pkt 1',
      },
    ],
  };
}

export function fallbackParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): ParentalSplitResult {
  const { scenario, parts } = input;
  const errors: Explanation[] = [];
  const periods: LeavePeriod[] = [];
  const totalPool = getTotalParentalWeeks(scenario, params);
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const maxPerParent = totalPool - nonTransferable;

  if (parts.length > params.parentalLeave.maxParts) {
    errors.push({
      message: `Urlop rodzicielski można podzielić na maksymalnie ${params.parentalLeave.maxParts} części (podano ${parts.length}).`,
      legalBasis: 'KP art. 182¹c § 2',
    });
  }

  let motherWeeks = 0;
  let fatherWeeks = 0;

  for (const part of parts) {
    if (part.weeks <= 0) continue;
    const parent = part.parentRole === 'mother' ? scenario.mother : scenario.father;
    const base = parent?.benefitBase ?? scenario.mother.benefitBase ?? 0;
    const rate =
      scenario.rateVariant === 'combined'
        ? part.parentRole === 'father'
          ? params.rates.secondParentNonTransferableInCombined
          : params.rates.combined
        : params.rates.parental;

    if (part.parentRole === 'mother') {
      motherWeeks += part.weeks;
    } else {
      fatherWeeks += part.weeks;
    }

    const days = part.weeks * 7;
    periods.push({
      parentRole: part.parentRole,
      leaveType: 'parentalLeave',
      startDate: part.startDate,
      endDate: addDaysIso(part.startDate, days - 1),
      weeks: part.weeks,
      days,
      rate,
      ...calculatePeriodMoney(base, rate, days),
    });
  }

  const totalUsed = motherWeeks + fatherWeeks;
  if (motherWeeks > maxPerParent) {
    errors.push({
      message: `Matka przekroczyła limit ${maxPerParent} tyg. (${motherWeeks} tyg.). Pozostałe ${nonTransferable} tyg. jest nieprzenoszalne dla drugiego rodzica.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }
  if (fatherWeeks > maxPerParent) {
    errors.push({
      message: `Drugi rodzic przekroczył limit ${maxPerParent} tyg. (${fatherWeeks} tyg.). Pozostałe ${nonTransferable} tyg. jest nieprzenoszalne dla matki.`,
      legalBasis: 'KP art. 182¹a § 4',
    });
  }
  if (totalUsed > totalPool) {
    errors.push({
      message: `Łączna liczba tygodni (${totalUsed}) przekracza dostępną pulę ${totalPool} tygodni.`,
      legalBasis: 'KP art. 182¹a § 1',
    });
  }

  const remainingPool = Math.max(0, totalPool - totalUsed);
  return {
    valid: errors.length === 0,
    errors,
    periods,
    remainingWeeks: {
      mother: Math.min(remainingPool, Math.max(0, maxPerParent - motherWeeks)),
      father: Math.min(remainingPool, Math.max(0, maxPerParent - fatherWeeks)),
    },
  };
}

export function fallbackParentalWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): ParentalWithWorkResult {
  const { scenario, parentRole, workTimeFraction, startDate, weeks } = input;
  const clampedFraction = Math.min(
    Math.max(workTimeFraction, 0.05),
    params.parentalLeave.maxWorkTimeFraction,
  );
  const parent = parentRole === 'mother' ? scenario.mother : scenario.father;
  const base = parent?.benefitBase ?? scenario.mother.benefitBase ?? 0;

  const baseRate =
    scenario.rateVariant === 'combined'
      ? parentRole === 'father'
        ? params.rates.secondParentNonTransferableInCombined
        : params.rates.combined
      : params.rates.parental;

  const workedDays = weeks * 7;
  const extendedDays = Math.round(workedDays * clampedFraction);
  const extendedWeeks = Math.floor(extendedDays / 7);
  const workedRate = roundPln(baseRate * (1 - clampedFraction));

  const periods: LeavePeriod[] = [
    {
      parentRole,
      leaveType: 'parentalLeave',
      startDate,
      endDate: addDaysIso(startDate, workedDays - 1),
      weeks,
      days: workedDays,
      rate: workedRate,
      ...calculatePeriodMoney(base, workedRate, workedDays),
    },
  ];

  if (extendedDays > 0) {
    const extStart = addDaysIso(startDate, workedDays);
    periods.push({
      parentRole,
      leaveType: 'parentalLeave',
      startDate: extStart,
      endDate: addDaysIso(extStart, extendedDays - 1),
      weeks: extendedWeeks,
      days: extendedDays,
      rate: baseRate,
      ...calculatePeriodMoney(base, baseRate, extendedDays),
    });
  }

  return {
    extendedWeeks,
    extendedDays,
    periods,
    explanations: [
      {
        message: `Łączenie ${weeks} tyg. urlopu rodzicielskiego z pracą na ${clampedFraction} etatu wydłuża urlop o ${extendedDays} dni (${extendedWeeks} tyg.). W czasie pracy zasiłek ulega proporcjonalnemu zmniejszeniu do ${formatRate(workedRate)} podstawy.`,
        legalBasis: 'KP art. 182¹f; ustawa zasiłkowa art. 31 ust. 4',
      },
    ],
  };
}

export function fallbackDocumentsChecklist(
  scenario: ScenarioInput,
  params: BenefitParams,
): DocumentChecklist {
  const payer = resolvePayer(scenario.mother, params);
  const eventDate = getScenarioEventDate(scenario);
  const combinedDeadline = addDaysIso(eventDate, params.combinedRateApplicationDeadlineDays);
  const paternityDeadline = addDaysIso(
    addDaysIso(eventDate, 14),
    -params.applicationDeadlinesDays.paternityLeave,
  );
  const documents: RequiredDocument[] = [];
  const deadlines: { label: string; date: string; legalBasis: string | null }[] = [];

  documents.push({
    id: 'birthCertificateShort',
    name: 'Skrócony odpis aktu urodzenia dziecka (lub postanowienie sądu o adopcji/pieczy)',
    submitTo: payer,
    deadline: combinedDeadline,
    note: 'Dostępny elektronicznie w Rejestrze Stanu Cywilnego / mObywatelu. Dołącza się do wniosku o zasiłek macierzyński.',
  });

  if (scenario.mother.insuranceTitle === 'employment') {
    documents.push({
      id: 'employerLeaveApplication',
      name:
        scenario.rateVariant === 'combined'
          ? `Wniosek do pracodawcy o urlop macierzyński i rodzicielski w pełnym wymiarze (stawka ${formatRate(params.rates.combined)})`
          : 'Wniosek do pracodawcy o udzielenie urlopu macierzyńskiego i rodzicielskiego',
      submitTo: 'employer',
      deadline: combinedDeadline,
      note: `Złożenie wniosku do ${params.combinedRateApplicationDeadlineDays} dni po porodzie zapewnia stawkę ${formatRate(params.rates.combined)} za cały okres.`,
    });
  }

  documents.push({
    id: 'ZAM',
    name: 'ZUS ZAM – wniosek o zasiłek macierzyński (od 24.10.2026 obejmuje dawne ZUR i ZAO)',
    submitTo: payer,
    deadline: combinedDeadline,
    note:
      payer === 'employer'
        ? 'Pracodawca zgłaszający > 20 ubezpieczonych wypłaca zasiłek – złóż w dziale kadr lub elektronicznie.'
        : 'Składasz bezpośrednio do ZUS (najwygodniej przez PUE/eZUS).',
  });

  if (
    payer === 'zus' &&
    (scenario.mother.insuranceTitle === 'employment' ||
      scenario.mother.insuranceTitle === 'mandateContract')
  ) {
    const formCode = scenario.mother.insuranceTitle === 'employment' ? 'Z-3' : 'Z-3a';
    documents.push({
      id: formCode,
      name: `ZUS ${formCode} – zaświadczenie płatnika składek`,
      submitTo: 'zus',
      deadline: combinedDeadline,
      note: 'Wystawia i przesyła do ZUS Twój pracodawca/zleceniodawca (druk Z-3b dla JDG został zlikwidowany).',
    });
  }

  if (scenario.situation === 'pregnant') {
    documents.push({
      id: 'ZAS-53',
      name: 'ZUS ZAS-53 – wniosek o zasiłek chorobowy w ciąży (kod „B” – 100%)',
      submitTo: payer,
      deadline: scenario.referenceDate,
      note: 'Wymagany m.in. przy JDG lub gdy wypłatę przejmuje ZUS; zwolnienie e-ZLA trafia do systemu automatycznie.',
    });
  }

  if (scenario.special.zaZyciemCertificate) {
    documents.push({
      id: 'zaZyciemCert',
      name: 'Zaświadczenie lekarskie z ustawy „Za życiem”',
      submitTo: payer,
      deadline: combinedDeadline,
      note: `Uprawnia do wydłużonego urlopu rodzicielskiego (${params.parentalLeave.weeksSingleChildZaZyciem}/${params.parentalLeave.weeksMultipleChildrenZaZyciem} tyg.).`,
    });
  }

  if (scenario.special.hospitalizationDays && scenario.special.hospitalizationDays > 0) {
    documents.push({
      id: 'hospitalCert',
      name: 'Zaświadczenie ze szpitala o okresie pobytu dziecka, tygodniu ciąży i masie urodzeniowej',
      submitTo: payer,
      deadline: addDaysIso(eventDate, params.applicationDeadlinesDays.supplementaryMaternityLeave),
      note: 'Niezbędne do przyznania uzupełniającego urlopu macierzyńskiego (do 8 lub 15 tygodni, 100%).',
    });
  }

  if (scenario.father?.wantsLeave) {
    documents.push({
      id: 'paternityApplication',
      name: 'Wniosek o urlop ojcowski (2 tygodnie) oraz oświadczenie o podziale urlopu rodzicielskiego',
      submitTo: resolvePayer(scenario.father, params),
      deadline: paternityDeadline,
      note: `Wniosek o urlop ojcowski składa się co najmniej ${params.applicationDeadlinesDays.paternityLeave} dni przed rozpoczęciem (do ukończenia 12. mies. życia dziecka).`,
    });
  }

  deadlines.push({
    label: `Termin na wniosek o jednolitą stawkę ${formatRate(params.rates.combined)} (${params.combinedRateApplicationDeadlineDays} dni od porodu/przyjęcia)`,
    date: combinedDeadline,
    legalBasis: 'Ustawa zasiłkowa art. 30a',
  });
  deadlines.push({
    label: `Najpóźniejszy termin złożenia wniosku o urlop rodzicielski (${params.applicationDeadlinesDays.parentalLeave} dni przed rozpoczęciem)`,
    date: addDaysIso(
      addDaysIso(eventDate, getMaternityWeeks(scenario.childrenCount, params) * 7),
      -params.applicationDeadlinesDays.parentalLeave,
    ),
    legalBasis: 'KP art. 182¹d § 1',
  });
  if (scenario.father?.wantsLeave) {
    deadlines.push({
      label: `Przykładowy termin wniosku o urlop ojcowski (${params.applicationDeadlinesDays.paternityLeave} dni przed startem)`,
      date: paternityDeadline,
      legalBasis: 'KP art. 182³ § 2',
    });
  }
  if (scenario.mother.insuranceTitle === 'selfEmployed') {
    deadlines.push({
      label: 'Przypomnienie JDG: ponowne zgłoszenie ZUS ZUA do dobrowolnego chorobowego po zakończeniu zasiłku macierzyńskiego',
      date: addDaysIso(
        eventDate,
        (getMaternityWeeks(scenario.childrenCount, params) +
          getTotalParentalWeeks(scenario, params) -
          params.parentalLeave.nonTransferableWeeksPerParent) *
          7 +
          7,
      ),
      legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 14',
    });
  }

  return { payer, documents, deadlines };
}

/* ---------- Warstwa API z automatycznym fallbackiem ---------- */

export async function fetchPlanBundle(scenario: ScenarioInput): Promise<PlanBundleResult> {
  let params: BenefitParams = DEFAULT_PARAMS;
  try {
    params = await apiGet<BenefitParams>('/params');
  } catch {
    params = DEFAULT_PARAMS;
  }

  const [eligRes, matRes, sickRes, docRes] = await Promise.allSettled([
    apiPost<EligibilityResult>('/eligibility', scenario),
    apiPost<MaternityCalculationResult>('/calculate/maternity', scenario),
    apiPost<SicknessResult>('/calculate/sickness', scenario),
    apiPost<DocumentChecklist>('/documents', scenario),
  ]);

  const usingApi =
    eligRes.status === 'fulfilled' &&
    matRes.status === 'fulfilled' &&
    sickRes.status === 'fulfilled' &&
    docRes.status === 'fulfilled';

  return {
    params,
    eligibility:
      eligRes.status === 'fulfilled' ? eligRes.value : fallbackEligibility(scenario, params),
    maternity:
      matRes.status === 'fulfilled'
        ? matRes.value
        : fallbackMaternityCalculation(scenario, params),
    sickness:
      sickRes.status === 'fulfilled'
        ? sickRes.value
        : fallbackSicknessCalculation(scenario, params),
    documents:
      docRes.status === 'fulfilled' ? docRes.value : fallbackDocumentsChecklist(scenario, params),
    usingApi,
  };
}

export async function fetchParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): Promise<ParentalSplitResult> {
  try {
    return await apiPost<ParentalSplitResult>('/plan/parental-split', input);
  } catch {
    return fallbackParentalSplit(input, params);
  }
}

export async function fetchParentalWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): Promise<ParentalWithWorkResult> {
  try {
    return await apiPost<ParentalWithWorkResult>('/plan/parental-with-work', input);
  } catch {
    return fallbackParentalWithWork(input, params);
  }
}

export async function askGuideAssistant(
  question: string,
  params: BenefitParams,
): Promise<AssistantAnswer> {
  try {
    const res = await apiPost<{ answer: string; sources: string[] }>('/assistant/ask', {
      question,
    });
    return {
      answer: res.answer,
      sources: res.sources.map((src) => ({ title: src, legalBasis: 'Poradnik ZUS 2026' })),
      fromApi: true,
    };
  } catch {
    const lower = question.toLowerCase();
    if (lower.includes('81') || lower.includes('21') || lower.includes('stawk')) {
      return {
        answer: `Jeśli matka złoży wniosek o cały wymiar urlopu macierzyńskiego i rodzicielskiego w ciągu ${params.combinedRateApplicationDeadlineDays} dni od porodu, otrzyma ujednoliconą stawkę ${formatRate(params.rates.combined)} za cały okres. Uwaga: nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni drugiego rodzica zawsze wynosi ${formatRate(params.rates.secondParentNonTransferableInCombined)}. Bez wniosku w 21 dni obowiązuje wariant ${formatRate(params.rates.maternity)} (macierzyński) + ${formatRate(params.rates.parental)} (rodzicielski).`,
        sources: [
          { title: 'Poradnik dla rodziców ZUS 2026', legalBasis: 'Ustawa zasiłkowa art. 30a, art. 31' },
        ],
        fromApi: false,
      };
    }
    if (lower.includes('jdg') || lower.includes('działalno') || lower.includes('zaleg') || lower.includes('zadłuż')) {
      return {
        answer: `Przy działalności gospodarczej (JDG) zasiłek macierzyński i chorobowy przysługują pod warunkiem opłacania dobrowolnego ubezpieczenia chorobowego i braku zadłużenia przekraczającego 1% minimalnego wynagrodzenia (art. 2a ustawy zasiłkowej). Po zakończeniu zasiłku macierzyńskiego pamiętaj o ponownym zgłoszeniu się do dobrowolnego ubezpieczenia chorobowego (ZUS ZUA).`,
        sources: [
          { title: 'Poradnik dla rodziców ZUS 2026', legalBasis: 'Ustawa zasiłkowa art. 2a; art. 14 u.s.u.s.' },
        ],
        fromApi: false,
      };
    }
    if (lower.includes('ojc') || lower.includes('9 tyg') || lower.includes('ojca') || lower.includes('tat')) {
      return {
        answer: `Ojciec ma prawo do ${params.paternityLeave.weeks} tygodni urlopu ojcowskiego (${formatRate(params.rates.paternity)}, do 12. miesiąca życia dziecka, w maksymalnie ${params.paternityLeave.maxParts} częściach) oraz do ${params.parentalLeave.nonTransferableWeeksPerParent} tygodni nieprzenoszalnego urlopu rodzicielskiego (${formatRate(params.rates.parental)}, do końca roku kalendarzowego, w którym dziecko kończy ${params.parentalLeave.deadlineChildTurnsAgeYears} lat).`,
        sources: [
          { title: 'Kodeks pracy – urlopy rodzicielskie', legalBasis: 'KP art. 182¹a § 4, art. 182³' },
        ],
        fromApi: false,
      };
    }
    if (lower.includes('wcześni') || lower.includes('szpital') || lower.includes('uzupełnia')) {
      return {
        answer: `Rodzicom wcześniaków i dzieci hospitalizowanych po porodzie przysługuje uzupełniający urlop macierzyński (100% podstawy wymiaru): 1 tydzień za każdy tydzień pobytu dziecka w szpitalu — do 15 tygodni (urodzenie przed 28. tyg. lub masa ≤ 1000 g) albo do 8 tygodni (od 28. do 37. tyg. z masą > 1000 g lub po 37. tyg. przy hospitalizacji min. 2 kolejne dni między 5. a 28. dniem).`,
        sources: [
          { title: 'Poradnik dla rodziców ZUS 2026', legalBasis: 'KP art. 180²' },
        ],
        fromApi: false,
      };
    }
    return {
      answer: `W celu uzyskania zasiłku macierzyńskiego złóż wniosek ZUS ZAM (od 24.10.2026 zastępuje dawne ZUR i ZAO) wraz ze skróconym odpisem aktu urodzenia. Jeśli pracodawca zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, zasiłek wypłaca pracodawca; w pozostałych przypadkach – ZUS. Możesz też zapytać o stawkę 81,5%, JDG, urlop ojcowski lub urlop uzupełniający.`,
      sources: [
        { title: 'Poradnik dla rodziców ZUS 2026', legalBasis: 'Ustawa zasiłkowa art. 29–31, art. 61' },
      ],
      fromApi: false,
    };
  }
}
