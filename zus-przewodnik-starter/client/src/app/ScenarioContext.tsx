import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ApplicantRole,
  AuthSession,
  CaseInputs,
  SituationType,
  UserProfile,
  ZusData,
} from '@shared/types';
import { apiGet, apiPost } from '../api/client';
import { readPlanAddress } from './planAddress';
import { wizardCase } from '../features/plan/caseScenario';
import { buildScenario } from '../features/wizard/wizardModel';
import {
  mergeZusIntoForm,
  resolveConflictInForm,
  selectZusIncomesForBuild,
} from '../features/wizard/zusMerge';
import type { FieldConflict, FieldSource, ManualFormState, ScenarioDraft } from './scenarioDraft';
import { isSituationType } from './situation';

export type { ScenarioDraft } from './scenarioDraft';

export interface MockAuthSession {
  sessionToken: string;
  profile: UserProfile;
  zusData: ZusData;
}

interface ScenarioContextValue {
  scenario: ScenarioDraft;
  planInputs: CaseInputs | null;
  updatePlanInputs: (inputs: CaseInputs | null) => void;
  manualForm: ManualFormState | null;
  storageAvailable: boolean;
  setSituation: (situation: SituationType | null) => void;
  updateScenario: (changes: Partial<ScenarioDraft>) => void;
  saveManualForm: (form: ManualFormState, scenario: ScenarioDraft) => void;
  clearScenario: () => void;
  simulatedIdentities: Partial<Record<ApplicantRole, AuthSession>>;
  setSimulatedIdentity: (role: ApplicantRole, identity: AuthSession) => void;
  authSession: MockAuthSession | null;
  loginWithProfile: (
    profileId: string,
    targetSituation?: SituationType | null,
    role?: ApplicantRole,
  ) => Promise<MockAuthSession>;
  logoutMockSession: () => void;
  resolveFieldConflict: (questionId: string, choice: 'keepUser' | 'useIncoming') => void;
}

interface ScenarioState {
  scenario: ScenarioDraft;
  manualForm: ManualFormState | null;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);
export const SCENARIO_STORAGE_KEY = 'zus-manual-scenario-v1';
export const MANUAL_FORM_STORAGE_KEY = 'zus-manual-form-v2';

function isFieldSource(value: unknown): value is FieldSource {
  return value === 'zus' || value === 'mobywatel' || value === 'user' || value === 'edited';
}

