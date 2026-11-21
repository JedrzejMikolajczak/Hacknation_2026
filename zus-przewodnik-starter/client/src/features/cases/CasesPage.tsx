import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseEvaluationResult, ZusCase, ZusCaseSummary } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import './CasesPage.css';

type CaseDetails = ZusCase & { source: 'synthetic'; expectedDays: number };
const formatMoney = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const money = (amount: number | null) =>
  amount === null ? 'Nie dotyczy' : formatMoney.format(amount);
const right = (granted: boolean) => (granted ? 'Przysługuje' : 'Nie przysługuje');
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Spróbuj ponownie.';

function CaseComparison({ item, result }: { item: CaseDetails; result: CaseEvaluationResult }) {
  const expected = item.zusDecision;
  const entitlement = result.eligibility.entitlements.find(
    (entry) => entry.parentRole === 'mother' && entry.benefit === 'maternityBenefit',
  );
  const rows = [
    ['Prawo do świadczenia', right(expected.granted), right(entitlement?.entitled ?? false)],
    [
      'Podstawa wymiaru',
      money(expected.benefitBase),
      money(result.benefitBase?.benefitBase ?? item.scenario.mother.benefitBase),
    ],
    [
      'Liczba dni',
      item.expectedDays,
      result.calculation?.periods.reduce((sum, period) => sum + period.days, 0) ?? 0,
    ],
    ['Kwota brutto', money(expected.amount), money(result.calculation?.totalAmount ?? null)],
  ];
  return (
    <section className="cases-panel">
      <h2>Porównanie wyników</h2>
      <p role="status">
        {result.matchesZusDecision
          ? 'Wynik zgodny z oczekiwaniem.'
          : 'Wynik różni się od oczekiwania.'}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Wartość</th>
            <th scope="col">Oczekiwana</th>
            <th scope="col">Kalkulator</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, reference, calculated]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{reference}</td>
              <td>{calculated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.differences.length > 0 && <p>Różnice: {result.differences.join(', ')}.</p>}
      <p>{entitlement?.reason.message}</p>
      {entitlement?.reason.legalBasis && (
        <p>
          <small>{entitlement.reason.legalBasis}</small>
        </p>
      )}
    </section>
  );
}

function CaseDetail({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<CaseDetails>();
  const [result, setResult] = useState<CaseEvaluationResult>();
  const [loadError, setLoadError] = useState<string>();
  const [evaluationError, setEvaluationError] = useState<string>();
  const [pending, setPending] = useState(false);
  const path = `/cases/${encodeURIComponent(caseId)}`;

  useEffect(() => {
    let active = true;
    apiGet<CaseDetails>(path).then(
      (data) => {
        if (active) setItem(data);
      },
      (error) => {
        if (active) setLoadError(errorMessage(error));
      },
    );
    return () => {
      active = false;
    };
  }, [path]);

  async function evaluate() {
    setPending(true);
    setEvaluationError(undefined);
    setResult(undefined);
    try {
      setResult(await apiPost<CaseEvaluationResult>(`${path}/evaluate`, {}));
    } catch (error) {
      setEvaluationError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (loadError) return <p role="alert">{loadError}</p>;
  if (!item) return <p role="status">Wczytywanie sprawy…</p>;
  const income = item.benefitBaseInput?.incomes[0];
  return (
    <>
      <section className="cases-panel">
        <h2>{item.title}</h2>
        <p>Data porodu: {item.scenario.birthDate} · Wariant standardowy (100% i 70%)</p>
        {income && (
          <p>
            Wynagrodzenie za miesiąc {income.month}: {money(income.grossAmount)} brutto.
          </p>
        )}
        <details>
          <summary>Jak ustalono wynik oczekiwany</summary>
          <p>{item.zusDecision.note}</p>
        </details>
        <button type="button" disabled={pending} onClick={() => void evaluate()}>
          {pending ? 'Obliczanie…' : 'Uruchom kalkulator dla tej sprawy'}
        </button>
        {evaluationError && <p role="alert">{evaluationError}</p>}
      </section>
      {result && <CaseComparison item={item} result={result} />}
    </>
  );
}

function CasesList() {
  const [items, setItems] = useState<ZusCaseSummary[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    apiGet<ZusCaseSummary[]>('/cases').then(
      (data) => {
        if (active) setItems(data);
      },
      (failure) => {
        if (active) setError(errorMessage(failure));
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!items) return <p role="status">Wczytywanie spraw…</p>;
  return (
    <ul className="cases-list">
      {items.map((item) => (
        <li className="cases-panel" key={item.caseId}>
          <h2>
            <Link to={`/cases/${item.caseId}`}>{item.title}</Link>
          </h2>
        </li>
      ))}
    </ul>
  );
}

export function CasesPage() {
  const { caseId } = useParams();
  return (
    <main className="cases-page">
      <Link to={caseId ? '/cases' : '/'}>{caseId ? 'Wszystkie sprawy' : 'Strona główna'}</Link>
      <h1>Przykładowe sprawy</h1>
      <p>Przykłady syntetyczne. Wyniki oczekiwane wyliczono ręcznie na potrzeby demonstracji.</p>
      {caseId ? <CaseDetail key={caseId} caseId={caseId} /> : <CasesList />}
    </main>
  );
}
