import { Router } from 'express';
import { z } from 'zod';
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

type EvaluableCase = ZusCase & {
  expectedDays?: number | null;
  benefitBaseInput: BaseInput | null;
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wymagany format daty RRRR-MM-DD.');
const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Wymagany format miesiąca RRRR-MM.');

const parentDataSchema = z.object({
  role: z.enum(['mother', 'father']),
  insuranceTitle: z.enum(['employment', 'mandateContract', 'selfEmployed', 'none']),
  sicknessInsurance: z.enum(['mandatory', 'voluntary', 'none']),
  insuredSince: isoDateSchema.nullable(),
  insuranceEndDate: isoDateSchema.nullable(),
  benefitBase: z.number().finite().nonnegative().nullable(),
  employerInsuredCount: z.number().int().nonnegative().nullable(),
  age: z.number().int().min(14).max(120).nullable(),
  contributionDebt: z.number().finite().nonnegative().nullable(),
  wantsLeave: z.boolean(),
});

const scenarioInputSchema = z.object({
  situation: z.enum(['planning', 'pregnant', 'afterBirth', 'adoption']),
  referenceDate: isoDateSchema,
  expectedBirthDate: isoDateSchema.nullable(),
  birthDate: isoDateSchema.nullable(),
  childrenCount: z.number().int().positive('Podaj dodatnią całkowitą liczbę dzieci (childrenCount).'),
  adoptionType: z.enum(['fosterFamily', 'adoption']).nullable(),
  childAcceptanceDate: isoDateSchema.nullable(),
  childAgeYears: z.number().finite().nonnegative().nullable(),
  schoolObligationDeferred: z.boolean(),
  rateVariant: z.enum(['standard', 'combined']),
  mother: parentDataSchema,
  father: parentDataSchema.nullable(),
  special: z.object({
    zaZyciemCertificate: z.boolean(),
    pregnancyWeekAtBirth: z.number().int().positive().nullable(),
    birthWeightGrams: z.number().int().positive().nullable(),
    hospitalizationDays: z.number().int().nonnegative().nullable(),
    stillbirth: z.boolean(),
    childDeathDate: isoDateSchema.nullable(),
    motherHospitalized: z.boolean(),
    motherIncapableOfIndependentLiving: z.boolean(),
    motherDeceased: z.boolean(),
    employerBankruptcyOrLiquidation: z.boolean(),
  }),
});

const payComponentSchema = z.object({
  kind: z.enum(['monthly', 'monthlyNonSupplemented', 'quarterly', 'annual', 'excluded']),
  amount: z.number().finite().nonnegative(),
});

const benefitBaseInputSchema = z.object({
  insuranceTitle: z.enum(['employment', 'mandateContract', 'selfEmployed', 'none']),
  rightArisesOn: isoDateSchema,
  incomes: z.array(
    z.object({
      month: yearMonthSchema,
      grossAmount: z.number().finite().nonnegative(),
      workedDays: z.number().int().nonnegative().nullable(),
      requiredWorkingDays: z.number().int().positive().nullable(),
      components: z.array(payComponentSchema).optional(),
    }),
  ),
  contractMonthlySalary: z.number().finite().nonnegative().nullable(),
  declaredContributionBase: z.number().finite().nonnegative().nullable(),
  previousBenefitEndDate: isoDateSchema.nullable(),
  previousBenefitBase: z.number().finite().nonnegative().nullable(),
  employmentFraction: z.number().finite().gt(0).lte(1).optional(),
  insuredSince: isoDateSchema.optional(),
  absencesJustified: z.boolean().optional(),
  employmentFractionChanged: z.boolean().optional(),
  minimumContributionBases: z.record(z.string(), z.number().finite().nonnegative()).optional(),
  creditedPreviousMonths: z.number().int().nonnegative().optional(),
});

const uploadedCaseSchema = z.object({
  caseId: z.string().trim().min(1, 'Podaj identyfikator sprawy (caseId).'),
  title: z.string().trim().min(1, 'Podaj tytuł sprawy (title).'),
  scenario: scenarioInputSchema,
  benefitBaseInput: benefitBaseInputSchema.nullable(),
  expectedDays: z.number().int().nonnegative().nullable().optional(),
  source: z.string().optional(),
  zusDecision: z.object({
    granted: z.boolean(),
    benefitBase: z.number().finite().nonnegative().nullable(),
    amount: z.number().finite().nonnegative().nullable(),
    note: z.string().nullable(),
  }),
});

// Jawny katalog publicznych danych demonstracyjnych.
const cases = [employed, uninsured].map((item) => ({
  ...item,
  source: 'synthetic',
})) as SyntheticCase[];

function evaluateCase(item: EvaluableCase): CaseEvaluationResult {
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
  if (expected.benefitBase !== null && scenario.mother.benefitBase !== expected.benefitBase) {
    differences.push('Podstawa wymiaru');
  }
  if (typeof item.expectedDays === 'number' && days !== item.expectedDays) {
    differences.push('Liczba dni');
  }
  if (expected.amount !== null && calculation.totalAmount !== expected.amount) {
    differences.push('Kwota brutto');
  }
  return {
    caseId: item.caseId,
    eligibility,
    calculation,
    benefitBase,
    matchesZusDecision: differences.length === 0,
    differences,
  };
}

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

casesRouter.post('/cases/evaluate', (req, res, next) => {
  try {
    const item = uploadedCaseSchema.parse(req.body);
    res.json(ok(evaluateCase(item)));
  } catch (err) {
    next(err);
  }
});

casesRouter.get('/cases/:caseId', (req, res) => {
  const item = cases.find((candidate) => candidate.caseId === req.params.caseId);
  if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
  return res.json(ok(item));
});

casesRouter.post('/cases/:caseId/evaluate', (req, res, next) => {
  try {
    const item = cases.find((candidate) => candidate.caseId === req.params.caseId);
    if (!item) return res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono przykładowej sprawy.'));
    return res.json(ok(evaluateCase(item)));
  } catch (err) {
    return next(err);
  }
});
