import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  BenefitParams,
  CaseInputs,
  CasePlan,
  CaseRecord,
  CaseStage,
  EmploymentType,
  PaymentVariant,
} from '@shared/types';
import { ApiError, apiGet, apiPost } from '../../api/client';
import { DEFAULT_PARAMS, formatRate } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import { AppBar } from '../../components/AppBar';
import { AppFooter } from '../../components/AppFooter';
import { PencilIcon } from '../../components/icons';
import { PlanHub } from './PlanHub';
import { PlanJourney, StepEyebrow } from './PlanJourney';
import { PlanNotifications } from './PlanNotifications';
import { useVisitedSteps } from './planProgress';
import {
  combinedRateUnavailable,
  isPlanTab,
  livingChildren,
  PLAN_TABS,
  todayIsoDate,
} from './planScenario';
import { CaseCalculator, CaseRights } from './tabs/CaseResults';
import { CasePlanner } from './tabs/CasePlanner';
import { CaseApplications, CaseDocuments } from './tabs/CasePaperwork';
import { CaseSupport } from './tabs/CaseSupport';
import './PlanPage.css';
import './CasePlan.css';
import './PlanClean.css';
import './PlanShell.css';
import './PlanUI.css';
import { SuperText } from '../../components/SuperText';

const editableDateRanges = [
  [
    { field: 'sickness_leave_start_date', label: 'Początek zwolnienia lekarskiego' },
    { field: 'sickness_leave_end_date', label: 'Koniec zwolnienia lekarskiego' },
  ],
  [
    { field: 'newborn_hospitalization_start', label: 'Początek pobytu dziecka w szpitalu' },
    { field: 'newborn_hospitalization_end', label: 'Koniec pobytu dziecka w szpitalu' },
  ],
] as const;

function planRequestError(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
    return {
      messages: [error instanceof ApiError ? error.message : 'Spróbuj ponownie za chwilę.'],
      fields: [],
      validation: false,
    };
  }
  const details = Array.isArray(error.details) ? error.details : [];
  return {
    messages: details.length
      ? [...new Set<string>(details.flatMap((item) => typeof item?.message === 'string' ? [item.message] : []))]
      : [error.message],
    fields: details.flatMap((item) => typeof item?.path?.[0] === 'string' ? [item.path[0]] : []),
    validation: true,
  };
}

function shortStageLabel(stage: CaseStage): string {
  switch (stage) {
    case 'PLANNING':
      return 'Planuję dziecko';
    case 'PREGNANCY':
      return 'Jestem w ciąży';
    case 'POST_BIRTH':
      return 'Urodziło się dziecko';
    case 'ADOPTION':
      return 'Adopcja / rodzina zastępcza';
  }
}

function shortEmploymentLabel(type: EmploymentType): string {
  switch (type) {
    case 'UOP':
      return 'umowa o pracę';
    case 'ZLECENIE':
      return 'umowa zlecenie';
    case 'B2B':
      return 'JDG';
    case 'NONE':
      return 'brak ubezpieczenia';
  }
}

function shortChildrenLabel(count: number): string {
  if (count === 1) return '1 dziecko';
  if (count >= 5) return '5+ dzieci';
  return `${count} dzieci`;
}

function buildDataSummary(input: CaseInputs, params: BenefitParams): string {
  const parts: string[] = [shortStageLabel(input.stage)];
  const employmentText = shortEmploymentLabel(input.employment_type);
  parts.push(input.applicant_role === 'FATHER' ? `tata: ${employmentText}` : employmentText);
  parts.push(shortChildrenLabel(input.children_count));

  const living = livingChildren(input);
  const childLostAll =
    input.special_circumstances.stillbirth_or_child_death !== 'NONE' && living <= 0;
  if (!childLostAll) {
    parts.push(
      input.requested_payment_variant === 'COMBINED_81_5' && !combinedRateUnavailable(input, params)
        ? formatRate(params.rates.combined)
        : `${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`,
    );
  }
  return parts.join(' · ');
}

