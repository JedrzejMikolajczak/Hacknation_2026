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

export { CalculationError, calculateBenefitAmount, roundPln } from './core';
export { calculateBenefitBase } from './benefitBase';
export type { BaseInput } from './benefitBase';
export { checkEligibility, calculateSicknessInPregnancy } from './eligibility';
export type { SicknessInput } from './eligibility';
export { calculateMaternity } from './maternity';
export type { MaternityInput } from './maternity';
export { planParentalSplit, calculateParentalLeaveWithWork } from './parental';
export { getRequiredDocuments } from './documents';

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
