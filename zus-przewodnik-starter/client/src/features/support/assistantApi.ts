import type { AssistantAnswer, BenefitParams, CaseInputs, CasePlan } from '@shared/types';
import { buildDemoAssistantAnswer } from '@shared/engine/assistantAnswers';
import { ApiError, apiGet, apiPost } from '../../api/client';

export interface AssistantPlanContext {
  stage?: string;
  employment_type?: string;
  applicant_role?: string;
  co_parenting?: boolean;
  children_count?: number;
  who_pays?: string | null;
  applied_payment_variant?: string;
  is_qualified?: boolean;
  has_b2b_arrears?: boolean | null;
  debt_amount_pln?: number | null;
  warning_codes?: string[];
  difficult_case?: boolean;
}

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantApiResponse extends AssistantAnswer {
  is_demo_fallback: boolean;
  model?: string;
}

export interface AssistantStatus {
  ai_enabled: boolean;
  provider: 'gemini' | 'demo';
}

/** Buduje wyłącznie zanonimizowany kontekst planu (bez danych osobowych). */
export function buildAssistantContext(
  input: CaseInputs,
  plan: CasePlan,
  difficult: boolean,
): AssistantPlanContext {
  return {
    stage: input.stage,
    employment_type: input.employment_type,
    applicant_role: input.applicant_role,
    co_parenting: input.co_parenting,
    children_count: input.children_count,
    who_pays: plan.outcome.who_pays,
    applied_payment_variant: plan.outcome.applied_payment_variant,
    is_qualified: plan.outcome.is_qualified,
    has_b2b_arrears: input.has_b2b_arrears,
    debt_amount_pln: input.debt_amount_pln ?? null,
    warning_codes: plan.outcome.warnings.map((warning) => warning.code).slice(0, 12),
    difficult_case: difficult,
  };
}

export async function fetchAssistantStatus(): Promise<AssistantStatus> {
  try {
    return await apiGet<AssistantStatus>('/assistant/status');
  } catch {
    return { ai_enabled: false, provider: 'demo' };
  }
}

export async function askSupportAssistant(
  question: string,
  params: BenefitParams,
  options?: {
    context?: AssistantPlanContext;
    history?: AssistantHistoryTurn[];
  },
) {
  try {
    const body: {
      question: string;
      context?: AssistantPlanContext;
      history?: AssistantHistoryTurn[];
    } = { question };
    if (options?.context) body.context = options.context;
    if (options?.history && options.history.length > 0) {
      body.history = options.history.slice(-6);
    }
    const data = await apiPost<AssistantApiResponse>('/assistant/ask', body);
    return {
      data: { answer: data.answer, sources: data.sources } satisfies AssistantAnswer,
      isDemoFallback: data.is_demo_fallback,
      model: data.model,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || !['NOT_FOUND', 'INTERNAL_ERROR'].includes(error.code))
      throw error;
    return {
      data: buildDemoAssistantAnswer(question, params),
      isDemoFallback: true,
      model: undefined,
    };
  }
}
