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