function isFieldConflict(value: unknown): value is FieldConflict {
  return (
    typeof value === 'object' &&
    value !== null &&
    'questionId' in value &&
    typeof value.questionId === 'string' &&
    'userValue' in value &&
    typeof value.userValue === 'string' &&
    'incomingValue' in value &&
    typeof value.incomingValue === 'string' &&
    'incomingSource' in value &&
    (value.incomingSource === 'zus' || value.incomingSource === 'mobywatel')
  );
}

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
      const raw = form as Record<string, unknown>;
      const rawSources = raw.fieldSources;
      const fieldSources =
        typeof rawSources === 'object' && rawSources !== null && !Array.isArray(rawSources)
          ? Object.fromEntries(
              Object.entries(rawSources).filter(([, entry]) => isFieldSource(entry)),
            )
          : undefined;
      const rawConflicts = raw.pendingConflicts;
      const pendingConflicts =
        typeof rawConflicts === 'object' && rawConflicts !== null && !Array.isArray(rawConflicts)
          ? Object.fromEntries(
              Object.entries(rawConflicts).filter(([, entry]) => isFieldConflict(entry)),
            )
          : undefined;
      const manualForm: ManualFormState = {
        version: 2,
        situation: form.situation as SituationType,
        answers: form.answers as Record<string, string>,
        currentQuestionId: form.currentQuestionId,
        completed: form.completed,
        ...(fieldSources ? { fieldSources } : {}),
        ...(pendingConflicts ? { pendingConflicts } : {}),
      };
      return { scenario: buildScenario(manualForm.situation, manualForm.answers), manualForm };
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
  const [authSession, setAuthSession] = useState<MockAuthSession | null>(null);
  const [simulatedIdentities, setSimulatedIdentities] = useState<
    ScenarioContextValue['simulatedIdentities']
  >({});
  const setSimulatedIdentity: ScenarioContextValue['setSimulatedIdentity'] = useCallback(
    (role, identity) => setSimulatedIdentities((current) => ({ ...current, [role]: identity })),
    [],
  );
  const [query, setQuery] = useSearchParams();
  const serialized = query.get('inputs');
  const hasCase = query.has('case');
  const planInputs = useMemo(
    () => (serialized ? readPlanAddress(serialized) : hasCase ? null : wizardCase(state.scenario)),
    [serialized, hasCase, state.scenario],
  );
  const updatePlanInputs = useCallback(
    (inputs: CaseInputs | null) => {
      const next = new URLSearchParams(query);
      if (inputs) next.set('inputs', JSON.stringify(inputs));
      else next.delete('inputs');
      setQuery(next, { replace: true });
    },
    [query, setQuery],
  );

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

  const mergeSessionIntoState = useCallback(
    (
      base: ScenarioState,
      zusData: ZusData,
      targetSituation?: SituationType | null,
    ): ScenarioState => {
      const situation = targetSituation ?? base.scenario.situation;
      if (!situation) return base;
      const existingForm: ManualFormState =
        base.manualForm && base.manualForm.situation === situation
          ? base.manualForm
          : {
              version: 2,
              situation,
              answers: {},
              currentQuestionId: 'family',
              completed: false,
            };
      const { form: mergedForm } = mergeZusIntoForm(existingForm, zusData);
      const zusIncomes = selectZusIncomesForBuild(mergedForm, zusData);
      return {
        manualForm: mergedForm,
        scenario: buildScenario(situation, mergedForm.answers, undefined, { zusIncomes }),
      };
    },
    [],
  );

  const setSituation = useCallback(
    (situation: SituationType | null) => {
      if (state.scenario.situation === situation) return;
      if (!situation) {
        commit({ scenario: { situation: null }, manualForm: null });
        return;
      }
      if (authSession) {
        commit(
          mergeSessionIntoState(
            { scenario: { situation }, manualForm: null },
            authSession.zusData,
            situation,
          ),
        );
        return;
      }
      commit({ scenario: { situation }, manualForm: null });
    },
    [state.scenario.situation, authSession, commit, mergeSessionIntoState],
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
    setSimulatedIdentities({});
    setAuthSession(null);
    commit({ scenario: { situation: null }, manualForm: null });
  }, [commit]);

  const loginWithProfile = useCallback(
    async (
      profileId: string,
      targetSituation?: SituationType | null,
      role: ApplicantRole = 'MOTHER',
    ): Promise<MockAuthSession> => {
      const loginResult = await apiPost<AuthSession>('/mock/login', { profile_id: profileId });
      const { sessionToken, profile } = loginResult;
      const zusData = await apiGet<ZusData>('/mock/zus-data', {
        Authorization: `Bearer ${sessionToken}`,
      });
      const session: MockAuthSession = { sessionToken, profile, zusData };
      setAuthSession(session);
      setSimulatedIdentities((current) => ({
        ...current,
        [role]: loginResult,
      }));
      const nextState = mergeSessionIntoState(state, zusData, targetSituation);
      if (nextState !== state) commit(nextState);
      return session;
    },
    [state, commit, mergeSessionIntoState],
  );

  const logoutMockSession = useCallback(() => {
    setAuthSession(null);
  }, []);

  const resolveFieldConflict = useCallback(
    (questionId: string, choice: 'keepUser' | 'useIncoming') => {
      if (!state.manualForm) return;
      const nextForm = resolveConflictInForm(
        state.manualForm,
        questionId,
        choice,
        authSession?.zusData ?? null,
      );
      const zusIncomes = selectZusIncomesForBuild(nextForm, authSession?.zusData ?? null);
      commit({
        manualForm: nextForm,
        scenario: buildScenario(nextForm.situation, nextForm.answers, undefined, { zusIncomes }),
      });
    },
    [state.manualForm, authSession, commit],
  );

  const value = useMemo(
    () => ({
      ...state,
      storageAvailable,
      planInputs,
      updatePlanInputs,
      setSituation,
      updateScenario,
      saveManualForm,
      clearScenario,
      simulatedIdentities,
      setSimulatedIdentity,
      authSession,
      loginWithProfile,
      logoutMockSession,
      resolveFieldConflict,
    }),
    [
      state,
      storageAvailable,
      planInputs,
      updatePlanInputs,
      setSituation,
      updateScenario,
      saveManualForm,
      clearScenario,
      simulatedIdentities,
      setSimulatedIdentity,
      authSession,
      loginWithProfile,
      logoutMockSession,
      resolveFieldConflict,
    ],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (!context) throw new Error('useScenario must be used inside <ScenarioProvider>');
  return context;
}
