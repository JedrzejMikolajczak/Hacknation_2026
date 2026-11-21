# Raport integracji `fix-all`

Stan gałęzi bazowych zweryfikowano 21 listopada 2026 r. Punktem wyjścia był `origin/main` (`8b4805c`). Przed integracją wysłano 17 tagów kopii zapasowej. Nie użyto zmian historii. Wzorzec ochrony `check*` obejmuje również `checkout1`.

## 1. Inwentaryzacja gałęzi

Kolejność kontroli w kolumnie „Kontrole” to `ci / lint / typecheck / test / build`. Kontrole wykonano w odłączonych katalogach `git worktree`. Odległość to commitów **za / przed** `origin/main`. „Pliki” oznaczają unikalny diff względem wspólnego przodka.

| Gałąź i ostatni commit | Za / przed | Kontrole | Kategoria | Pliki, wymagania i decyzja | Nazwa po odstawieniu |
|---|---:|---|---|---|---|
| `main` · `8b4805c` | 0 / 0 | chroniona | CHRONIONA | Baza integracji | `main` |
| `checkout1` · `fba3ec7` | 37 / 0 | chroniona | CHRONIONA | Kreator zawarty w main, pasuje do check* | `checkout1` |
| `JedrzejMikolajczak-patch-1` · `77da23e` | 52 / 0 | brak package.json | UNUSED | Szablon agentów i README zawarte w main | `niepotrzebne/JedrzejMikolajczak-patch-1` |
| `bchochoool-patch-1` · `d3feff9` | 47 / 0 | brak package.json | UNUSED | README zawarte w main | `niepotrzebne/bchochoool-patch-1` |
| `codex/kalkulator` · `d5c9aa7` | 37 / 0 | ✅ ✅ ✅ ✅ ✅ | UNUSED | Silnik i trasy zawarte w main, stary kontrakt | `niepotrzebne/codex/kalkulator` |
| `feature/admin-panel` · `bfe851e` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | MERGE | `App.tsx`, klient HTTP, edytor i testy admina. Po integracji API z tokenem środowiskowym | `niepotrzebne/feature/admin-panel` |
| `feature/ui-cases` · `d4d98f1` | 21 / 1 | ✅ ✅ ✅ ✅ ✅ | UNUSED | `App.tsx`, katalog, trasa API, test i dwie syntetyczne sprawy. Ten sam katalog wniesiono przez nowszą gałąź przewodnika | `niepotrzebne/feature/ui-cases` |
| `feature/ui-clarity` · `5a095cb` | 8 / 0 | ✅ ✅ ✅ ❌ ✅ | UNUSED | Uproszczenia panelu w main, w tym nawigacja i komunikaty | `niepotrzebne/feature/ui-clarity` |
| `feature/ui-documents` · `9e51eb8` | 37 / 1 | ✅ ✅ ✅ ❌ ✅ | UNUSED | `App.tsx`, samodzielny `DocumentsPage` i test. Zastąpione zakładką wspólnego planu | `niepotrzebne/feature/ui-documents` |
| `feature/ui-guide` · `d8895bf` | 0 / 4 | ✅ ✅ ✅ ❌ ✅ | MERGE | Katalog spraw, przewodnik z artykułami, podgląd wydruku, integracja tras i testy. Zmieniono kontrakt i katalog spraw | `niepotrzebne/feature/ui-guide` |
| `feature/ui-leave-calendar` · `1770c62` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | UNUSED | `App.tsx`, oś, kalendarz, planer i mock. Zastąpione osią i walidacją na wspólnym API | `niepotrzebne/feature/ui-leave-calendar` |
| `feature/ui-plan` · `ee14070` | 7 / 2 | ✅ ✅ ✅ ❌ ✅ | MERGE | Katalog i podgląd wniosków weszły przez `feature/ui-guide` | `niepotrzebne/feature/ui-plan` |
| `feature/ui-support` · `7a4ae30` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | MERGE | Samodzielne wsparcie, asystent, mock i CSS. Zachowano asystenta i jego odpowiedzi w zakładce panelu | `niepotrzebne/feature/ui-support` |
| `feature/ui-support-documents` · `0af6b4f` | 1 / 0 | ✅ ✅ ✅ ❌ ✅ | UNUSED | Integracja dokumentów i wsparcia już w main | `niepotrzebne/feature/ui-support-documents` |
| `fix/ui-date-slashes` · `c580c31` | 0 / 1 | ✅ ✅ ✅ ❌ ✅ | MERGE | `WizardPage.tsx` i test formatowania dat w kreatorze | `niepotrzebne/fix/ui-date-slashes` |
| `fix/ui-plan` · `867684f` | 0 / 3 | ✅ ✅ ✅ ❌ ✅ | MERGE | Trasy spraw, podgląd i dokumenty weszły przez `feature/ui-guide` | `niepotrzebne/fix/ui-plan` |
| `gluglam-patch-1` · `674f45d` | 49 / 0 | brak package.json | UNUSED | Zmiany README zawarte w main | `niepotrzebne/gluglam-patch-1` |

