import { describe, expect, it } from 'vitest';
import type { BenefitParams } from '../../types';
import paramsJson from '../../params.json';
import { planParentalSplit } from '../index';

describe('shared smoke', () => {
  it('loads params.json with a version matching BenefitParams', () => {
    const params: BenefitParams = paramsJson;
    expect(typeof params.version).toBe('string');
    expect(params.version.length).toBeGreaterThan(0);
  });

  it('unimplemented stubs throw until completed', () => {
    expect(() => planParentalSplit({} as never, paramsJson)).toThrow('Not implemented');
  });
});
