import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** True, gdy przeglądarka może animować i użytkownik nie prosi o ograniczenie ruchu. */
export function canAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.IntersectionObserver !== 'function') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Odsłanianie elementów `[data-reveal]` przy przewijaniu.
 * Klasa `landing--motion` ukrywa elementy dopiero po zamontowaniu (przed pierwszym malowaniem),
 * więc bez JS, w testach i przy „reduced motion” treść jest zawsze widoczna.
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !canAnimate()) return;

    root.classList.add('landing--motion');
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove('landing--motion');
    };
  }, [rootRef]);
}

/**
 * Delikatny paralaks i „reflektor” w nagłówku – tylko zmienne CSS (`--mx`, `--my` ∈ [-1, 1]),
 * bez odczytów układu; aktualizacja raz na klatkę.
 */
export function usePointerParallax(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !canAnimate()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      root.style.setProperty('--mx', x.toFixed(3));
      root.style.setProperty('--my', y.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      x = (event.clientX / window.innerWidth) * 2 - 1;
      y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef]);
}

interface CountUpProps {
  value: number;
  className?: string;
  duration?: number;
}

/** Liczba, która „nabiega” od 0 po wejściu w widok. Czytniki ekranu dostają od razu wartość końcową. */
export function CountUp({ value, className, duration = 1400 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !canAnimate()) return;

    node.textContent = '0';
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          node.textContent = String(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      node.textContent = String(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
