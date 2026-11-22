import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { BenefitParams } from '@shared/types';
import defaultParams from '@shared/params.json';
import { fail, ok } from '../lib/envelope';

let active: BenefitParams = defaultParams;

export function getParams(): BenefitParams {
  return active;
}

function matchesShape(example: unknown, input: unknown): boolean {
  if (example === null)
    return input === null || (typeof input === 'number' && Number.isFinite(input) && input >= 0);
  if (typeof example === 'number')
    return typeof input === 'number' && Number.isFinite(input) && input >= 0;
  if (typeof example === 'string')
    return (
      typeof input === 'string' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(example) || z.iso.date().safeParse(input).success)
    );
  if (Array.isArray(example))
    return (
      Array.isArray(input) &&
      input.length === example.length &&
      example.every((value, index) => matchesShape(value, input[index]))
    );
  if (
    example &&
    typeof example === 'object' &&
    input &&
    typeof input === 'object' &&
    !Array.isArray(input)
  ) {
    return (
      Object.keys(example).length === Object.keys(input).length &&
      Object.entries(example).every(
        ([key, value]) =>
          Object.hasOwn(input, key) && matchesShape(value, (input as Record<string, unknown>)[key]),
      )
    );
  }
  return typeof example === typeof input;
}

function addDefaultStandardSicknessLimit(input: unknown): unknown {
  if (
    !input ||
    typeof input !== 'object' ||
    !('sickness' in input) ||
    !input.sickness ||
    typeof input.sickness !== 'object' ||
    Object.hasOwn(input.sickness, 'maxStandardBenefitPeriodDays')
  )
    return input;
  return {
    ...input,
    sickness: {
      ...input.sickness,
      maxStandardBenefitPeriodDays: defaultParams.sickness.maxStandardBenefitPeriodDays,
    },
  };
}

const benefitParamsSchema = z.custom<BenefitParams>((input) => {
  if (!matchesShape(defaultParams, input)) return false;
  const params = input as BenefitParams;
  return (
    Object.values(params.rates).every((rate) => rate <= 1) &&
    params.calendar.daysPerWeek === defaultParams.calendar.daysPerWeek &&
    params.calendar.dailyBenefitDivisor === defaultParams.calendar.dailyBenefitDivisor &&
    Number.isInteger(params.benefitBase.lookbackMonths) &&
    params.benefitBase.lookbackMonths > 0 &&
    Number.isInteger(params.sickness.maxStandardBenefitPeriodDays) &&
    params.sickness.maxStandardBenefitPeriodDays > 0 &&
    params.sickness.maxStandardBenefitPeriodDays <= params.sickness.maxBenefitPeriodDays &&
    params.benefitBase.socialContributionDeduction < 1 &&
    params.parentalLeave.maxWorkTimeFraction < 1 &&
    params.parentalLeave.nonTransferableWeeksPerParent <=
      Math.min(params.parentalLeave.weeksSingleChild, params.parentalLeave.weeksMultipleChildren)
  );
}, 'Parametry muszą mieć poprawny format i zakres.');

/** Minimalna długość tokenu administratora – słabe lub przykładowe tokeny wyłączają panel. */
const MIN_ADMIN_TOKEN_LENGTH = 32;
const PLACEHOLDER_ADMIN_TOKENS = new Set(['change-me', 'changeme', 'admin', 'password']);

export function isUsableAdminToken(token: string | undefined): token is string {
  return (
    typeof token === 'string' &&
    token.length >= MIN_ADMIN_TOKEN_LENGTH &&
    !PLACEHOLDER_ADMIN_TOKENS.has(token.toLowerCase())
  );
}

function authorized(header: string | undefined): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!isUsableAdminToken(token) || !header) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const paramsRouter = Router();
paramsRouter.get('/params', (_req, res) => res.json(ok(getParams())));
paramsRouter.put('/admin/params', (req, res, next) => {
  if (!authorized(req.get('Authorization'))) {
    res.status(401).json(fail('UNAUTHORIZED', 'Wymagany poprawny token administratora.'));
    return;
  }
  try {
    active = benefitParamsSchema.parse(addDefaultStandardSicknessLimit(req.body));
    res.json(ok(getParams()));
  } catch (error) {
    next(error);
  }
});