Kategoria KEEP nie ma kandydatów. Każda samodzielna gałąź używała starego kontraktu lub nie miała projektu npm. W konfliktach `App.tsx` zachowano aktualne trasy planu i dodano panel administracyjny. Przy scalaniu wsparcia zachowano aktywną trasę planu i przeniesiono istniejący asystent do zakładki. Samodzielny ekran wsparcia i drugi zestaw reguł zostały zastąpione aktywną integracją.

## 2. Sześć zakładek

| Zakładka | Status | Wynik |
|---|---|---|
| Uprawnienia | ✅ | Osobne uprawnienia i płatnicy, powody, podstawy prawne i neutralne sygnały możliwej weryfikacji |
| Kalkulator | ✅ | Okresy i odmowy, kwoty z podstawy, stawki, wcześniactwo, „Za życiem”, praca i adopcja |
| Plan urlopów | ✅ | Oś czasu i edytowalne części, walidacja puli, etatu i okresów, stan kontekstu zapisany w URL |
| Dokumenty i terminy | ✅ | Dokumenty i odbiorcy według części użytkownika, oznaczenie upływu terminu, formularz ZAM |
| Wnioski | ✅ | Edytowalne, jawnie przykładowe dane, podgląd wydruku, wniosek USC i symulacja wysyłki |
| Wsparcie | ✅ | Organizacje i linki z API, ostrzeżenia planu, symulacja PUE/eZUS i oryginalne odpowiedzi asystenta |

## 3. Decyzje ZUS a silnik

Zakresy obejmują oba dni graniczne. Łączny wymiar zasiłku macierzyńskiego dotyczy wnioskodawcy. Okresy chorobowego i części drugiego rodzica są podane osobno. Puste kwoty w decyzji oznaczają brak wartości do porównania. Streszczenia i podstawy prawne silnika mają własne brzmienie.

