import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BenefitParams, DocumentChecklist, ScenarioInput } from '@shared/types';
import { resolveParentPayer } from '@shared/engine';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import { formatPayer, formatPolishDate } from '../planScenario';

interface DocumentsTabProps {
  checklist: DocumentChecklist;
  scenario?: ScenarioInput;
  params?: BenefitParams;
  missingFields?: string[];
  wizardHref?: string;
}

const CHECKLIST_STORAGE_KEY = 'zus-plan-documents-checked-v1';

function loadCheckedIds(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

export function DocumentsTab({
  checklist,
  scenario,
  params = DEFAULT_PARAMS,
  missingFields = [],
  wizardHref = '/wizard',
}: DocumentsTabProps) {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(loadCheckedIds);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedMap));
    } catch {
      // ignore storage errors
    }
  }, [checkedMap]);

  if (missingFields.length > 0) {
    return (
      <div className="plan-tab-content">
        <section className="plan-section" aria-labelledby="docs-missing-heading">
          <div className="plan-missing-data" role="status">
            <h2 id="docs-missing-heading" className="plan-section__title">
              Uzupełnij dane, aby przygotować listę dokumentów i terminów
            </h2>
            <p className="plan-section__lead">
              Aby ustalić właściwego płatnika, listę formularzy i dokładne terminy, podaj brakujące
              informacje w formularzu lub pasku parametrów powyżej:
            </p>
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij formularz ›
            </Link>
          </div>
        </section>
      </div>
    );
  }

  function toggleDocument(id: string) {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const completedCount = checklist.documents.filter((doc) => checkedMap[doc.id]).length;
  const fatherPayer = scenario?.father ? resolveParentPayer(scenario.father, params) : null;

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="docs-payer-heading">
        <h2 id="docs-payer-heading" className="plan-section__title">
          Gdzie składasz dokumenty i kto wypłaca zasiłek
        </h2>
        <div className="plan-callout plan-callout--info">
          <p>
            <strong>Właściwy płatnik zasiłku (główny):</strong> {formatPayer(checklist.payer)}.{' '}
            {checklist.payer === 'employer'
              ? `Płatnik składek zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, więc przyjmuje wniosek i wypłaca zasiłek.`
              : 'Zasiłek wypłaca bezpośrednio ZUS – najwygodniej złożyć dokumenty elektronicznie na PUE / eZUS.'}
          </p>
          {scenario?.father && (
            <p className="doc-item__note">
              <strong>Płatnik drugiego rodzica:</strong> {formatPayer(fatherPayer)} (ustalany osobno
              według liczby ubezpieczonych zgłaszanych przez płatnika ojca).
            </p>
          )}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="docs-checklist-heading">
        <div className="docs-header-row">
          <div>
            <h2 id="docs-checklist-heading" className="plan-section__title">
              Lista dokumentów do skompletowania
            </h2>
            <p className="plan-section__lead">
              Odhaczaj gotowe pozycje – postęp zapisuje się w Twojej przeglądarce. Od 24.10.2026 r.
              formularze ZUR i ZAO zostały włączone do ZUS ZAM, a druk Z-3b został zlikwidowany.
            </p>
          </div>
          <span className="plan-badge plan-badge--navy" aria-live="polite">
            Skompletowano: {completedCount} z {checklist.documents.length}
          </span>
        </div>

        <ul className="docs-list" role="list">
          {checklist.documents.map((doc) => {
            const isChecked = Boolean(checkedMap[doc.id]);
            return (
              <li key={doc.id} className={isChecked ? 'doc-item doc-item--checked' : 'doc-item'}>
                <label className="doc-item__checkbox-label">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDocument(doc.id)}
                  />
                  <div className="doc-item__body">
                    <div className="doc-item__top">
                      <span className="doc-item__name">{doc.name}</span>
                      <span className="plan-badge plan-badge--navy">
                        Złóż do:{' '}
                        {doc.submitTo === 'employer' ? 'Płatnik / pracodawca' : 'ZUS (PUE/eZUS)'}
                      </span>
                    </div>
                    {doc.deadline && (
                      <p className="doc-item__deadline">
                        Termin: <strong>{formatPolishDate(doc.deadline)}</strong>
                      </p>
                    )}
                    {doc.note && <p className="doc-item__note">{doc.note}</p>}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="plan-section" aria-labelledby="docs-deadlines-heading">
        <h2 id="docs-deadlines-heading" className="plan-section__title">
          Kluczowe terminy wniosków
        </h2>
        {checklist.deadlines.length === 0 ? (
          <div className="plan-callout plan-callout--info">
            Dla bieżącej sytuacji nie występują odrębne terminy na urlop rodzicielski ani ojcowski.
            Złóż wymagane dokumenty w dogodnym momencie.
          </div>
        ) : (
          <div className="plan-table-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Data graniczna</th>
                  <th>Czynność / wniosek</th>
                  <th>Podstawa prawna</th>
                </tr>
              </thead>
              <tbody>
                {checklist.deadlines.map((item) => (
                  <tr key={`${item.date}-${item.label}`}>
                    <td>
                      <strong>{formatPolishDate(item.date)}</strong>
                    </td>
                    <td>{item.label}</td>
                    <td>{item.legalBasis ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
