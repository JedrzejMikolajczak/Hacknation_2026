import type {
  BenefitParams,
  EligibilityResult,
  Entitlement,
  Explanation,
  MonthlyBase,
  ParentData,
  Payer,
  WizardScenario,
  SicknessResult,
  Warning,
} from '../types';
import { hasPregnancyBaseIncrease } from './benefitBase';
import {
  addDays,
  addMonths,
  amount,
  calculateBenefitAmount,
  date,
  daysBetween,
  formatPercentPl,
  requireValue,
  roundPln,
  validateParams,
} from './core';

export type EligibilityInput = WizardScenario & {
  sicknessStartDate?: string;
  creditedInsuranceDays?: number;
  waitingPeriodExempt?: boolean;
  unlawfulTerminationConfirmedByCourt?: boolean;
  shamContractRiskHint?: boolean;
  monthlyBases?: readonly MonthlyBase[];
};

export type SicknessInput = EligibilityInput & {
  sicknessDaysUsed?: number;
  employerSickPayDaysUsed?: number;
  yearTurned50?: number;
};

export function resolveParentPayer(parent: ParentData, params: BenefitParams): Payer | null {
  if (parent.insuranceTitle === 'none' || parent.sicknessInsurance === 'none') return null;
  if (parent.insuranceTitle === 'selfEmployed') return 'zus';
  if (parent.employerInsuredCount === null) return null;
  requireValue(
    Number.isInteger(parent.employerInsuredCount) && parent.employerInsuredCount >= 0,
    'employerInsuredCount',
    'Liczba osób zgłaszanych do ubezpieczenia chorobowego (employerInsuredCount) musi być nieujemną liczbą całkowitą.',
  );
  return parent.employerInsuredCount > params.payerThresholdInsuredCount ? 'employer' : 'zus';
}

export function insuranceActive(parent: ParentData, on: string): boolean {
  if (parent.insuranceTitle === 'none' || parent.sicknessInsurance === 'none') return false;
  if (parent.insuredSince !== null && parent.insuranceEndDate !== null) {
    requireValue(
      date(parent.insuranceEndDate, 'insuranceEndDate') >=
        date(parent.insuredSince, 'insuredSince'),
      'insuranceEndDate',
      'Data końca ubezpieczenia (insuranceEndDate) poprzedza początek (insuredSince).',
    );
  }
  const started =
    parent.insuredSince === null || date(parent.insuredSince, 'insuredSince') <= date(on);
  const notEnded =
    parent.insuranceEndDate === null ||
    date(on) <= date(parent.insuranceEndDate, 'insuranceEndDate');
  return started && notEnded;
}

export function debtBlocks(parent: ParentData, params: BenefitParams): boolean {
  if (parent.insuranceTitle !== 'selfEmployed') return false;
  if (parent.contributionDebt === null) return false;
  amount(parent.contributionDebt, 'contributionDebt');
  return (
    parent.contributionDebt >
    params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage
  );
}

export function getAdoptionAgeLimit(input: WizardScenario, params: BenefitParams): number | null {
  if (input.situation !== 'adoption' || input.adoptionType === null) return null;
  if (input.adoptionType === 'adoption') {
    return params.adoptionMaternityLeave.adoptionMaxChildAgeYears;
  }
  return input.schoolObligationDeferred
    ? params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYearsDeferredSchool
    : params.adoptionMaternityLeave.fosterFamilyMaxChildAgeYears;
}

