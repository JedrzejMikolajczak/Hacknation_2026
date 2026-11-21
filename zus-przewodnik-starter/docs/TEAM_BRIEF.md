# Na czym polega nasz projekt (dla całego zespołu)

Hej! Żebyśmy wszyscy nadawali na tych samych falach, tak wygląda nasz projekt na HackNation:

**Wyzwanie:** ZUS – „Zasiłkowy Przewodnik Przyszłego Rodzica”.

**Problem:** przyszli rodzice nie wiedzą, jakie zasiłki im przysługują, ile dostaną i co, gdzie i kiedy złożyć. Przez to tracą pieniądze, składają złe dokumenty albo są zaskoczeni decyzją ZUS.

**Co budujemy:** responsywną aplikację webową (React + Express, TypeScript), która w kilku krokach:
1. pyta o sytuację: forma zatrudnienia, data porodu, liczba dzieci, okoliczności szczególne, drugi rodzic;
2. mówi, co przysługuje, a co nie i dlaczego (zasiłek chorobowy w ciąży, zasiłek macierzyński za każdy rodzaj urlopu);
3. liczy, ile i jak długo: okresy z datami i kwoty, porównanie wariantu 100% + 70% z wariantem 81,5%, podział urlopu między rodziców, łączenie urlopu z pracą, adopcja;
4. podpowiada, jakie dokumenty, gdzie (pracodawca czy ZUS) i do kiedy złożyć, oraz ostrzega przed ryzykami;
5. pozwala „wypełnić i wysłać” wnioski.

**Ważne:**
- Logowanie mObywatelem, dane z ZUS, e-ZLA i PUE są **tylko symulowane**. Nie integrujemy się z niczym prawdziwym.
- **Jury sprawdzi nasze wyliczenia na przykładowych sprawach ZUS.** Poprawne liczby to nasz priorytet nr 1. Ładny UI z błędnymi kwotami przegrywa.
- Wszystkie liczby (tygodnie, stawki %, limity) są w jednym pliku `shared/params.json`. Nikt nie wpisuje ich w kod. Dzięki temu panel admina może je zmieniać, a ZUS łatwo by to wdrożył.
- Nazwy w kodzie bierzemy ze słownika w `agents/CONVENTIONS.md`, a typy z `shared/types.ts`. Każdy agent AI (Claude, Gemini, ChatGPT) dostaje te same pliki, żeby kod się zgadzał przy łączeniu.

**Podział:**
- **Osoba 1:** treści przewodnika + prezentacja, film i opis projektu.
- **Osoba 2:** UI/UX: kreator, ekrany, responsywność.
- **Osoba 3:** symulacja mObywatela i danych z ZUS, świadczenia w ciąży, wnioski.
- **Osoba 4:** backend (REST API), parametry, panel admina, deploy.
- **Osoba 5:** kalkulator zasiłku macierzyńskiego, plan urlopów, łączenie z pracą, adopcja.
- **Osoba 6:** podstawa wymiaru zasiłku + przykładowe sprawy ZUS (testy zgodności).

**Git:**
- Każdy feature to osobny branch `feature/<obszar>-<opis>`, zawsze od najnowszego checkpointu.
- Nikt nie pushuje do `main` ani do `checkN`.
- **Co 2–3 godziny integracja:** łączymy gotowe branche w `check1`, `check2`, … Jeśli wszystko przechodzi testy, przesuwamy na `main`, a potem każdy dociąga zmiany do swojego brancha.
- Nieskończony branch czeka na kolejny checkpoint. Lepiej mniej, ale działające.
- Zmiana typów, `params.json` albo ścieżek API tylko po ogłoszeniu na grupie.

**Materiały ZUS** (przykładowe sprawy, poradnik, przepisy) są tylko do użytku na hackathonie. **Nie wrzucamy ich do repo.** Leżą lokalnie w `docs/zus/`, a ten folder jest w `.gitignore`.

Start: przeczytajcie `README.md`, a potem `agents/CONVENTIONS.md`. Pytania wrzucajcie na grupę albo do sekcji „Otwarte kwestie” w `CONVENTIONS.md`.
