import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  BenefitParams,
  CaseInputs,
  CasePlan,
  CaseRecord,
  CaseStage,
  EmploymentType,
  PaymentVariant,
} from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { DEFAULT_PARAMS, formatRate } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import { PlanHub } from './PlanHub';
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
import { HeroEmblem } from '../landing/HeroEmblem';
import { usePointerParallax } from '../landing/useLandingMotion';
import '../landing/LandingMotion.css';
import './PlanPage.css';
import './CasePlan.css';
import './PlanMotion.css';
import './PlanClean.css';

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
  hasUrlEdits: boolean;
  onUpdate: (patch: Partial<CaseInputs>) => void;
  onResetEdits: () => void;
}

function PlanDataSummaryBar({
  input,
  params,
  caseRecord,
  hasUrlEdits,
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

  function handleCopyShareLink() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href).catch(() => {
        // Ignoruj brak uprawnień schowka w środowisku testowym.
      });
    }
    setShareCopied(true);
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
                        }),
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
                          : Math.min(input.living_children_count, count),
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
              {hasUrlEdits && (
                <button type="button" className="plan-btn plan-btn--ghost" onClick={onResetEdits}>
                  Cofnij zmiany
                </button>
              )}
              <button
                type="button"
                className="plan-btn plan-btn--secondary"
                onClick={handleCopyShareLink}
              >
                {shareCopied ? 'Skopiowano link ✓' : 'Kopiuj link do planu'}
              </button>
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
  const search = query.size ? `?${query.toString()}` : '';
  const { scenario, planInputs, updatePlanInputs } = useScenario();
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  usePointerParallax(rootRef);

  const [fixture, setFixture] = useState<{ key: string; item: CaseRecord | null } | null>(null);
  const [computed, setComputed] = useState<{
    key: string;
    plan: CasePlan | null;
    params: BenefitParams | null;
    error?: string;
  } | null>(null);

  const serialized = query.get('inputs');
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
    if (serialized) return planInputs;
    if (caseId)
      return currentFixture?.item
        ? { ...currentFixture.item.inputs, reference_date: todayIsoDate() }
        : null;
    return planInputs;
  }, [serialized, caseId, currentFixture, planInputs]);

  const key = input ? JSON.stringify(input) : '';
  const current = computed?.key === key ? computed : null;
  const plan = current?.plan ?? null;
  const params = current?.params ?? null;

  useEffect(() => {
    if (!key || !tab || !isPlanTab(tab)) return;
    let active = true;
    void Promise.all([
      apiPost<CasePlan>('/plan', JSON.parse(key)),
      apiGet<BenefitParams>('/params'),
    ])
      .then(([nextPlan, nextParams]) => {
        if (active) setComputed({ key, plan: nextPlan, params: nextParams });
      })
      .catch((error: unknown) => {
        if (active)
          setComputed({
            key,
            plan: null,
            params: null,
            error: error instanceof Error ? error.message : 'Błąd API',
          });
      });
    return () => {
      active = false;
    };
  }, [key, tab]);

  useEffect(() => {
    if (typeof activeTabRef.current?.scrollIntoView === 'function') {
      activeTabRef.current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [tab]);

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

  return (
    <div className="plan-page" ref={rootRef}>
      <div className="plan-page__demo-strip">
        <p className="plan-page__container plan-page__demo-note">
          Wersja demonstracyjna · dane i wysyłka są symulowane
        </p>
      </div>

      <header
        className={
          activeTabMeta ? 'plan-page__header plan-page__header--section' : 'plan-page__header'
        }
      >
        <div className="landing__aurora" aria-hidden="true">
          <span className="landing__blob landing__blob--1" />
          <span className="landing__blob landing__blob--2" />
          <span className="landing__blob landing__blob--3" />
          <span className="landing__spark landing__spark--1" />
          <span className="landing__spark landing__spark--2" />
          <span className="landing__spark landing__spark--3" />
          <span className="landing__spark landing__spark--4" />
        </div>
        <div className="plan-page__container">
          <div className="plan-page__nav-row">
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
              <span className="plan-page__hub-kicker">Twój plan</span>
            )}

            <Link to={wizardUrl} className="plan-page__wizard-link">
              Zmień odpowiedzi
            </Link>
          </div>

          <div className="plan-page__hero-row">
            <div className="plan-page__hero-text">
              <h1 className="plan-page__title">
                {['Twój plan', 'zasiłkowy i', 'urlopowy'].map((part, index) => (
                  <Fragment key={part}>
                    <span className="landing__word" style={{ ['--i' as string]: index }}>
                      <span className="landing__word-inner">{part}</span>
                    </span>{' '}
                  </Fragment>
                ))}
              </h1>
              {!activeTabMeta && (
                <p className="plan-page__subtitle">
                  {difficult
                    ? 'Zestawienie uprawnień, dokumentów i bezpłatnego wsparcia dla Twojej sytuacji.'
                    : 'Uprawnienia, kwoty, urlopy i wnioski dopasowane do Twojej sytuacji.'}
                </p>
              )}
            </div>
            {!activeTabMeta && <HeroEmblem />}
          </div>
        </div>
      </header>

      <main className="plan-page__main">
        <div className="plan-page__container">
          {!tab ? (
            <>
              {input && (
                <PlanDataSummaryBar
                  input={input}
                  params={effectiveParams}
                  caseRecord={currentFixture?.item ?? null}
                  hasUrlEdits={Boolean(serialized)}
                  onUpdate={update}
                  onResetEdits={() => updatePlanInputs(null)}
                />
              )}
              <PlanHub querySuffix={search} />
            </>
          ) : (
            <>
              <nav className="plan-tabs case-plan-nav" aria-label="Zakładki Twojego planu">
                <ul className="plan-tabs__list">
                  {PLAN_TABS.map((item) => (
                    <li className="plan-tabs__item" key={item.id}>
                      <NavLink
                        ref={item.id === tab ? activeTabRef : undefined}
                        to={`/plan/${item.id}${search}`}
                        className={({ isActive }) =>
                          isActive ? 'plan-tabs__link plan-tabs__link--active' : 'plan-tabs__link'
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              {input && (
                <PlanDataSummaryBar
                  input={input}
                  params={effectiveParams}
                  caseRecord={currentFixture?.item ?? null}
                  hasUrlEdits={Boolean(serialized)}
                  onUpdate={update}
                  onResetEdits={() => updatePlanInputs(null)}
                />
              )}

              <section
                key={tab}
                className="plan-panel case-plan-panel"
                aria-label="Zawartość zakładki"
              >
                {fixtureError && (
                  <p className="plan-callout plan-callout--warning" role="alert">
                    Nie udało się otworzyć sprawy. <Link to="/cases">Wybierz sprawę z listy.</Link>
                  </p>
                )}
                {waiting && <p role="status">Pobieranie planu z API…</p>}
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
                {current?.error && (
                  <p className="plan-callout plan-callout--warning" role="alert">
                    Nie udało się wyliczyć planu. {current.error}{' '}
                    {serialized && (
                      <button
                        type="button"
                        className="plan-btn plan-btn--secondary"
                        onClick={() => {
                          updatePlanInputs(null);
                        }}
                      >
                        Cofnij zmiany
                      </button>
                    )}
                  </p>
                )}
                {input && plan && params && (
                  <>
                    {plan.validation_errors.length > 0 && (
                      <div className="plan-callout plan-callout--warning" role="alert">
                        <strong>Sprawdź plan urlopów</strong>
                        <ul>
                          {plan.validation_errors.map((item, index) => (
                            <li key={`${item.code}-${index}`}>
                              {item.message_pl} <small>{item.legal_basis}</small>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tab === 'entitlements' && (
                      <CaseRights plan={plan} input={input} params={params} />
                    )}
                    {tab === 'calculator' && (
                      <CaseCalculator plan={plan} input={input} params={params} update={update} />
                    )}
                    {tab === 'leave-plan' && (
                      <CasePlanner plan={plan} input={input} params={params} update={update} />
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
            </>
          )}
        </div>
      </main>

      <footer className="plan-page__footer">
        <div className="plan-page__container">
          <nav aria-label="Dodatkowa nawigacja" className="plan-page__footer-nav">
            <ul className="plan-page__footer-links">
              <li>
                <Link to="/">Strona startowa</Link>
              </li>
              <li>
                <Link to={wizardUrl}>Wróć do kreatora</Link>
              </li>
              <li>
                <Link to="/guide">Przewodnik</Link>
              </li>
              <li>
                <Link to="/cases">Przykładowe sprawy</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
