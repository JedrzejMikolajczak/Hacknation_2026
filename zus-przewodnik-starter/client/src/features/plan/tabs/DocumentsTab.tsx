import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { BenefitParams, DocumentChecklist, ScenarioInput } from '@shared/types';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import { DeadlinesSection } from '../../documents/DeadlinesSection';
import { DocumentChecklistSection } from '../../documents/DocumentChecklistSection';
import { resolveParentsFilingInfo, selectNextAction } from '../../documents/documentModel';
import './DocumentsTab.css';

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
  const { search } = useLocation();
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
              Uzupełnij dane do listy dokumentów
            </h2>
            <p className="plan-section__lead">
              Aby ustalić, gdzie złożyć dokumenty i jakie obowiązują terminy, uzupełnij brakujące
              pola:
            </p>
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="docs-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/applications${search}`} className="docs-next-link">
            Dalej: Wnioski ›
          </Link>
        </nav>
      </div>
    );
  }

  function toggleDocument(id: string) {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleResetChecked() {
    setCheckedMap({});
    try {
      window.localStorage.removeItem(CHECKLIST_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  const referenceDate = scenario?.referenceDate ?? null;
  const parentsFiling = resolveParentsFilingInfo(checklist, scenario, params);
  const nextAction = selectNextAction(checklist, checkedMap, referenceDate);

  if (nextAction.empty) {
    return (
      <div className="plan-tab-content">
        <section className="plan-section" aria-labelledby="docs-empty-heading">
          <div className="plan-missing-data" role="status">
            <h2 id="docs-empty-heading" className="plan-section__title">
              Brak dokumentów do złożenia
            </h2>
            <p className="plan-section__lead">
              Dla podanych danych o ubezpieczeniu nie wygenerowano listy wymaganych wniosków. Jeśli
              zmieniła się Twoja sytuacja lub chcesz dopisać ubezpieczenie, zaktualizuj dane.
            </p>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="docs-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/applications${search}`} className="docs-next-link">
            Dalej: Wnioski ›
          </Link>
        </nav>
      </div>
    );
  }

  return (
    <div className="plan-tab-content">
      <section
        className={nextAction.isOverdue ? 'docs-answer docs-answer--overdue' : 'docs-answer'}
        aria-labelledby="docs-next-step-heading"
      >
        <div className="docs-answer__head">
          <h2 id="docs-next-step-heading" className="docs-answer__eyebrow">
            Co zrobić teraz
          </h2>
          {nextAction.isOverdue && <span className="plan-badge plan-badge--no">Termin minął</span>}
        </div>

        <p className="docs-answer__step">{nextAction.text}</p>

        {nextAction.overdueHint && (
          <p className="docs-answer__overdue-hint" role="alert">
            {nextAction.overdueHint}
          </p>
        )}

        <dl className="docs-answer__payers">
          {parentsFiling.map((info) => (
            <div key={info.role} className="docs-answer__payer-row">
              <dt>{info.label}</dt>
              <dd>{info.summary}</dd>
              {info.method && <dd className="docs-answer__payer-method">{info.method}</dd>}
            </div>
          ))}
        </dl>

        <details className="docs-details">
          <summary className="docs-details__summary">
            Dlaczego ten płatnik i jak złożyć dokumenty?
          </summary>
          <div className="docs-details__body">
            Zasiłek wypłaca pracodawca lub zleceniodawca, jeśli zgłasza do ubezpieczenia chorobowego
            powyżej {params.payerThresholdInsuredCount} osób (art. 61 ustawy zasiłkowej). W
            pozostałych przypadkach oraz przy działalności gospodarczej (JDG) dokumenty trafiają do
            ZUS – elektronicznie przez PUE/eZUS (symulacja) lub papierowo. Płatnik ustalany jest
            osobno dla każdego rodzica.
          </div>
        </details>
      </section>

      <DocumentChecklistSection
        documents={checklist.documents}
        checkedMap={checkedMap}
        onToggleDocument={toggleDocument}
        onResetChecked={handleResetChecked}
        referenceDate={referenceDate}
        scenario={scenario}
        params={params}
      />

      <DeadlinesSection
        deadlines={checklist.deadlines}
        referenceDate={referenceDate}
        scenario={scenario}
        params={params}
        search={search}
      />

      <nav className="docs-next-nav" aria-label="Następny krok planu">
        <Link
          to={`/plan/applications${search}`}
          className="plan-btn plan-btn--primary docs-next-cta"
        >
          Dalej: Wnioski ›
        </Link>
      </nav>
    </div>
  );
}
