import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { BenefitBaseResult, ScenarioInput } from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import {
  computePlanBundleLocally,
  fetchPlanBundle,
  resolveBenefitBasesForPlan,
  type PlanBundleResult,
} from './planApi';
import { PlanControlsBar } from './PlanControlsBar';
import { PlanHub } from './PlanHub';
import {
  getMissingFieldsForTab,
  isDifficultSituation,
  isPlanTab,
  PLAN_TABS,
  resolvePlanContext,
  scenarioToDraftPatch,
  scenarioToSearchParams,
  type PlanTabId,
  type ScenarioMeta,
} from './planScenario';
import { ApplicationsTab } from './tabs/ApplicationsTab';
import { CalculatorTab } from './tabs/CalculatorTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { EntitlementsTab } from './tabs/EntitlementsTab';
import { LeavePlanTab } from './tabs/LeavePlanTab';
import { SupportTab } from './tabs/SupportTab';
import './PlanPage.css';

export interface ComputedBaseInfo {
  mother: BenefitBaseResult | null;
  father: BenefitBaseResult | null;
  sickness: BenefitBaseResult | null;
}

export function PlanPage() {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scenario: draft, updateScenario } = useScenario();
  const [shareCopied, setShareCopied] = useState(false);
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);

  const initialContext = useMemo(
    () => resolvePlanContext(draft, searchParams),
    // Inicjalizacja z draftu + URL; dalsze zmiany sterowane przez live controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [scenario, setScenario] = useState<ScenarioInput>(initialContext.scenario);
  const [meta, setMeta] = useState<ScenarioMeta>(initialContext.meta);
  const [computedBases, setComputedBases] = useState<ComputedBaseInfo>({
    mother: null,
    father: null,
    sickness: null,
  });

  const sicknessStartDate = draft.pregnancySickLeave?.startDate ?? undefined;

  const [bundle, setBundle] = useState<PlanBundleResult>(() =>
    computePlanBundleLocally(initialContext.scenario, DEFAULT_PARAMS, {
      sicknessStartDate,
    }),
  );

  useEffect(() => {
    let active = true;

    async function loadPlan() {
      const needsBaseResolution =
        (scenario.mother.benefitBase === null &&
          Boolean(draft.benefitBaseInputs?.mother || draft.sicknessBenefitBaseInput)) ||
        (scenario.father !== null &&
          scenario.father.benefitBase === null &&
          Boolean(draft.benefitBaseInputs?.father));

      let effectiveScenario = scenario;
      let nextComputed: ComputedBaseInfo = { mother: null, father: null, sickness: null };
      let basesUsedApi = true;

      if (needsBaseResolution) {
        const resolved = await resolveBenefitBasesForPlan(draft, scenario, bundle.params);
        if (!active) return;
        effectiveScenario = resolved.scenarioWithBases;
        nextComputed = {
          mother: resolved.motherBaseResult,
          father: resolved.fatherBaseResult,
          sickness: resolved.sicknessBaseResult,
        };
        basesUsedApi = resolved.usingApi;
        setComputedBases(nextComputed);
      } else {
        setComputedBases({ mother: null, father: null, sickness: null });
      }

      const nextBundle = await fetchPlanBundle(effectiveScenario, {
        sicknessStartDate,
        sicknessBenefitBase: nextComputed.sickness?.benefitBase ?? null,
      });
      if (!active) return;
      setBundle({
        ...nextBundle,
        usingApi: nextBundle.usingApi && basesUsedApi,
      });
    }

    void loadPlan();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, draft.benefitBaseInputs, draft.sicknessBenefitBaseInput, sicknessStartDate]);

  useEffect(() => {
    if (typeof activeTabRef.current?.scrollIntoView === 'function') {
      activeTabRef.current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [tab]);

  const effectiveScenario: ScenarioInput = useMemo(
    () => ({
      ...scenario,
      mother: {
        ...scenario.mother,
        benefitBase: scenario.mother.benefitBase ?? computedBases.mother?.benefitBase ?? null,
      },
      father: scenario.father
        ? {
            ...scenario.father,
            benefitBase: scenario.father.benefitBase ?? computedBases.father?.benefitBase ?? null,
          }
        : null,
    }),
    [scenario, computedBases],
  );

  const currentQuery = searchParams.toString();
  const querySuffix = currentQuery ? `?${currentQuery}` : '';

  if (tab !== undefined && !isPlanTab(tab)) {
    return <Navigate to={`/plan${querySuffix}`} replace />;
  }

  const activeTab: PlanTabId | null = tab ?? null;
  const activeTabMeta = activeTab ? PLAN_TABS.find((item) => item.id === activeTab) : null;
  const difficult = isDifficultSituation(effectiveScenario);
  const wizardHref = `/wizard?situation=${effectiveScenario.situation}`;

  const missingEntitlements = getMissingFieldsForTab('entitlements', effectiveScenario, meta);
  const missingCalculator = getMissingFieldsForTab('calculator', effectiveScenario, meta);
  const missingDocuments = getMissingFieldsForTab('documents', effectiveScenario, meta);

  function handleScenarioChange(next: ScenarioInput, nextMetaPatch?: Partial<ScenarioMeta>) {
    const nextMeta: ScenarioMeta = nextMetaPatch ? { ...meta, ...nextMetaPatch } : meta;
    setScenario(next);
    setMeta(nextMeta);
    updateScenario(scenarioToDraftPatch(next, nextMeta));
    setSearchParams(scenarioToSearchParams(next, nextMeta), { replace: true });
    setShareCopied(false);
  }

  function handleCopyShareLink() {
    const nextParams = scenarioToSearchParams(effectiveScenario, meta);
    setSearchParams(nextParams, { replace: true });
    const section = activeTab ? `/${activeTab}` : '';
    const shareUrl = `${window.location.origin}/plan${section}?${nextParams.toString()}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {
        // ignore clipboard denial in test/sandbox environments
      });
    }
    setShareCopied(true);
  }

  return (
    <div className="plan-page">
      <div className="plan-page__demo-strip">
        <div className="plan-page__container plan-page__demo-strip-inner">
          <p className="plan-page__demo-note">
            Wersja demonstracyjna – dane są symulowane
            {!bundle.usingApi && activeTab !== null && (
              <span className="plan-page__mode-inline" role="status">
                {' '}
                · tryb demonstracyjny – obliczenia w przeglądarce
              </span>
            )}
          </p>
        </div>
      </div>

      <header
        className={
          activeTab !== null ? 'plan-page__header plan-page__header--section' : 'plan-page__header'
        }
      >
        <div className="plan-page__container">
          <div className="plan-page__nav-row">
            {activeTabMeta ? (
              <nav className="plan-breadcrumb" aria-label="Ścieżka nawigacji">
                <Link to={`/plan${querySuffix}`} className="plan-breadcrumb__back">
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

            <Link to={wizardHref} className="plan-page__wizard-link">
              Zmień odpowiedzi
            </Link>
          </div>

          <h1 className="plan-page__title">Twój plan zasiłkowy i urlopowy</h1>
          {activeTab === null && (
            <p className="plan-page__subtitle">
              {difficult
                ? 'Zestawienie uprawnień, dokumentów i bezpłatnego wsparcia dla Twojej sytuacji.'
                : 'Uprawnienia, kwoty, urlopy i wnioski dopasowane do Twojej sytuacji.'}
            </p>
          )}
        </div>
      </header>

      <main className="plan-page__main">
        <div className="plan-page__container">
          {activeTab === null ? (
            <PlanHub querySuffix={querySuffix} />
          ) : (
            <>
              <nav className="plan-tabs" aria-label="Zakładki Twojego planu">
                <ul className="plan-tabs__list">
                  {PLAN_TABS.map((item) => (
                    <li key={item.id} className="plan-tabs__item">
                      <NavLink
                        ref={item.id === activeTab ? activeTabRef : undefined}
                        to={`/plan/${item.id}${querySuffix}`}
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

              <PlanControlsBar
                scenario={effectiveScenario}
                meta={meta}
                params={bundle.params}
                onChange={handleScenarioChange}
                onCopyShareLink={handleCopyShareLink}
                shareCopied={shareCopied}
              />

              <div
                className="plan-panel"
                role="region"
                aria-label="Zawartość wybranej zakładki planu"
              >
                {activeTab === 'entitlements' && (
                  <EntitlementsTab
                    eligibility={bundle.eligibility}
                    missingFields={missingEntitlements}
                    wizardHref={wizardHref}
                    hasMotherInPlan={meta.hasMotherInPlan}
                  />
                )}
                {activeTab === 'calculator' && (
                  <CalculatorTab
                    scenario={effectiveScenario}
                    params={bundle.params}
                    maternity={bundle.maternity}
                    sickness={bundle.sickness}
                    onScenarioChange={(next) => handleScenarioChange(next)}
                    missingFields={missingCalculator}
                    wizardHref={wizardHref}
                    computedBases={computedBases}
                    hasMotherInPlan={meta.hasMotherInPlan}
                  />
                )}
                {activeTab === 'leave-plan' && (
                  <LeavePlanTab
                    scenario={effectiveScenario}
                    params={bundle.params}
                    maternity={bundle.maternity}
                    usingApi={bundle.usingApi}
                  />
                )}
                {activeTab === 'documents' && (
                  <DocumentsTab
                    checklist={bundle.documents}
                    scenario={effectiveScenario}
                    params={bundle.params}
                    missingFields={missingDocuments}
                    wizardHref={wizardHref}
                  />
                )}
                {activeTab === 'applications' && (
                  <ApplicationsTab
                    scenario={effectiveScenario}
                    params={bundle.params}
                    maternity={bundle.maternity}
                    checklist={bundle.documents}
                  />
                )}
                {activeTab === 'support' && (
                  <SupportTab scenario={effectiveScenario} params={bundle.params} />
                )}
              </div>
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
                <Link to={wizardHref}>Wróć do kreatora</Link>
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
