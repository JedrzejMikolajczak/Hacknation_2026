import type { BenefitParams, EligibilityResult, ParentData, ScenarioInput, SicknessResult } from '../../zus-przewodnik-starter/shared/types.ts';
import { amount, calculateBenefitAmount, date, daysBetween, requireValue, validateParams } from './core.ts';

export type SicknessInput = ScenarioInput & {
  sicknessStartDate?: string;
  creditedInsuranceDays?: number;
  waitingPeriodExempt?: boolean;
  sicknessDaysUsed?: number;
  employerSickPayDaysUsed?: number;
  yearTurned50?: number;
};

export function insuranceActive(parent: ParentData, on: string): boolean {
  if (parent.insuranceTitle === 'none' || parent.sicknessInsurance === 'none') return false;
  requireValue(parent.insuredSince !== null, 'insuredSince', 'Podaj datę początku ubezpieczenia.');
  requireValue(!parent.insuranceEndDate || date(parent.insuranceEndDate) >= date(parent.insuredSince), 'insuranceEndDate', 'Koniec ubezpieczenia poprzedza początek.');
  return date(parent.insuredSince) <= date(on) && (!parent.insuranceEndDate || date(on) <= date(parent.insuranceEndDate));
}

export function debtBlocks(parent: ParentData, params: BenefitParams): boolean {
  if (parent.insuranceTitle !== 'selfEmployed') return false;
  amount(parent.contributionDebt, 'contributionDebt');
  return parent.contributionDebt > params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage;
}

export function checkEligibility(input: ScenarioInput, params: BenefitParams): EligibilityResult {
  const on = input.birthDate ?? input.expectedBirthDate;
  requireValue(on && input.situation !== 'adoption', 'birthDate', 'Ta funkcja ocenia urodzenie dziecka. Adopcja wymaga dat i danych postępowania.');
  validateParams(params, on);
  requireValue(!input.special.employerBankruptcyOrLiquidation && !input.special.motherDeceased && !input.special.motherHospitalized && !input.special.motherIncapableOfIndependentLiving, 'special', 'Szczególny tytuł uprawnienia wymaga dodatkowej weryfikacji art. 29–30.');
  const entitlements: EligibilityResult['entitlements'] = [];
  const warnings: EligibilityResult['warnings'] = [];
  for (const parent of [input.mother, input.father]) {
    if (!parent) continue;
    const active = insuranceActive(parent, on);
    // Ustanie wcześniejszego ubezpieczenia wymaga sprawdzenia wyjątków art. 30.
    requireValue(active || !parent.insuranceEndDate || date(parent.insuranceEndDate) >= date(on), 'insuranceEndDate', 'Sprawdź prawo po ustaniu ubezpieczenia (art. 30), w tym przedłużenie umowy do dnia porodu.');
    const debt = active && debtBlocks(parent, params);
    let payer: 'zus' | 'employer' | null = null;
    if (active && !debt) {
      payer = 'zus';
      if (parent.insuranceTitle !== 'selfEmployed') {
        requireValue(Number.isInteger(parent.employerInsuredCount) && parent.employerInsuredCount! >= 0, 'employerInsuredCount', 'Podaj liczbę ubezpieczonych właściwą dla art. 61.');
        if (parent.employerInsuredCount! > params.payerThresholdInsuredCount) payer = 'employer';
      }
    }
    entitlements.push({ benefit: 'maternityBenefit', parentRole: parent.role, entitled: active && !debt, payer,
      reason: { message: debt ? 'Wypłata wstrzymana do spłaty zadłużenia; sprawdź termin sześciu miesięcy.' : active ? 'Ubezpieczenie na dzień porodu. Zasiłek macierzyński przysługuje bez okresu wyczekiwania; wymiar dla rodzica zależy od rodzaju urlopu.' : 'Brak ubezpieczenia chorobowego na dzień porodu.', legalBasis: debt ? 'Ustawa zasiłkowa art. 2a' : 'Ustawa zasiłkowa art. 29, 61' } });
    if (debt) warnings.push({ code: 'SELF_EMPLOYED_DEBT', message: 'Zadłużenie przekracza próg ustawowy.', legalBasis: 'Ustawa zasiłkowa art. 2a' });
  }
  return { entitlements, warnings };
}

export function calculateSicknessInPregnancy(input: SicknessInput, params: BenefitParams): SicknessResult {
  requireValue(input.situation === 'pregnant', 'situation', 'Wymagana jest sytuacja ciąży.');
  const on = input.sicknessStartDate;
  requireValue(on, 'sicknessStartDate', 'Podaj datę początku niezdolności do pracy.');
  validateParams(params, on);
  const parent = input.mother;
  requireValue(insuranceActive(parent, on), 'insurance', 'Niezdolność poza okresem ubezpieczenia wymaga weryfikacji art. 7 i 13.');
  requireValue(typeof input.waitingPeriodExempt === 'boolean' && Number.isInteger(input.creditedInsuranceDays) && input.creditedInsuranceDays! >= 0, 'creditedInsuranceDays', 'Potwierdź wyjątki i zaliczane wcześniejsze okresy ubezpieczenia (art. 4).');
  const waiting = parent.sicknessInsurance === 'mandatory' ? params.sickness.waitingPeriodDaysMandatory : params.sickness.waitingPeriodDaysVoluntary;
  const eligible = (input.waitingPeriodExempt || daysBetween(parent.insuredSince!, on) + input.creditedInsuranceDays! >= waiting) && !debtBlocks(parent, params);
  const used = input.sicknessDaysUsed;
  requireValue(Number.isInteger(used) && used! >= 0, 'sicknessDaysUsed', 'Podaj dni wykorzystane w aktualnym okresie zasiłkowym, z uwzględnieniem art. 9.');
  let employerDays = 0;
  if (parent.insuranceTitle === 'employment') {
    requireValue(Number.isInteger(input.yearTurned50) && input.yearTurned50! > 1900, 'yearTurned50', 'Podaj rok ukończenia 50 lat (próg obowiązuje od następnego roku).');
    requireValue(Number.isInteger(input.employerSickPayDaysUsed) && input.employerSickPayDaysUsed! >= 0, 'employerSickPayDaysUsed', 'Podaj wykorzystane dni wynagrodzenia chorobowego w roku.');
    const limit = Number(on.slice(0, 4)) > input.yearTurned50! ? params.sickness.employerPaidDaysFrom50 : params.sickness.employerPaidDaysUnder50;
    employerDays = Math.max(0, limit - input.employerSickPayDaysUsed!);
  }
  const remaining = Math.max(0, params.sickness.maxBenefitPeriodDays - used!);
  if (parent.benefitBase !== null) amount(parent.benefitBase, 'benefitBase');
  return { entitled: eligible && remaining > 0, employerSickPayDays: eligible ? Math.min(employerDays, remaining) : 0,
    sicknessBenefitMaxDays: remaining, rate: params.rates.sicknessPregnancy,
    dailyAmount: eligible && remaining > 0 && parent.benefitBase !== null ? calculateBenefitAmount(parent.benefitBase, params.rates.sicknessPregnancy, 1).dailyAmount : null,
    explanations: [{ message: 'Ocena na pierwszy dzień niezdolności. Pozostały okres obejmuje również wynagrodzenie chorobowe. Ponowna ocena jest potrzebna po zakończeniu wyczekiwania.', legalBasis: 'Ustawa zasiłkowa art. 4, 8–9, 11; KP art. 92' }] };
}