### case-01 · zgodność danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | SPLIT_EMPLOYER_THEN_ZUS | SPLIT_EMPLOYER_THEN_ZUS |
| `granted_rate_percent` | 81.5 | 81.5 |
| `granted_duration_days` | 532 | 532 |
| `granted_duration_weeks` | 76 | 76 |
| `benefit_base_pln` | 3710.47 | 3710.47 |
| `calculated_amount_pln` | — | 53626.19 |
| `mapped_forms_2026` | ["Z-3","ZAS-12","e-ZLA","ZAM"] | ["ZAM","Z-3","ZAS-12","e-ZLA"] |
| `decision_summary_pl` | Przyznano zasiłek chorobowy w ciąży (kod B, 100%) za 197 dni (01.04.2024–14.10.2024) z odmową za 15.10.2024–31.10.2024 z uwagi na poród. Przyznano zasiłek macierzyński w stawce 81,5% za urlop macierzyński (15.10.2024–03.03.2025, 20 tyg.) i rodzicielski (04.03.2025–13.10.2025, 32 tyg.). Decyzją z 04.12.2025 r. (autokontrola) uchylono decyzję odmowną z 05.11.2025 r. i przyznano zasiłek macierzyński za dodatkowe 24 tygodnie urlopu rodzicielskiego (14.10.2025–30.03.2026) na podstawie ustawy 'Za życiem'. | Dla wnioskodawcy wyliczono 532 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Częściowa odmowa zasiłku chorobowego za okres 15.10.2024–31.10.2024 z powodu porodu w dniu 15.10.2024 r. (zbieg z zasiłkiem macierzyńskim). Pierwotna odmowa z 05.11.2025 r. przedłużenia urlopu rodzicielskiego o 24 tygodnie wynikała z dostarczenia zaświadczeń szpitalnych pod kątem uzupełniającego urlopu macierzyńskiego (do którego brak było prawa, gdyż 19.03.2025 r. ubezpieczona przebywała już na urlopie rodzicielskim, a nie macierzyńskim) zamiast właściwego zaświadczenia 'Za życiem' z art. 4 ust. 3 ustawy (uchylona po dostarczeniu dokumentu z odwołaniem 27.11.2025 r.). | Okres zwolnienia przypada od porodu lub rozpoczęcia świadczenia macierzyńskiego. |
| `legal_basis_cited` | ["art. 92 Kodeksu pracy","art. 180 § 1 pkt 1 Kodeksu pracy","art. 182(1a) § 2 Kodeksu pracy","art. 184 Kodeksu pracy","art. 29a ust. 1 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa","art. 4 ust. 3 ustawy z dnia 4 listopada 2016 r. o wsparciu kobiet w ciąży i rodzin 'Za życiem'","ustawa z dnia 6 grudnia 2024 r. o zmianie ustawy - Kodeks pracy oraz niektórych innych ustaw","art. 83 ust. 6 ustawy z dnia 13 października 1998 r. o systemie ubezpieczeń społecznych"] | ["Ustawa zasiłkowa, art. 4, 8 i 11","Kodeks pracy, art. 180 i 180¹","Kodeks pracy, art. 182¹ᵃ–182¹ᵈ","Kodeks pracy, art. 182¹ᵃ § 2 i ustawa „Za życiem”, art. 4 ust. 3","Kodeks pracy, art. 92"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| SICKNESS · MOTHER | 2024-04-01–2024-10-14 · 197 dni · 28.1429 tyg. · 100% · etat 0 | 2024-04-01–2024-10-14 · 197 dni · 28.1429 tyg. · 100% · etat 0 | — / — / — → — / — / — |
| Segmenty kwot | 2024-04-01 / 2024-06-30 / 3660.42 / 3660.42 / 122.01<br>2024-07-01 / 2024-10-14 / 3710.47 / 3710.47 / 123.68 | 2024-04-01 / 2024-06-30 / 3660.42 / 3660.42 / 122.01<br>2024-07-01 / 2024-10-14 / 3710.47 / 3710.47 / 123.68 | Wartości segmentów to daty, podstawa, kwota za 30 dni i dzienna. |
| SICKNESS · MOTHER | 2024-10-15–2024-10-31 · 17 dni · 2.4286 tyg. · —% · etat 0 · odmowa | 2024-10-15–2024-10-31 · 17 dni · 2.4286 tyg. · —% · etat 0 · odmowa | — / — / — → 3710.47 / — / — |
| MATERNITY · MOTHER | 2024-10-15–2025-03-03 · 140 dni · 20 tyg. · 81.5% · etat 0 | 2024-10-15–2025-03-03 · 140 dni · 20 tyg. · 81.5% · etat 0 | 3710.47 / 3024.03 / 100.8 → 3710.47 / 3024.03 / 100.8 |
| PARENTAL · MOTHER | 2025-03-04–2025-10-13 · 224 dni · 32 tyg. · 81.5% · etat 0 | 2025-03-04–2025-10-13 · 224 dni · 32 tyg. · 81.5% · etat 0 | — / — / — → 3710.47 / 3024.03 / 100.8 |
| PARENTAL_ZA_ZYCIEM_EXTENSION · MOTHER | 2025-10-14–2026-03-30 · 168 dni · 24 tyg. · 81.5% · etat 0 | 2025-10-14–2026-03-30 · 168 dni · 24 tyg. · 81.5% · etat 0 | — / — / — → 3710.47 / 3024.03 / 100.8 |

Wynagrodzenie chorobowe pracodawcy · 2024-02-26–2024-03-31 · 35 dni · 5 tyg. · 100% · etat 0. Por. uwaga o 33 dniach w sekcji 5.

### case-02 · rozbieżności w danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | ZUS | ZUS |
| `granted_rate_percent` | 81.5 | 81.5 |
| `granted_duration_days` | 1001 | 1029 |
| `granted_duration_weeks` | 143 | 147 |
| `benefit_base_pln` | — | — |
| `calculated_amount_pln` | — | — |
| `mapped_forms_2026` | ["ZAM","Z-3"] | ["ZAM","Z-3"] |
| `decision_summary_pl` | Przyznano zasiłek macierzyński w stawce 81,5% za okres urlopu macierzyńskiego od 13.05.2024 do 15.12.2024 (31 tygodni / 217 dni) oraz za okres urlopu rodzicielskiego wydłużonego na podstawie ustawy 'Za życiem' (56 tygodni / 392 dni: 16.12.2024–11.01.2026) i proporcjonalnie wydłużonego o kolejne 56 tygodni (392 dni: 12.01.2026–07.02.2027) w związku z łączeniem całego urlopu oraz jego części wydłużonej z pracą na 1/2 etatu. | Dla wnioskodawcy wyliczono 1029 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Wymiar urlopu macierzyńskiego ustalono na 31 tygodni (zamiast 33 tygodni dla trojaczków) z powodu martwego urodzenia jednego z trojga dzieci (art. 180(1) § 1-2 k.p.). Wysokość zasiłku w okresie urlopu rodzicielskiego (16.12.2024–07.02.2027) jest proporcjonalnie pomniejszona o połowę z uwagi na wykonywanie pracy na 1/2 etatu. | — |
| `legal_basis_cited` | ["art. 180 § 1 pkt 2 Kodeksu pracy","art. 180(1) § 1-2 Kodeksu pracy","art. 182(1a) Kodeksu pracy","art. 182(1f) Kodeksu pracy","art. 4 ust. 3 ustawy z dnia 4 listopada 2016 r. o wsparciu kobiet w ciąży i rodzin 'Za życiem'","art. 63 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa"] | ["Kodeks pracy, art. 180 i 180¹","Kodeks pracy, art. 182¹ᵃ–182¹ᵈ","Kodeks pracy, art. 182¹ᵉ–182¹ᶠ oraz ustawa zasiłkowa, art. 31 ust. 4a"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| MATERNITY · MOTHER | 2024-05-13–2024-12-15 · 217 dni · 31 tyg. · 81.5% · etat 0 | 2024-05-13–2024-12-15 · 217 dni · 31 tyg. · 81.5% · etat 0 | — / — / — → — / — / — |
| PARENTAL · MOTHER | 2024-12-16–2026-01-11 · 392 dni · 56 tyg. · 81.5% · etat 0.5 | 2024-12-16–2026-01-25 · 406 dni · 58 tyg. · 81.5% · etat 0.5 | — / — / — → — / — / — |
| PARENTAL_WORK_EXTENSION · MOTHER | 2026-01-12–2027-02-07 · 392 dni · 56 tyg. · 81.5% · etat 0.5 | 2026-01-26–2027-03-07 · 406 dni · 58 tyg. · 81.5% · etat 0.5 | — / — / — → — / — / — |

- `granted_duration_days` · 1001 → 1029
- `granted_duration_weeks` · 143 → 147
- `periods[1].end_date` · 2026-01-11 → 2026-01-25
- `periods[1].days` · 392 → 406
- `periods[1].weeks` · 56 → 58
- `periods[2].start_date` · 2026-01-12 → 2026-01-26
- `periods[2].end_date` · 2027-02-07 → 2027-03-07
- `periods[2].days` · 392 → 406
- `periods[2].weeks` · 56 → 58

### case-03 · zgodność danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | ZUS | ZUS |
| `granted_rate_percent` | 81.5 | 81.5 |
| `granted_duration_days` | 455 | 455 |
| `granted_duration_weeks` | 65 | 65 |
| `benefit_base_pln` | 3897.37 | 3897.37 |
| `calculated_amount_pln` | — | 48174.79 |
| `mapped_forms_2026` | ["ZAM","POG","e-ZLA"] | ["ZAM","e-ZLA","POG"] |
| `decision_summary_pl` | Wypłacono zasiłek chorobowy w ciąży (100%) od 27.09.2024 do 08.01.2025 (104 dni) oraz przyznano zasiłek macierzyński w stawce 81,5% za łączny okres 65 tygodni (455 dni) od 09.01.2025 do 08.04.2026: 31 tygodni (217 dni) urlopu macierzyńskiego z tytułu urodzenia bliźniąt (09.01.2025–13.08.2025) oraz 34 tygodnie (238 dni) urlopu rodzicielskiego (14.08.2025–08.04.2026). | Dla wnioskodawcy wyliczono 455 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Wypłatę zasiłku chorobowego zakończono z dniem 08.01.2025 r. (mimo wystawionego eZLA do 10.02.2025 r.), ponieważ ubezpieczona wystąpiła o zasiłek macierzyński przed porodem (od 09.01.2025 r., tj. 6 dni przed urodzeniem bliźniąt w dniu 15.01.2025 r.). | Okres zwolnienia przypada od porodu lub rozpoczęcia świadczenia macierzyńskiego. |
| `legal_basis_cited` | ["art. 180 § 1 pkt 2 Kodeksu pracy","art. 180 § 2 Kodeksu pracy","art. 182(1a) § 1 pkt 2 Kodeksu pracy","art. 29a ust. 1 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa"] | ["Ustawa zasiłkowa, art. 4, 8 i 11","Kodeks pracy, art. 180 i 180¹","Kodeks pracy, art. 182¹ᵃ–182¹ᵈ"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| SICKNESS · MOTHER | 2024-09-27–2025-01-08 · 104 dni · 14.8571 tyg. · 100% · etat 0 | 2024-09-27–2025-01-08 · 104 dni · 14.8571 tyg. · 100% · etat 0 | 3897.37 / 3897.37 / 129.91 → 3897.37 / 3897.37 / 129.91 |
| SICKNESS · MOTHER | 2025-01-09–2025-02-10 · 33 dni · 4.7143 tyg. · —% · etat 0 · odmowa | 2025-01-09–2025-02-10 · 33 dni · 4.7143 tyg. · —% · etat 0 · odmowa | — / — / — → 3897.37 / — / — |
| MATERNITY · MOTHER | 2025-01-09–2025-08-13 · 217 dni · 31 tyg. · 81.5% · etat 0 | 2025-01-09–2025-08-13 · 217 dni · 31 tyg. · 81.5% · etat 0 | 3897.37 / 3176.36 / 105.88 → 3897.37 / 3176.36 / 105.88 |
| PARENTAL · MOTHER | 2025-08-14–2026-04-08 · 238 dni · 34 tyg. · 81.5% · etat 0 | 2025-08-14–2026-04-08 · 238 dni · 34 tyg. · 81.5% · etat 0 | 3897.37 / 3176.36 / 105.88 → 3897.37 / 3176.36 / 105.88 |

### case-04 · zgodność danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | ZUS | ZUS |
| `granted_rate_percent` | 81.5 | 81.5 |
| `granted_duration_days` | 679 | 679 |
| `granted_duration_weeks` | 97 | 97 |
| `benefit_base_pln` | — | — |
| `calculated_amount_pln` | — | — |
| `mapped_forms_2026` | ["Z-3","POG","ZAM"] | ["ZAM","Z-3","POG"] |
| `decision_summary_pl` | Zawiadomieniem z 03.09.2025 r. przyznano zasiłek macierzyński w stawce 81,5% za podstawowy urlop macierzyński dla bliźniąt (31 tygodni / 217 dni: 20.07.2025–21.02.2026), odkładając rozstrzygnięcie w zakresie uzupełniającego urlopu macierzyńskiego oraz urlopu rodzicielskiego do czasu wypisu dzieci ze szpitala. Po dostarczeniu kart wypisowych ze szpitala (hospitalizacja powyżej 8 tygodni przy urodzeniu po ukończeniu 28. tyg. ciąży z masą > 1000 g) oraz zaświadczeń 'Za życiem' dla obu córek, przysługuje 8 tygodni (56 dni: 22.02.2026–18.04.2026) uzupełniającego urlopu macierzyńskiego oraz 58 tygodni (406 dni: 19.04.2026–29.05.2027) urlopu rodzicielskiego (67 tygodni puli minus 9 tygodni dla ojca ubezpieczonego w KRUS). | Dla wnioskodawcy wyliczono 679 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Czasowe wstrzymanie ustalenia prawa do uzupełniającego urlopu macierzyńskiego i urlopu rodzicielskiego w zawiadomieniu z 03.09.2025 r. do momentu zakończenia hospitalizacji noworodków i przedłożenia zaświadczeń szpitalnych. | — |
| `legal_basis_cited` | ["art. 180 § 1 pkt 2 Kodeksu pracy","art. 180(2) § 1 pkt 2 Kodeksu pracy","art. 182(1a) § 2 pkt 2 i § 4 Kodeksu pracy","art. 184 Kodeksu pracy","art. 29a ust. 1 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa","art. 4 ust. 3 ustawy z dnia 4 listopada 2016 r. o wsparciu kobiet w ciąży i rodzin 'Za życiem'","ustawa z dnia 6 grudnia 2024 r. o zmianie ustawy - Kodeks pracy oraz niektórych innych ustaw"] | ["Kodeks pracy, art. 180 i 180¹","Kodeks pracy, art. 180²","Kodeks pracy, art. 182¹ᵃ–182¹ᵈ"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| MATERNITY · MOTHER | 2025-07-20–2026-02-21 · 217 dni · 31 tyg. · 81.5% · etat 0 | 2025-07-20–2026-02-21 · 217 dni · 31 tyg. · 81.5% · etat 0 | — / — / — → — / — / — |
| SUPPLEMENTARY_MATERNITY · MOTHER | 2026-02-22–2026-04-18 · 56 dni · 8 tyg. · 100% · etat 0 | 2026-02-22–2026-04-18 · 56 dni · 8 tyg. · 100% · etat 0 | — / — / — → — / — / — |
| PARENTAL · MOTHER | 2026-04-19–2027-05-29 · 406 dni · 58 tyg. · 81.5% · etat 0 | 2026-04-19–2027-05-29 · 406 dni · 58 tyg. · 81.5% · etat 0 | — / — / — → — / — / — |
| PARENTAL · FATHER | 2027-05-30–2027-07-31 · 63 dni · 9 tyg. · 70% · etat 0 | 2027-05-30–2027-07-31 · 63 dni · 9 tyg. · 70% · etat 0 | — / — / — → — / — / — |

### case-05 · zgodność danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | ZUS | ZUS |
| `granted_rate_percent` | 81.5 | 81.5 |
| `granted_duration_days` | 378 | 378 |
| `granted_duration_weeks` | 54 | 54 |
| `benefit_base_pln` | — | — |
| `calculated_amount_pln` | — | — |
| `mapped_forms_2026` | ["ZAM"] | ["ZAM"] |
| `decision_summary_pl` | Przyznano zasiłek macierzyński w stawce 81,5% za łączny okres 54 tygodni (378 dni) od 01.12.2025 do 13.12.2026: 20 tygodni (140 dni) urlopu macierzyńskiego (01.12.2025–19.04.2026), 2 tygodnie (14 dni) uzupełniającego urlopu macierzyńskiego z tytułu 8-dniowego pobytu noworodka w szpitalu (20.04.2026–03.05.2026) oraz 32 tygodnie (224 dni) urlopu rodzicielskiego (04.05.2026–13.12.2026). | Dla wnioskodawcy wyliczono 378 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Skorygowano wymiar uzupełniającego urlopu macierzyńskiego z błędnie wnioskowanych 8 tygodni (pierwotny wniosek do 24.01.2027 r.) do prawidłowych 2 tygodni (wniosek skorygowany do 13.12.2026 r.), ponieważ dziecko urodzone o czasie (masa 2350 g) przebywało w szpitalu 8 dni (01.12.2025–08.12.2025), co daje 2 tygodnie urlopu uzupełniającego (1 tydzień za każdy rozpoczęty tydzień pobytu w szpitalu). | — |
| `legal_basis_cited` | ["art. 180 § 1 pkt 1 Kodeksu pracy","art. 180(2) § 1 pkt 3 i § 2 Kodeksu pracy","art. 182(1a) Kodeksu pracy","art. 29a ust. 1 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa"] | ["Kodeks pracy, art. 180 i 180¹","Kodeks pracy, art. 180²","Kodeks pracy, art. 182¹ᵃ–182¹ᵈ"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| MATERNITY · MOTHER | 2025-12-01–2026-04-19 · 140 dni · 20 tyg. · 81.5% · etat 0 | 2025-12-01–2026-04-19 · 140 dni · 20 tyg. · 81.5% · etat 0 | — / — / — → — / — / — |
| SUPPLEMENTARY_MATERNITY · MOTHER | 2026-04-20–2026-05-03 · 14 dni · 2 tyg. · 100% · etat 0 | 2026-04-20–2026-05-03 · 14 dni · 2 tyg. · 100% · etat 0 | — / — / — → — / — / — |
| PARENTAL · MOTHER | 2026-05-04–2026-12-13 · 224 dni · 32 tyg. · 81.5% · etat 0 | 2026-05-04–2026-12-13 · 224 dni · 32 tyg. · 81.5% · etat 0 | — / — / — → — / — / — |

### case-06 · rozbieżności w danych porównywanych

| Pole | Decyzja / tabela zespołu | Silnik |
|---|---|---|
| `is_qualified` | tak | tak |
| `who_pays` | ZUS | ZUS |
| `granted_rate_percent` | 70 | 70 |
| `granted_duration_days` | 103 | 103 |
| `granted_duration_weeks` | — | — |
| `benefit_base_pln` | 4748.19 | 4748.19 |
| `calculated_amount_pln` | — | 11411.49 |
| `mapped_forms_2026` | ["ZAM","POG"] | ["ZAM","POG"] |
| `decision_summary_pl` | Przyznano wypłatę zasiłku macierzyńskiego za okres urlopu rodzicielskiego w stawce 70% w dwóch częściach z puli 32 tygodni: od 20.09.2026 do 31.10.2026 (42 dni) oraz od 01.11.2026 do 31.12.2026 (61 dni), łącznie 103 dni. | Dla wnioskodawcy wyliczono 103 dni świadczenia. |
| `denial_or_reduction_reason_pl` | Stawka zasiłku wynosi 70% (zamiast 81,5%), ponieważ wniosek o urlop rodzicielski został złożony po upływie 21 dni od porodu (dziecko urodzone 20.07.2023 r., brak pobierania zasiłku macierzyńskiego bezpośrednio po porodzie). | — |
| `legal_basis_cited` | ["art. 182(1a) Kodeksu pracy","art. 182(1c) Kodeksu pracy","art. 31 ust. 3 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa","art. 63 ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa","§ 22 ust. 1 rozporządzenia Ministra Rodziny, Pracy i Polityki Społecznej z dnia 8 grudnia 2015 r."] | ["Kodeks pracy, art. 182¹ᵃ–182¹ᵈ"] |

| Okres | Oczekiwany | Uzyskany | Podstawa / 30 dni / dzień, oczekiwane → uzyskane (PLN) |
|---|---|---|---|
| PARENTAL · MOTHER | 2026-09-20–2026-10-31 · 42 dni · 6 tyg. · 70% · etat 0 | 2026-09-20–2026-10-31 · 42 dni · 6 tyg. · 70% · etat 0 | 4748.19 / 3323.73 / 110.79 → 4748.19 / 3323.74 / 110.79 |
| PARENTAL · MOTHER | 2026-11-01–2026-12-31 · 61 dni · 8.7143 tyg. · 70% · etat 0 | 2026-11-01–2026-12-31 · 61 dni · 8.7143 tyg. · 70% · etat 0 | 4748.19 / 3323.73 / 110.79 → 4748.19 / 3323.74 / 110.79 |

Pula indywidualna 32 → 32 tygodni. Termin wykorzystania 2029-12-31 → 2029-12-31.

- `periods[0].monthly_amount_pln` · 3323.73 → 3323.74
- `periods[1].monthly_amount_pln` · 3323.73 → 3323.74

## 4. Kontrakt

- `CaseInputs` obejmuje pola źródłowe, daty porodu, wniosku u płatnika, e-ZLA i hospitalizacji, wagi, aktualną liczbę żyjących dzieci, historię podstaw, drugi tytuł ubezpieczenia, części urlopu, adopcję i sygnały ryzyka.
- `CaseOutcome` obejmuje wynik decyzji, procentowe stawki, podstawę, okresy i segmenty kwot, alternatywne warianty, ostrzeżenia i terminy puli.
- `CasePlan` udostępnia wynik, uprawnienia, dokumenty, błędy walidacji i zasoby wsparcia w jednej odpowiedzi.
- `GET /cases`, `GET /cases/:caseId`, `POST /cases/:caseId/evaluate` obsługują sześć spraw. `POST /plan` liczy zakładki. Ścieżki obliczeń i dokumentów korzystają z tego samego planu.
- Koperta `{ data, error }` pozostała wspólna. Przeglądarka przechodzi ze szkicu kreatora do kontraktu sprawy przed wysłaniem żądania.
- Konfiguracja techniczna `BenefitParams` zachowuje współczynniki używane w obliczeniach. Wyniki REST mają stawki procentowe. Historyczne testy wcześniejszych reguł zachowano obok testów kanonicznego silnika.

## 5. Ograniczenia i tematy do potwierdzenia

- **case-01**. Od 26.02 do 31.03.2024 mija 35 dni kalendarzowych włącznie. Opis sprawy podaje 33 dni wynagrodzenia. Datę początku zasiłku ZUS 01.04 pozostawiono jako udokumentowaną granicę. Ustalenie rozkładu 33 dni wymaga dodatkowej informacji.
- **case-02**. Dwoje żywych dzieci i „Za życiem” dają 67 tygodni wspólnie, czyli 58 tygodni dla matki. Po łączeniu całego rodzicielskiego z pracą na pół etatu otrzymujemy 116 tygodni rodzicielskiego, łącznie 147 tygodni i 1029 dni. ZUS wskazał 143 tygodnie i 1001 dni. Test decyzji jest oznaczony `it.fails`, a ustawowy wynik ma osobną asercję. [Ministerstwo Rodziny – urlop rodzicielski](https://www.gov.pl/web/rodzina/urlop-rodzicielski)
- **case-04**. Zakres hospitalizacji opiera się na dolnym ograniczeniu z notatek, ponad 15 tygodni. Do uzyskania limitu 8 tygodni wystarcza pobyt obejmujący ustawowy przedział. Formularz 81,5% z 04.08 u pracodawcy ma pierwszeństwo przed datą przekazania Z-3, 12.08. Dane z notatki o KRUS pozostawiono jako kontekst sprawy. Brak podstawy i płatnika w kontrakcie ZUS dla części ojca jest widoczny jako „Do ustalenia”. [ZUS – urlop uzupełniający](https://bip.zus.pl/pl/web/guest/swiadczenia/zasilki/zasilek-macierzynski/prawo-do-zasilku-i-okres-przyslugiwania/za-okres-uzupelniajacego-urlopu-macierzynskiego)
- **case-05**. Data 10.12 jest dziewiątym dniem po porodzie 01.12. Pole pomocnicze dostarczone w opisie ma wartość 15. Obie wartości mieszczą się w oknie 21 dni. Przyjęto rzeczywistą różnicę dat.
- **case-06**. Podstawa po przeliczeniu wynosi 4748,19354 zł. 70% to 3323,735478 zł, czyli 3323,74 zł po zaokrągleniu na wyjściu. Tabela zespołu podaje 3323,73 zł. Stawka dzienna pozostaje 110,79 zł. Do potwierdzenia dokładny moment zaokrąglenia oczekiwany przez ZUS.
- **Podstawa minimalna**. Materiał konkursowy pozostawia pustą tabelę. Dla kwot podanych w decyzjach i ich odtworzenia wykorzystano znane podstawy lub średnią z udokumentowanych miesięcy. Wymiar etatu i historyczny próg do zasad minimalnej podstawy wymagają dodatkowych danych i potwierdzenia przed użyciem poza demo.
- **Terminy poza UoP**. Kodeksowy termin 21 dni przed rodzicielskim i 7 dni przed ojcowskim dotyczy pracowników. Na potrzeby wniosków o zasiłek B2B dokumenty wskazują początek wnioskowanego okresu. W sprawie 06 wniosek B2B złożono 3 dni przed początkiem. [PIP – rodzicielstwo](https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo)
- **Formularze**. Użyj aktualnego ZAM zamiast wycofanych ZUR, ZAO i Z-3b. [ZUS – uproszczenia w zasiłkach](https://www.zus.pl/-/kolejne-uproszczenia-w-zasi%C5%82kach)
- **Sygnały „dla pozoru”**. W sprawach 1–6 żadne z dostępnych danych nie spełniają warunków. Sprawy 03 i 05 mają datę tytułu sprzed ciąży i ponad 6 miesięcy przed zdarzeniem. Tytuł sprawy 06 powstał po porodzie, ponad 6 miesięcy przed wnioskiem. Pozostałe nie podają daty tytułu. Znane zmiany podstaw nie sięgają 30%, a żadna sprawa nie podaje zatrudnienia w rodzinie ani nowego stanowiska. Test dodatni sprawdza wszystkie trzy sygnały oraz brak zmiany kwalifikacji. Podstawa prawna heurystyk ma wartość `null`.
- **Asystent**. Zachowano etykietę „Wspierane przez AI” przy odpowiedziach z demonstracyjnej bazy. Odpowiedzi są regułowe, a źródła pochodzą z dotychczasowej implementacji.
- **Dane**. Dane osobowe w edytorze wniosków i treść symulacji PUE istnieją w pamięci interfejsu. Adres edytowanego planu zawiera dane scenariusza, w tym daty i podstawy. Dane testowe zawierają tylko zanonimizowane parametry i tytuły. Surowe dane oraz materiały źródłowe są ignorowane.
- **Znana granica symulacji**. Pełne uprawnienia przy nietypowych przerwach w ubezpieczeniu, wyliczenie dokładnej podstawy przy zmiennej strukturze wynagrodzenia i dowody kwalifikacji w indywidualnych sprawach wymagają weryfikacji danych. Panel demonstracyjny pokazuje brak kwoty, jeśli podstawa jest niedostępna.

## 6. Uruchomienie i weryfikacja

Z katalogu `zus-przewodnik-starter`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, a potem `npm run dev`.

- `GET /api/v1/health` zwrócił status `ok`. Domyślne porty były zajęte, więc uruchomiono `npm run dev` z `PORT=3301` i `VITE_PORT=5276`.
- Chrome, 375 i 1280 px. Zweryfikowano 72 widoki, 6 spraw × 6 zakładek × 2 szerokości, po przejściu z katalogu `/cases`. Brak błędów konsoli, błędów HTTP i przewijania poziomego.
- Test zmiany części ojca w sprawie 04 potwierdził termin 19.10.2027 oraz zgodny okres w podglądzie wniosku. Testy regresji pokrywają przepływ danych i lokalną edycję pól formularza.

Wartością demonstracji jest przekład zasad świadczeń na terminy i gotowe wzory dla każdego rodzica. Zmiana harmonogramu aktualizuje wszystkie zależne widoki, co ogranicza ryzyko skorzystania ze starej daty.

## 7. Kopie zapasowe

Użyj `git fetch origin --tags`, a następnie `git branch <nazwa> <tag>` do odtworzenia wybranej gałęzi lokalnie.

- `backup/20261121-1851/JedrzejMikolajczak-patch-1`
- `backup/20261121-1851/bchochoool-patch-1`
- `backup/20261121-1851/checkout1`
- `backup/20261121-1851/codex/kalkulator`
- `backup/20261121-1851/feature/admin-panel`
- `backup/20261121-1851/feature/ui-cases`
- `backup/20261121-1851/feature/ui-clarity`
- `backup/20261121-1851/feature/ui-documents`
- `backup/20261121-1851/feature/ui-guide`
- `backup/20261121-1851/feature/ui-leave-calendar`
- `backup/20261121-1851/feature/ui-plan`
- `backup/20261121-1851/feature/ui-support`
- `backup/20261121-1851/feature/ui-support-documents`
- `backup/20261121-1851/fix/ui-date-slashes`
- `backup/20261121-1851/fix/ui-plan`
- `backup/20261121-1851/gluglam-patch-1`
- `backup/20261121-1851/main`
