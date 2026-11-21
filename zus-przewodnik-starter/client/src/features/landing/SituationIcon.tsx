import type { SituationType } from '@shared/types';

interface SituationIconProps {
  situation: SituationType;
  className?: string;
}

/** Proste ikony liniowe (inline SVG, bez bibliotek). Dekoracyjne – ukryte przed czytnikami. */
export function SituationIcon({ situation, className }: SituationIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[situation]}
    </svg>
  );
}

const ICON_PATHS: Record<SituationType, JSX.Element> = {
  // kalendarz z plusem
  planning: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </>
  ),
  // serce
  pregnant: (
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
  ),
  // buzia niemowlęcia
  afterBirth: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 5c-1.6 0-2.2 1.4-1 2.2" />
      <path d="M9.5 15.5a3.5 3.5 0 0 0 5 0" />
      <path d="M9 11.5h.01M15 11.5h.01" strokeWidth={2.5} />
    </>
  ),
  // dom z sercem
  adoption: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M12 17.5s-3-1.8-3-3.9a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.1-3 3.9-3 3.9z" />
    </>
  ),
};
