import { useEffect, useState } from 'react';
import type { DocumentChecklist } from '@shared/types';
import { formatPayer, formatPolishDate } from '../planScenario';

interface DocumentsTabProps {
  checklist: DocumentChecklist;
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

export function DocumentsTab({ checklist }: DocumentsTabProps) {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(loadCheckedIds);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedMap));
    } catch {
      // ignore storage errors
    }
  }, [checkedMap]);

  function toggleDocument(id: string) {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const completedCount = checklist.documents.filter((doc) => checkedMap[doc.id]).length;

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="docs-payer-heading">
        <h2 id="docs-payer-heading" className="plan-section__title">
          Gdzie składasz dokumenty i kto wypłaca zasiłek
        </h2>
        <div className="plan-callout plan-callout--info">
          <strong>Właściwy płatnik zasiłku w Twojej sytuacji:</strong>{' '}
          {formatPayer(checklist.payer)}.{' '}
          {checklist.payer === 'employer'
            ? 'Twój pracodawca zgłasza powyżej 20 ubezpieczonych, więc to on przyjmuje wniosek i wypłaca zasiłek.'
            : 'Zasiłek wypłaca bezpośrednio ZUS – najwygodniej złożyć dokumenty elektronicznie na PUE / eZUS.'}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="docs-checklist-heading">
        <div className="docs-header-row">
          <div>
            <h2 id="docs-checklist-heading" className="plan-section__title">
              Lista dokumentów do skompletowania
            </h2>
            <p className="plan-section__lead">
              Odhaczaj gotowe pozycje – postęp zapisuje się w Twojej przeglądarce.
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
              <li
                key={doc.id}
                className={isChecked ? 'doc-item doc-item--checked' : 'doc-item'}
              >
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
                        Złóż do: {doc.submitTo === 'employer' ? 'Pracodawca' : 'ZUS (PUE/eZUS)'}
                      </span>
                    </div>
                    {doc.deadline && (
                      <p className="doc-item__deadline">
                        Zalecany termin: <strong>{formatPolishDate(doc.deadline)}</strong>
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
          Kluczowe terminy liczone od daty porodu / przyjęcia dziecka
        </h2>
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
      </section>
    </div>
  );
}
