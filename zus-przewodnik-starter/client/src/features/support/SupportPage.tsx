import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BenefitParams, Warning } from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { AssistantSection } from './AssistantSection';
import { RiskAlertsSection } from './RiskAlertsSection';
import { SpecialSituationsSection } from './SpecialSituationsSection';
import { fetchScenarioWarnings, fetchSupportParams } from './supportApi';
import { buildSupportScenario, DEFAULT_BENEFIT_PARAMS } from './supportMock';
import './SupportPage.css';

const PLAN_TABS = [
  { id: 'entitlements', label: 'Uprawnienia' },
  { id: 'calculator', label: 'Kalkulator' },
  { id: 'leave-plan', label: 'Plan urlopów' },
  { id: 'documents', label: 'Dokumenty i terminy' },
  { id: 'applications', label: 'Wnioski' },
  { id: 'support', label: 'Wsparcie' },
] as const;

export function SupportPage() {
  const { scenario: draftScenario } = useScenario();
  const scenario = useMemo(() => buildSupportScenario(draftScenario), [draftScenario]);

  const [params, setParams] = useState<BenefitParams>(DEFAULT_BENEFIT_PARAMS);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isDemoFallback, setIsDemoFallback] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSupportData() {
      setLoading(true);
      const paramsRes = await fetchSupportParams();
      if (cancelled) return;

      const loadedParams = paramsRes.data;
      setParams(loadedParams);

      const eligibilityRes = await fetchScenarioWarnings(scenario, loadedParams);
      if (cancelled) return;

      setWarnings(eligibilityRes.data.warnings);
      setIsDemoFallback(paramsRes.isDemoFallback || eligibilityRes.isDemoFallback);
      setLoading(false);
    }

    void loadSupportData();
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const isSensitiveSituation =
    scenario.special.stillbirth || scenario.special.childDeathDate !== null;

  return (
    <div className="support-page">
      <header className="support-header">
        <div className="support-container">
          <div className="support-header__top">
            <Link to="/" className="support-header__back">
              ‹ Strona startowa
            </Link>
            <span className="support-badge">
              Wersja demonstracyjna – dane i logowanie są symulowane
            </span>
          </div>

          <h1 className="support-header__title">Wsparcie i ostrzeżenia</h1>
          <p className="support-header__subtitle">
            {isSensitiveSituation
              ? 'Sprawdź najważniejsze zasady bezpieczeństwa formalnego, odpowiedzi na pytania oraz dostępne kanały pomocy.'
              : 'Sprawdź, na co uważać, zadaj pytanie asystentowi i zobacz kroki w sytuacjach szczególnych.'}
          </p>

          <nav aria-label="Sekcje planu" className="support-tabs">
            {PLAN_TABS.map((item) => (
              <Link
                key={item.id}
                to={`/plan/${item.id}`}
                className={item.id === 'support' ? 'support-tab support-tab--active' : 'support-tab'}
                aria-current={item.id === 'support' ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="support-main">
        <div className="support-container">
          {isDemoFallback && (
            <div className="support-demo-notice" role="status">
              Widok korzysta z danych demonstracyjnych – po uruchomieniu endpointów /eligibility oraz
              /assistant/ask na serwerze połączy się automatycznie z API.
            </div>
          )}

          {loading ? (
            <p className="support-loading" role="status">
              Wczytywanie wskazówek i ostrzeżeń…
            </p>
          ) : (
            <div className="support-sections">
              <AssistantSection params={params} />
              <RiskAlertsSection scenario={scenario} warnings={warnings} params={params} />
              <SpecialSituationsSection scenario={scenario} params={params} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
