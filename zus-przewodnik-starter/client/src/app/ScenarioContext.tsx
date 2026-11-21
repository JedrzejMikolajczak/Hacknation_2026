import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ScenarioInput, SituationType } from '@shared/types';

/**
 * Scenariusz budowany krok po kroku (start → kreator).
 * Docelowo pełny ScenarioInput; na razie wypełniamy tylko `situation`.
 */
export type ScenarioDraft = Partial<Omit<ScenarioInput, 'situation'>> & {
  situation: SituationType | null;
};

interface ScenarioContextValue {
  scenario: ScenarioDraft;
  setSituation: (situation: SituationType | null) => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

interface ScenarioProviderProps {
  children: ReactNode;
  initialScenario?: ScenarioDraft;
}

export function ScenarioProvider({ children, initialScenario }: ScenarioProviderProps) {
  const [scenario, setScenario] = useState<ScenarioDraft>(initialScenario ?? { situation: null });

  const setSituation = useCallback((situation: SituationType | null) => {
    setScenario((prev) => (prev.situation === situation ? prev : { ...prev, situation }));
  }, []);

  const value = useMemo(() => ({ scenario, setSituation }), [scenario, setSituation]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenario must be used inside <ScenarioProvider>');
  }
  return context;
}
