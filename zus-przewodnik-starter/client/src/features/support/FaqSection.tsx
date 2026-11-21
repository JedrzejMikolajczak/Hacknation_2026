import { useState, type FormEvent } from 'react';
import type { BenefitParams } from '@shared/types';
import { answerFaqQuestion, FAQ_SUGGESTIONS, type FaqAnswer } from './supportData';

interface FaqDetailsProps {
  params: BenefitParams;
}

export function FaqDetails({ params }: FaqDetailsProps) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<{ question: string; response: FaqAnswer }[]>([]);

  function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    const response = answerFaqQuestion(trimmed, params);
    setHistory((prev) => [{ question: trimmed, response }, ...prev]);
    setQuery('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitQuestion(query);
  }

  return (
    <details className="support-accordion">
      <summary className="support-accordion__summary">Najczęstsze pytania</summary>
      <div className="support-accordion__body">
        <p className="support-accordion__intro">
          Gotowe odpowiedzi opracowane na podstawie Poradnika dla rodziców ZUS 2026 oraz Kodeksu
          pracy (charakter informacyjny, nie zastępują decyzji ZUS).
        </p>

        <div className="support-faq-chips" aria-label="Najczęstsze pytania o zasiłki">
          {FAQ_SUGGESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="support-faq-chip"
              onClick={() => submitQuestion(sample)}
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
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="submit" className="plan-btn plan-btn--secondary support-action-btn">
            Sprawdź odpowiedź ›
          </button>
        </form>

        {history.length > 0 && (
          <div className="support-faq-history" aria-live="polite">
            {history.map((item, idx) => (
              <article key={`${item.question}-${idx}`} className="support-faq-answer">
                <p>
                  <strong>Pytanie:</strong> {item.question}
                </p>
                <p>{item.response.answer}</p>
                <details className="support-inline-details">
                  <summary className="support-inline-details__summary">
                    Podstawa prawna i źródła
                  </summary>
                  <div className="support-inline-details__body">
                    {item.response.sources.map((s) => `${s.title} (${s.legalBasis})`).join(' · ')}
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
