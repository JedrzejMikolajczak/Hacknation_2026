import { useMemo, useState, type FormEvent } from 'react';
import type { AssistantAnswer, BenefitParams, CaseInputs, CasePlan } from '@shared/types';
import { AiBadge } from '../../components/AiBadge';
import {
  askSupportAssistant,
  buildAssistantContext,
  type AssistantHistoryTurn,
} from './assistantApi';
import { SUGGESTED_QUESTIONS } from './assistantQuestions';

interface AssistantMessageItem {
  id: number;
  question: string;
  answer: AssistantAnswer;
  isDemoFallback: boolean;
}

interface AiAssistantSectionProps {
  input?: CaseInputs;
  plan?: CasePlan;
  params: BenefitParams;
  difficult?: boolean;
}

function buildSuggestedQuestions(input: CaseInputs | undefined, difficult: boolean): string[] {
  if (difficult) {
    return [
      'Jaki wymiar urlopu i zasiłku przysługuje po stracie dziecka?',
      'Jakie dokumenty z USC są potrzebne do zasiłku macierzyńskiego?',
      'Czy mogę złożyć wniosek elektronicznie bez wizyty w placówce?',
    ];
  }
  const tailored: string[] = [];
  if (input?.employment_type === 'B2B') {
    tailored.push('Mam działalność gospodarczą – czy mały dług blokuje zasiłek?');
  }
  if (input?.contract_type === 'FIXED_TERM' || input?.stage === 'PREGNANCY') {
    tailored.push('Kończy mi się umowa w ciąży – co wtedy?');
  }
  for (const base of SUGGESTED_QUESTIONS) {
    if (!tailored.includes(base)) tailored.push(base);
  }
  return tailored.slice(0, 5);
}

export function AiAssistantSection({
  input,
  plan,
  params,
  difficult = false,
}: AiAssistantSectionProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessageItem[]>([]);

  const context = useMemo(
    () => (input && plan ? buildAssistantContext(input, plan, difficult) : undefined),
    [input, plan, difficult],
  );
  const suggestedQuestions = useMemo(
    () => buildSuggestedQuestions(input, difficult),
    [input, difficult],
  );

  async function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) {
      setErrorText('Wpisz pytanie lub wybierz jedną z podpowiedzi powyżej.');
      return;
    }
    setErrorText(null);
    setLoading(true);
    try {
      const history: AssistantHistoryTurn[] = messages
        .slice(-3)
        .flatMap((item) => [
          { role: 'user' as const, text: item.question },
          { role: 'assistant' as const, text: item.answer.answer },
        ]);
      const response = await askSupportAssistant(trimmed, params, { context, history });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + prev.length,
          question: trimmed,
          answer: response.data,
          isDemoFallback: response.isDemoFallback,
        },
      ]);
      setQuery('');
    } catch {
      setErrorText('Nie udało się pobrać odpowiedzi. Spróbuj ponownie za chwilę.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(query);
  }

  return (
    <section className="support-ai" aria-labelledby="support-ai-heading">
      <div className="support-ai__header">
        <div className="support-ai__title-row">
          <h3 id="support-ai-heading" className="support-ai__title">
            Asystent AI – zapytaj o swoją sytuację
          </h3>
          <AiBadge />
        </div>
        <p className="support-accordion__intro">
          Asystent korzysta z modelu Google Gemini i uwzględnia zanonimizowany kontekst Twojego
          planu (bez danych osobowych). Odpowiedzi mają charakter informacyjny i nie zastępują
          oficjalnej decyzji ZUS.
        </p>
      </div>

      <div className="support-faq-chips" aria-label="Przykładowe pytania do asystenta AI">
        {suggestedQuestions.map((sample) => (
          <button
            key={sample}
            type="button"
            className="support-faq-chip"
            disabled={loading}
            onClick={() => void submitQuestion(sample)}
          >
            {sample}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="support-faq-history" aria-live="polite">
          {messages.map((item) => (
            <article key={item.id} className="support-faq-answer">
              <div className="support-ai__answer-top">
                <p className="support-ai__question">
                  <strong>Twoje pytanie:</strong> {item.question}
                </p>
                <span
                  className={
                    item.isDemoFallback
                      ? 'support-ai__source-tag support-ai__source-tag--fallback'
                      : 'support-ai__source-tag support-ai__source-tag--ai'
                  }
                >
                  {item.isDemoFallback ? 'Tryb awaryjny (baza lokalna ZUS 2026)' : 'Gemini AI'}
                </span>
              </div>
              <p className="support-ai__reply">{item.answer.answer}</p>
              {item.answer.sources.length > 0 && (
                <details className="support-inline-details">
                  <summary className="support-inline-details__summary">
                    Podstawa prawna i źródła
                  </summary>
                  <div className="support-inline-details__body">
                    {item.answer.sources.join(' · ')}
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      )}

      <form className="support-form" onSubmit={handleSubmit}>
        <label className="plan-field">
          <span className="plan-field__label">Zadaj pytanie asystentowi AI</span>
          <input
            type="text"
            className="plan-field__input"
            placeholder="Np. Do kiedy złożyć wniosek o 81,5% lub co zrobić z zadłużeniem JDG?"
            value={query}
            disabled={loading}
            onChange={(e) => {
              setQuery(e.target.value);
              if (errorText) setErrorText(null);
            }}
          />
        </label>
        <div className="support-ai__actions">
          <button
            type="submit"
            className="plan-btn plan-btn--primary support-action-btn"
            disabled={loading}
          >
            {loading ? 'Analizuję pytanie…' : 'Zapytaj asystenta ›'}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              className="plan-btn plan-btn--secondary support-action-btn"
              disabled={loading}
              onClick={() => {
                setMessages([]);
                setErrorText(null);
              }}
            >
              Wyczyść rozmowę
            </button>
          )}
        </div>
        {errorText && (
          <p className="plan-callout plan-callout--warning support-pue-feedback" role="alert">
            {errorText}
          </p>
        )}
      </form>
    </section>
  );
}

/** Zachowany eksport dla zgodności z AssistantSection. */
export function FaqDetails({ params }: { params: BenefitParams }) {
  return <AiAssistantSection params={params} />;
}
