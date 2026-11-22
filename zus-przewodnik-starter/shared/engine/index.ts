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
  WizardScenario,
  SicknessResult,
} from '../types';

export { CalculationError, calculateBenefitAmount, roundPln } from './core';
export { calculateBenefitBase } from './benefitBase';
export type { BaseInput } from './benefitBase';
export { checkEligibility, calculateSicknessInPregnancy, resolveParentPayer } from './eligibility';
export type { EligibilityInput, SicknessInput } from './eligibility';
export { calculateMaternity, resolveSupplementaryMaternityLeave } from './maternity';
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
  WizardScenario,
  SicknessResult,
};
export { calculateCasePlan } from './casePlan';
export { secondParentTotalForVariant } from './casePeriods';
