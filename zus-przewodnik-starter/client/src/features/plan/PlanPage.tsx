import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { BenefitParams, CaseInputs, CasePlan, CaseRecord } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { useScenario } from '../../app/ScenarioContext';
import { PlanHub } from './PlanHub';
import { isPlanTab, PLAN_TABS, todayIsoDate } from './planScenario';
import { wizardCase } from './caseScenario';
import { CaseCalculator, CaseRights } from './tabs/CaseResults';
import { CasePlanner } from './tabs/CasePlanner';
import { CaseApplications, CaseDocuments } from './tabs/CasePaperwork';
import { CaseSupport } from './tabs/CaseSupport';
import './PlanPage.css';
import './CasePlan.css';

function readInputs(serialized: string | null): CaseInputs | null {
  if (!serialized) return null;
  try {
    const data: unknown = JSON.parse(serialized);
    return data && typeof data === 'object' && 'stage' in data && 'special_circumstances' in data &&
      typeof data.special_circumstances === 'object' && data.special_circumstances !== null ? data as CaseInputs : null;
  } catch {
    return null;
  }
}

export function PlanPage() {
  const { tab } = useParams();
  const [query, setQuery] = useSearchParams();
  const caseId = query.get('case');
  const search = query.size ? `?${query.toString()}` : '';
  const { scenario } = useScenario();
  const [fixture, setFixture] = useState<{ key: string; item: CaseRecord | null } | null>(null);
  const [computed, setComputed] = useState<{ key: string; plan: CasePlan | null; params: BenefitParams | null; error?: string } | null>(null);
  const serialized = query.get('inputs');
  const currentFixture = fixture?.key === caseId ? fixture : null;
  useEffect(() => {
    if (!caseId) return;
    let active = true;
    void apiGet<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`)
      .then((item) => { if (active) setFixture({ key: caseId, item }); })
      .catch(() => { if (active) setFixture({ key: caseId, item: null }); });
    return () => { active = false; };
  }, [caseId]);
  const input = useMemo(() => {
    const edited = readInputs(serialized);
    if (serialized) return edited;
    if (caseId) return currentFixture?.item ? { ...currentFixture.item.inputs, reference_date: todayIsoDate() } : null;
    return wizardCase(scenario);
  }, [serialized, caseId, currentFixture, scenario]);
  const key = input ? JSON.stringify(input) : '';
  const current = computed?.key === key ? computed : null;
  const plan = current?.plan ?? null;
  const params = current?.params ?? null;
  useEffect(() => {
    if (!key || !tab || !isPlanTab(tab)) return;
    let active = true;
    void Promise.all([apiPost<CasePlan>('/plan', JSON.parse(key)), apiGet<BenefitParams>('/params')])
      .then(([plan, params]) => { if (active) setComputed({ key, plan, params }); })
      .catch((error: unknown) => { if (active) setComputed({ key, plan: null, params: null,
        error: error instanceof Error ? error.message : 'Błąd API' }); });
    return () => { active = false; };
  }, [key, tab]);

  if (tab && !isPlanTab(tab)) return <Navigate replace to={`/plan${search}`} />;

  function update(patch: Partial<CaseInputs>) {
    if (!input) return;
    const next = new URLSearchParams(query);
    next.set('inputs', JSON.stringify({ ...input, ...patch }));
    setQuery(next, { replace: true });
  }
  const wizardUrl = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';
  const fixtureError = caseId && currentFixture && !currentFixture.item;
  const waiting = !fixtureError && ((caseId && !fixture && !input) || (input && !current));
  return <div className="plan-page">
    <div className="plan-page__demo-strip"><p className="plan-page__container plan-page__demo-note">
      Wersja demonstracyjna · dane i wysyłka są symulowane
    </p></div>
    <header className="plan-page__header">
      <div className="plan-page__container">
        <nav className="case-plan-links" aria-label="Nawigacja projektu">
          <Link to="/">Start</Link><Link to="/cases">Przykładowe sprawy</Link>
          <Link to={wizardUrl}>Kreator</Link><Link to="/guide">Przewodnik</Link>
        </nav>
        <h1 className="plan-page__title">Twój plan zasiłkowy i urlopowy</h1>
        {currentFixture?.item && <p className="plan-page__subtitle">{currentFixture.item.short_title}</p>}
      </div>
    </header>
    <main className="plan-page__main">
      <div className="plan-page__container">
        {!tab ? <PlanHub querySuffix={search} /> : <>
          <nav className="plan-tabs case-plan-nav" aria-label="Zakładki Twojego planu"><ul className="plan-tabs__list">
            {PLAN_TABS.map((item) => <li className="plan-tabs__item" key={item.id}>
              <NavLink to={`/plan/${item.id}${search}`} className={({ isActive }) =>
                isActive ? 'plan-tabs__link plan-tabs__link--active' : 'plan-tabs__link'}>{item.label}</NavLink>
            </li>)}
          </ul></nav>
          <section className="plan-panel case-plan-panel" aria-label="Zawartość zakładki">
            {fixtureError && <p role="alert">Nie udało się otworzyć sprawy. <Link to="/cases">Wybierz sprawę z listy.</Link></p>}
            {waiting && <p role="status">Pobieranie planu z API…</p>}
            {!waiting && !fixtureError && !input && <p>Uzupełnij dane w <Link to={wizardUrl}>kreatorze</Link> lub wybierz <Link to="/cases">sprawę testową</Link>.</p>}
            {current?.error && <p role="alert">Nie udało się wyliczyć planu. {current.error}{' '}
              {serialized && <button type="button" className="plan-btn plan-btn--secondary" onClick={() => {
                const next = new URLSearchParams(query); next.delete('inputs'); setQuery(next, { replace: true });
              }}>Cofnij zmiany</button>}</p>}
            {input && plan && params && <>
              {plan.validation_errors.length > 0 && <div className="plan-callout plan-callout--warning" role="alert">
                <strong>Sprawdź plan urlopów</strong>
                <ul>{plan.validation_errors.map((item, index) => <li key={`${item.code}-${index}`}>{item.message_pl} <small>{item.legal_basis}</small></li>)}</ul>
              </div>}
              {tab === 'entitlements' && <CaseRights plan={plan} />}
              {tab === 'calculator' && <CaseCalculator plan={plan} input={input} update={update} />}
              {tab === 'leave-plan' && <CasePlanner plan={plan} input={input} update={update} />}
              {tab === 'documents' && <CaseDocuments documents={plan.documents} />}
              {tab === 'applications' && <CaseApplications documents={plan.documents} />}
              {tab === 'support' && <CaseSupport input={input} outcome={plan.outcome} params={params} />}
            </>}
          </section>
        </>}
      </div>
    </main>
  </div>;
}
