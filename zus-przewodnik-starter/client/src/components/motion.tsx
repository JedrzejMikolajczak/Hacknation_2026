import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/** True, gdy przeglądarka może animować i użytkownik nie prosi o ograniczenie ruchu. */
export function canAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.IntersectionObserver !== 'function') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Odsłanianie elementów `[data-reveal]` w całej aplikacji – także tych, które pojawiają się
 * później (np. po odpowiedzi z API). Klasa `ui-motion` na <html> ukrywa je dopiero po
 * zamontowaniu, więc bez JS, w testach i przy „reduced motion” treść jest zawsze widoczna.
 * Stan „widoczny” to atrybut `data-visible` – React go nie nadpisuje przy zmianie className.
 */
export function useGlobalReveal() {
  useLayoutEffect(() => {
    if (!canAnimate()) return;

    const root = document.documentElement;
    root.classList.add('ui-motion');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).setAttribute('data-visible', '');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );

    const watched = new WeakSet<Element>();
    const watch = (element: Element) => {
      if (watched.has(element)) return;
      watched.add(element);
      observer.observe(element);
    };
    const scan = (parent: ParentNode) => parent.querySelectorAll('[data-reveal]').forEach(watch);

    scan(document);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('[data-reveal]')) watch(node);
          scan(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      root.classList.remove('ui-motion');
    };
  }, []);
}

/**
 * Po zmianie ścieżki (nowa strona lub kolejny krok planu) wracamy na górę – inaczej nowy ekran
 * otwierałby się w połowie, w miejscu, w którym kliknięto „Dalej”.
 */
export function useScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (typeof window.scrollTo !== 'function') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
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
  /** Jak zapisać liczbę w trakcie i po animacji (domyślnie liczba całkowita). */
  format?: (value: number) => string;
}

const defaultFormat = (n: number) => String(Math.round(n));

/**
 * Liczba, która „nabiega” od 0 po wejściu w widok. Czytniki ekranu i testy dostają od razu
 * wartość końcową (animacja podmienia tekst tylko, gdy ruch jest dozwolony).
 */
export function CountUp({ value, className, duration = 1300, format }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatValue = format ?? defaultFormat;
  // Najnowszy formatter trafia do refa dopiero po renderze – animacja nie odpala się od nowa
  // tylko dlatego, że rodzic przekazał nową funkcję.
  const formatRef = useRef(formatValue);
  useLayoutEffect(() => {
    formatRef.current = formatValue;
  });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !canAnimate()) return;

    node.textContent = formatRef.current(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          node.textContent = formatRef.current(value * eased);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      node.textContent = formatRef.current(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatValue(value)}
    </span>
  );
}
