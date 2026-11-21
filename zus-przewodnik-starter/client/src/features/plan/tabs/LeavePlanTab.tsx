import type { BenefitParams, MaternityCalculationResult, ScenarioInput } from '@shared/types';
import { LeavePlanView } from '../../leavePlan/LeavePlanView';

export interface LeavePlanTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  usingApi?: boolean;
}

export function LeavePlanTab({ scenario, params, maternity, usingApi }: LeavePlanTabProps) {
  return (
    <LeavePlanView scenario={scenario} params={params} maternity={maternity} usingApi={usingApi} />
  );
}
