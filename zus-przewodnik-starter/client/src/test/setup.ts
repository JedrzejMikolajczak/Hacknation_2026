import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Kreator zapisuje odpowiedzi w localStorage – bez czyszczenia przeciekają między testami.
  try {
    if (typeof window.localStorage?.clear === 'function') window.localStorage.clear();
  } catch {
    // niektóre testy podmieniają localStorage na atrapę bez clear()
  }
});
