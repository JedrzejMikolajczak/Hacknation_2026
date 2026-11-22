import type { BenefitParams } from '@shared/types';
import { debtThresholdPln } from '@shared/engine/caseRules';

export interface ParamChangeItem {
  id: string;
  label: string;
  before: string;
  after: string;
}

export function rateToPercent(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

export function percentToRate(percent: number): number {
  return Math.round(percent * 100) / 10000;
}

function formatPct(rate: number): string {
  return `${rateToPercent(rate).toString().replace('.', ',')}%`;
}

function formatPln(amount: number): string {
  return `${amount.toFixed(2).replace('.00', '').replace('.', ',')} zł`;
}

export function computeDerivedMetrics(params: BenefitParams) {
  const jdgDebtThresholdPln = debtThresholdPln(params);
  const minBenefitBasePln =
    Math.round(
      params.benefitBase.minimumWage * (1 - params.benefitBase.socialContributionDeduction) * 100,
    ) / 100;

  return {
    jdgDebtThresholdPln,
    minBenefitBasePln,
  };
}

export function diffBenefitParams(
  baseline: BenefitParams,
  draft: BenefitParams,
): ParamChangeItem[] {
  const changes: ParamChangeItem[] = [];

  function check(id: string, label: string, before: string | number, after: string | number) {
    if (before !== after) {
      changes.push({
        id,
        label,
        before: String(before),
        after: String(after),
      });
    }
  }

  check('version', 'Wersja parametrów', baseline.version, draft.version);
  check('effectiveFrom', 'Obowiązuje od dnia', baseline.effectiveFrom, draft.effectiveFrom);

  // Stawki %
  check(
    'rates.maternity',
    'Stawka zasiłku macierzyńskiego',
    formatPct(baseline.rates.maternity),
    formatPct(draft.rates.maternity),
  );
  check(
    'rates.parental',
    'Stawka zasiłku rodzicielskiego',
    formatPct(baseline.rates.parental),
    formatPct(draft.rates.parental),
  );
  check(
    'rates.combined',
    'Stawka łączona (wniosek do 21 dni)',
    formatPct(baseline.rates.combined),
    formatPct(draft.rates.combined),
  );
  check(
    'rates.secondParentNonTransferableInCombined',
    'Stawka dla 9 tyg. drugiego rodzica w wariancie łączonym',
    formatPct(baseline.rates.secondParentNonTransferableInCombined),
    formatPct(draft.rates.secondParentNonTransferableInCombined),
  );
  check(
    'rates.paternity',
    'Stawka zasiłku ojcowskiego',
    formatPct(baseline.rates.paternity),
    formatPct(draft.rates.paternity),
  );
  check(
    'rates.supplementaryMaternity',
    'Stawka uzupełniającego urlopu macierzyńskiego',
    formatPct(baseline.rates.supplementaryMaternity),
    formatPct(draft.rates.supplementaryMaternity),
  );
  check(
    'rates.sicknessPregnancy',
    'Stawka zasiłku chorobowego w ciąży',
    formatPct(baseline.rates.sicknessPregnancy),
    formatPct(draft.rates.sicknessPregnancy),
  );

  // Podstawa wymiaru i progi
  check(
    'benefitBase.minimumWage',
    'Płaca minimalna',
    formatPln(baseline.benefitBase.minimumWage),
    formatPln(draft.benefitBase.minimumWage),
  );
  check(
    'benefitBase.socialContributionDeduction',
    'Odliczenie składek społecznych',
    formatPct(baseline.benefitBase.socialContributionDeduction),
    formatPct(draft.benefitBase.socialContributionDeduction),
  );
  check(
    'benefitBase.maxVoluntaryContributionBase',
    'Maksymalna podstawa dobrowolnego chorobowego',
    formatPln(baseline.benefitBase.maxVoluntaryContributionBase),
    formatPln(draft.benefitBase.maxVoluntaryContributionBase),
  );
  check(
    'benefitBase.maxBaseNonEmployee',
    'Maksymalna podstawa pozapracownicza',
    formatPln(baseline.benefitBase.maxBaseNonEmployee),
    formatPln(draft.benefitBase.maxBaseNonEmployee),
  );
  check(
    'benefitBase.lookbackMonths',
    'Liczba miesięcy do wyliczenia średniej podstawy',
    `${baseline.benefitBase.lookbackMonths} mies.`,
    `${draft.benefitBase.lookbackMonths} mies.`,
  );
  check(
    'selfEmployedDebtThresholdShareOfMinimumWage',
    'Próg zadłużenia JDG (% płacy minimalnej)',
    formatPct(baseline.selfEmployedDebtThresholdShareOfMinimumWage),
    formatPct(draft.selfEmployedDebtThresholdShareOfMinimumWage),
  );
  check(
    'payerThresholdInsuredCount',
    'Próg liczby ubezpieczonych u płatnika (pracodawca vs ZUS)',
    `${baseline.payerThresholdInsuredCount} osób`,
    `${draft.payerThresholdInsuredCount} osób`,
  );

  // Wymiary urlopów
  (['1', '2', '3', '4', '5'] as const).forEach((countKey) => {
    check(
      `maternityLeave.weeks.${countKey}`,
      `Urlop macierzyński (${countKey === '5' ? '5+' : countKey} dziecko/dzieci)`,
      `${baseline.maternityLeave.weeksByChildrenCount[countKey]} tyg.`,
      `${draft.maternityLeave.weeksByChildrenCount[countKey]} tyg.`,
    );
  });
  check(
    'maternityLeave.maxWeeksBeforeBirth',
    'Urlop macierzyński przed porodem (maks.)',
    `${baseline.maternityLeave.maxWeeksBeforeBirth} tyg.`,
    `${draft.maternityLeave.maxWeeksBeforeBirth} tyg.`,
  );
  check(
    'maternityLeave.motherMandatoryWeeksAfterBirth',
    'Obowiązkowy urlop matki po porodzie',
    `${baseline.maternityLeave.motherMandatoryWeeksAfterBirth} tyg.`,
    `${draft.maternityLeave.motherMandatoryWeeksAfterBirth} tyg.`,
  );
  check(
    'parentalLeave.weeksSingleChild',
    'Urlop rodzicielski (1 dziecko)',
    `${baseline.parentalLeave.weeksSingleChild} tyg.`,
    `${draft.parentalLeave.weeksSingleChild} tyg.`,
  );
  check(
    'parentalLeave.weeksMultipleChildren',
    'Urlop rodzicielski (2+ dzieci)',
    `${baseline.parentalLeave.weeksMultipleChildren} tyg.`,
    `${draft.parentalLeave.weeksMultipleChildren} tyg.`,
  );
  check(
    'parentalLeave.weeksSingleChildZaZyciem',
    'Urlop rodzicielski „Za życiem” (1 dziecko)',
    `${baseline.parentalLeave.weeksSingleChildZaZyciem} tyg.`,
    `${draft.parentalLeave.weeksSingleChildZaZyciem} tyg.`,
  );
  check(
    'parentalLeave.weeksMultipleChildrenZaZyciem',
    'Urlop rodzicielski „Za życiem” (2+ dzieci)',
    `${baseline.parentalLeave.weeksMultipleChildrenZaZyciem} tyg.`,
    `${draft.parentalLeave.weeksMultipleChildrenZaZyciem} tyg.`,
  );
  check(
    'parentalLeave.nonTransferableWeeksPerParent',
    'Tygodnie wyłącznie dla każdego z rodziców',
    `${baseline.parentalLeave.nonTransferableWeeksPerParent} tyg.`,
    `${draft.parentalLeave.nonTransferableWeeksPerParent} tyg.`,
  );
  check(
    'parentalLeave.maxParts',
    'Maksymalna liczba części urlopu rodzicielskiego',
    `${baseline.parentalLeave.maxParts} części`,
    `${draft.parentalLeave.maxParts} części`,
  );
  check(
    'paternityLeave.weeks',
    'Wymiar urlopu ojcowskiego',
    `${baseline.paternityLeave.weeks} tyg.`,
    `${draft.paternityLeave.weeks} tyg.`,
  );
  check(
    'paternityLeave.deadlineChildAgeMonths',
    'Limit wieku dziecka na urlop ojcowski',
    `${baseline.paternityLeave.deadlineChildAgeMonths} mies.`,
    `${draft.paternityLeave.deadlineChildAgeMonths} mies.`,
  );
  check(
    'adoptionMaternityLeave.minWeeks',
    'Minimalny urlop na warunkach macierzyńskiego (adopcja)',
    `${baseline.adoptionMaternityLeave.minWeeks} tyg.`,
    `${draft.adoptionMaternityLeave.minWeeks} tyg.`,
  );

  // Terminy i chorobowe
  check(
    'combinedRateApplicationDeadlineDays',
    'Termin na wniosek o stawkę 81,5%',
    `${baseline.combinedRateApplicationDeadlineDays} dni`,
    `${draft.combinedRateApplicationDeadlineDays} dni`,
  );
  check(
    'applicationDeadlinesDays.parentalLeave',
    'Termin wniosku o urlop rodzicielski (przed startem)',
    `${baseline.applicationDeadlinesDays.parentalLeave} dni`,
    `${draft.applicationDeadlinesDays.parentalLeave} dni`,
  );
  check(
    'applicationDeadlinesDays.paternityLeave',
    'Termin wniosku o urlop ojcowski (przed startem)',
    `${baseline.applicationDeadlinesDays.paternityLeave} dni`,
    `${draft.applicationDeadlinesDays.paternityLeave} dni`,
  );
  check(
    'sickness.waitingPeriodDaysMandatory',
    'Okres wyczekiwania – ubezpieczenie obowiązkowe',
    `${baseline.sickness.waitingPeriodDaysMandatory} dni`,
    `${draft.sickness.waitingPeriodDaysMandatory} dni`,
  );
  check(
    'sickness.waitingPeriodDaysVoluntary',
    'Okres wyczekiwania – ubezpieczenie dobrowolne',
    `${baseline.sickness.waitingPeriodDaysVoluntary} dni`,
    `${draft.sickness.waitingPeriodDaysVoluntary} dni`,
  );
  check(
    'sickness.maxBenefitPeriodDays',
    'Maksymalny okres zasiłku chorobowego w ciąży',
    `${baseline.sickness.maxBenefitPeriodDays} dni`,
    `${draft.sickness.maxBenefitPeriodDays} dni`,
  );

  // Wcześniaki
  draft.supplementaryMaternityLeave.cases.forEach((item, index) => {
    const baseCase = baseline.supplementaryMaternityLeave.cases[index];
    if (baseCase) {
      check(
        `supplementary.case.${item.id}`,
        `Urlop uzupełniający – próg #${item.id} (${item.description})`,
        `${baseCase.limitWeekAfterBirth} tyg.`,
        `${item.limitWeekAfterBirth} tyg.`,
      );
    }
  });

  return changes;
}
