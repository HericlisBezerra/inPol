// Google Programmable Search (Custom Search JSON API) — fallback de descoberta de URLs
// quando o Firecrawl não está configurado ou falha. Gated em GOOGLE_API_KEY + GOOGLE_CSE_ID;
// noop silencioso (com warn) se ausente ou em erro — nunca derruba o caller.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface CustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface CustomSearchResponse {
  items?: CustomSearchItem[];
}

const CUSTOM_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

// Grounding do Gemini (Google Search nativo na API) — reusa GEMINI_API_KEY, sem CSE.
// Cota free: 5.000 buscas ancoradas/mês na família 3.x → serve de buffer grátis quando o
// Firecrawl (1k/mês) esgota. É o endpoint NATIVO (generateContent), não o OpenAI-compat.
const GEMINI_NATIVE = "https://generativelanguage.googleapis.com/v1beta/models";
const GROUNDING_MODEL = "gemini-3.5-flash";

interface GroundingResponse {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
}

/**
 * Descoberta de URLs via grounding do Gemini (Google Search). Retorna [] (nunca lança) se a
 * GEMINI_API_KEY não existir ou em erro. Uso "off-label" (o grounding ancora uma resposta e
 * cita fontes) — por isso é FALLBACK, não primário: o Firecrawl `/search` tem melhor recall.
 * As URIs vêm como redirect do Google e resolvem para o artigo real ao serem raspadas.
 */
export async function groundedSearch(query: string, limit = 8): Promise<WebSearchResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const url = `${GEMINI_NATIVE}/${GROUNDING_MODEL}:generateContent?key=${apiKey}`;
  const prompt = `Liste as notícias e publicações recentes da imprensa local sobre: "${query}". Priorize conteúdo dos últimos dias, com o veículo e o título de cada uma.`;

  // grounding faz busca real + geração → costuma levar 10-15s; timeout folgado.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `groundedSearch: falha [${res.status}] para "${query}": ${body || res.statusText}`,
      );
      return [];
    }
    const j = (await res.json()) as GroundingResponse;
    const chunks = j.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const out: WebSearchResult[] = [];
    const seen = new Set<string>();
    for (const c of chunks) {
      const uri = c.web?.uri;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      out.push({ title: c.web?.title ?? uri, url: uri, snippet: c.web?.title ?? "" });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.warn(`groundedSearch: ${aborted ? "timeout" : "erro de rede"} para "${query}"`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca resultados reais via Google Custom Search JSON API. Retorna [] (nunca lança) se as
 * env vars não estiverem configuradas ou se a chamada falhar — quem chama trata como "sem
 * resultados", igual ao comportamento do Firecrawl quando não configurado.
 */
export async function googleSearch(query: string, limit = 8): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cx) return [];

  const num = Math.max(1, Math.min(limit, 10)); // API do Custom Search limita a 10/página
  const url = new URL(CUSTOM_SEARCH_ENDPOINT);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(num));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `googleSearch: falha [${res.status}] para query "${query}": ${body || res.statusText}`,
      );
      return [];
    }
    const j = (await res.json()) as CustomSearchResponse;
    return (j.items ?? [])
      .filter((it): it is CustomSearchItem & { link: string } => Boolean(it.link))
      .map((it) => ({
        title: it.title ?? it.link,
        url: it.link,
        snippet: it.snippet ?? "",
      }));
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.warn(
      `googleSearch: ${aborted ? "timeout" : "erro de rede"} para query "${query}"`,
      aborted ? undefined : e,
    );
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
