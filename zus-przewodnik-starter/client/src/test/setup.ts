import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom nie implementuje przewijania – aplikacja wraca na górę po zmianie ścieżki.
// (Testy w środowisku „node”, np. generowanie PDF, nie mają obiektu window.)
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
}

afterEach(() => {
  cleanup();
  // Kreator zapisuje odpowiedzi w localStorage – bez czyszczenia przeciekają między testami.
  try {
    if (typeof window.localStorage?.clear === 'function') window.localStorage.clear();
  } catch {
    // niektóre testy podmieniają localStorage na atrapę bez clear()
  }
});
