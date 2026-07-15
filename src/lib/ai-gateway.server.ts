// Google Gemini helpers (server-only).
// Uses the OpenAI-compatible /v1beta/openai/chat/completions endpoint with GEMINI_API_KEY.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

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
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function callAi(opts: AiCallOptions): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiGatewayError(500, "GEMINI_API_KEY não está configurada.");
  }
  const model = opts.model ?? "gemini-2.5-flash";
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
    // Strip code fences if model returned ```json ... ```
    const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  }
}
