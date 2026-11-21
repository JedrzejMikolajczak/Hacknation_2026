import type { AssistantAnswer, BenefitParams } from '../types';

export function buildDemoAssistantAnswer(
  rawQuestion: string,
  params: BenefitParams,
): AssistantAnswer {
  const q = rawQuestion.toLowerCase();

  if (q.includes('81,5') || q.includes('81.5') || q.includes('spóźni') || q.includes('wnios')) {
    return {
      answer: `Wniosek o wypłatę zasiłku w wysokości ${Math.round(params.rates.combined * 1000) / 10}% za cały okres trzeba złożyć najpóźniej w ciągu ${params.combinedRateApplicationDeadlineDays} dni po porodzie. Jeśli spóźnisz się choćby o jeden dzień, otrzymasz ${Math.round(params.rates.maternity * 100)}% za urlop macierzyński oraz ${Math.round(params.rates.parental * 100)}% za urlop rodzicielski. Uwaga: 9 tygodni drugiego rodzica w obu wariantach jest płatne ${Math.round(params.rates.secondParentNonTransferableInCombined * 100)}%.`,
      sources: ['Poradnik dla rodziców ZUS 2026', 'Ustawa zasiłkowa art. 30a'],
    };
  }

  if (q.includes('dług') || q.includes('działalnoś') || q.includes('jdg') || q.includes('zaległ')) {
    const threshold =
      Math.round(
        params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
      ) / 100;
    return {
      answer: `Przy własnej działalności gospodarczej zadłużenie przekraczające 1% płacy minimalnej (obecnie ok. ${threshold.toFixed(2).replace('.', ',')} zł) w dniu powstania prawa do zasiłku wstrzymuje wypłatę. Prawo do zasiłku nie przepada na stałe — po całkowitej spłacie zadłużenia ZUS uruchomi wypłatę (jeśli uregulujesz dług w ciągu 6 miesięcy od powstania prawa).`,
      sources: ['Ustawa zasiłkowa art. 2a', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  if (q.includes('umow') || q.includes('kończy') || q.includes('ciąży')) {
    return {
      answer:
        'Jeśli pracujesz na umowę o pracę na czas określony, która kończyłaby się po upływie 3. miesiąca ciąży, umowa automatycznie przedłuża się do dnia porodu. W dniu porodu podlegasz więc ubezpieczeniu i ZUS wypłaci Ci zasiłek macierzyński również po zakończeniu umowy.',
      sources: ['Kodeks pracy art. 177 § 3', 'Ustawa zasiłkowa art. 29'],
    };
  }

  if (q.includes('ojc') || q.includes('tata') || q.includes('nie pracowała')) {
    return {
      answer: `Jeśli mama nie podlega ubezpieczeniu chorobowemu, ale ubezpieczony jest tata, może on skorzystać z urlopu ojcowskiego (${params.paternityLeave.weeks} tyg. do 12. miesiąca życia dziecka, płatne 100%) oraz z urlopu rodzicielskiego. Ponadto matka bez ubezpieczenia w ZUS może ubiegać się w gminie o świadczenie rodzicielskie (tzw. Kosiniakowe).`,
      sources: ['Kodeks pracy art. 182^1a i 182^3', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  if (q.includes('wcześni') || q.includes('szpital') || q.includes('uzupełniając')) {
    return {
      answer:
        'Rodzicom wcześniaków oraz dzieci wymagających dłuższej hospitalizacji po narodzinach przysługuje uzupełniający urlop macierzyński płatny 100%. Przysługuje 1 tydzień za każdy tydzień pobytu dziecka w szpitalu — maksymalnie do 8 lub 15 tygodni, zależnie od tygodnia ciąży i masy urodzeniowej.',
      sources: ['Kodeks pracy art. 180^2', 'Poradnik dla rodziców ZUS 2026'],
    };
  }

  return {
    answer:
      'Na podstawie zasad ZUS na 2026 rok możesz sprawdzić w swoim planie przysługujące urlopy: macierzyński (od 20 do 37 tyg., 100%), rodzicielski (41 lub 43 tyg., w tym po 9 tyg. wyłącznie dla każdego rodzica) oraz ojcowski (2 tyg.). Jeśli Twoje pytanie dotyczy konkretnej sytuacji z umowy lub działalności, porównaj swoje dane w zakładkach Uprawnienia i Dokumenty lub skonsultuj sprawę na e-wizycie w ZUS.',
    sources: ['Poradnik dla rodziców ZUS 2026', 'Kodeks pracy art. 180–182^3'],
  };
}
