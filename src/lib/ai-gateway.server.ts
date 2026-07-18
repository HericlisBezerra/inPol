// Google Gemini helpers (server-only).
// Uses the OpenAI-compatible /v1beta/openai/chat/completions endpoint with GEMINI_API_KEY.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Model ids centralizados. Os `gemini-2.5-*` foram descontinuados para chaves
// novas (404 "not available to new users") — não reintroduzir.
// FLASH: alto volume (análise, busca). PRO: relatórios executivos.
export const MODEL_FLASH = "gemini-3.5-flash";
export const MODEL_PRO = "gemini-3.1-pro-preview";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AiCallOptions {
  model?: string;
  /** Ordered fallback models tried when the primary fails (transient errors or model
   *  unavailability). Ex.: MODEL_PRO with fallbackModels [MODEL_FLASH]. */
  fallbackModels?: string[];
  messages: AiMessage[];
  jsonObject?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Per-attempt timeout (ms). Default 60s. */
  timeoutMs?: number;
  /** Attempts per model before moving to the next fallback. Default 3. */
  maxAttempts?: number;
}

// HTTP statuses worth retrying on the same model (rate limit / transient server errors).
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AiResult {
  text: string;
  raw: unknown;
  model: string;
}

export class AiGatewayError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** One HTTP attempt against a single model. Throws AiGatewayError (status 0 = network/timeout). */
async function callAiOnce(model: string, apiKey: string, opts: AiCallOptions): Promise<AiResult> {
  const body: Record<string, unknown> = { model, messages: opts.messages };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.jsonObject) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    // Network error or timeout (abort) — treat as transient (status 0).
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new AiGatewayError(
      0,
      aborted ? "Tempo de resposta da IA esgotado." : "Falha de rede na chamada de IA.",
      e,
    );
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 429
        ? "Limite de chamadas à IA atingido. Tente novamente em instantes."
        : res.status === 401 || res.status === 403
          ? "Chave da API do Gemini inválida ou sem permissão."
          : res.status === 400
            ? "Requisição inválida para a API do Gemini."
            : `Falha na chamada de IA (HTTP ${res.status}).`;
    throw new AiGatewayError(res.status, message, raw);
  }

  const choice = (raw as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0];
  const text = choice?.message?.content ?? "";
  return { text, raw, model };
}

/**
 * Resilient AI call: tries the primary model then each fallback model, retrying transient
 * failures (429 / 5xx / network / timeout) with exponential backoff. Auth errors (401/403)
 * fail fast; model-specific errors (400/404 — e.g. a preview model deprecated) skip straight
 * to the next fallback model. This is what keeps analysis and reports from dying on a blip.
 */
export async function callAi(opts: AiCallOptions): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiGatewayError(500, "GEMINI_API_KEY não está configurada.");
  }
  const models = [opts.model ?? MODEL_FLASH, ...(opts.fallbackModels ?? [])];
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await callAiOnce(model, apiKey, opts);
      } catch (e) {
        lastError = e;
        const status = e instanceof AiGatewayError ? e.status : 0;
        if (status === 401 || status === 403) throw e; // key problem — no retry, no fallback helps
        const transient = status === 0 || TRANSIENT_STATUS.has(status);
        if (transient && attempt < maxAttempts) {
          await sleep(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
          continue; // retry same model
        }
        break; // exhausted retries, or non-transient (400/404) — try next fallback model
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AiGatewayError(500, "Falha na chamada de IA após tentativas e fallbacks.");
}

export async function callAiJson<T>(opts: AiCallOptions): Promise<T> {
  const result = await callAi({ ...opts, jsonObject: true });
  try {
    return JSON.parse(result.text) as T;
  } catch {
    // Fallback: remove code fences (```json ... ```) e extrai o primeiro valor
    // JSON balanceado — modelos preview às vezes anexam um `}`/`]` extra depois
    // do fechamento, o que quebra o JSON.parse estrito.
    const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(extractBalancedJson(cleaned)) as T;
  }
}

// Extrai o primeiro objeto/array JSON balanceado, ignorando qualquer texto
// antes do primeiro `{`/`[` e depois do fechamento correspondente. Respeita
// strings e escapes para não contar chaves dentro de aspas.
function extractBalancedJson(input: string): string {
  const start = input.search(/[{[]/);
  if (start < 0) return input;
  const open = input[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return input.slice(start);
}
