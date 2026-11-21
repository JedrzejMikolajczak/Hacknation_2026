import type { SituationType } from '@shared/types';

export interface SituationOption {
  value: SituationType;
  title: string;
  description: string;
}

const SITUATION_TEXTS: Record<SituationType, Omit<SituationOption, 'value'>> = {
  planning: {
    title: 'Planuję dziecko',
    description: 'Jak zadbać o prawo do zasiłku przed ciążą',
  },
  pregnant: {
    title: 'Jestem w ciąży',
    description: 'Zasiłek chorobowy i przygotowanie do macierzyńskiego',
  },
  afterBirth: {
    title: 'Urodziło się dziecko',
    description: 'Urlopy rodzicielskie i wysokość zasiłku',
  },
  adoption: {
    title: 'Adopcja lub rodzina zastępcza',
    description: 'Urlop na warunkach macierzyńskiego i rodzicielski',
  },
};

const ORDER: SituationType[] = ['planning', 'pregnant', 'afterBirth', 'adoption'];

export const SITUATION_OPTIONS: SituationOption[] = ORDER.map((value) => ({
  value,
  ...SITUATION_TEXTS[value],
}));
