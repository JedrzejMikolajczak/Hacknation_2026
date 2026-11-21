import { useEffect, useMemo, useState } from 'react';
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
      <header className="plan-page__header">
        <div className="plan-page__container">
          <div className="plan-page__top-bar">
            <p className="plan-page__demo-label">
              Wersja demonstracyjna – dane i wysyłka są symulowane (bez zapisu danych osobowych na
              serwerze)
            </p>
            <div className="plan-page__top-links">
              <Link to="/">Strona startowa</Link>
              <Link to={wizardHref}>Wróć do kreatora</Link>
              <Link to="/guide">Przewodnik</Link>
              <Link to="/cases">Przykładowe sprawy</Link>
            </div>
          </div>

          <h1 className="plan-page__title">Twój plan zasiłkowy i urlopowy</h1>
          <p className="plan-page__subtitle">
            {difficult
              ? 'Zestawienie przysługujących uprawnień, dokumentów i bezpłatnego wsparcia dopasowane do Twojej sytuacji.'
              : 'Jedno miejsce na uprawnienia, wyliczenie kwot, oś czasu urlopów, listę dokumentów, gotowe wnioski i wsparcie.'}
          </p>
          {!bundle.usingApi && activeTab !== null && (
            <p className="plan-page__mode-note" role="status">
              tryb demonstracyjny – obliczenia w przeglądarce
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
              <Link to={`/plan${querySuffix}`} className="plan-page__back-link">
                ← Wszystkie sekcje planu
              </Link>

              <PlanControlsBar
                scenario={effectiveScenario}
                meta={meta}
                params={bundle.params}
                onChange={handleScenarioChange}
                onCopyShareLink={handleCopyShareLink}
                shareCopied={shareCopied}
              />

              <nav className="plan-tabs" aria-label="Zakładki Twojego planu">
                <ul className="plan-tabs__list">
                  {PLAN_TABS.map((item) => (
                    <li key={item.id} className="plan-tabs__item">
                      <NavLink
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
    </div>
  );
}
