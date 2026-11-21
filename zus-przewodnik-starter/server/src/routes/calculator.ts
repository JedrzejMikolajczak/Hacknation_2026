import { Router } from 'express';
import type { BenefitParams } from '@shared/types';
import paramsJson from '@shared/params.json';
import {
  calculateBenefitBase,
  calculateMaternity,
  calculateParentalLeaveWithWork,
  calculateSicknessInPregnancy,
  checkEligibility,
  getRequiredDocuments,
  planParentalSplit,
} from '@shared/engine';
import { ok } from '../lib/envelope';

const params: BenefitParams = paramsJson;

export const calculatorRouter = Router();

calculatorRouter.post('/eligibility', (req, res, next) => {
  try {
    const result = checkEligibility(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/maternity', (req, res, next) => {
  try {
    const result = calculateMaternity(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/benefit-base', (req, res, next) => {
  try {
    const result = calculateBenefitBase(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/sickness', (req, res, next) => {
  try {
    const result = calculateSicknessInPregnancy(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/plan/parental-split', (req, res, next) => {
  try {
    const result = planParentalSplit(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/plan/parental-with-work', (req, res, next) => {
  try {
    const result = calculateParentalLeaveWithWork(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/documents', (req, res, next) => {
  try {
    const result = getRequiredDocuments(req.body, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
