import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

// Wczytaj .env z katalogu serwera lub katalogu głównego projektu (Node >= 20.12, bez dodatkowych zależności).
const currentDir = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
  resolve(currentDir, '../../.env'),
  resolve(currentDir, '../../../.env'),
]) {
  if (!existsSync(candidate)) continue;
  try {
    process.loadEnvFile?.(candidate);
    break;
  } catch {
    // ignoruj nieczytelny .env – używamy zmiennych środowiskowych i wartości domyślnych
  }
}

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT) || DEFAULT_PORT;

createApp().listen(port, () => {
  console.log(`API: http://localhost:${port}/api/v1/health`);
});
