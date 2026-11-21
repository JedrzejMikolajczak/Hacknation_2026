import { useId, useRef, type KeyboardEvent } from 'react';
import type { SituationType } from '@shared/types';
import { SituationIcon } from './SituationIcon';
import type { SituationOption } from './situationOptions';

interface SituationTilesProps {
  options: SituationOption[];
  value: SituationType | null;
  onChange: (value: SituationType) => void;
  labelledBy: string;
  describedBy?: string;
}

/**
 * Grupa wyboru jednokrotnego (wzorzec ARIA radiogroup):
 * Tab wchodzi na zaznaczony (lub pierwszy) kafelek, strzałki/Home/End zmieniają wybór,
 * Enter/Spacja zaznaczają kafelek z fokusem.
 */
export function SituationTiles({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: SituationTilesProps) {
  const idPrefix = useId();
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function moveTo(index: number) {
    const option = options[index];
    if (!option) return;
    tileRefs.current[index]?.focus();
    onChange(option.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        moveTo(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        moveTo(index === 0 ? last : index - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(last);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div
      className="situation-tiles"
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const titleId = `${idPrefix}-${option.value}-title`;
        const descriptionId = `${idPrefix}-${option.value}-description`;
        return (
          <button
            key={option.value}
            ref={(element) => {
              tileRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={index === tabStopIndex ? 0 : -1}
            className={checked ? 'situation-tile situation-tile--checked' : 'situation-tile'}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="situation-tile__check" aria-hidden="true">
              {checked ? '✓' : ''}
            </span>
            <SituationIcon situation={option.value} className="situation-tile__icon" />
            <span id={titleId} className="situation-tile__title">
              {option.title}
            </span>
            <span id={descriptionId} className="situation-tile__description">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
