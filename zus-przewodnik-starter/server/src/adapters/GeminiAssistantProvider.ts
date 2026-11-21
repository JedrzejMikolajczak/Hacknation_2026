import type { AssistantAnswer, BenefitParams } from '@shared/types';
import { buildDemoAssistantAnswer } from '@shared/engine/assistantAnswers';

export interface AssistantPlanContext {
  stage?: string;
  employment_type?: string;
  applicant_role?: string;
  co_parenting?: boolean;
  children_count?: number;
  who_pays?: string | null;
  applied_payment_variant?: string;
  is_qualified?: boolean;
  has_b2b_arrears?: boolean | null;
  debt_amount_pln?: number | null;
  warning_codes?: string[];
  difficult_case?: boolean;
}

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantAskRequest {
  question: string;
  context?: AssistantPlanContext;
  history?: AssistantHistoryTurn[];
}

export interface AssistantReply extends AssistantAnswer {
  is_demo_fallback: boolean;
  model?: string;
}

export interface AssistantProvider {
  isConfigured(): boolean;
  ask(request: AssistantAskRequest, params: BenefitParams): Promise<AssistantReply>;
}

interface GeminiResponsePayload {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 20_000;

function formatRatePercent(rate: number): string {
  return `${(Math.round(rate * 1000) / 10).toString().replace('.', ',')}%`;
}

function buildSystemInstruction(params: BenefitParams, context?: AssistantPlanContext): string {
  const debtThreshold =
    Math.round(
      params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
    ) / 100;

  const rules = [
    'Jesteś pomocnym, rzeczowym asystentem AI w aplikacji „Zasiłkowy Przewodnik Przyszłego Rodzica” (ZUS 2026).',
    'Odpowiadasz WYŁĄCZNIE po polsku, zwięźle i zrozumiale dla rodziców (bez zbędnego żargonu prawniczego, maksymalnie kilka krótkich akapitów lub krótkie punkty).',
    'Opieraj się na polskich przepisach (Kodeks pracy, Ustawa zasiłkowa z 25.06.1999 r., Poradnik dla rodziców ZUS 2026, Rozporządzenie MRPiPS z 11.03.2025 r. poz. 322, Rozporządzenie z 2026 r. poz. 1316) oraz na aktualnych parametrach systemu:',
    `- Urlop macierzyński: ${params.maternityLeave.weeksByChildrenCount['1']} tyg. (1 dziecko), ${params.maternityLeave.weeksByChildrenCount['2']} (2), ${params.maternityLeave.weeksByChildrenCount['3']} (3), ${params.maternityLeave.weeksByChildrenCount['4']} (4), ${params.maternityLeave.weeksByChildrenCount['5']} (5+); do ${params.maternityLeave.maxWeeksBeforeBirth} tyg. przed porodem; ${params.maternityLeave.motherMandatoryWeeksAfterBirth} tyg. po porodzie obowiązkowo dla matki (lub ${params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate} tyg. przy niezdolności do samodzielnej egzystencji / szpitalu).`,
    `- Urlop rodzicielski: ${params.parentalLeave.weeksSingleChild} tyg. (1 dziecko), ${params.parentalLeave.weeksMultipleChildren} tyg. (2+); z zaświadczeniem „Za życiem” ${params.parentalLeave.weeksSingleChildZaZyciem}/${params.parentalLeave.weeksMultipleChildrenZaZyciem} tyg.; po ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. nieprzenoszalnych dla każdego rodzica; maks. ${params.parentalLeave.maxParts} części do końca roku ukończenia ${params.parentalLeave.deadlineChildTurnsAgeYears} lat; łączenie z pracą do ${Math.round(params.parentalLeave.maxWorkTimeFraction * 100)}% etatu wydłuża urlop proporcjonalnie.`,
    `- Urlop ojcowski: ${params.paternityLeave.weeks} tyg. (maks. ${params.paternityLeave.maxParts} części), do ukończenia ${params.paternityLeave.deadlineChildAgeMonths} mies. życia dziecka; wniosek min. ${params.applicationDeadlinesDays.paternityLeave} dni przed startem.`,
    `- Uzupełniający urlop macierzyński (wcześniaki / hospitalizacja noworodka): 100%, 1 tydzień za każdy tydzień pobytu w szpitalu, do 8 lub 15 tyg.; wniosek najpóźniej ${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed końcem macierzyńskiego.`,
    `- Stawki zasiłku: macierzyński ${formatRatePercent(params.rates.maternity)}, rodzicielski ${formatRatePercent(params.rates.parental)}, wariant łączny ${formatRatePercent(params.rates.combined)} przy wniosku w ciągu ${params.combinedRateApplicationDeadlineDays} dni od porodu/przyjęcia (nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica zawsze ${formatRatePercent(params.rates.secondParentNonTransferableInCombined)}), chorobowy w ciąży z kodem „B” ${formatRatePercent(params.rates.sicknessPregnancy)}.`,
    `- Okres wyczekiwania na zasiłek chorobowy: ${params.sickness.waitingPeriodDaysMandatory} dni (obowiązkowe) / ${params.sickness.waitingPeriodDaysVoluntary} dni (dobrowolne); zasiłek chorobowy w ciąży do ${params.sickness.maxBenefitPeriodDays} dni; wynagrodzenie chorobowe od pracodawcy ${params.sickness.employerPaidDaysUnder50} dni (${params.sickness.employerPaidDaysFrom50} dni po 50. r.ż.).`,
    `- Płatnik świadczeń: powyżej ${params.payerThresholdInsuredCount} ubezpieczonych wypłaca pracodawca/zleceniodawca, w pozostałych przypadkach i przy JDG wypłaca ZUS (art. 61 ustawy zasiłkowej).`,
    `- JDG zadłużenie składkowe: przekroczenie 1% płacy minimalnej (${debtThreshold.toFixed(2).replace('.', ',')} zł przy płacy minimalnej ${params.benefitBase.minimumWage} zł) na dzień powstania prawa wstrzymuje wypłatę zasiłku do czasu spłaty (art. 2a ustawy zasiłkowej; spłata w ciągu 6 miesięcy odblokowuje wypłatę).`,
    `- Formularze od ${params.forms2026EffectiveDate}: ZUR i ZAO włączone do jednego wniosku ZUS ZAM; Z-3b zlikwidowany.`,
    'Zasady bezpieczeństwa i uczciwości:',
    '- Nigdy nie wymyślaj kwot ani numerów artykułów. Jeśli brakuje danych, wskaż co użytkownik powinien uzupełnić w planie albo zweryfikować w ZUS.',
    '- Zawsze pamiętaj, że odpowiedź ma charakter informacyjny i nie zastępuje oficjalnej decyzji ZUS.',
    '- Jeśli kontekst dotyczy trudnej sytuacji (strata dziecka, martwe urodzenie, ciężka choroba lub śmierć rodzica), pisz spokojnie, empatycznie, bez wykrzykników i bez gratulacji.',
    '- Zwróć WYŁĄCZNIE poprawny obiekt JSON w formacie: {"answer": "...", "sources": ["...", "..."]} gdzie "sources" to 1–4 krótkie nazwy aktów prawnych lub poradnika ZUS.',
  ];

  if (context) {
    const contextLines = ['Zanonimizowany kontekst aktualnego planu użytkownika (bez danych osobowych):'];
    if (context.stage) contextLines.push(`- Etap: ${context.stage}`);
    if (context.applicant_role) contextLines.push(`- Wnioskodawca: ${context.applicant_role}`);
    if (context.employment_type) contextLines.push(`- Tytuł ubezpieczenia: ${context.employment_type}`);
    if (typeof context.co_parenting === 'boolean')
      contextLines.push(`- Plan wspólny dwojga rodziców: ${context.co_parenting ? 'tak' : 'nie'}`);
    if (typeof context.children_count === 'number')
      contextLines.push(`- Liczba dzieci: ${context.children_count}`);
    if (context.who_pays) contextLines.push(`- Płatnik: ${context.who_pays}`);
    if (context.applied_payment_variant)
      contextLines.push(`- Wariant wypłaty: ${context.applied_payment_variant}`);
    if (typeof context.is_qualified === 'boolean')
      contextLines.push(`- Kwalifikacja do świadczeń: ${context.is_qualified ? 'tak' : 'nie'}`);
    if (context.has_b2b_arrears) {
      contextLines.push(
        `- Zaległość składkowa JDG: tak${typeof context.debt_amount_pln === 'number' ? ` (${context.debt_amount_pln} zł)` : ''}`,
      );
    }
    if (context.warning_codes && context.warning_codes.length > 0) {
      contextLines.push(`- Ostrzeżenia wykryte w planie: ${context.warning_codes.join(', ')}`);
    }
    if (context.difficult_case) {
      contextLines.push('- Uwaga: trudna sytuacja życiowa – zachowaj spokojny, taktowny ton bez wykrzykników.');
    }
    rules.push(contextLines.join('\n'));
  }

  return rules.join('\n');
}

function parseGeminiStructuredAnswer(rawText: string): AssistantAnswer | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(unfenced) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'answer' in parsed &&
      typeof parsed.answer === 'string' &&
      parsed.answer.trim().length > 0
    ) {
      const rawSources = 'sources' in parsed && Array.isArray(parsed.sources) ? parsed.sources : [];
      const sources = rawSources
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 5);
      return {
        answer: parsed.answer.trim(),
        sources: sources.length > 0 ? sources : ['Poradnik dla rodziców ZUS 2026'],
      };
    }
  } catch {
    // Model zwrócił zwykły tekst zamiast JSON – użyjemy go bezpiecznie z domyślnym źródłem.
  }

  return {
    answer: unfenced,
    sources: ['Poradnik dla rodziców ZUS 2026'],
  };
}

