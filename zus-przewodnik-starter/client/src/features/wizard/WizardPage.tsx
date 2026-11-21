import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useScenario } from '../../app/ScenarioContext';
import type { ManualFormState } from '../../app/scenarioDraft';
import { parseSituation } from '../../app/situation';
import {
  buildScenario,
  changeAnswer,
  dateInputToIso,
  displayDate,
  formatAnswer,
  getQuestions,
  SITUATION_LABELS,
  STAGES,
  validateAnswer,
  type WizardQuestion,
} from './wizardModel';
import './WizardPage.css';

function formatDateInput(value: string): string {
  const digits = displayDate(value).replace(/\D/g, '');
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: WizardQuestion;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const describedBy =
    [question.hint ? 'question-hint' : '', error ? 'question-error' : '']
      .filter(Boolean)
      .join(' ') || undefined;
  if (question.type === 'choice') {
    return (
      <fieldset
        className="wizard__choices"
        aria-labelledby="question-title"
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
      >
        {question.options?.map((option) => (
          <label
            key={option.value}
            className={`wizard__choice${value === option.value ? ' wizard__choice--selected' : ''}`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="wizard__choice-label">{option.label}</span>
              {option.description && (
                <span className="wizard__choice-description">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <div className="wizard__input-group">
      <label className="wizard__field">
        {question.label}
        <input
          type={question.type === 'date' ? 'text' : question.type}
          value={value === 'unknown' ? '' : question.type === 'date' ? displayDate(value) : value}
          placeholder={question.type === 'date' ? 'DD/MM/YYYY' : undefined}
          maxLength={question.type === 'date' ? 10 : undefined}
          disabled={value === 'unknown'}
          min={question.type === 'number' ? question.min : undefined}
          max={question.type === 'number' ? question.max : undefined}
          step={question.step}
          inputMode={question.type === 'date' || question.step === '1' ? 'numeric' : 'decimal'}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => {
            const input = event.currentTarget;
            if (question.type !== 'date') {
              onChange(input.value);
              return;
            }

            const formatted = formatDateInput(input.value);
            if (formatted !== input.value) {
              const prefix = input.value.slice(0, input.selectionStart ?? input.value.length);
              const position = formatDateInput(prefix).length;
              input.value = formatted;
              input.setSelectionRange(position, position);
            }
            onChange(dateInputToIso(formatted));
          }}
        />
      </label>
      {question.unknownLabel && (
        <label className="wizard__check">
          <input
            type="checkbox"
            checked={value === 'unknown'}
            onChange={(event) => onChange(event.target.checked ? 'unknown' : '')}
          />
          {question.unknownLabel}
        </label>
      )}
    </div>
  );
}

export function WizardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { scenario, manualForm, setSituation, saveManualForm, clearScenario, storageAvailable } =
    useScenario();
  const situation = parseSituation(params.get('situation')) ?? scenario.situation;
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const form: ManualFormState | null = situation
    ? manualForm?.situation === situation
      ? manualForm
      : {
          version: 2,
          situation,
          answers: {},
          currentQuestionId: 'family',
          completed: false,
        }
    : null;
  const questions = situation && form ? getQuestions(situation, form.answers) : [];
  const firstMissing = questions.find(
    (question) => validateAnswer(question, form?.answers[question.id]) !== null,
  );
  const showComplete = Boolean(form?.completed && !firstMissing);
  const showSummary = !showComplete && form?.currentQuestionId === 'summary' && !firstMissing;
  const question =
    questions.find((item) => item.id === form?.currentQuestionId) ?? firstMissing ?? questions[0];
  const stage = showComplete
    ? STAGES.length
    : showSummary
      ? STAGES.length - 1
      : (question?.stage ?? 0);
  const focusKey = showComplete ? 'complete' : showSummary ? 'summary' : question?.id;
  const progress = Math.round((stage / STAGES.length) * 100);

  useEffect(() => {
    if (situation && scenario.situation !== situation) setSituation(situation);
  }, [situation, scenario.situation, setSituation]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [focusKey]);

  function persist(answers: Record<string, string>, currentQuestionId: string, completed = false) {
    if (!situation) return;
    saveManualForm(
      { version: 2, situation, answers, currentQuestionId, completed },
      buildScenario(situation, answers),
    );
  }

  function answer(value: string) {
    if (!situation || !form || !question) return;
    persist(changeAnswer(situation, form.answers, question.id, value), question.id);
    setError(null);
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !question) return;
    const validation = validateAnswer(question, form.answers[question.id]);
    if (validation) {
      setError(validation);
      return;
    }
    const nextQuestion = editing
      ? firstMissing
      : questions[questions.findIndex((item) => item.id === question.id) + 1];
    persist(form.answers, nextQuestion?.id ?? 'summary');
    setError(null);
    if (!nextQuestion) setEditing(false);
  }

  function back() {
    if (!form || !question) return;
    const previous = questions[questions.findIndex((item) => item.id === question.id) - 1];
    if (previous) persist(form.answers, previous.id);
    setError(null);
    setEditing(false);
  }

  function edit(id: string) {
    if (!form) return;
    persist(form.answers, id);
    setEditing(true);
    setError(null);
  }

  function remove() {
    clearScenario();
    navigate('/');
  }

  if (!situation || !form) {
    return (
      <main className="wizard__empty">
        <h1>Najpierw wybierz swoją sytuację</h1>
        <Link to="/">Wróć do strony startowej</Link>
      </main>
    );
  }

  return (
    <div className="wizard">
      <header className="wizard__header">
        <div className="wizard__shell">
          <Link to="/" className="wizard__back-link">
            ← Strona startowa
          </Link>
          <span className="wizard__situation">{SITUATION_LABELS[situation]}</span>
          <h1>Plan dla Twojej rodziny</h1>
          <p>Pytania dopasujemy do Waszej sytuacji. Odpowiedzi można uzupełnić później.</p>
        </div>
      </header>
      <main className="wizard__shell wizard__main">
        <div className="wizard__progress-heading">
          <span>
            {showComplete ? 'Gotowe' : `Etap ${stage + 1} z ${STAGES.length}: ${STAGES[stage]}`}
          </span>
          <span>{progress}%</span>
        </div>
        <div
          className="wizard__progress"
          role="progressbar"
          aria-label="Postęp formularza"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="wizard__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <ol className="wizard__stages" aria-label="Etapy formularza">
          {STAGES.map((label, index) => (
            <li
              key={label}
              className={index <= stage ? 'wizard__stage--active' : ''}
              aria-current={index === stage ? 'step' : undefined}
            >
              <span aria-hidden="true">{index < stage ? '✓' : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {showComplete ? (
          <section className="wizard__card" aria-labelledby="question-title">
            <span className="wizard__complete-icon" aria-hidden="true">
              ✓
            </span>
            <h2 ref={titleRef} tabIndex={-1} id="question-title">
              {storageAvailable ? 'Odpowiedzi zapisane' : 'Odpowiedzi zebrane'}
            </h2>
            <p>
              {storageAvailable
                ? 'Możecie wrócić do nich na tym samym urządzeniu i w tej samej przeglądarce.'
                : 'Pozostawcie tę stronę otwartą. Przeglądarka nie pozwoliła zapisać odpowiedzi na później.'}
            </p>
            {questions.some((item) => form.answers[item.id] === 'unknown') && (
              <p className="wizard__notice">
                Część danych czeka na uzupełnienie. Znajdziecie je w podsumowaniu.
              </p>
            )}
            <div className="wizard__actions">
              <button
                type="button"
                className="wizard__button wizard__button--primary"
                onClick={() => persist(form.answers, 'summary')}
              >
                Zobacz podsumowanie
              </button>
              <Link className="wizard__button wizard__button--secondary" to="/plan">
                Przejdź do planu
              </Link>
            </div>
          </section>
        ) : showSummary ? (
          <section className="wizard__card" aria-labelledby="question-title">
            <h2 ref={titleRef} tabIndex={-1} id="question-title">
              Sprawdźcie odpowiedzi
            </h2>
            <p className="wizard__help">
              Każdą odpowiedź możecie zmienić. Pola „Do uzupełnienia później” pozostaną oznaczone
              jako brakujące.
            </p>
            {STAGES.slice(0, -1).map((label, index) => (
              <section key={label} className="wizard__summary-section" aria-label={label}>
                <h3>{label}</h3>
                <dl className="wizard__summary">
                  {questions
                    .filter((item) => item.stage === index)
                    .map((item) => (
                      <div key={item.id}>
                        <dt>{item.label}</dt>
                        <dd>{formatAnswer(item, form.answers[item.id])}</dd>
                        <button
                          type="button"
                          className="wizard__edit"
                          aria-label={`Zmień: ${item.label}`}
                          onClick={() => edit(item.id)}
                        >
                          Zmień
                        </button>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
            <button
              type="button"
              className="wizard__button wizard__button--primary"
              onClick={() => persist(form.answers, 'summary', true)}
            >
              Zapisz odpowiedzi
            </button>
          </section>
        ) : (
          question && (
            <form className="wizard__card" noValidate onSubmit={next}>
              <p className="wizard__eyebrow">{STAGES[question.stage]}</p>
              <h2 ref={titleRef} tabIndex={-1} id="question-title">
                {question.title}
              </h2>
              {question.hint && (
                <p id="question-hint" className="wizard__help">
                  {question.hint}
                </p>
              )}
              <QuestionField
                key={question.id}
                question={question}
                value={form.answers[question.id] ?? ''}
                error={error}
                onChange={answer}
              />
              {error && (
                <p className="wizard__error" id="question-error" role="alert">
                  {error}
                </p>
              )}
              <div className="wizard__actions">
                {question.id !== 'family' && (
                  <button
                    type="button"
                    className="wizard__button wizard__button--secondary"
                    onClick={back}
                  >
                    Wstecz
                  </button>
                )}
                <button type="submit" className="wizard__button wizard__button--primary">
                  {editing ? 'Wróć do podsumowania' : 'Dalej'} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          )
        )}

        <p className={storageAvailable ? 'wizard__save-note' : 'wizard__notice'} role="status">
          {storageAvailable
            ? 'Odpowiedzi zapisują się automatycznie tylko w tej przeglądarce.'
            : 'Zapis na urządzeniu jest niedostępny. Odpowiedzi zachowamy do zamknięcia strony.'}
        </p>
        {confirmDelete ? (
          <div className="wizard__delete-confirm">
            <p>Usunąć wszystkie odpowiedzi tej rodziny?</p>
            <button className="wizard__delete" type="button" onClick={remove}>
              Tak, usuń odpowiedzi
            </button>
            <button
              className="wizard__delete"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              Anuluj
            </button>
          </div>
        ) : (
          <button type="button" className="wizard__delete" onClick={() => setConfirmDelete(true)}>
            Usuń zapisane odpowiedzi
          </button>
        )}
      </main>
    </div>
  );
}