export function checkEligibility(
  input: EligibilityInput,
  params: BenefitParams,
): EligibilityResult {
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
      'Podaj formę przyjęcia dziecka na wychowanie (adoptionType: adoption lub fosterFamily).',
    );
  }

  const on = isAdoption ? input.childAcceptanceDate! : (input.birthDate ?? input.expectedBirthDate);
  requireValue(
    on,
    isAdoption ? 'childAcceptanceDate' : 'birthDate',
    'Podaj datę porodu, przewidywaną datę porodu lub datę przyjęcia dziecka.',
  );
  validateParams(params, on);

  const entitlements: Entitlement[] = [];
  const warnings: Warning[] = [];
  const debtThreshold = roundPln(
    params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage,
  );
  const maxAdoptionAge = getAdoptionAgeLimit(input, params);
  const adoptionOverAgeLimit =
    isAdoption &&
    maxAdoptionAge !== null &&
    input.childAgeYears !== null &&
    input.childAgeYears >= maxAdoptionAge;

  const isBankruptcy = Boolean(input.special.employerBankruptcyOrLiquidation);
  const isUnlawfulTermination = Boolean(input.unlawfulTerminationConfirmedByCourt);
  const hasMaternityEquivalentCause = isBankruptcy || isUnlawfulTermination;
  const motherIsInsuredOrActive = insuranceActive(input.mother, on);

  for (const parent of [input.mother, input.father]) {
    if (!parent) continue;
    const isMother = parent.role === 'mother';
    const active = insuranceActive(parent, on);
    const endsBeforeEvent =
      parent.insuranceTitle !== 'none' &&
      parent.sicknessInsurance !== 'none' &&
      parent.insuranceEndDate !== null &&
      date(parent.insuranceEndDate, 'insuranceEndDate') < date(on);

    const debt = active && debtBlocks(parent, params);
    const payer = active && !debt ? resolveParentPayer(parent, params) : null;
    const missingInsuredSinceNote =
      active && parent.insuredSince === null
        ? ' Nie podano daty rozpoczęcia ubezpieczenia – przyjęto, że trwa w dniu zdarzenia.'
        : '';
    const missingPayerCountNote =
      active && !debt && payer === null && parent.insuranceTitle !== 'selfEmployed'
        ? ` Nie podano liczby ubezpieczonych u płatnika – powyżej ${params.payerThresholdInsuredCount} osób wypłaca płatnik, w przeciwnym razie ZUS.`
        : '';
    const missingDebtNote =
      active && parent.insuranceTitle === 'selfEmployed' && parent.contributionDebt === null
        ? ' Nie podano stanu zadłużenia składkowego – zweryfikuj brak zaległości na koncie PUE/eZUS (art. 2a).'
        : '';

    if (endsBeforeEvent) {
      warnings.push({
        code: 'CONTRACT_ENDS_BEFORE_BIRTH',
        message:
          isMother && parent.insuranceTitle === 'employment'
            ? `Umowa o pracę kończy się (${parent.insuranceEndDate}) przed datą zdarzenia (${on}). Umowa zawarta na czas określony albo na okres próbny przekraczający 1 miesiąc, która uległaby rozwiązaniu po upływie 3. miesiąca ciąży, ulega z mocy prawa przedłużeniu do dnia porodu (KP art. 177 § 3), zachowując prawo do zasiłku macierzyńskiego wypłacanego przez ZUS.`
            : `Ubezpieczenie (${parent.role === 'mother' ? 'matki' : 'ojca'}) kończy się (${parent.insuranceEndDate}) przed datą zdarzenia (${on}). Dla umowy zlecenia i JDG nie obowiązuje przedłużenie umowy do dnia porodu z Kodeksu pracy – wygaśnięcie ubezpieczenia przed porodem oznacza brak prawa do zasiłku macierzyńskiego.`,
        legalBasis:
          isMother && parent.insuranceTitle === 'employment'
            ? 'KP art. 177 § 3; ustawa zasiłkowa art. 30'
            : 'Ustawa zasiłkowa art. 29 ust. 1',
      });
    }

    if (debt) {
      warnings.push({
        code: 'SELF_EMPLOYED_DEBT',
        message: `Zadłużenie składkowe w JDG (${parent.contributionDebt} zł) przekracza próg ${formatPercentPl(params.selfEmployedDebtThresholdShareOfMinimumWage)} minimalnego wynagrodzenia (${debtThreshold} zł). Prawo do zasiłku nie przysługuje do czasu spłaty całości zadłużenia (na spłatę jest 6 miesięcy od powstania prawa).`,
        legalBasis: 'Ustawa zasiłkowa art. 2a',
      });
    }

    if (isMother && !active && !hasMaternityEquivalentCause) {
      warnings.push({
        code: 'NO_INSURANCE_ON_BIRTH_DATE',
        message: endsBeforeEvent
          ? 'Ubezpieczenie chorobowe kończy się przed datą zdarzenia. Jeżeli nie zadziała przedłużenie umowy do dnia porodu (KP art. 177 § 3), zasiłek macierzyński z ZUS nie przysługuje (możliwe jest świadczenie rodzicielskie „Kosiniakowe” z urzędu gminy).'
          : 'Brak czynnego ubezpieczenia chorobowego matki na dzień porodu lub przyjęcia dziecka oznacza brak prawa do zasiłku macierzyńskiego z ZUS (można ubiegać się o świadczenie rodzicielskie „Kosiniakowe” z urzędu gminy).',
        legalBasis: 'Ustawa zasiłkowa art. 29 ust. 1',
      });
    }

    // Ryzyka kontroli ZUS (sekcja H PDF)
    const hasSicknessTitle =
      parent.insuranceTitle !== 'none' && parent.sicknessInsurance !== 'none';
    if (isMother && hasSicknessTitle) {
      const insuredSince = parent.insuredSince;
      const risk = params.insuranceRisk;
      const pregnancyStart = isAdoption ? null : addDays(on, -risk.estimatedPregnancyDays);
      const riskEvent = isAdoption ? on : (input.sicknessStartDate ?? on);
      const startedDuringPregnancy =
        pregnancyStart !== null &&
        insuredSince !== null &&
        insuredSince >= pregnancyStart &&
        insuredSince <= on;
      const startedShortlyBeforeEvent =
        insuredSince !== null &&
        insuredSince <= riskEvent &&
        insuredSince > addMonths(riskEvent, -risk.shortTitleMonths);

      if (input.shamContractRiskHint || startedDuringPregnancy || startedShortlyBeforeEvent) {
        warnings.push({
          code: 'SHAM_CONTRACT_RISK',
          message:
            'Przy rozpoczęciu ubezpieczenia w trakcie ciąży lub krótko przed zdarzeniem ZUS może zweryfikować tytuł ubezpieczenia. Warto zachować dokumenty potwierdzające faktyczne wykonywanie pracy lub prowadzenie działalności.',
          legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 68, art. 83; KC art. 83',
        });
      }
      const pregnancyEnd =
        input.situation === 'pregnant' && input.referenceDate < on ? input.referenceDate : on;
      if (
        pregnancyStart !== null &&
        input.situation !== 'planning' &&
        input.monthlyBases &&
        hasPregnancyBaseIncrease(input.monthlyBases, pregnancyStart, pregnancyEnd, params)
      ) {
        warnings.push({
          code: 'BASE_INCREASE_IN_PREGNANCY',
          message:
            'Znaczne podwyższenie podstawy wymiaru składek w okresie ciąży może zostać zweryfikowane przez ZUS w postępowaniu wyjaśniającym. ZUS ocenia, czy podwyższenie miało realne uzasadnienie zawodowe lub przychodowe.',
          legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 41 ust. 12–13, art. 83',
        });
      }
    }

    // Zasiłek macierzyński – ocena uprawnień
    let entitled = active && !debt && !adoptionOverAgeLimit;
    let effectivePayer: Payer | null = entitled ? payer : null;
    let reasonMessage: string;
    let legalBasis: string;

    if (isMother && hasMaternityEquivalentCause && parent.insuranceTitle === 'employment') {
      // Po ustaniu zatrudnienia wskutek upadłości/likwidacji lub bezprawnego rozwiązania umowy
      // matka zachowuje prawo do zasiłku macierzyńskiego po porodzie (art. 30 ust. 1)
      entitled = !adoptionOverAgeLimit;
      effectivePayer = entitled ? 'zus' : null;
      reasonMessage =
        'Po ustaniu umowy o pracę z powodu upadłości, likwidacji pracodawcy albo bezprawnego rozwiązania umowy w ciąży przysługuje zasiłek w wysokości zasiłku macierzyńskiego do dnia porodu oraz zasiłek macierzyński po porodzie (wypłaca ZUS).';
      legalBasis = 'Ustawa zasiłkowa art. 30 ust. 1 i 3';
    } else if (adoptionOverAgeLimit) {
      entitled = false;
      effectivePayer = null;
      const careLabel =
        input.adoptionType === 'fosterFamily'
          ? `rodziny zastępczej niezawodowej (${input.schoolObligationDeferred ? 'z odroczeniem obowiązku szkolnego' : 'bez odroczenia obowiązku szkolnego'})`
          : 'przysposobienia (adopcji)';
      reasonMessage = `Dziecko w wieku ${input.childAgeYears} lat przekroczyło ustawowy limit wieku dla ${careLabel} (do ukończenia ${maxAdoptionAge}. roku życia). Urlop na warunkach urlopu macierzyńskiego i urlop rodzicielski nie przysługują.`;
      legalBasis = 'KP art. 183 § 1, § 4; ustawa zasiłkowa art. 29 ust. 1 pkt 2–3';
    } else if (debt) {
      reasonMessage = `Wypłata zasiłku jest wyłączona z powodu zadłużenia składkowego w JDG przekraczającego ${formatPercentPl(params.selfEmployedDebtThresholdShareOfMinimumWage)} minimalnego wynagrodzenia. Prawo powstaje po spłacie całości zadłużenia w terminie 6 miesięcy.`;
      legalBasis = 'Ustawa zasiłkowa art. 2a';
    } else if (!active) {
      reasonMessage = endsBeforeEvent
        ? 'Ubezpieczenie chorobowe kończy się przed datą zdarzenia.'
        : 'Brak czynnego ubezpieczenia chorobowego na dzień zdarzenia.';
      legalBasis = 'Ustawa zasiłkowa art. 29 ust. 1';
    } else if (isMother) {
      if (input.special.motherDeceased) {
        reasonMessage =
          'W przypadku śmierci matki prawo do niewykorzystanej części urlopu macierzyńskiego i zasiłku macierzyńskiego przejmuje ubezpieczony ojciec dziecka (lub inny ubezpieczony członek najbliższej rodziny).';
        legalBasis = 'KP art. 180 § 12; ustawa zasiłkowa art. 29 ust. 5';
      } else if (input.special.motherHospitalized) {
        reasonMessage = `Matka jest uprawniona do zasiłku macierzyńskiego. W okresie pobytu matki w szpitalu uniemożliwiającego opiekę nad dzieckiem (w szczególności po wykorzystaniu ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tygodni po porodzie) część urlopu może przejąć ubezpieczony ojciec dziecka.${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`;
        legalBasis = 'KP art. 180 § 10; ustawa zasiłkowa art. 29 ust. 5, art. 61';
      } else if (input.special.motherIncapableOfIndependentLiving) {
        reasonMessage = `Matka jest uprawniona do zasiłku macierzyńskiego. Przy orzeczeniu o niezdolności do samodzielnej egzystencji może zrezygnować z dalszej części urlopu po wykorzystaniu co najmniej ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tygodni po porodzie, a resztę przejmuje ubezpieczony ojciec.${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`;
        legalBasis = 'KP art. 180 § 6–7; ustawa zasiłkowa art. 29 ust. 5, art. 61';
      } else if (input.special.stillbirth || input.special.childDeathDate) {
        reasonMessage = `Ubezpieczenie chorobowe jest czynne na dzień porodu. Zasiłek macierzyński przysługuje bez okresu wyczekiwania w wymiarze przewidzianym dla sytuacji straty dziecka.${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`;
        legalBasis = 'KP art. 180¹; ustawa zasiłkowa art. 29, art. 61';
      } else {
        reasonMessage = isAdoption
          ? `Ubezpieczenie chorobowe jest czynne na dzień przyjęcia dziecka na wychowanie (limit wieku: do ${maxAdoptionAge} lat). Zasiłek macierzyński przysługuje bez okresu wyczekiwania.${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`
          : `Ubezpieczenie chorobowe jest czynne na dzień porodu. Zasiłek macierzyński przysługuje bez okresu wyczekiwania.${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`;
        legalBasis = isAdoption
          ? 'Ustawa zasiłkowa art. 29 ust. 1 pkt 2–3, art. 61'
          : 'Ustawa zasiłkowa art. 29, art. 61';
      }
    } else {
      // Ojciec / drugi rodzic
      const specialTakeoverNotes: string[] = [];
      if (input.special.motherDeceased) {
        specialTakeoverNotes.push(
          `Ze względu na śmierć matki ojciec może przejąć pozostałą część urlopu macierzyńskiego bez konieczności wykorzystania ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tygodni przez matkę.`,
        );
      } else if (input.special.motherIncapableOfIndependentLiving) {
        specialTakeoverNotes.push(
          `Ze względu na niezdolność matki do samodzielnej egzystencji ojciec może przejąć urlop macierzyński już po ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tygodniach po porodzie.`,
        );
      } else if (input.special.motherHospitalized) {
        specialTakeoverNotes.push(
          'W okresie hospitalizacji matki ojciec może przejąć urlop macierzyński na czas jej pobytu w szpitalu.',
        );
      } else if (!motherIsInsuredOrActive) {
        specialTakeoverNotes.push(
          'Mimo że matka nie podlega ubezpieczeniu chorobowemu w dniu zdarzenia, ubezpieczonemu ojcu przysługuje urlop rodzicielski oraz urlop ojcowski.',
        );
      } else {
        specialTakeoverNotes.push(
          `Ojcu przysługuje ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. nieprzenoszalnego urlopu rodzicielskiego${isAdoption && input.adoptionType === 'fosterFamily' ? '' : ` oraz ${params.paternityLeave.weeks} tyg. urlopu ojcowskiego`}, a po wykorzystaniu ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tyg. przez matkę może także przejąć resztę urlopu macierzyńskiego.`,
        );
      }
      reasonMessage = `${specialTakeoverNotes.join(' ')}${missingInsuredSinceNote}${missingPayerCountNote}${missingDebtNote}`;
      legalBasis =
        input.special.motherDeceased ||
        input.special.motherHospitalized ||
        input.special.motherIncapableOfIndependentLiving
          ? 'KP art. 180 § 6–12, art. 182¹a, art. 182³; ustawa zasiłkowa art. 29 ust. 5, art. 61'
          : 'KP art. 180 § 4, art. 182¹a § 4, art. 182³; ustawa zasiłkowa art. 29a, art. 61';
    }

    entitlements.push({
      benefit: 'maternityBenefit',
      parentRole: parent.role,
      entitled,
      payer: effectivePayer,
      reason: { message: reasonMessage, legalBasis },
    });
  }

  // Termin 21 dni na wniosek o stawkę 81,5%
  const childLostAll =
    (input.special.stillbirth || Boolean(input.special.childDeathDate)) && input.childrenCount <= 1;
  if (input.rateVariant === 'combined' && !childLostAll && !adoptionOverAgeLimit) {
    const deadline = addDays(on, params.combinedRateApplicationDeadlineDays);
    const passed = input.situation === 'afterBirth' && date(input.referenceDate) > date(deadline);
    warnings.push({
      code: 'COMBINED_RATE_DEADLINE',
      message: passed
        ? `Termin ${params.combinedRateApplicationDeadlineDays} dni od porodu na wniosek o jednolitą stawkę ${formatPercentPl(params.rates.combined)} upłynął ${deadline}. Bez terminowego wniosku obowiązuje wariant ${formatPercentPl(params.rates.maternity)} + ${formatPercentPl(params.rates.parental)}.`
        : `Aby otrzymać jednolitą stawkę ${formatPercentPl(params.rates.combined)}, wniosek o pełny wymiar urlopu macierzyńskiego i rodzicielskiego należy złożyć najpóźniej ${params.combinedRateApplicationDeadlineDays} dni po dniu zdarzenia (do ${deadline}).`,
      legalBasis: 'Ustawa zasiłkowa art. 30a ust. 1',
    });
  }

  // Świadczenia w okresie ciąży (3a): chorobowy, wynagrodzenie chorobowe, rehabilitacyjne, zasiłek w wysokości macierzyńskiego
  const includePregnancyBenefits =
    input.situation === 'pregnant' ||
    input.situation === 'planning' ||
    Boolean(input.sicknessStartDate);

  if (includePregnancyBenefits) {
    const sickness = calculateSicknessInPregnancy(input, params);
    const mother = input.mother;
    const sicknessOn = input.sicknessStartDate ?? input.referenceDate;
    const motherActiveForSickness = insuranceActive(mother, sicknessOn);
    const motherDebtBlocked = debtBlocks(mother, params);
    const motherSicknessPayer = sickness.entitled ? resolveParentPayer(mother, params) : null;

    // Ostrzeżenie o okresie wyczekiwania
    if (motherActiveForSickness && !motherDebtBlocked && mother.insuredSince !== null) {
      const waitingDays =
        mother.sicknessInsurance === 'mandatory'
          ? params.sickness.waitingPeriodDaysMandatory
          : params.sickness.waitingPeriodDaysVoluntary;
      const insuredDays =
        Math.max(0, daysBetween(mother.insuredSince, sicknessOn)) +
        (input.creditedInsuranceDays ?? 0);
      if (!input.waitingPeriodExempt && insuredDays < waitingDays) {
        warnings.push({
          code: 'WAITING_PERIOD_NOT_MET',
          message: `Okres wyczekiwania na zasiłek chorobowy wynosi ${waitingDays} dni (${mother.sicknessInsurance === 'mandatory' ? 'ubezpieczenie obowiązkowe' : 'ubezpieczenie dobrowolne'}; obecny staż: ${insuredDays} dni). Okres wyczekiwania nie dotyczy zasiłku macierzyńskiego.`,
          legalBasis: 'Ustawa zasiłkowa art. 4 ust. 1',
        });
      }
    }

    // Wynagrodzenie chorobowe (tylko umowa o pracę)
    if (mother.insuranceTitle === 'employment') {
      entitlements.push({
        benefit: 'employerSickPay',
        parentRole: 'mother',
        entitled: sickness.entitled && sickness.employerSickPayDays > 0,
        payer: sickness.entitled && sickness.employerSickPayDays > 0 ? 'employer' : null,
        reason: {
          message: sickness.entitled
            ? `Pracodawca wypłaca wynagrodzenie chorobowe za pierwsze ${sickness.employerSickPayDays} dni niezdolności do pracy w roku kalendarzowym (${formatPercentPl(params.rates.sicknessPregnancy)} z kodem „B”).`
            : (sickness.explanations[0]?.message ??
              'Wynagrodzenie chorobowe nie przysługuje przed nabyciem prawa do świadczeń chorobowych.'),
          legalBasis: 'KP art. 92',
        },
      });
    }

    // Zasiłek chorobowy w ciąży
    entitlements.push({
      benefit: 'sicknessBenefit',
      parentRole: 'mother',
      entitled: sickness.entitled,
      payer: motherSicknessPayer,
      reason: {
        message: sickness.entitled
          ? `Zasiłek chorobowy w ciąży (kod literowy „B”) wynosi ${formatPercentPl(params.rates.sicknessPregnancy)} podstawy wymiaru i przysługuje maksymalnie przez ${params.sickness.maxBenefitPeriodDays} dni${mother.insuranceTitle === 'employment' ? ` (po wykorzystaniu ${sickness.employerSickPayDays} dni wynagrodzenia chorobowego od pracodawcy)` : ' od 1. dnia niezdolności do pracy'}.`
          : (sickness.explanations[0]?.message ?? 'Brak prawa do zasiłku chorobowego w ciąży.'),
        legalBasis: 'Ustawa zasiłkowa art. 4, art. 8, art. 11 ust. 2 pkt 1',
      },
    });

    // Świadczenie rehabilitacyjne (informacyjnie po wyczerpaniu 270 dni okresu zasiłkowego)
    entitlements.push({
      benefit: 'rehabilitationBenefit',
      parentRole: 'mother',
      entitled: sickness.entitled,
      payer: sickness.entitled ? 'zus' : null,
      reason: {
        message: sickness.entitled
          ? `Jeżeli po wyczerpaniu ${params.sickness.maxBenefitPeriodDays} dni okresu zasiłkowego nadal utrzymuje się niezdolność do pracy w ciąży, a dalsze leczenie rokuje odzyskanie zdolności do pracy, przysługuje świadczenie rehabilitacyjne z ZUS (${formatPercentPl(params.rates.sicknessPregnancy)} podstawy w ciąży, maksymalnie do 12 miesięcy; wniosek ZUS ZNp-7).`
          : 'Świadczenie rehabilitacyjne przysługuje wyłącznie po wyczerpaniu zasiłku chorobowego, do którego obecnie brak uprawnień.',
        legalBasis: 'Ustawa zasiłkowa art. 18–19',
      },
    });
  }

  // Zasiłek w wysokości zasiłku macierzyńskiego (upadłość/likwidacja/śmierć pracodawcy lub bezprawne rozwiązanie umowy)
  if (hasMaternityEquivalentCause) {
    const isEmployee = input.mother.insuranceTitle === 'employment';
    entitlements.push({
      benefit: 'maternityEquivalentBenefit',
      parentRole: 'mother',
      entitled: isEmployee,
      payer: isEmployee ? 'zus' : null,
      reason: {
        message: isEmployee
          ? `W razie rozwiązania umowy o pracę z kobietą w ciąży z powodu ${isBankruptcy ? 'upadłości, likwidacji lub śmierci pracodawcy (bez zapewnienia innego zatrudnienia)' : 'naruszenia przepisów prawa potwierdzonego prawomocnym wyrokiem sądu'} ZUS wypłaca do dnia porodu zasiłek w wysokości zasiłku macierzyńskiego (${formatPercentPl(params.rates.maternity)} podstawy wymiaru).`
          : 'Zasiłek w wysokości zasiłku macierzyńskiego przysługuje wyłącznie pracownicom zatrudnionym na podstawie umowy o pracę (nie dotyczy umowy zlecenia ani JDG).',
        legalBasis: 'Ustawa zasiłkowa art. 30 ust. 3',
      },
    });
  }

  return { entitlements, warnings };
}

