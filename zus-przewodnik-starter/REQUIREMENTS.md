# Wymagania środowiska i instalacja

## 1. Wymagane narzędzia

| Narzędzie | Wersja           | Uwagi                             |
| --------- | ---------------- | --------------------------------- |
| Node.js   | **≥ 20 (LTS)**   | wersja zapisana w `.nvmrc` (`20`) |
| npm       | **≥ 10**         | instalowany razem z Node.js 20    |
| Git       | dowolna aktualna | workflow w README §7              |

## 2. Instalacja

```bash
nvm use              # opcjonalnie – przełącza na Node z .nvmrc
npm install          # w katalogu głównym; instaluje wszystkie workspace'y (client, server, shared)
cp .env.example .env # opcjonalnie – własny port / origin / token admina
```

Zawsze instaluj z **katalogu głównego** (tam, gdzie jest ten plik). Nie uruchamiaj `npm install` w `client/` ani w `server/`.

## 3. Uruchomienie

```bash
npm run dev
```

- client: http://localhost:5173
- API: http://localhost:3001/api/v1/health → `{ "data": { "status": "ok" }, "error": null }`
- przez proxy Vite: http://localhost:5173/api/v1/health (frontend woła zawsze `/api/v1/...`)

## 4. Pozostałe skrypty (z katalogu głównego)

| Skrypt              | Co robi                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `npm test`          | Vitest we wszystkich workspace'ach (shared, server, client)      |
| `npm run lint`      | ESLint na całym repo                                             |
| `npm run typecheck` | `tsc --noEmit` w każdym workspace                                |
| `npm run build`     | shared (typecheck) → server (`tsc`) → client (`vite build`)      |
| `npm run format`    | Prettier (kontrakt i dokumenty są wyłączone w `.prettierignore`) |

Przed każdym pushem: `npm run lint && npm run typecheck && npm test` (README §7).

## 5. Zależności

> **Zasada:** nowa zależność tylko po uzgodnieniu z zespołem **i** z wpisem do tej tabeli.

| Pakiet                        | Workspace    | Po co jest                                                               |
| ----------------------------- | ------------ | ------------------------------------------------------------------------ |
| `typescript`                  | root (dev)   | Kompilator TypeScript i sprawdzanie typów w całym repo.                  |
| `concurrently`                | root (dev)   | Uruchamia client i server jednym poleceniem `npm run dev`.               |
| `eslint`                      | root (dev)   | Linter kodu (konfiguracja w `eslint.config.js`).                         |
| `@eslint/js`                  | root (dev)   | Zestaw zalecanych reguł ESLint dla JavaScriptu.                          |
| `typescript-eslint`           | root (dev)   | Parser i reguły ESLint dla TypeScriptu.                                  |
| `eslint-plugin-react-hooks`   | root (dev)   | Pilnuje poprawnego użycia hooków Reacta.                                 |
| `prettier`                    | root (dev)   | Jednolite formatowanie kodu.                                             |
| `vitest`                      | root (dev)   | Runner testów jednostkowych we wszystkich workspace'ach.                 |
| `react`                       | client       | Biblioteka UI.                                                           |
| `react-dom`                   | client       | Renderowanie Reacta w przeglądarce.                                      |
| `react-router-dom`            | client       | Routing stron (`/`, `/wizard`, `/plan/:tab` …).                          |
| `vite`                        | client (dev) | Serwer deweloperski, proxy `/api` i build frontendu.                     |
| `@vitejs/plugin-react`        | client (dev) | Obsługa JSX i Fast Refresh w Vite.                                       |
| `@types/react`                | client (dev) | Typy TypeScript dla Reacta.                                              |
| `@types/react-dom`            | client (dev) | Typy TypeScript dla react-dom.                                           |
| `@testing-library/react`      | client (dev) | Testowanie komponentów tak, jak używa ich człowiek.                      |
| `@testing-library/jest-dom`   | client (dev) | Czytelne asercje DOM (`toBeInTheDocument`, `toHaveAttribute` …).         |
| `@testing-library/user-event` | client (dev) | Symulacja kliknięć i klawiatury w testach.                               |
| `jsdom`                       | client (dev) | Środowisko DOM dla testów frontendu w Node.                              |
| `express`                     | server       | Serwer HTTP i routing REST API.                                          |
| `cors`                        | server       | Nagłówki CORS dla frontendu (localhost:5173 i adres demo).               |
| `zod`                         | server       | Walidacja danych wejściowych API (błędy → 422 `VALIDATION_ERROR`).       |
| `tsx`                         | server (dev) | Uruchamianie serwera TypeScript bez kompilacji (`npm run dev`, `start`). |
| `@types/express`              | server (dev) | Typy TypeScript dla Express.                                             |
| `@types/cors`                 | server (dev) | Typy TypeScript dla cors.                                                |
| `@types/node`                 | server (dev) | Typy TypeScript dla Node.js.                                             |
| `supertest`                   | server (dev) | Testy endpointów HTTP bez uruchamiania serwera.                          |
| `@types/supertest`            | server (dev) | Typy TypeScript dla supertest.                                           |

`shared` nie ma zależności runtime.

### Przypięte wersje (dlaczego nie „latest”)

- `eslint@^9` → `@eslint/js@^9` (wersja 10 wymaga ESLint 10).
- `vite@^5` → `@vitejs/plugin-react@^4` (5+ wymaga nowszego Vite) i `vitest@^3` (4+ wymaga Vite ≥ 6).
- `@testing-library/jest-dom@^6` (8 wymaga Vitest 5).
- `concurrently@^9`, `jsdom@^26` – nowsze wersje wymagają Node ≥ 22 / ≥ 20.19.
- `overrides.vite` w `package.json` wymusza jedną wersję Vite w całym repo (dev server i testy używają tej samej).
