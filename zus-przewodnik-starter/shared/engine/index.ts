/**
 * Publiczne API silnika obliczeń (CONVENTIONS §5).
 * Na razie tylko sygnatury – implementacje: Osoba 5 (maternity, parental, adoption)
 * i Osoba 6 (benefitBase). Czyste funkcje: bez I/O, bez Date.now().
 */
import type {
  BenefitBaseInput,
  BenefitBaseResult,
  BenefitParams,
  DocumentChecklist,
  EligibilityResult,
  MaternityCalculationResult,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  ScenarioInput,
  SicknessResult,
} from '../types';

export type {
  BenefitBaseInput,
  BenefitBaseResult,
  BenefitParams,
  DocumentChecklist,
  EligibilityResult,
  MaternityCalculationResult,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  ScenarioInput,
  SicknessResult,
};

const notImplemented = (): never => {
  throw new Error('Not implemented');
};

export function checkEligibility(_input: ScenarioInput, _params: BenefitParams): EligibilityResult {
  return notImplemented();
}

export function calculateMaternity(
  _input: ScenarioInput,
  _params: BenefitParams,
): MaternityCalculationResult {
  return notImplemented();
}

export function calculateBenefitBase(
  _input: BenefitBaseInput,
  _params: BenefitParams,
): BenefitBaseResult {
  return notImplemented();
}

export function planParentalSplit(
  _input: ParentalSplitInput,
  _params: BenefitParams,
): ParentalSplitResult {
  return notImplemented();
}

export function calculateParentalLeaveWithWork(
  _input: ParentalWithWorkInput,
  _params: BenefitParams,
): ParentalWithWorkResult {
  return notImplemented();
}

export function calculateSicknessInPregnancy(
  _input: ScenarioInput,
  _params: BenefitParams,
): SicknessResult {
  return notImplemented();
}

export function getRequiredDocuments(
  _input: ScenarioInput,
  _params: BenefitParams,
): DocumentChecklist {
  return notImplemented();
}
