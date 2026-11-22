import { useCallback, useState } from 'react';
import { PLAN_TABS, type PlanTabId } from './planScenario';

const STORAGE_KEY = 'zus-plan-visited-v1';

function readVisited(): PlanTabId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is PlanTabId => PLAN_TABS.some((tab) => tab.id === id));
  } catch {
    return [];
  }
}

function writeVisited(ids: PlanTabId[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // brak miejsca albo tryb prywatny – postęp zostaje tylko w pamięci tej karty
  }
}

/**
 * Które kroki planu rodzic już obejrzał. Zapis tylko w tej przeglądarce (localStorage) – dzięki
 * temu ścieżka pokazuje „ptaszki”, a ekran startowy planu wie, od którego kroku wznowić.
 */
export function useVisitedSteps() {
  const [visited, setVisited] = useState<ReadonlySet<PlanTabId>>(() => new Set(readVisited()));

  const markVisited = useCallback((id: PlanTabId) => {
    setVisited((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous).add(id);
      writeVisited([...next]);
      return next;
    });
  }, []);

  return { visited, markVisited };
}

/** Pierwszy krok, którego jeszcze nie obejrzano (null, gdy wszystkie są odhaczone). */
export function firstUnvisitedStep(visited: ReadonlySet<PlanTabId>): PlanTabId | null {
  return PLAN_TABS.find((tab) => !visited.has(tab.id))?.id ?? null;
}