export function calculateSicknessInPregnancy(
  input: SicknessInput,
  params: BenefitParams,
): SicknessResult {
  const on = input.sicknessStartDate ?? input.referenceDate;
  validateParams(params, on);

  const parent = input.mother;
  const explanations: Explanation[] = [];

  if (input.sicknessStartDate === undefined) {
    explanations.push({
      message: `Nie podano daty rozpoczęcia zwolnienia lekarskiego – ocenę wykonano na dzień ${on}.`,
      legalBasis: null,
    });
  }

  if (parent.insuranceTitle === 'none' || parent.sicknessInsurance === 'none') {
    return {
      entitled: false,
      employerSickPayDays: 0,
      sicknessBenefitMaxDays: 0,
      rate: params.rates.sicknessPregnancy,
      dailyAmount: null,
      explanations: [
        {
          message:
            'Brak czynnego ubezpieczenia chorobowego – zasiłek chorobowy w ciąży nie przysługuje.',
          legalBasis: 'Ustawa zasiłkowa art. 1, art. 4',
        },
      ],
    };
  }

  if (!insuranceActive(parent, on)) {
    return {
      entitled: false,
      employerSickPayDays: 0,
      sicknessBenefitMaxDays: 0,
      rate: params.rates.sicknessPregnancy,
      dailyAmount: null,
      explanations: [
        {
          message: `W dniu ${on} ubezpieczenie chorobowe nie jest aktywne. Prawo do zasiłku chorobowego po ustaniu tytułu ubezpieczenia wymaga odrębnej weryfikacji (art. 7 i art. 13 ustawy zasiłkowej).`,
          legalBasis: 'Ustawa zasiłkowa art. 7, art. 13',
        },
      ],
    };
  }

  if (debtBlocks(parent, params)) {
    const threshold = roundPln(
      params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage,
    );
    return {
      entitled: false,
      employerSickPayDays: 0,
      sicknessBenefitMaxDays: 0,
      rate: params.rates.sicknessPregnancy,
      dailyAmount: null,
      explanations: [
        {
          message: `Zadłużenie składkowe w JDG (${parent.contributionDebt} zł) przekracza próg ${threshold} zł (${formatPercentPl(params.selfEmployedDebtThresholdShareOfMinimumWage)} minimalnego wynagrodzenia) – zasiłek chorobowy nie przysługuje do czasu spłaty zaległości.`,
          legalBasis: 'Ustawa zasiłkowa art. 2a',
        },
      ],
    };
  }

  const waitingPeriodExempt = input.waitingPeriodExempt ?? false;
  const creditedInsuranceDays = input.creditedInsuranceDays ?? 0;
  requireValue(
    Number.isInteger(creditedInsuranceDays) && creditedInsuranceDays >= 0,
    'creditedInsuranceDays',
    'Liczba zaliczanych dni ubezpieczenia (creditedInsuranceDays) musi być nieujemną liczbą całkowitą.',
  );

  const waiting =
    parent.sicknessInsurance === 'mandatory'
      ? params.sickness.waitingPeriodDaysMandatory
      : params.sickness.waitingPeriodDaysVoluntary;

  let waitingMet = waitingPeriodExempt;
  if (!waitingMet) {
    if (parent.insuredSince !== null) {
      const accumulatedDays = daysBetween(parent.insuredSince, on) + creditedInsuranceDays;
      waitingMet = accumulatedDays >= waiting;
      if (!waitingMet) {
        explanations.push({
          message: `Nie upłynął jeszcze okres wyczekiwania: wymagane ${waiting} dni (${parent.sicknessInsurance === 'mandatory' ? 'ubezpieczenie obowiązkowe' : 'ubezpieczenie dobrowolne'}), a na dzień ${on} zgromadzono ${Math.max(0, accumulatedDays)} dni. Po upływie okresu wyczekiwania prawo powstaje automatycznie (sprawdź też wyjątki z art. 4 ust. 3).`,
          legalBasis: 'Ustawa zasiłkowa art. 4 ust. 1–3',
        });
      }
    } else {
      waitingMet = true;
      explanations.push({
        message: `Nie podano daty początku ubezpieczenia – przyjęto spełnienie okresu wyczekiwania (${waiting} dni). Zweryfikuj staż ubezpieczeniowy.`,
        legalBasis: 'Ustawa zasiłkowa art. 4 ust. 1',
      });
    }
  }

  const used = input.sicknessDaysUsed ?? 0;
  requireValue(
    Number.isInteger(used) && used >= 0,
    'sicknessDaysUsed',
    'Liczba wykorzystanych dni zasiłkowych (sicknessDaysUsed) musi być nieujemną liczbą całkowitą.',
  );
  const remaining = Math.max(0, params.sickness.maxBenefitPeriodDays - used);

  let employerDays = 0;
  if (parent.insuranceTitle === 'employment') {
    const employerUsed = input.employerSickPayDaysUsed ?? 0;
    requireValue(
      Number.isInteger(employerUsed) && employerUsed >= 0,
      'employerSickPayDaysUsed',
      'Liczba wykorzystanych dni wynagrodzenia chorobowego (employerSickPayDaysUsed) musi być nieujemną liczbą całkowitą.',
    );

    let limit = params.sickness.employerPaidDaysUnder50;
    if (input.yearTurned50 !== undefined) {
      requireValue(
        Number.isInteger(input.yearTurned50) && input.yearTurned50 > 1900,
        'yearTurned50',
        'Rok ukończenia 50 lat (yearTurned50) musi być poprawnym rokiem.',
      );
      limit =
        Number(on.slice(0, 4)) > input.yearTurned50
          ? params.sickness.employerPaidDaysFrom50
          : params.sickness.employerPaidDaysUnder50;
    } else if (parent.age !== null) {
      if (parent.age > 50) {
        limit = params.sickness.employerPaidDaysFrom50;
      } else if (parent.age === 50) {
        limit = params.sickness.employerPaidDaysUnder50;
        explanations.push({
          message: `Niższy limit ${params.sickness.employerPaidDaysFrom50} dni wynagrodzenia chorobowego od pracodawcy obowiązuje od roku kalendarzowego następującego po roku ukończenia 50. roku życia – dla wieku 50 lat przyjęto ${params.sickness.employerPaidDaysUnder50} dni.`,
          legalBasis: 'KP art. 92 § 1 pkt 1',
        });
      }
    } else {
      explanations.push({
        message: `Nie podano wieku mamy – przyjęto limit ${params.sickness.employerPaidDaysUnder50} dni wynagrodzenia chorobowego od pracodawcy (po roku ukończenia 50. r.ż. wynosi ${params.sickness.employerPaidDaysFrom50} dni).`,
        legalBasis: 'KP art. 92 § 1 pkt 1',
      });
    }
    employerDays = Math.max(0, limit - employerUsed);
  }

  if (parent.benefitBase !== null) amount(parent.benefitBase, 'benefitBase');

  const entitled = waitingMet && remaining > 0;

  if (entitled) {
    explanations.push({
      message:
        parent.insuranceTitle === 'employment'
          ? `Zasiłek chorobowy w ciąży (e-ZLA z kodem „B”) wynosi ${formatPercentPl(params.rates.sicknessPregnancy)} podstawy wymiaru. Przez pierwsze ${Math.min(employerDays, remaining)} dni w roku pracodawca wypłaca wynagrodzenie chorobowe, a od kolejnego dnia przysługuje zasiłek chorobowy (łącznie maksymalnie ${params.sickness.maxBenefitPeriodDays} dni okresu zasiłkowego).`
          : `Zasiłek chorobowy w ciąży (e-ZLA z kodem „B”) wynosi ${formatPercentPl(params.rates.sicknessPregnancy)} podstawy wymiaru i przysługuje od pierwszego dnia niezdolności do pracy, maksymalnie przez ${params.sickness.maxBenefitPeriodDays} dni.`,
      legalBasis: 'Ustawa zasiłkowa art. 4, art. 8–9, art. 11 ust. 2 pkt 1; KP art. 92',
    });
    explanations.push({
      message: `Po wyczerpaniu ${params.sickness.maxBenefitPeriodDays} dni okresu zasiłkowego można ubiegać się o świadczenie rehabilitacyjne z ZUS (${formatPercentPl(params.rates.sicknessPregnancy)} podstawy w ciąży, wniosek ZUS ZNp-7).`,
      legalBasis: 'Ustawa zasiłkowa art. 18–19',
    });
  } else if (remaining === 0) {
    explanations.push({
      message: `Wyczerpano maksymalny okres zasiłkowy (${params.sickness.maxBenefitPeriodDays} dni). Jeżeli niezdolność do pracy trwa nadal, złóż wniosek o świadczenie rehabilitacyjne (ZUS ZNp-7).`,
      legalBasis: 'Ustawa zasiłkowa art. 8, art. 18',
    });
  }

  if (input.special.employerBankruptcyOrLiquidation && parent.insuranceTitle === 'employment') {
    explanations.push({
      message: `W związku z upadłością lub likwidacją pracodawcy do dnia porodu przysługuje z ZUS zasiłek w wysokości zasiłku macierzyńskiego (${formatPercentPl(params.rates.maternity)} podstawy wymiaru).`,
      legalBasis: 'Ustawa zasiłkowa art. 30 ust. 3',
    });
  }

  return {
    entitled,
    employerSickPayDays: entitled ? Math.min(employerDays, remaining) : 0,
    sicknessBenefitMaxDays: remaining,
    rate: params.rates.sicknessPregnancy,
    dailyAmount:
      entitled && parent.benefitBase !== null
        ? calculateBenefitAmount(parent.benefitBase, params.rates.sicknessPregnancy, 1).dailyAmount
        : null,
    explanations,
  };
}
