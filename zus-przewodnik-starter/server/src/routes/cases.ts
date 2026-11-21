import { Router } from 'express';
import {
  calculateBenefitBase,
  calculateMaternity,
  checkEligibility,
  type BaseInput,
} from '@shared/engine';
import params from '@shared/params.json';
import type { CaseEvaluationResult, ZusCase, ZusCaseSummary } from '@shared/types';
import { fail, ok } from '../lib/envelope';
import employed from '../../../data/cases/etat-po-porodzie.json';
import uninsured from '../../../data/cases/brak-ubezpieczenia.json';

type SyntheticCase = ZusCase & {
  source: 'synthetic';
  expectedDays: number;
  benefitBaseInput: BaseInput | null;
};

// Jawny katalog publicznych danych demonstracyjnych.
const cases = [employed, uninsured].map((item) => ({
  ...item,
  source: 'synthetic',
})) as SyntheticCase[];

export const casesRouter = Router();

casesRouter.get('/cases', (_req, res) => {
  res.json(
    ok(
      cases.map((item): ZusCaseSummary => ({
        caseId: item.caseId,
        title: item.title,
        expectedGranted: item.zusDecision.granted,
      })),
    ),
  );
});

casesRouter.get('/cases/:caseId', (req, res) => {
  const item = cases.find((candidate) => candidate.caseId === req.params.caseId);
  if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
  return res.json(ok(item));
});

casesRouter.post('/cases/:caseId/evaluate', (req, res) => {
  const item = cases.find((candidate) => candidate.caseId === req.params.caseId);
  if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
  const benefitBase = item.benefitBaseInput
    ? calculateBenefitBase(item.benefitBaseInput, params)
    : null;
  const scenario = {
    ...item.scenario,
    mother: {
      ...item.scenario.mother,
      benefitBase: benefitBase?.benefitBase ?? item.scenario.mother.benefitBase,
    },
  };
  const eligibility = checkEligibility(scenario, params);
  const granted = eligibility.entitlements.some(
    (entitlement) =>
      entitlement.parentRole === 'mother' &&
      entitlement.benefit === 'maternityBenefit' &&
      entitlement.entitled,
  );
  const calculation = calculateMaternity(scenario, params);
  const days = calculation.periods.reduce((total, period) => total + period.days, 0);
  const expected = item.zusDecision;
  const differences: string[] = [];
  if (granted !== expected.granted) differences.push('Prawo do świadczenia');
  if (scenario.mother.benefitBase !== expected.benefitBase) differences.push('Podstawa wymiaru');
  if (days !== item.expectedDays) differences.push('Liczba dni');
  if (calculation.totalAmount !== expected.amount) differences.push('Kwota brutto');
  const result: CaseEvaluationResult = {
    caseId: item.caseId,
    eligibility,
    calculation,
    benefitBase,
    matchesZusDecision: differences.length === 0,
    differences,
  };
  return res.json(ok(result));
});
