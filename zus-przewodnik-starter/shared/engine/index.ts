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

export { CalculationError, calculateBenefitAmount } from './core';
export { calculateBenefitBase } from './benefitBase';
export type { BaseInput } from './benefitBase';
export { checkEligibility, calculateSicknessInPregnancy } from './eligibility';
export type { SicknessInput } from './eligibility';
export { calculateMaternity } from './maternity';
export type { MaternityInput } from './maternity';

const notImplemented = (): never => {
  throw new Error('Not implemented');
};

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

export function getRequiredDocuments(
  _input: ScenarioInput,
  _params: BenefitParams,
): DocumentChecklist {
  return notImplemented();
}
