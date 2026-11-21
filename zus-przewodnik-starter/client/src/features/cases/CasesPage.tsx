import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseEvaluation, CaseRecord, CaseSummary } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { CasePdfUpload } from './CasePdfUpload';
import './CasesPage.css';

export function CasesPage() {
  const { caseId } = useParams();
  const [list, setList] = useState<CaseSummary[] | null>(null);
  const [detail, setDetail] = useState<{ item: CaseRecord; evaluation: CaseEvaluation } | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (caseId) {
      const path = `/cases/${encodeURIComponent(caseId)}`;
      void Promise.all([apiGet<CaseRecord>(path), apiPost<CaseEvaluation>(`${path}/evaluate`, {})])
        .then(([item, evaluation]) => {
          if (active) setDetail({ item, evaluation });
        })
        .catch(() => {
          if (active) setError(true);
        });
    } else {
      void apiGet<CaseSummary[]>('/cases')
        .then((items) => {
          if (active) setList(items);
        })
        .catch(() => {
          if (active) setError(true);
        });
    }
    return () => {
      active = false;
    };
  }, [caseId]);
  const current = detail?.item.case_id === caseId ? detail : null;
  return (
    <main className="plan-page__container cases-page">
      <nav>
        <Link to="/">Strona startowa</Link>
        {caseId && (
          <>
            {' '}
            · <Link to="/cases">Wszystkie sprawy</Link>
          </>
        )}
      </nav>
      <h1>{current ? current.item.short_title : 'Przykładowe sprawy ZUS'}</h1>
      {error && <p role="alert">Nie udało się pobrać sprawy. Sprawdź adres lub odśwież stronę.</p>}
      {!error && (caseId ? !current : !list) && <p role="status">Pobieranie danych z API…</p>}
      {!caseId && list && (
        <section aria-labelledby="case-list-title">
          <h2 id="case-list-title">Wybierz sprawę z listy</h2>
          <ul className="cases-list">
            {list.map((item) => (
              <li className="cases-panel" key={item.case_id}>
                <h3>{item.short_title}</h3>
                <div>
                  <Link to={`/cases/${item.case_id}`}>Zobacz porównanie</Link>
                  {' · '}
                  <Link to={`/plan/entitlements?case=${item.case_id}`}>Otwórz Twój plan</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!caseId && <CasePdfUpload />}
      {current && (
        <>
          <p>
            <Link
              className="plan-btn plan-btn--primary"
              to={`/plan/entitlements?case=${current.item.case_id}`}
            >
              Otwórz Twój plan
            </Link>
          </p>
          <h2>Wynik silnika</h2>
          <p>{current.evaluation.outcome.decision_summary_pl}</p>
          <h2>Decyzja w materiale konkursowym</h2>
          <p>{current.item.ground_truth_outcome.decision_summary_pl}</p>
          {current.evaluation.matches ? (
            <p>Porównywane dane są zgodne.</p>
          ) : (
            <details>
              <summary>Rozbieżności ({current.evaluation.differences.length})</summary>
              <ul>
                {current.evaluation.differences.map((diff) => (
                  <li key={diff.field}>
                    <code>{diff.field}</code> · oczekiwano {JSON.stringify(diff.expected)} · silnik{' '}
                    {JSON.stringify(diff.actual)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  );
}
