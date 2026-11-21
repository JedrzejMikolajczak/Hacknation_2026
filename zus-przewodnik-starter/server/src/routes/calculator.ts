import { Router } from 'express';
import { z } from 'zod';
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

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wymagany format daty RRRR-MM-DD.');

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Wymagany format miesiąca RRRR-MM.');

const insuranceTitleSchema = z.enum(['employment', 'mandateContract', 'selfEmployed', 'none']);
const sicknessInsuranceSchema = z.enum(['mandatory', 'voluntary', 'none']);
const parentRoleSchema = z.enum(['mother', 'father']);
const situationTypeSchema = z.enum(['planning', 'pregnant', 'afterBirth', 'adoption']);
const adoptionTypeSchema = z.enum(['fosterFamily', 'adoption']);
const rateVariantSchema = z.enum(['standard', 'combined']);
const leaveTypeSchema = z.enum([
  'maternityLeave',
  'adoptionMaternityLeave',
  'supplementaryMaternityLeave',
  'parentalLeave',
  'paternityLeave',
]);
const payComponentKindSchema = z.enum([
  'monthly',
  'monthlyNonSupplemented',
  'quarterly',
  'annual',
  'excluded',
]);

const parentDataSchema = z.object({
  role: parentRoleSchema,
  insuranceTitle: insuranceTitleSchema,
  sicknessInsurance: sicknessInsuranceSchema,
  insuredSince: isoDateSchema.nullable(),
  insuranceEndDate: isoDateSchema.nullable(),
  benefitBase: z.number().finite().nonnegative().nullable(),
  employerInsuredCount: z.number().int().nonnegative().nullable(),
  age: z.number().int().min(14).max(120).nullable(),
  contributionDebt: z.number().finite().nonnegative().nullable(),
  wantsLeave: z.boolean(),
});

const specialCircumstancesSchema = z.object({
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
});

const scenarioInputSchema = z.object({
  situation: situationTypeSchema,
  referenceDate: isoDateSchema,
  expectedBirthDate: isoDateSchema.nullable(),
  birthDate: isoDateSchema.nullable(),
  childrenCount: z
    .number()
    .int()
    .positive('Podaj dodatnią całkowitą liczbę dzieci (childrenCount).'),
  adoptionType: adoptionTypeSchema.nullable(),
  childAcceptanceDate: isoDateSchema.nullable(),
  childAgeYears: z.number().finite().nonnegative().nullable(),
  schoolObligationDeferred: z.boolean(),
  rateVariant: rateVariantSchema,
  mother: parentDataSchema,
  father: parentDataSchema.nullable(),
  special: specialCircumstancesSchema,
});

const eligibilityInputSchema = scenarioInputSchema.extend({
  sicknessStartDate: isoDateSchema.optional(),
  creditedInsuranceDays: z.number().int().nonnegative().optional(),
  waitingPeriodExempt: z.boolean().optional(),
  unlawfulTerminationConfirmedByCourt: z.boolean().optional(),
  shamContractRiskHint: z.boolean().optional(),
  baseIncreasedInPregnancy: z.boolean().optional(),
});

const maternityInputSchema = eligibilityInputSchema.extend({
  combinedApplicationDate: isoDateSchema.optional(),
  childrenAliveCount: z.number().int().nonnegative().optional(),
  motherAbandonedChild: z.boolean().optional(),
  motherHospitalizationWeeks: z.number().int().positive().optional(),
  motherUsedWeeksBeforeTakeover: z.number().int().nonnegative().optional(),
});

const sicknessInputSchema = eligibilityInputSchema.extend({
  sicknessDaysUsed: z.number().int().nonnegative().optional(),
  employerSickPayDaysUsed: z.number().int().nonnegative().optional(),
  yearTurned50: z.number().int().min(1901).max(2200).optional(),
});

const monthlyIncomeSchema = z.object({
  month: yearMonthSchema,
  grossAmount: z.number().finite().nonnegative(),
  workedDays: z.number().int().nonnegative().nullable(),
  requiredWorkingDays: z.number().int().positive().nullable(),
  components: z
    .array(
      z.object({
        kind: payComponentKindSchema,
        amount: z.number().finite().nonnegative(),
      }),
    )
    .optional(),
});

const benefitBaseInputSchema = z.object({
  insuranceTitle: insuranceTitleSchema,
  rightArisesOn: isoDateSchema,
  incomes: z.array(monthlyIncomeSchema),
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

const parentalSplitInputSchema = z.object({
  scenario: scenarioInputSchema,
  parts: z.array(
    z.object({
      parentRole: parentRoleSchema,
      leaveType: leaveTypeSchema,
      startDate: isoDateSchema,
      weeks: z.number().int().positive(),
    }),
  ),
});

const parentalWithWorkInputSchema = z.object({
  scenario: scenarioInputSchema,
  parentRole: parentRoleSchema,
  workTimeFraction: z.number().finite().gt(0).lte(1),
  startDate: isoDateSchema,
  weeks: z.number().int().positive(),
});

export const calculatorRouter = Router();

calculatorRouter.post('/eligibility', (req, res, next) => {
  try {
    const input = eligibilityInputSchema.parse(req.body);
    const result = checkEligibility(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/maternity', (req, res, next) => {
  try {
    const input = maternityInputSchema.parse(req.body);
    const result = calculateMaternity(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/benefit-base', (req, res, next) => {
  try {
    const input = benefitBaseInputSchema.parse(req.body);
    const result = calculateBenefitBase(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/calculate/sickness', (req, res, next) => {
  try {
    const input = sicknessInputSchema.parse(req.body);
    const result = calculateSicknessInPregnancy(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/plan/parental-split', (req, res, next) => {
  try {
    const input = parentalSplitInputSchema.parse(req.body);
    const result = planParentalSplit(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/plan/parental-with-work', (req, res, next) => {
  try {
    const input = parentalWithWorkInputSchema.parse(req.body);
    const result = calculateParentalLeaveWithWork(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

calculatorRouter.post('/documents', (req, res, next) => {
  try {
    const input = scenarioInputSchema.parse(req.body);
    const result = getRequiredDocuments(input, params);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
