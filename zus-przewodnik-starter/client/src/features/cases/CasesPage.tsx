import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseEvaluationResult, ZusCase, ZusCaseSummary } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import './CasesPage.css';

type CaseDetails = ZusCase & { source?: 'synthetic' | string; expectedDays?: number | null };
const formatMoney = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const money = (amount: number | null) =>
  amount === null ? 'Nie dotyczy' : formatMoney.format(amount);
const right = (granted: boolean) => (granted ? 'Przysługuje' : 'Nie przysługuje');
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Spróbuj ponownie.';

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Błąd odczytu pliku.'));
    reader.readAsText(file);
  });
}

function formatScenarioMeta(item: CaseDetails): string {
  const dateLabel = item.scenario.birthDate
    ? `Data porodu: ${item.scenario.birthDate}`
    : item.scenario.expectedBirthDate
      ? `Przewidywana data porodu: ${item.scenario.expectedBirthDate}`
      : item.scenario.childAcceptanceDate
        ? `Data przyjęcia dziecka: ${item.scenario.childAcceptanceDate}`
        : `Data odniesienia: ${item.scenario.referenceDate}`;
  const variantLabel =
    item.scenario.rateVariant === 'combined'
      ? 'Wariant łączony (81,5%)'
      : 'Wariant standardowy (100% i 70%)';
  return `${dateLabel} · ${variantLabel}`;
}

function CaseComparison({ item, result }: { item: CaseDetails; result: CaseEvaluationResult }) {
  const expected = item.zusDecision;
  const entitlement = result.eligibility.entitlements.find(
    (entry) => entry.parentRole === 'mother' && entry.benefit === 'maternityBenefit',
  );
  const rows: [string, string | number, string | number][] = [
    ['Prawo do świadczenia', right(expected.granted), right(entitlement?.entitled ?? false)],
    [
      'Podstawa wymiaru',
      money(expected.benefitBase),
      money(result.benefitBase?.benefitBase ?? item.scenario.mother.benefitBase),
    ],
    [
      'Liczba dni',
      typeof item.expectedDays === 'number' ? item.expectedDays : 'Nie podano',
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

function CaseSummaryCard({
  item,
  pending,
  evaluationError,
  buttonLabel,
  onEvaluate,
}: {
  item: CaseDetails;
  pending: boolean;
  evaluationError?: string;
  buttonLabel: string;
  onEvaluate: () => void;
}) {
  const income = item.benefitBaseInput?.incomes[0];
  return (
    <section className="cases-panel">
      <h2>{item.title}</h2>
      <p>{formatScenarioMeta(item)}</p>
      {income && (
        <p>
          Wynagrodzenie za miesiąc {income.month}: {money(income.grossAmount)} brutto.
        </p>
      )}
      {item.zusDecision.note && (
        <details>
          <summary>Jak ustalono wynik oczekiwany</summary>
          <p>{item.zusDecision.note}</p>
        </details>
      )}
      <button type="button" className="cases-cta" disabled={pending} onClick={onEvaluate}>
        {pending ? 'Obliczanie…' : buttonLabel}
      </button>
      {evaluationError && (
        <p className="cases-error" role="alert">
          {evaluationError}
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

  if (loadError) {
    return (
      <p className="cases-error" role="alert">
        {loadError}
      </p>
    );
  }
  if (!item) return <p role="status">Wczytywanie sprawy…</p>;
  return (
    <>
      <CaseSummaryCard
        item={item}
        pending={pending}
        evaluationError={evaluationError}
        buttonLabel="Uruchom kalkulator dla tej sprawy"
        onEvaluate={() => void evaluate()}
      />
      {result && <CaseComparison item={item} result={result} />}
    </>
  );
}

function CaseUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [uploadedCase, setUploadedCase] = useState<CaseDetails>();
  const [result, setResult] = useState<CaseEvaluationResult>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function evaluateUploaded(payload: CaseDetails) {
    setPending(true);
    setError(undefined);
    setResult(undefined);
    try {
      const evaluated = await apiPost<CaseEvaluationResult>('/cases/evaluate', payload);
      setResult(evaluated);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(undefined);
    setResult(undefined);
    setUploadedCase(undefined);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch {
      setError('Nie udało się odczytać pliku JSON. Sprawdź poprawność składni.');
      return;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError('Plik musi zawierać pojedynczy obiekt sprawy ZUS w formacie JSON.');
      return;
    }

    const candidate = parsed as CaseDetails;
    if (
      typeof candidate.caseId !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.scenario !== 'object' ||
      candidate.scenario === null ||
      typeof candidate.zusDecision !== 'object' ||
      candidate.zusDecision === null
    ) {
      setError(
        'Niekompletny plik sprawy. Wymagane pola: caseId, title, scenario oraz zusDecision.',
      );
      return;
    }

    setUploadedCase(candidate);
    await evaluateUploaded(candidate);
  }

  function clearUpload() {
    setFileName(undefined);
    setUploadedCase(undefined);
    setResult(undefined);
    setError(undefined);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <section className="cases-upload-block" aria-labelledby="cases-upload-heading">
      <div className="cases-panel">
        <h2 id="cases-upload-heading">Wgraj własną sprawę lub wniosek (JSON)</h2>
        <p className="cases-muted">
          Wybierz plik JSON w formacie sprawy ZUS (<code>ZusCase</code>), aby przeliczyć ją przez
          kalkulator i porównać wynik z decyzją ZUS.
        </p>
        <div className="cases-upload-controls">
          <label className="cases-upload-label" htmlFor="case-upload-input">
            Wybierz plik JSON
          </label>
          <input
            ref={inputRef}
            id="case-upload-input"
            className="cases-upload-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => void handleFileChange(event)}
          />
          {fileName && <span className="cases-muted">Plik: {fileName}</span>}
          {(uploadedCase || error) && (
            <button type="button" className="cases-secondary" onClick={clearUpload}>
              Wyczyść wgraną sprawę
            </button>
          )}
        </div>
        {error && (
          <p className="cases-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {uploadedCase && (
        <CaseSummaryCard
          item={uploadedCase}
          pending={pending}
          buttonLabel="Przelicz ponownie wgraną sprawę"
          onEvaluate={() => void evaluateUploaded(uploadedCase)}
        />
      )}
      {uploadedCase && result && <CaseComparison item={uploadedCase} result={result} />}
    </section>
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
  if (error) {
    return (
      <p className="cases-error" role="alert">
        {error}
      </p>
    );
  }
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
      {caseId ? (
        <CaseDetail key={caseId} caseId={caseId} />
      ) : (
        <>
          <CaseUploadSection />
          <CasesList />
        </>
      )}
    </main>
  );
}
