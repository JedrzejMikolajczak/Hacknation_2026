import { useState, type FormEvent } from 'react';
import type { BenefitParams } from '@shared/types';
import { AiBadge } from '../../components/AiBadge';
import { askSupportAssistant } from './supportApi';
import { type AssistantAnswer, SUGGESTED_QUESTIONS } from './supportMock';

interface AssistantMessage {
  id: number;
  question: string;
  answer: AssistantAnswer;
  isDemoFallback: boolean;
}

interface AssistantSectionProps {
  params: BenefitParams;
}

export function AssistantSection({ params }: AssistantSectionProps) {
  const [question, setQuestion] = useState<string>('');
  const [asking, setAsking] = useState<boolean>(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function submitQuestion(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setErrorText('Wpisz pytanie lub wybierz jedno z gotowych pytań poniżej.');
      return;
    }
    setErrorText(null);
    setAsking(true);

    try {
      const response = await askSupportAssistant(trimmed, params);
      setMessages((prev) => [
        {
          id: Date.now(),
          question: trimmed,
          answer: response.data,
          isDemoFallback: response.isDemoFallback,
        },
        ...prev,
      ]);
      setQuestion('');
    } catch {
      setErrorText('Nie udało się pobrać odpowiedzi. Spróbuj ponownie za chwilę.');
    } finally {
      setAsking(false);
    }
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(question);
  }

  return (
    <section className="support-card" aria-labelledby="assistant-heading">
      <div className="assistant-header">
        <div>
          <div className="assistant-title-row">
            <h2 id="assistant-heading" className="support-card__title">
              Zapytaj przewodnika ZUS
            </h2>
            <AiBadge />
          </div>
          <p className="support-card__lead">
            Zadaj pytanie prostym językiem – asystent odpowiada na podstawie poradnika ZUS i
            przepisów. Jeśli nie wiesz, od czego zacząć, kliknij jedno z gotowych pytań.
          </p>
        </div>
      </div>

      <div className="assistant-suggestions" aria-label="Przykładowe pytania">
        {SUGGESTED_QUESTIONS.map((sample) => (
          <button
            key={sample}
            type="button"
            className="suggestion-chip"
            disabled={asking}
            onClick={() => void submitQuestion(sample)}
          >
            {sample}
          </button>
        ))}
      </div>

      <form className="assistant-form" onSubmit={handleFormSubmit}>
        <label htmlFor="support-question-input" className="assistant-form__label">
          Twoje pytanie
        </label>
        <div className="assistant-form__row">
          <input
            id="support-question-input"
            type="text"
            className="assistant-form__input"
            placeholder="Np. Czy po zmianie etatu w ciąży dostanę niższy zasiłek?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
          />
          <button type="submit" className="button button--primary" disabled={asking}>
            {asking ? 'Szukam odpowiedzi…' : 'Zapytaj'}
          </button>
        </div>
        {errorText && (
          <p className="assistant-error" role="alert">
            {errorText}
          </p>
        )}
      </form>

      {messages.length > 0 && (
        <div className="assistant-answers" aria-live="polite">
          {messages.map((item) => (
            <article key={item.id} className="assistant-answer-card">
              <p className="assistant-answer-card__question">
                <strong>Pytanie:</strong> {item.question}
              </p>
              <p className="assistant-answer-card__text">{item.answer.answer}</p>
              <div className="assistant-answer-card__footer">
                {item.answer.sources.length > 0 && (
                  <p className="assistant-answer-card__sources">
                    <strong>Źródła:</strong> {item.answer.sources.join(' · ')}
                  </p>
                )}
                {item.isDemoFallback && (
                  <span className="assistant-demo-tag">
                    Odpowiedź z lokalnej bazy wiedzy (przed podpięciem API asystenta)
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
