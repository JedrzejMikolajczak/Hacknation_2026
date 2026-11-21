import type { ParentData, ScenarioInput, SituationType, SpecialCircumstances } from '@shared/types';

/** Dane kreatora mogą być niepełne. Brakujący rodzic nie jest osobą bez ubezpieczenia. */
export type ScenarioDraft = Partial<
  Omit<ScenarioInput, 'situation' | 'mother' | 'father' | 'special'>
> & {
  situation: SituationType | null;
  mother?: Partial<ParentData> | null;
  father?: Partial<ParentData> | null;
  special?: Partial<SpecialCircumstances>;
};

/** Stan interfejsu, oddzielony od kontraktu obliczeń. 'unknown' oznacza świadome pominięcie. */
export interface ManualFormState {
  version: 2;
  situation: SituationType;
  answers: Record<string, string>;
  currentQuestionId: string;
  completed: boolean;
}
