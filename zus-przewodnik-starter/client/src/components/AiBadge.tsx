import './AiBadge.css';

/** Oznaczenie funkcji korzystających z AI (wymóg konkursu, README §9). */
export function AiBadge() {
  return (
    <span className="ai-badge">
      <svg className="ai-badge__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
      Wspierane przez AI
    </span>
  );
}