interface PlanDataSummaryBarProps {
  input: CaseInputs;
  params: BenefitParams;
  caseRecord: CaseRecord | null;
  warnings: CasePlan['outcome']['warnings'];
  hasPlanEdits: boolean;
  onUpdate: (patch: Partial<CaseInputs>) => void;
  onResetEdits: () => void;
}

function PlanDataSummaryBar({
  input,
  params,
  caseRecord,
  warnings,
  hasPlanEdits,
  onUpdate,
  onResetEdits,
}: PlanDataSummaryBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const summaryText = buildDataSummary(input, params);
  const combinedUnavailable = combinedRateUnavailable(input, params);
  const isAdoption = input.stage === 'ADOPTION';
  const eventDateValue = isAdoption
    ? (input.adopted_or_foster_child_acceptance_date ?? '')
    : (input.due_or_birth_date ?? '');

  async function handleCopyShareLink() {
    if (!caseRecord || !navigator.clipboard?.writeText) return;
    const address = new URL(window.location.pathname, window.location.origin);
    address.searchParams.set('case', caseRecord.case_id);
    try {
      await navigator.clipboard.writeText(address.href);
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  }

  return (
    <section className="plan-controls" aria-label="Twoje dane planu">
      <div className="plan-controls__summary-bar">
        {caseRecord ? (
          <p
            className="plan-controls__summary plan-controls__summary--case"
            title={caseRecord.short_title}
          >
            <strong className="plan-controls__summary-label">Sprawa ZUS:</strong>{' '}
            {caseRecord.short_title}
          </p>
        ) : (
          <p className="plan-controls__summary">
            <strong className="plan-controls__summary-label">Twoje dane:</strong> {summaryText}
          </p>
        )}
        <div className="plan-controls__bar-actions">
          <PlanNotifications warnings={warnings} params={params} />
          <button
            type="button"
            className="plan-controls__toggle"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="plan-controls-panel"
          >
            {isOpen ? 'Zwiń' : 'Zmień dane'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="plan-controls-panel" className="plan-controls__panel">
          {caseRecord && (
            <p className="plan-controls__case-full">
              <strong>{caseRecord.case_id}:</strong> {caseRecord.short_title}
            </p>
          )}
          <div className="plan-controls__grid">
            <label className="plan-field">
              <span className="plan-field__label">Sytuacja</span>
              <select
                className="plan-field__input"
                value={input.stage}
                onChange={(event) => {
                  const nextStage = event.target.value as CaseStage;
                  onUpdate({
                    stage: nextStage,
                    ...(nextStage === 'POST_BIRTH'
                      ? {}
                      : {
                          mother_abandonment_date: undefined,
                          mother_maternity_days_used: undefined,
                          mother_was_insured_at_abandonment: undefined,
                          father_stops_gainful_activity: undefined,
                          mother_death_date: undefined,
                          mother_was_insured_at_death: undefined,
                          child_death_date: undefined,
                        }),
                    adopted_or_foster_child_birth_date: nextStage === 'ADOPTION'
                      ? input.adopted_or_foster_child_birth_date : undefined,
                    adoption_order_final_date: nextStage === 'ADOPTION'
                      ? input.adoption_order_final_date : undefined,
                    adopted_or_foster_child_acceptance_date:
                      nextStage === 'ADOPTION'
                        ? (input.adopted_or_foster_child_acceptance_date ??
                          input.due_or_birth_date ??
                          undefined)
                        : undefined,
                  });
                }}
              >
                <option value="PLANNING">Planuję dziecko</option>
                <option value="PREGNANCY">Jestem w ciąży</option>
                <option value="POST_BIRTH">Urodziło się dziecko</option>
                <option value="ADOPTION">Adopcja / rodzina zastępcza</option>
              </select>
            </label>

            <label className="plan-field">
              <span className="plan-field__label">Forma zatrudnienia</span>
              <select
                className="plan-field__input"
                value={input.employment_type}
                onChange={(event) => {
                  const nextType = event.target.value as EmploymentType;
                  onUpdate({
                    employment_type: nextType,
                    voluntary_sickness_insured:
                      nextType === 'UOP' || nextType === 'NONE'
                        ? false
                        : (input.voluntary_sickness_insured ?? true),
                    payer_insured_count_nov_30:
                      nextType === 'UOP' || nextType === 'ZLECENIE'
                        ? input.payer_insured_count_nov_30
                        : null,
                  });
                }}
              >
                <option value="UOP">Umowa o pracę</option>
                <option value="ZLECENIE">Umowa zlecenie</option>
                <option value="B2B">Działalność gospodarcza (JDG)</option>
                <option value="NONE">Brak ubezpieczenia</option>
              </select>
            </label>

            <label className="plan-field">
              <span className="plan-field__label">
                {isAdoption
                  ? 'Data przyjęcia dziecka'
                  : input.stage === 'POST_BIRTH'
                    ? 'Data porodu'
                    : 'Przewidywana data porodu'}
              </span>
              <input
                type="date"
                className="plan-field__input"
                value={eventDateValue}
                onChange={(event) => {
                  const nextDate = event.target.value || null;
                  if (isAdoption) {
                    onUpdate({ adopted_or_foster_child_acceptance_date: nextDate ?? undefined });
                  } else {
                    onUpdate({ due_or_birth_date: nextDate });
                  }
                }}
              />
            </label>

            {isAdoption && (
              <>
                <label className="plan-field">
                  <span className="plan-field__label">Data urodzenia przyjętego dziecka</span>
                  <input
                    type="date"
                    className="plan-field__input"
                    max={eventDateValue || undefined}
                    value={input.adopted_or_foster_child_birth_date ?? ''}
                    onChange={(event) => onUpdate({ adopted_or_foster_child_birth_date: event.target.value || undefined })}
                  />
                </label>
                {input.adoption_type !== 'FOSTER_FAMILY' && (
                  <label className="plan-field">
                    <span className="plan-field__label">Data uprawomocnienia przysposobienia</span>
                    <input
                      type="date"
                      className="plan-field__input"
                      min={input.adopted_or_foster_child_birth_date}
                      value={input.adoption_order_final_date ?? ''}
                      onChange={(event) => onUpdate({ adoption_order_final_date: event.target.value || undefined })}
                    />
                  </label>
                )}
              </>
            )}
            <label className="plan-field">
              <span className="plan-field__label">Liczba dzieci</span>
              <select
                className="plan-field__input"
                value={input.children_count}
                onChange={(event) => {
                  const count = Number(event.target.value);
                  const deceased =
                    input.deceased_children_count === undefined
                      ? undefined
                      : Math.min(input.deceased_children_count, count);
                  onUpdate({
                    children_count: count,
                    deceased_children_count: deceased,
                    living_children_count:
                      deceased !== undefined
                        ? count - deceased
                        : input.living_children_count === undefined
                          ? undefined
                          : input.special_circumstances.stillbirth_or_child_death === 'NONE'
                            ? count
                            : Math.min(input.living_children_count, count - 1),
                  });
                }}
              >
                <option value={1}>1 dziecko</option>
                <option value={2}>2 dzieci (bliźnięta)</option>
                <option value={3}>3 dzieci</option>
                <option value={4}>4 dzieci</option>
                <option value={5}>5 lub więcej dzieci</option>
              </select>
            </label>

            <label className="plan-field">
              <span className="plan-field__label">Podstawa wymiaru (PLN)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="plan-field__input"
                placeholder="Uzupełnij kwotę"
                disabled={input.employment_type === 'NONE'}
                value={input.benefit_base_amount_pln ?? ''}
                onChange={(event) =>
                  onUpdate({
                    benefit_base_amount_pln:
                      event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </label>

            {input.sickness_leave_start_date && input.title_start_date && (
              <label className="plan-field">
                <span className="plan-field__label">Dni poprzedniego ubezpieczenia zaliczone do wyczekiwania</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="plan-field__input"
                  value={input.sickness_prior_credited_days ?? ''}
                  onChange={(event) => onUpdate({
                    sickness_prior_credited_days: event.target.value ? Number(event.target.value) : undefined,
                  })}
                />
              </label>
            )}

            <label className="plan-field">
              <span className="plan-field__label">Wariant wypłaty</span>
              <select
                className="plan-field__input"
                value={combinedUnavailable ? 'SPLIT_100_70' : input.requested_payment_variant}
                onChange={(event) =>
                  onUpdate({
                    requested_payment_variant:
                      event.target.value === 'COMBINED_81_5'
                        ? ('COMBINED_81_5' as PaymentVariant)
                        : ('SPLIT_100_70' as PaymentVariant),
                  })
                }
              >
                <option value="COMBINED_81_5" disabled={combinedUnavailable}>
                  {formatRate(params.rates.combined)} za cały okres (wniosek w{' '}
                  {params.combinedRateApplicationDeadlineDays} dni)
                </option>
                <option value="SPLIT_100_70">
                  {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}{' '}
                  (standardowy)
                </option>
              </select>
            </label>

            <label className="plan-field">
              <span className="plan-field__label">Data złożenia wniosku u płatnika</span>
              <input
                type="date"
                className="plan-field__input"
                value={input.application_to_payer_date ?? input.application_date ?? ''}
                onChange={(event) =>
                  onUpdate({
                    application_to_payer_date: event.target.value || undefined,
                    application_date: event.target.value || null,
                    days_from_birth_to_application: null,
                  })
                }
              />
            </label>
          </div>

          <details className="plan-controls__details">
            <summary className="plan-controls__details-summary">
              Więcej parametrów i okoliczności
            </summary>
            <div className="plan-controls__advanced">
              {(input.employment_type === 'UOP' || input.employment_type === 'ZLECENIE') && (
                <label className="plan-field">
                  <span className="plan-field__label">
                    Liczba ubezpieczonych u płatnika (na 30.11)
                  </span>
                  <select
                    className="plan-field__input"
                    value={input.payer_insured_count_nov_30 ?? ''}
                    onChange={(event) =>
                      onUpdate({
                        payer_insured_count_nov_30:
                          event.target.value === '> 20'
                            ? '> 20'
                            : event.target.value === '<= 20'
                              ? '<= 20'
                              : null,
                      })
                    }
                  >
                    <option value="">Nie wiem / do ustalenia</option>
                    <option value="<= 20">
                      Do {params.payerThresholdInsuredCount} osób (wypłaca ZUS)
                    </option>
                    <option value="> 20">
                      Powyżej {params.payerThresholdInsuredCount} osób (wypłaca pracodawca)
                    </option>
                  </select>
                </label>
              )}

              <div className="plan-checkboxes">
                {(input.employment_type === 'B2B' || input.employment_type === 'ZLECENIE') && (
                  <label className="plan-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(input.voluntary_sickness_insured)}
                      onChange={(event) =>
                        onUpdate({ voluntary_sickness_insured: event.target.checked })
                      }
                    />
                    <span>Dobrowolne ubezpieczenie chorobowe</span>
                  </label>
                )}

                {input.employment_type === 'B2B' && (
                  <label className="plan-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(input.has_b2b_arrears)}
                      onChange={(event) =>
                        onUpdate({
                          has_b2b_arrears: event.target.checked,
                          debt_amount_pln: event.target.checked ? input.debt_amount_pln : undefined,
                        })
                      }
                    />
                    <span>Zadłużenie składkowe w ZUS</span>
                  </label>
                )}

                <label className="plan-checkbox">
                  <input
                    type="checkbox"
                    checked={input.special_circumstances.za_zyciem_certificate}
                    onChange={(event) =>
                      onUpdate({
                        special_circumstances: {
                          ...input.special_circumstances,
                          za_zyciem_certificate: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>Zaświadczenie „Za życiem”</span>
                </label>
              </div>
            </div>
          </details>

          <div className="plan-controls__footer">
            <p className="plan-controls__hint">
              Zmiany od razu przeliczają plan i zapisują się w adresie URL.
            </p>
            <div className="plan-controls__actions">
              {hasPlanEdits && (
                <button type="button" className="plan-btn plan-btn--ghost" onClick={onResetEdits}>
                  Cofnij zmiany
                </button>
              )}
              {caseRecord && (
                <button type="button" className="plan-btn plan-btn--secondary" onClick={() => void handleCopyShareLink()}>
                  {shareCopied ? 'Skopiowano link ✓' : 'Kopiuj link do sprawy katalogowej'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function PlanPage() {
  const { tab } = useParams();
  const [query] = useSearchParams();
  const caseId = query.get('case');
  const safeQuery = new URLSearchParams(query);
  safeQuery.delete('inputs');
  const search = safeQuery.size ? `?${safeQuery.toString()}` : '';
  const { scenario, planInputs, hasPlanEdits, updatePlanInputs } = useScenario();
  const { visited, markVisited } = useVisitedSteps();

  const [fixture, setFixture] = useState<{ key: string; item: CaseRecord | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [computed, setComputed] = useState<{
    key: string;
    caseId: string | null;
    plan: CasePlan | null;
    params: BenefitParams | null;
    error?: ReturnType<typeof planRequestError>;
  } | null>(null);

  const currentFixture = fixture?.key === caseId ? fixture : null;

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    void apiGet<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`)
      .then((item) => {
        if (active) setFixture({ key: caseId, item });
      })
      .catch(() => {
        if (active) setFixture({ key: caseId, item: null });
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  const input = useMemo(() => {
    if (hasPlanEdits) return planInputs;
    if (caseId)
      return currentFixture?.item
        ? { ...currentFixture.item.inputs, reference_date: todayIsoDate() }
        : null;
    return planInputs;
  }, [hasPlanEdits, caseId, currentFixture, planInputs]);

  const key = input ? JSON.stringify(input) : '';
  const current = computed?.key === key && computed.caseId === caseId ? computed : null;
  // Keep the editor mounted while the API recalculates the same scenario (otherwise the open
  // accordion with the benefit-base field collapses after every keystroke).
  const plannerSnapshot =
    (tab === 'leave-plan' || tab === 'calculator') && computed?.caseId === caseId ? computed : null;
  const visibleResult = current ?? plannerSnapshot;
  const plan = visibleResult?.plan ?? null;
  const params = visibleResult?.params ?? null;

  useEffect(() => {
    if (!key || (tab && !isPlanTab(tab))) return;
    let active = true;
    void Promise.all([
      apiPost<CasePlan>('/plan', JSON.parse(key)),
      apiGet<BenefitParams>('/params'),
    ])
      .then(([nextPlan, nextParams]) => {
        if (active) setComputed({ key, caseId, plan: nextPlan, params: nextParams });
      })
      .catch((error: unknown) => {
        if (active)
          setComputed({
            key,
            caseId,
            plan: null,
            params: null,
            error: planRequestError(error),
          });
      });
    return () => {
      active = false;
    };
  }, [key, caseId, tab, attempt]);

  // Krok uznajemy za obejrzany, gdy plan jest wyświetlony – wtedy dostaje „ptaszek” na ścieżce.
  const planReady = Boolean(current?.plan);
  useEffect(() => {
    if (tab && isPlanTab(tab) && planReady) markVisited(tab);
  }, [tab, planReady, markVisited]);

  // Kierunek przejścia (do przodu / wstecz) decyduje, z której strony wjeżdża nowy krok.
  // Pierwsze wyświetlenie strony nie ma kierunku – wchodzi razem z całą stroną.
  const tabIndex = tab ? PLAN_TABS.findIndex((item) => item.id === tab) : -1;
  const [navigation, setNavigation] = useState<{
    index: number;
    direction?: 'forward' | 'back';
  }>({ index: tabIndex });
  if (navigation.index !== tabIndex) {
    setNavigation({ index: tabIndex, direction: tabIndex > navigation.index ? 'forward' : 'back' });
  }

  if (tab && !isPlanTab(tab)) return <Navigate replace to={`/plan${search}`} />;

  function update(patch: Partial<CaseInputs>) {
    if (!input) return;
    updatePlanInputs({ ...input, ...patch });
  }

  const activeTabMeta = tab ? PLAN_TABS.find((item) => item.id === tab) : null;
  const wizardUrl = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';
  const fixtureError = Boolean(caseId && currentFixture && !currentFixture.item);
  const waiting =
    !fixtureError &&
    ((Boolean(caseId) && !currentFixture && !input) || (Boolean(input) && !current));
  const difficult = Boolean(
    input?.special_circumstances.stillbirth_or_child_death &&
    input.special_circumstances.stillbirth_or_child_death !== 'NONE',
  );
  const effectiveParams = params ?? DEFAULT_PARAMS;
  const planError = current?.error;
  const repairDates = editableDateRanges
    .flatMap((range) => range.some(({ field }) => planError?.fields.includes(field)) ? [...range] : []);

  const footerLinks = [
    { to: '/', label: 'Strona startowa' },
    { to: wizardUrl, label: 'Wróć do kreatora' },
    { to: '/guide', label: 'Przewodnik' },
    { to: '/cases', label: 'Przykładowe sprawy' },
  ];

  const summaryBar = input ? (
    <PlanDataSummaryBar
      input={input}
      params={effectiveParams}
      caseRecord={currentFixture?.item ?? null}
      warnings={visibleResult?.plan?.outcome.warnings ?? []}
      hasPlanEdits={hasPlanEdits}
      onUpdate={update}
      onResetEdits={() => updatePlanInputs(null)}
    />
  ) : null;

  return (
    <div className="plan-page">
      <header className={activeTabMeta ? 'plan-top plan-top--section' : 'plan-top'}>
        <AppBar
          isStatic
          actions={
            <Link to={wizardUrl} className="ui-btn ui-btn--ghost ui-btn--sm plan-top__edit">
              <PencilIcon className="plan-top__edit-icon" />
              <span className="plan-top__edit-label">Zmień odpowiedzi</span>
            </Link>
          }
        />
        <div className="ui-container plan-top__body">
          {activeTabMeta ? (
            <nav className="plan-breadcrumb" aria-label="Ścieżka nawigacji">
              <Link to={`/plan${search}`} className="plan-breadcrumb__back">
                ← Twój plan
              </Link>
              <span className="plan-breadcrumb__sep" aria-hidden="true">
                ›
              </span>
              <span className="plan-breadcrumb__current" aria-current="page">
                {activeTabMeta.label}
              </span>
            </nav>
          ) : (
            <p className="ui-eyebrow plan-top__kicker ui-rise">Twój plan</p>
          )}
          <h1 className={activeTabMeta ? 'visually-hidden' : 'plan-top__title ui-rise'}>
            Twój plan zasiłkowy i urlopowy
          </h1>
          {!activeTabMeta && (
            <p className="plan-top__subtitle ui-rise" style={{ ['--i' as string]: 1 }}>
              {difficult
                ? 'Zestawienie uprawnień, dokumentów i bezpłatnego wsparcia dla Twojej sytuacji.'
                : 'Uprawnienia, kwoty, urlopy i wnioski dopasowane do Twojej sytuacji.'}
            </p>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className="plan-main">
        {!tab ? (
          <div className="ui-container plan-container">
            {summaryBar}
            <PlanHub
              querySuffix={search}
              visited={visited}
              plan={current?.plan ?? null}
              waiting={waiting}
              hasData={Boolean(input)}
              wizardUrl={wizardUrl}
            />
          </div>
        ) : (
          <>
            {isPlanTab(tab) && <PlanJourney tab={tab} search={search} visited={visited} />}
            <div className="ui-container plan-container">
              {summaryBar}
              {isPlanTab(tab) && <StepEyebrow tab={tab} />}

              <section
                key={tab}
                className="plan-panel case-plan-panel"
                aria-label="Zawartość zakładki"
                data-dir={navigation.direction}
              >
                {fixtureError && (
                  <p className="plan-callout plan-callout--warning" role="alert">
                    Nie udało się otworzyć sprawy. <Link to="/cases">Wybierz sprawę z listy.</Link>
                  </p>
                )}
                {waiting && (
                  <div className="plan-loading" role="status">
                    <span className="plan-loading__text">
                      {plan
                        ? 'Przeliczamy plan. Poniżej widać poprzedni wynik.'
                        : 'Przygotowujemy Twój plan…'}
                    </span>
                    {!plan && (
                      <span className="plan-loading__blocks" aria-hidden="true">
                        <span className="ui-skeleton plan-loading__block plan-loading__block--title" />
                        <span className="ui-skeleton plan-loading__block" />
                        <span className="ui-skeleton plan-loading__block plan-loading__block--short" />
                      </span>
                    )}
                  </div>
                )}
                {!waiting && !fixtureError && !input && (
                  <div className="plan-missing-data plan-callout" role="status">
                    <h2>{activeTabMeta?.label ?? 'Uzupełnij dane'}</h2>
                    <p>
                      Nie przyjmujemy zmyślonych założeń. Odpowiedz na kilka pytań w kreatorze, aby
                      zobaczyć wyliczenia dla swojej sytuacji.
                    </p>
                    <Link to={wizardUrl} className="plan-btn plan-btn--primary">
                      Uzupełnij dane ›
                    </Link>
                    <p className="plan-controls__hint">
                      Możesz też otworzyć gotową <Link to="/cases">przykładową sprawę ZUS</Link>.
                    </p>
                  </div>
                )}
                {planError && (
                  <div className="plan-callout plan-callout--warning">
                    <div role="alert">
                      <strong>Nie udało się wyliczyć planu.</strong>
                      <ul>{planError.messages.map((message) => <li key={message}>{message}</li>)}</ul>
                    </div>
                    {input && repairDates.length > 0 && (
                      <div className="plan-controls__grid">
                        {repairDates.map(({ field, label }) => (
                          <label className="plan-field" key={field}>
                            <span className="plan-field__label">{label}</span>
                            <input
                              className="plan-field__input"
                              type="date"
                              value={input[field] ?? ''}
                              onChange={(event) => update({ [field]: event.target.value || undefined })}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {planError.validation ? (
                      <p>
                        Popraw wskazane dane w planie lub <Link to={wizardUrl}>wróć do kreatora</Link>.
                      </p>
                    ) : (
                      <button type="button" className="plan-btn plan-btn--secondary" onClick={() => {
                        setComputed(null);
                        setAttempt((value) => value + 1);
                      }}>
                        Spróbuj ponownie
                      </button>
                    )}
                    {hasPlanEdits && (
                      <button type="button" className="plan-btn plan-btn--secondary" onClick={() => updatePlanInputs(null)}>
                        Cofnij zmiany
                      </button>
                    )}
                  </div>
                )}
                {input && plan && params && (
                  <>
                    {/* Na zakładce „Plan urlopów” te same uwagi pokazuje sam planer (przy wyborze
                        scenariusza), więc nie dublujemy czerwonego komunikatu. Na pozostałych
                        zakładkach dajemy od razu drogę do poprawy. */}
                    {current && tab !== 'leave-plan' && plan.validation_errors.length > 0 && (
                      <div className="plan-callout plan-callout--warning" role="alert">
                        <strong>Sprawdź plan urlopów</strong>
                        <ul>
                          {plan.validation_errors.map((item, index) => (
                            <li key={`${item.code}-${index}`}>
                              {item.message_pl} <small>{item.legal_basis && <SuperText text={item.legal_basis} />}</small>
                            </li>
                          ))}
                        </ul>
                        <Link className="plan-callout__link" to={`/plan/leave-plan${search}`}>
                          Popraw w planie urlopów
                        </Link>
                      </div>
                    )}
                    {tab === 'entitlements' && (
                      <CaseRights plan={plan} input={input} params={params} />
                    )}
                    {tab === 'calculator' && (
                      <CaseCalculator plan={plan} input={input} params={params} update={update} />
                    )}
                    {tab === 'leave-plan' && (
                      <CasePlanner key={caseId} plan={plan} input={input} params={params} update={update} />
                    )}
                    {tab === 'documents' && (
                      <CaseDocuments
                        documents={plan.documents}
                        effectiveDate={params.forms2026EffectiveDate}
                        input={input}
                        plan={plan}
                      />
                    )}
                    {tab === 'applications' && (
                      <CaseApplications
                        documents={plan.documents}
                        input={input}
                        plan={plan}
                        params={params}
                      />
                    )}
                    {tab === 'support' && <CaseSupport input={input} plan={plan} params={params} />}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <AppFooter links={footerLinks} />
    </div>
  );
}
