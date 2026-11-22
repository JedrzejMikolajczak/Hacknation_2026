## Opis zmiany
<!-- Co zostało dodane lub poprawione i dlaczego? -->

## Obszar zmian
- [ ] `shared/` — silnik obliczeń, typy lub `params.json`
- [ ] `server/` — REST API, walidacja Zod, adaptery (mObywatel, ZUS, Gemini)
- [ ] `client/` — UI/UX, kreator, plan, generowanie PDF
- [ ] `data/` — sprawy katalogowe lub fikcyjne profile demonstracyjne
- [ ] `docs/` / CI — dokumentacja, testy lub konfiguracja repozytorium

## Checklista przed scaleniem
- [ ] Brak kluczy API, plików `.env` i surowych materiałów konkursowych ZUS w commicie
- [ ] Uruchomiono lokalnie: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] Jeśli zmieniono kontrakt (`shared/types.ts`, `shared/params.json`, ścieżki API) — zaktualizowano `agents/CONVENTIONS.md`
