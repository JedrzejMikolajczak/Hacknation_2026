import { Router, type RequestHandler } from 'express';
import { calculateCasePlan } from '@shared/engine';
import type { CasePlan } from '@shared/types';
import { getParams } from './params';
import { ok } from '../lib/envelope';
import { caseInputSchema } from './caseInput';

const run =
  (select: (plan: CasePlan) => unknown): RequestHandler =>
  (req, res, next) => {
    try {
      const input = caseInputSchema.parse(req.body);
      res.json(ok(select(calculateCasePlan(input, getParams()))));
    } catch (error) {
      next(error);
    }
  };

export const calculatorRouter = Router();
calculatorRouter.post(
  '/plan',
  run((plan) => plan),
);
calculatorRouter.post(
  '/eligibility',
  run(({ entitlements, outcome }) => ({ entitlements, warnings: outcome.warnings })),
);
calculatorRouter.post(
  '/calculate/maternity',
  run((plan) => plan.outcome),
);
calculatorRouter.post(
  '/calculate/sickness',
  run(({ outcome }) => ({
    periods: outcome.periods.filter((period) => period.leave_type === 'SICKNESS'),
    employer_sick_pay: outcome.employer_sick_pay,
    warnings: outcome.warnings,
  })),
);
calculatorRouter.post(
  '/calculate/benefit-base',
  run(({ outcome }) => ({ benefit_base_pln: outcome.benefit_base_pln })),
);
calculatorRouter.post(
  '/plan/parental-split',
  run((plan) => plan),
);
calculatorRouter.post(
  '/plan/parental-with-work',
  run((plan) => plan),
);
calculatorRouter.post(
  '/documents',
  run((plan) => plan.documents),
);
