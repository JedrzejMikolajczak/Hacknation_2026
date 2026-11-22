import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { BenefitParams, CaseWarning } from '@shared/types';
import { WarningList } from './tabs/CaseResults';

interface PlanNotificationsProps {
  warnings: CaseWarning[];
  params: BenefitParams;
}

export function PlanNotifications({ warnings, params }: PlanNotificationsProps) {
  const { pathname } = useLocation();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState<string>('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const open = openPathname === pathname;
  const warningsKey = warnings.map((w) => `${w.code}:${w.message_pl}`).join('|');
  const hasUnread = warnings.length > 0 && seenKey !== warningsKey;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPathname(null);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpenPathname(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (warnings.length === 0) return null;

  function togglePanel() {
    if (open) {
      setOpenPathname(null);
    } else {
      setOpenPathname(pathname);
      setSeenKey(warningsKey);
    }
  }

  return (
    <div className="plan-notif" ref={wrapRef}>
      <button
        type="button"
        className={hasUnread ? 'plan-notif__btn plan-notif__btn--unread' : 'plan-notif__btn'}
        aria-expanded={open}
        aria-controls="plan-notifications-panel"
        aria-label={`Ważne uwagi do planu (${warnings.length})`}
        onClick={togglePanel}
      >
        <svg
          className="plan-notif__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="plan-notif__label">Uwagi</span>
        <span
          className={
            hasUnread ? 'plan-notif__badge plan-notif__badge--unread' : 'plan-notif__badge'
          }
        >
          {warnings.length}
        </span>
      </button>

      {open && (
        <div
          id="plan-notifications-panel"
          className="plan-notif__popover"
          role="region"
          aria-label="Powiadomienia i uwagi do planu"
        >
          <div className="plan-notif__popover-header">
            <h3 className="plan-notif__popover-title">
              Na co zwrócić uwagę ({warnings.length})
            </h3>
            <button
              type="button"
              className="plan-notif__close"
              aria-label="Zamknij uwagi"
              onClick={() => setOpenPathname(null)}
            >
              ✕
            </button>
          </div>
          <div className="plan-notif__popover-body">
            <WarningList warnings={warnings} params={params} compact />
          </div>
        </div>
      )}
    </div>
  );
}
