import { describe, expect, it } from 'vitest';
import type { BenefitParams } from '../../types';
import paramsJson from '../../params.json';
import { checkEligibility } from '../index';

describe('shared smoke', () => {
  it('loads params.json with a version matching BenefitParams', () => {
    const params: BenefitParams = paramsJson;
    expect(typeof params.version).toBe('string');
    expect(params.version.length).toBeGreaterThan(0);
  });

  it('engine stubs throw until implemented', () => {
    expect(() => checkEligibility({} as never, paramsJson)).toThrow('Not implemented');
  });
});
