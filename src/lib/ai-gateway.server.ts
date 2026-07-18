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
  messages: AiMessage[];
  jsonObject?: boolean;
  temperature?: number;
  maxTokens?: number;
}

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

export async function callAi(opts: AiCallOptions): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiGatewayError(500, "GEMINI_API_KEY não está configurada.");
  }
  const model = opts.model ?? MODEL_FLASH;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.jsonObject) body.response_format = { type: "json_object" };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

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