export interface GeminiAssistantOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class GeminiAssistantProvider implements AssistantProvider {
  private readonly explicitApiKey?: string;
  private readonly explicitModel?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GeminiAssistantOptions = {}) {
    this.explicitApiKey = options.apiKey;
    this.explicitModel = options.model;
    this.baseUrl = (options.baseUrl ?? process.env.GEMINI_API_BASE_URL ?? DEFAULT_GEMINI_BASE_URL).replace(
      /\/+$/,
      '',
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  private resolveApiKey(): string | null {
    if (this.explicitApiKey !== undefined) {
      const trimmed = this.explicitApiKey.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    // W testach jednostkowych bez jawnego klucza nie wykonujemy zapytań sieciowych do zewnętrznego API.
    if (process.env.VITEST) return null;
    const envKey = process.env.GEMINI_API_KEY?.trim();
    return envKey && envKey.length > 0 ? envKey : null;
  }

  private resolveModel(): string {
    return (
      this.explicitModel?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      DEFAULT_GEMINI_MODEL
    );
  }

  isConfigured(): boolean {
    return this.resolveApiKey() !== null;
  }

  async ask(request: AssistantAskRequest, params: BenefitParams): Promise<AssistantReply> {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return {
        ...buildDemoAssistantAnswer(request.question, params),
        is_demo_fallback: true,
      };
    }

    const model = this.resolveModel();
    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    const historyTurns = (request.history ?? []).slice(-6).map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    }));

    const payload = {
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(params, request.context) }],
      },
      contents: [
        ...historyTurns,
        {
          role: 'user',
          parts: [{ text: request.question }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            answer: { type: 'STRING' },
            sources: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['answer', 'sources'],
        },
      },
    };

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return {
          ...buildDemoAssistantAnswer(request.question, params),
          is_demo_fallback: true,
        };
      }

      const body = (await response.json()) as GeminiResponsePayload;
      const text =
        body.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('')
          .trim() ?? '';
      const parsed = parseGeminiStructuredAnswer(text);
      if (!parsed) {
        return {
          ...buildDemoAssistantAnswer(request.question, params),
          is_demo_fallback: true,
        };
      }

      return {
        ...parsed,
        is_demo_fallback: false,
        model,
      };
    } catch {
      return {
        ...buildDemoAssistantAnswer(request.question, params),
        is_demo_fallback: true,
      };
    }
  }
}
