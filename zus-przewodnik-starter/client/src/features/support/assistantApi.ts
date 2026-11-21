import type { AssistantAnswer, BenefitParams } from '@shared/types';
import { buildDemoAssistantAnswer } from '@shared/engine/assistantAnswers';
import { ApiError, apiPost } from '../../api/client';

export async function askSupportAssistant(question: string, params: BenefitParams) {
  try {
    const data = await apiPost<AssistantAnswer & { is_demo_fallback: boolean }>('/assistant/ask', { question });
    return { data, isDemoFallback: data.is_demo_fallback };
  } catch (error) {
    if (!(error instanceof ApiError) || !['NOT_FOUND', 'INTERNAL_ERROR'].includes(error.code)) throw error;
    return { data: buildDemoAssistantAnswer(question, params), isDemoFallback: true };
  }
}
