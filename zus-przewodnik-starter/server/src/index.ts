import { createApp } from './app';

// Wczytaj .env, jeśli istnieje (Node >= 20.12, bez dodatkowych zależności).
try {
  process.loadEnvFile?.();
} catch {
  // brak pliku .env – używamy zmiennych środowiskowych i wartości domyślnych
}

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT) || DEFAULT_PORT;

createApp().listen(port, () => {
  console.log(`API: http://localhost:${port}/api/v1/health`);
});
