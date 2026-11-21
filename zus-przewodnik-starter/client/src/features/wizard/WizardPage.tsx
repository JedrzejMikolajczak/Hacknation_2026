import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SickLeaveCertificate } from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import type { FieldSource, ManualFormState } from '../../app/scenarioDraft';
import { parseSituation } from '../../app/situation';
import { ContributionDebtCertificate, SickLeavePreview } from '../login/ZusSimulationPanels';
import {
  buildScenario,
  dateInputToIso,
  displayDate,
  formatAnswer,
  getQuestions,
  selectedMotherSituations,
  SITUATION_LABELS,
  STAGES,
  validateAnswer,
  type WizardQuestion,
} from './wizardModel';
import {
  FIELD_SOURCE_LABELS,
  recordUserEdit,
  resolveRightArisesDate,
  selectZusIncomesForBuild,
} from './zusMerge';
import './WizardPage.css';

function formatDateInput(value: string): string {
  const digits = displayDate(value).replace(/\D/g, '');
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

function SourceBadge({ source }: { source: FieldSource | undefined }) {
  if (!source) return null;
  return (
    <span
      className={`wizard__source-badge wizard__source-badge--${source}`}
      data-source={source}
    >
      {FIELD_SOURCE_LABELS[source]}
    </span>
  );
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
  if (question.type === 'choice' || question.type === 'multiple') {
    const multiple = question.type === 'multiple';
    const selected = value ? (multiple ? selectedMotherSituations(value) : [value]) : [];
    function toggle(option: string) {
      if (!multiple) return onChange(option);
      if (selected.includes(option))
        return onChange(selected.filter((item) => item !== option).join(','));
      if (option === 'none' || option === 'deceased' || option === 'abandoned')
        return onChange(option);
      onChange(
        [
          ...selected.filter(
            (item) => item !== 'none' && item !== 'deceased' && item !== 'abandoned',
          ),
          option,
        ].join(','),
      );
    }
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
            className={`wizard__choice${selected.includes(option.value) ? ' wizard__choice--selected' : ''}`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={question.id}
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
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
  const {
    scenario,
    manualForm,
    authSession,
    setSituation,
    saveManualForm,
    clearScenario,
    resolveFieldConflict,
    storageAvailable,
  } = useScenario();
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
  const rate = questions.find((item) => item.id === 'rateVariant');
  const answers =
    rate?.options?.length === 1 && form
      ? { ...form.answers, rateVariant: 'standard' }
      : (form?.answers ?? {});
  const fieldSources = form?.fieldSources ?? {};
  const pendingConflicts = form?.pendingConflicts ?? {};
  const conflictList = Object.values(pendingConflicts);
  const firstMissing = questions.find(
    (question) => validateAnswer(question, answers[question.id]) !== null,
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

  function persistForm(nextForm: ManualFormState) {
    const zusIncomes = selectZusIncomesForBuild(nextForm, authSession?.zusData ?? null);
    saveManualForm(
      nextForm,
      buildScenario(nextForm.situation, nextForm.answers, undefined, { zusIncomes }),
    );
  }

  function persist(nextAnswers: Record<string, string>, currentQuestionId: string, completed = false) {
    if (!situation || !form) return;
    persistForm({
      ...form,
      situation,
      answers: nextAnswers,
      currentQuestionId,
      completed,
    });
  }

  function answer(value: string) {
    if (!situation || !form || !question) return;
    const baseForm: ManualFormState = { ...form, answers };
    const updated = recordUserEdit(baseForm, question.id, value);
    persistForm({ ...updated, currentQuestionId: question.id, completed: false });
    setError(null);
  }

  function applyEzlaStartDate(cert: SickLeaveCertificate) {
    if (!situation || !form) return;
    const nextAnswers = {
      ...answers,
      'mother.pregnancySickLeave': 'yes',
      'mother.sickLeaveStart': cert.startDate,
    };
    const nextSources: Record<string, FieldSource> = {
      ...fieldSources,
      'mother.pregnancySickLeave': 'zus',
      'mother.sickLeaveStart': 'zus',
    };
    const nextConflicts = { ...pendingConflicts };
    delete nextConflicts['mother.pregnancySickLeave'];
    delete nextConflicts['mother.sickLeaveStart'];
    persistForm({
      ...form,
      situation,
      answers: nextAnswers,
      fieldSources: nextSources,
      pendingConflicts: nextConflicts,
      currentQuestionId: question?.id ?? form.currentQuestionId,
      completed: false,
    });
    setError(null);
  }

  function applyZusDebt(amount: number) {
    if (!situation || !form) return;
    const nextAnswers = { ...answers, 'mother.contributionDebt': String(amount) };
    const nextSources: Record<string, FieldSource> = {
      ...fieldSources,
      'mother.contributionDebt': 'zus',
    };
    const nextConflicts = { ...pendingConflicts };
    delete nextConflicts['mother.contributionDebt'];
    persistForm({
      ...form,
      situation,
      answers: nextAnswers,
      fieldSources: nextSources,
      pendingConflicts: nextConflicts,
      currentQuestionId: question?.id ?? form.currentQuestionId,
      completed: false,
    });
    setError(null);
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !question) return;
    const validation = validateAnswer(question, answers[question.id]);
    if (validation) {
      setError(validation);
      return;
    }
    const nextQuestion = editing
      ? firstMissing
      : questions[questions.findIndex((item) => item.id === question.id) + 1];
    persist(answers, nextQuestion?.id ?? 'summary');
    setError(null);
    if (!nextQuestion) setEditing(false);
  }

  function back() {
    if (!form || !question) return;
    const previous = questions[questions.findIndex((item) => item.id === question.id) - 1];
    if (previous) persist(answers, previous.id);
    setError(null);
    setEditing(false);
  }

  function edit(id: string) {
    if (!form) return;
    persist(answers, id);
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

  const activeConflict = question ? pendingConflicts[question.id] : undefined;
  const showEzlaPreview =
    Boolean(authSession?.zusData.sickLeaveCertificates.length) &&
    Boolean(
      question &&
        (question.id === 'mother.pregnancySickLeave' ||
          question.id === 'mother.sickLeaveStart' ||
          question.id === 'mother.sickLeaveEnd'),
    );
  const showDebtCertificate =
    Boolean(authSession?.zusData) &&
    question?.id === 'mother.contributionDebt' &&
    authSession?.profile.mother.insuranceTitle === 'selfEmployed';
  const rightArisesDate = resolveRightArisesDate(scenario, answers);

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
          <div className="wizard__zus-bar">
            {authSession ? (
              <p className="wizard__zus-status" role="status">
                Połączono z ZUS przez mObywatela (symulacja):{' '}
                <strong>
                  {authSession.profile.firstName} {authSession.profile.lastName}
                </strong>
                . Uzupełniono wyłącznie puste pola.
              </p>
            ) : (
              <Link
                to={`/login?situation=${situation}`}
                state={{ returnTo: `/wizard?situation=${situation}` }}
                className="wizard__zus-link"
              >
                Pobierz dane z ZUS przez mObywatela (symulacja) →
              </Link>
            )}
          </div>
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

        {!showComplete && !showSummary && conflictList.length > 0 && !activeConflict && (
          <section className="wizard__conflict-banner" aria-label="Rozbieżności z danymi ZUS">
            <p>
              Wykryto {conflictList.length === 1 ? '1 rozbieżność' : `${conflictList.length} rozbieżności`}{' '}
              między Twoimi wpisami a danymi z ZUS. Żaden Twój wpis nie został nadpisany.
            </p>
            <div className="wizard__conflict-jumps">
              {conflictList.map((item) => {
                const target = questions.find((q) => q.id === item.questionId);
                if (!target) return null;
                return (
                  <button
                    key={item.questionId}
                    type="button"
                    className="wizard__edit"
                    onClick={() => edit(item.questionId)}
                  >
                    Rozstrzygnij: {target.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

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
            {questions.some((item) => answers[item.id] === 'unknown') && (
              <p className="wizard__notice">
                Część danych czeka na uzupełnienie. Znajdziecie je w podsumowaniu.
              </p>
            )}
            <div className="wizard__actions">
              <button
                type="button"
                className="wizard__button wizard__button--primary"
                onClick={() => persist(answers, 'summary')}
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
                    .map((item) => {
                      const conflict = pendingConflicts[item.id];
                      return (
                        <div key={item.id}>
                          <dt>
                            <span>{item.label}</span>
                            <SourceBadge source={fieldSources[item.id]} />
                          </dt>
                          <dd>
                            {item.id === 'family' && answers.motherSituation === 'deceased'
                              ? 'Plan taty po zgonie mamy'
                              : item.id === 'family' && answers.motherSituation === 'abandoned'
                                ? 'Plan taty po porzuceniu dziecka przez mamę'
                                : formatAnswer(item, answers[item.id])}
                            {conflict && (
                              <div className="wizard__conflict-inline">
                                <p>
                                  Dane z {FIELD_SOURCE_LABELS[conflict.incomingSource]}:{' '}
                                  <strong>{formatAnswer(item, conflict.incomingValue)}</strong>
                                </p>
                                <div className="wizard__conflict-actions">
                                  <button
                                    type="button"
                                    className="wizard__conflict-btn"
                                    onClick={() => resolveFieldConflict(item.id, 'keepUser')}
                                  >
                                    Zostaw moją wartość
                                  </button>
                                  <button
                                    type="button"
                                    className="wizard__conflict-btn wizard__conflict-btn--primary"
                                    onClick={() => resolveFieldConflict(item.id, 'useIncoming')}
                                  >
                                    Użyj danych z {FIELD_SOURCE_LABELS[conflict.incomingSource]}
                                  </button>
                                </div>
                              </div>
                            )}
                          </dd>
                          <button
                            type="button"
                            className="wizard__edit"
                            aria-label={`Zmień: ${item.label}`}
                            onClick={() => edit(item.id)}
                          >
                            Zmień
                          </button>
                        </div>
                      );
                    })}
                </dl>
              </section>
            ))}
            <button
              type="button"
              className="wizard__button wizard__button--primary"
              onClick={() => persist(answers, 'summary', true)}
            >
              Zapisz odpowiedzi
            </button>
          </section>
        ) : (
          question && (
            <form className="wizard__card" noValidate onSubmit={next}>
              <div className="wizard__card-top">
                <p className="wizard__eyebrow">{STAGES[question.stage]}</p>
                <SourceBadge source={fieldSources[question.id]} />
              </div>
              <h2 ref={titleRef} tabIndex={-1} id="question-title">
                {question.title}
              </h2>
              {question.hint && (
                <p id="question-hint" className="wizard__help">
                  {question.hint}
                </p>
              )}

              {activeConflict && (
                <div
                  className="wizard__conflict-box"
                  role="region"
                  aria-label="Rozbieżność z danymi ZUS"
                >
                  <p className="wizard__conflict-title">
                    Wykryto rozbieżność z danymi z{' '}
                    {FIELD_SOURCE_LABELS[activeConflict.incomingSource]} (Twój wpis nie został
                    nadpisany)
                  </p>
                  <p className="wizard__conflict-values">
                    Twoja odpowiedź: <strong>{formatAnswer(question, activeConflict.userValue)}</strong>
                    {' · '}
                    Dane z {FIELD_SOURCE_LABELS[activeConflict.incomingSource]}:{' '}
                    <strong>{formatAnswer(question, activeConflict.incomingValue)}</strong>
                  </p>
                  <div className="wizard__conflict-actions">
                    <button
                      type="button"
                      className="wizard__conflict-btn"
                      onClick={() => resolveFieldConflict(question.id, 'keepUser')}
                    >
                      Zostaw moją wartość
                    </button>
                    <button
                      type="button"
                      className="wizard__conflict-btn wizard__conflict-btn--primary"
                      onClick={() => resolveFieldConflict(question.id, 'useIncoming')}
                    >
                      Użyj danych z {FIELD_SOURCE_LABELS[activeConflict.incomingSource]}
                    </button>
                  </div>
                </div>
              )}

              <QuestionField
                key={question.id}
                question={question}
                value={answers[question.id] ?? ''}
                error={error}
                onChange={answer}
              />

              {showEzlaPreview && authSession && (
                <SickLeavePreview
                  certificates={authSession.zusData.sickLeaveCertificates}
                  selectedStartDate={answers['mother.sickLeaveStart'] ?? null}
                  onSelectStartDate={applyEzlaStartDate}
                />
              )}

              {showDebtCertificate && authSession && (
                <ContributionDebtCertificate
                  payerName={`${authSession.profile.firstName} ${authSession.profile.lastName}`}
                  asOfDate={rightArisesDate}
                  contributionDebt={authSession.zusData.contributionDebt}
                  params={DEFAULT_PARAMS}
                  onApplyDebt={
                    answers['mother.contributionDebt'] !== String(authSession.zusData.contributionDebt)
                      ? applyZusDebt
                      : undefined
                  }
                />
              )}

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
