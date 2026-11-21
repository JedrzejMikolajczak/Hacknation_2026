import { useState, type FormEvent } from 'react';
import type { AssistantAnswer, BenefitParams } from '@shared/types';
import { askSupportAssistant } from './assistantApi';
import { SUGGESTED_QUESTIONS } from './assistantQuestions';

interface FaqHistoryItem {
  id: number;
  question: string;
  answer: AssistantAnswer;
}

interface FaqDetailsProps {
  params: BenefitParams;
}

export function FaqDetails({ params }: FaqDetailsProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [history, setHistory] = useState<FaqHistoryItem[]>([]);

  async function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) {
      setErrorText('Wpisz pytanie lub wybierz jedno z gotowych pytań powyżej.');
      return;
    }
    setErrorText(null);
    setLoading(true);
    try {
      const response = await askSupportAssistant(trimmed, params);
      setHistory((prev) => [
        {
          id: Date.now() + prev.length,
          question: trimmed,
          answer: response.data,
        },
        ...prev,
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
    <details className="support-accordion">
      <summary className="support-accordion__summary">Najczęstsze pytania</summary>
      <div className="support-accordion__body">
        <p className="support-accordion__intro">
          Gotowe odpowiedzi z bazy wiedzy opracowanej na podstawie Poradnika dla rodziców ZUS 2026
          oraz Kodeksu pracy (bez użycia modelu AI; charakter informacyjny, nie zastępują decyzji
          ZUS).
        </p>

        <div className="support-faq-chips" aria-label="Najczęstsze pytania o zasiłki">
          {SUGGESTED_QUESTIONS.map((sample) => (
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

        <form className="support-form" onSubmit={handleSubmit}>
          <label className="plan-field">
            <span className="plan-field__label">Wyszukaj odpowiedź w bazie pytań</span>
            <input
              type="text"
              className="plan-field__input"
              placeholder="Np. Do kiedy złożyć wniosek o 81,5%?"
              value={query}
              disabled={loading}
              onChange={(e) => {
                setQuery(e.target.value);
                if (errorText) setErrorText(null);
              }}
            />
          </label>
          <button
            type="submit"
            className="plan-btn plan-btn--secondary support-action-btn"
            disabled={loading}
          >
            {loading ? 'Szukam odpowiedzi…' : 'Sprawdź odpowiedź ›'}
          </button>
          {errorText && (
            <p className="plan-callout plan-callout--warning support-pue-feedback" role="alert">
              {errorText}
            </p>
          )}
        </form>

        {history.length > 0 && (
          <div className="support-faq-history" aria-live="polite">
            {history.map((item) => (
              <article key={item.id} className="support-faq-answer">
                <p>
                  <strong>Pytanie:</strong> {item.question}
                </p>
                <p>{item.answer.answer}</p>
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
      </div>
    </details>
  );
}
