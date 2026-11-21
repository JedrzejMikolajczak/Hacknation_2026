import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { ScenarioInput } from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import {
  fallbackDocumentsChecklist,
  fallbackEligibility,
  fallbackMaternityCalculation,
  fallbackSicknessCalculation,
  fetchPlanBundle,
  type PlanBundleResult,
} from './planApi';
import { PlanControlsBar } from './PlanControlsBar';
import {
  isPlanTab,
  isDifficultSituation,
  PLAN_TABS,
  resolveScenarioInput,
  scenarioToDraftPatch,
  scenarioToSearchParams,
  type PlanTabId,
} from './planScenario';
import { ApplicationsTab } from './tabs/ApplicationsTab';
import { CalculatorTab } from './tabs/CalculatorTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { EntitlementsTab } from './tabs/EntitlementsTab';
import { LeavePlanTab } from './tabs/LeavePlanTab';
import { SupportTab } from './tabs/SupportTab';
import './PlanPage.css';

export function PlanPage() {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scenario: draft, updateScenario } = useScenario();
  const [shareCopied, setShareCopied] = useState(false);

  const initialScenario = useMemo(
    () => resolveScenarioInput(draft, searchParams),
    // Inicjalizacja z draftu + URL; dalsze zmiany sterowane przez live controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [scenario, setScenario] = useState<ScenarioInput>(initialScenario);

  const [bundle, setBundle] = useState<PlanBundleResult>(() => ({
    params: DEFAULT_PARAMS,
    eligibility: fallbackEligibility(initialScenario, DEFAULT_PARAMS),
    maternity: fallbackMaternityCalculation(initialScenario, DEFAULT_PARAMS),
    sickness: fallbackSicknessCalculation(initialScenario, DEFAULT_PARAMS),
    documents: fallbackDocumentsChecklist(initialScenario, DEFAULT_PARAMS),
    usingApi: false,
  }));

  useEffect(() => {
    let active = true;
    fetchPlanBundle(scenario).then((nextBundle) => {
      if (active) {
        setBundle(nextBundle);
      }
    });
    return () => {
      active = false;
    };
  }, [scenario]);

  if (!tab || !isPlanTab(tab)) {
    const query = searchParams.toString();
    return <Navigate to={`/plan/entitlements${query ? `?${query}` : ''}`} replace />;
  }

  const activeTab: PlanTabId = tab;
  const currentQuery = searchParams.toString();
  const querySuffix = currentQuery ? `?${currentQuery}` : '';
  const difficult = isDifficultSituation(scenario);

  function handleScenarioChange(next: ScenarioInput) {
    setScenario(next);
    updateScenario(scenarioToDraftPatch(next));
    setSearchParams(scenarioToSearchParams(next), { replace: true });
    setShareCopied(false);
  }

  function handleCopyShareLink() {
    const nextParams = scenarioToSearchParams(scenario);
    setSearchParams(nextParams, { replace: true });
    const shareUrl = `${window.location.origin}/plan/${activeTab}?${nextParams.toString()}`;
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
              <Link to={`/wizard?situation=${scenario.situation}`}>Wróć do kreatora</Link>
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
        </div>
      </header>

      <main className="plan-page__main">
        <div className="plan-page__container">
          <PlanControlsBar
            scenario={scenario}
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

          <div className="plan-panel" role="region" aria-label="Zawartość wybranej zakładki planu">
            {activeTab === 'entitlements' && (
              <EntitlementsTab eligibility={bundle.eligibility} />
            )}
            {activeTab === 'calculator' && (
              <CalculatorTab
                scenario={scenario}
                params={bundle.params}
                maternity={bundle.maternity}
                sickness={bundle.sickness}
                onScenarioChange={handleScenarioChange}
              />
            )}
            {activeTab === 'leave-plan' && (
              <LeavePlanTab
                scenario={scenario}
                params={bundle.params}
                maternity={bundle.maternity}
              />
            )}
            {activeTab === 'documents' && <DocumentsTab checklist={bundle.documents} />}
            {activeTab === 'applications' && (
              <ApplicationsTab
                scenario={scenario}
                params={bundle.params}
                maternity={bundle.maternity}
                checklist={bundle.documents}
              />
            )}
            {activeTab === 'support' && (
              <SupportTab scenario={scenario} params={bundle.params} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
