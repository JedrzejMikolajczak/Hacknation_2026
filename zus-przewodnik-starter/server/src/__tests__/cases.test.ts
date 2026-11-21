import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CaseEvaluation, CaseRecord, CaseSummary } from '@shared/types';
import { createApp } from '../app';

const app = createApp();
const api = '/api/v1';

describe('Katalog spraw konkursowych', () => {
  it('podaje dokładnie sześć publicznych identyfikatorów, kontrakt sprawy i wynik silnika', async () => {
    const { body } = await request(app).get(`${api}/cases`).expect(200);
    const summaries: CaseSummary[] = body.data;
    expect(summaries.map(({ case_id }) => case_id)).toEqual([
      'case-01',
      'case-02',
      'case-03',
      'case-04',
      'case-05',
      'case-06',
    ]);
    for (const { case_id } of summaries) {
      const response = await request(app).get(`${api}/cases/${case_id}`).expect(200);
      const detail: CaseRecord = response.body.data;
      expect(detail.case_id).toBe(case_id);
      expect(detail.inputs.applicant_role).toBe('MOTHER');
      const evaluation: CaseEvaluation = (
        await request(app).post(`${api}/cases/${case_id}/evaluate`).send({}).expect(200)
      ).body.data;
      expect(evaluation.case_id).toBe(case_id);
      expect(evaluation.outcome.is_qualified).toBe(true);
      expect(evaluation.matches).toBe(!['case-02', 'case-06'].includes(case_id));
      expect(evaluation.differences.length > 0).toBe(!evaluation.matches);
    }
  });
  it('zwraca 404 w kopercie dla nieznanej sprawy', async () => {
    const path = `${api}/cases/case-07`;
    const get = await request(app).get(path).expect(404);
    const post = await request(app).post(`${path}/evaluate`).expect(404);
    expect(get.body.error.code).toBe('NOT_FOUND');
    expect(post.body.data).toBeNull();
  });
});
