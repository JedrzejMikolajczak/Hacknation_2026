import type { SituationType } from '@shared/types';

export interface SituationOption {
  value: SituationType;
  title: string;
  description: string;
}

const SITUATION_TEXTS: Record<SituationType, Omit<SituationOption, 'value'>> = {
  planning: {
    title: 'Planuję dziecko',
    description: 'Co zrobić wcześniej, żeby nie stracić prawa do zasiłku',
  },
  pregnant: {
    title: 'Jestem w ciąży',
    description: 'Zasiłek chorobowy w ciąży i przygotowanie do urlopu macierzyńskiego',
  },
  afterBirth: {
    title: 'Urodziło się dziecko',
    description: 'Urlop macierzyński, rodzicielski, ojcowski i wysokość zasiłku',
  },
  adoption: {
    title: 'Adopcja lub rodzina zastępcza',
    description: 'Urlop na warunkach urlopu macierzyńskiego i rodzicielski',
  },
};

const ORDER: SituationType[] = ['planning', 'pregnant', 'afterBirth', 'adoption'];

export const SITUATION_OPTIONS: SituationOption[] = ORDER.map((value) => ({
  value,
  ...SITUATION_TEXTS[value],
}));
