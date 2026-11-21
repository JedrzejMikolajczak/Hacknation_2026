import { Router } from 'express';
import { calculateCasePlan } from '@shared/engine/casePlan';
import { compareCase } from '@shared/engine/caseComparison';
import params from '@shared/params.json';
import type { CaseEvaluation, CaseRecord, CaseSummary } from '@shared/types';
import { fail, ok } from '../lib/envelope';
import case01 from '../../../data/cases/case-01.json';
import case02 from '../../../data/cases/case-02.json';
import case03 from '../../../data/cases/case-03.json';
import case04 from '../../../data/cases/case-04.json';
import case05 from '../../../data/cases/case-05.json';
import case06 from '../../../data/cases/case-06.json';
import { caseInputSchema } from './caseInput';

const cases = [case01, case02, case03, case04, case05, case06].map((item) => ({
  ...item, inputs: caseInputSchema.parse(item.inputs),
})) as CaseRecord[];

export const casesRouter = Router();

casesRouter.get('/cases', (_req, res) => {
  res.json(ok(cases.map(({ case_id, short_title, scenario_category }): CaseSummary =>
    ({ case_id, short_title, scenario_category }))));
});

casesRouter.get('/cases/:caseId', (req, res) => {
  const item = cases.find((candidate) => candidate.case_id === req.params.caseId);
  if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
  return res.json(ok(item));
});

casesRouter.post('/cases/:caseId/evaluate', (req, res) => {
  const item = cases.find((candidate) => candidate.case_id === req.params.caseId);
  if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
  const { outcome } = calculateCasePlan(item.inputs, params);
  const differences = compareCase(item.ground_truth_outcome, outcome);
  const result: CaseEvaluation = { case_id: item.case_id, outcome, differences, matches: differences.length === 0 };
  return res.json(ok(result));
});
