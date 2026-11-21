import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = 'http://127.0.0.1:' + (process.env.PORT ?? '3001');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  optimizeDeps: {
    // generator PDF ładuje się dopiero przy pobieraniu – bez tego Vite odkrywa te paczki w trakcie
    // działania i przeładowuje stronę (wygląda to jak „odświeżenie bez efektu”).
    include: ['pdf-lib', '@pdf-lib/fontkit'],
  },
  server: {
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': apiTarget,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
