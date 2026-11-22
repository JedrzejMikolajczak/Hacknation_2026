import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseEvaluation, CaseRecord, CaseSummary } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { AppBar } from '../../components/AppBar';
import { AppFooter, type FooterLink } from '../../components/AppFooter';
import { ArrowIcon, CheckIcon } from '../../components/icons';
import { CasePdfUpload } from './CasePdfUpload';
import './CasesPage.css';

const FOOTER_LINKS: FooterLink[] = [
  { to: '/guide', label: 'Przewodnik' },
  { to: '/', label: 'Zacznij plan' },
];

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
  const loading = !error && (caseId ? !current : !list);
  return (
    <div className="cases-page">
      <header>
        <AppBar
          actions={
            <Link to="/" className="ui-btn ui-btn--cta ui-btn--sm">
              Zacznij plan
            </Link>
          }
        />
      </header>
      <main id="main" tabIndex={-1} className="ui-container cases-page__main">
        <nav className="cases-page__nav" aria-label="Ścieżka nawigacji">
          <Link to="/">Strona startowa</Link>
          {caseId && (
            <>
              <span aria-hidden="true">›</span>
              <Link to="/cases">Wszystkie sprawy</Link>
            </>
          )}
        </nav>
        <header className="cases-hero">
          {!current && <p className="ui-eyebrow">Materiał konkursowy</p>}
          <h1>{current ? current.item.short_title : 'Przykładowe sprawy ZUS'}</h1>
          {!caseId && (
            <p className="cases-hero__lead">
              Gotowe sprawy z materiału konkursowego. Otwórz plan dla wybranej sprawy albo
              porównaj wynik naszego silnika z decyzją ZUS.
            </p>
          )}
        </header>
        {error && (
          <p className="cases-alert" role="alert">
            Nie udało się pobrać sprawy. Sprawdź adres lub odśwież stronę.
          </p>
        )}
        {loading && (
          <div className="cases-loading">
            <p role="status">Pobieranie danych z API…</p>
            <span className="ui-skeleton cases-loading__bar" />
            <span className="ui-skeleton cases-loading__bar" />
          </div>
        )}
        {!caseId && list && (
          <section aria-labelledby="case-list-title" className="cases-section">
            <h2 id="case-list-title">Wybierz sprawę z listy</h2>
            <ul className="cases-list">
              {list.map((item, index) => (
                <li
                  className="cases-card ui-rise"
                  key={item.case_id}
                  style={{ ['--i' as string]: Math.min(index, 7) }}
                >
                  <span className="cases-card__num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{item.short_title}</h3>
                  <div className="cases-card__actions">
                    <Link
                      className="ui-btn ui-btn--cta ui-btn--sm"
                      to={`/plan/entitlements?case=${item.case_id}`}
                    >
                      Otwórz Twój plan
                    </Link>
                    <Link className="ui-btn ui-btn--ghost ui-btn--sm" to={`/cases/${item.case_id}`}>
                      Zobacz porównanie
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!caseId && <CasePdfUpload />}
        {current && (
          <>
            <div className="cases-detail__cta">
              <Link
                className="ui-btn ui-btn--cta ui-btn--lg"
                to={`/plan/entitlements?case=${current.item.case_id}`}
              >
                Otwórz Twój plan <ArrowIcon />
              </Link>
            </div>
            <div className="cases-compare">
              <section className="cases-compare__card cases-compare__card--engine">
                <h2>Wynik silnika</h2>
                <p>{current.evaluation.outcome.decision_summary_pl}</p>
              </section>
              <section className="cases-compare__card">
                <h2>Decyzja w materiale konkursowym</h2>
                <p>{current.item.ground_truth_outcome.decision_summary_pl}</p>
              </section>
            </div>
            {current.evaluation.matches ? (
              <p className="cases-match">
                <CheckIcon className="cases-match__icon" />
                Porównywane dane są zgodne.
              </p>
            ) : (
              <details className="cases-diff">
                <summary>Rozbieżności ({current.evaluation.differences.length})</summary>
                <ul>
                  {current.evaluation.differences.map((diff) => (
                    <li key={diff.field}>
                      <code>{diff.field}</code> · oczekiwano {JSON.stringify(diff.expected)} ·
                      silnik {JSON.stringify(diff.actual)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>
      <AppFooter links={FOOTER_LINKS} />
    </div>
  );
}
