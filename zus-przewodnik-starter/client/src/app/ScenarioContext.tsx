import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SituationType } from '@shared/types';
import type { ManualFormState, ScenarioDraft } from './scenarioDraft';
import { isSituationType } from './situation';

export type { ScenarioDraft } from './scenarioDraft';

interface ScenarioContextValue {
  scenario: ScenarioDraft;
  manualForm: ManualFormState | null;
  storageAvailable: boolean;
  setSituation: (situation: SituationType | null) => void;
  updateScenario: (changes: Partial<ScenarioDraft>) => void;
  saveManualForm: (form: ManualFormState, scenario: ScenarioDraft) => void;
  clearScenario: () => void;
}

interface ScenarioState {
  scenario: ScenarioDraft;
  manualForm: ManualFormState | null;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);
export const SCENARIO_STORAGE_KEY = 'zus-manual-scenario-v1';
export const MANUAL_FORM_STORAGE_KEY = 'zus-manual-form-v2';

function loadState(initialScenario?: ScenarioDraft): ScenarioState {
  if (initialScenario) return { scenario: initialScenario, manualForm: null };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? 'null');
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('situation' in parsed) ||
      (parsed.situation !== null && !isSituationType(parsed.situation))
    ) {
      return { scenario: { situation: null }, manualForm: null };
    }
    const scenario = parsed as ScenarioDraft;
    const form: unknown = JSON.parse(
      window.localStorage.getItem(MANUAL_FORM_STORAGE_KEY) ?? 'null',
    );
    if (
      typeof form === 'object' &&
      form !== null &&
      'version' in form &&
      form.version === 2 &&
      'situation' in form &&
      form.situation === scenario.situation &&
      'currentQuestionId' in form &&
      typeof form.currentQuestionId === 'string' &&
      'completed' in form &&
      typeof form.completed === 'boolean' &&
      'answers' in form &&
      typeof form.answers === 'object' &&
      form.answers !== null &&
      !Array.isArray(form.answers) &&
      Object.values(form.answers).every((value) => typeof value === 'string')
    ) {
      return { scenario, manualForm: form as ManualFormState };
    }
    return { scenario, manualForm: null };
  } catch {
    return { scenario: { situation: null }, manualForm: null };
  }
}

interface ScenarioProviderProps {
  children: ReactNode;
  initialScenario?: ScenarioDraft;
}

export function ScenarioProvider({ children, initialScenario }: ScenarioProviderProps) {
  const [state, setState] = useState<ScenarioState>(() => loadState(initialScenario));
  const [storageAvailable, setStorageAvailable] = useState(true);

  const commit = useCallback((next: ScenarioState) => {
    setState(next);
    try {
      if (next.scenario.situation === null) {
        window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(next.scenario));
      }
      if (next.manualForm) {
        window.localStorage.setItem(MANUAL_FORM_STORAGE_KEY, JSON.stringify(next.manualForm));
      } else {
        window.localStorage.removeItem(MANUAL_FORM_STORAGE_KEY);
      }
      window.localStorage.removeItem('zus-manual-wizard-step-v1');
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, []);

  const setSituation = useCallback(
    (situation: SituationType | null) => {
      if (state.scenario.situation !== situation)
        commit({ scenario: { situation }, manualForm: null });
    },
    [state.scenario.situation, commit],
  );

  const updateScenario = useCallback(
    (changes: Partial<ScenarioDraft>) => {
      commit({ ...state, scenario: { ...state.scenario, ...changes } });
    },
    [state, commit],
  );

  const saveManualForm = useCallback(
    (manualForm: ManualFormState, scenario: ScenarioDraft) => {
      commit({ manualForm, scenario });
    },
    [commit],
  );

  const clearScenario = useCallback(() => {
    commit({ scenario: { situation: null }, manualForm: null });
  }, [commit]);

  const value = useMemo(
    () => ({
      ...state,
      storageAvailable,
      setSituation,
      updateScenario,
      saveManualForm,
      clearScenario,
    }),
    [state, storageAvailable, setSituation, updateScenario, saveManualForm, clearScenario],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (!context) throw new Error('useScenario must be used inside <ScenarioProvider>');
  return context;
}
