import type {
  BenefitBaseInput,
  IsoDate,
  ParentData,
  ParentRole,
  WizardScenario,
  SituationType,
  SpecialCircumstances,
} from '@shared/types';

/** Dane kreatora mogą być niepełne. Brakujący rodzic nie jest osobą bez ubezpieczenia. */
export type ScenarioDraft = Partial<
  Omit<WizardScenario, 'situation' | 'mother' | 'father' | 'special'>
> & {
  situation: SituationType | null;
  mother?: Partial<ParentData> | null;
  father?: Partial<ParentData> | null;
  special?: Partial<SpecialCircumstances>;
  /**
   * Dane do wyliczenia podstawy wymiaru (POST /api/v1/calculate/benefit-base) dla rodzica,
   * który nie zna swojej podstawy. Brak wpisu = podstawa podana wprost albo brak danych.
   */
  benefitBaseInputs?: Partial<Record<ParentRole, BenefitBaseInput>>;
  /** Zwolnienie lekarskie mamy w ciąży (zasiłek chorobowy; ciągłość z zasiłkiem macierzyńskim). */
  pregnancySickLeave?: PregnancySickLeave | null;
  /** Dane do podstawy zasiłku chorobowego w ciąży – prawo powstaje w dniu rozpoczęcia zwolnienia. */
  sicknessBenefitBaseInput?: BenefitBaseInput;
  motherDeathDate?: IsoDate | null;
};

export interface PregnancySickLeave {
  startDate: IsoDate | null;
  /** Ostatni dzień zwolnienia; przy zwolnieniu do porodu = dzień przed (przewidywanym) porodem. */
  endDate: IsoDate | null;
  untilBirth: boolean | null;
}

/** Stan interfejsu, oddzielony od kontraktu obliczeń. 'unknown' oznacza świadome pominięcie. */
export interface ManualFormState {
  version: 2;
  situation: SituationType;
  answers: Record<string, string>;
  currentQuestionId: string;
  completed: boolean;
}
