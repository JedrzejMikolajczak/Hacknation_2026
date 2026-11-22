import type { ReactNode } from 'react';

interface IconProps {
  className?: string;
}

function LineIcon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Strzałka w prawo – w przyciskach „dalej”. */
export function ArrowIcon({ className = 'ui-btn__arrow' }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </LineIcon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </LineIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </LineIcon>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 12h6M10 15h6M10 18h4" />
    </LineIcon>
  );
}

export function CoinIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.7 5.2 1.4 5.2 4.2 0 1.1-1.1 2-2.7 2-1.2 0-2.2-.5-2.7-1.4M12 6.5V8m0 8v1.5" />
    </LineIcon>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </LineIcon>
  );
}

/** Koło ratunkowe – pomoc w trudnych sytuacjach. */
export function LifebuoyIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </LineIcon>
  );
}

/** Pytajnik w kółku – najczęstsze pytania. */
export function HelpIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 17h.01" />
    </LineIcon>
  );
}
