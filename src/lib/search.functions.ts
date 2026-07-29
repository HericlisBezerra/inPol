import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const searchInternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        q: z.string().min(1).max(200),
        neighborhood: z.string().nullish(),
        minRisk: z.number().min(0).max(100).optional(),
        days: z.number().min(1).max(90).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    // Bairro e risco moram em message_analyses. Filtrar no banco exige `!inner` — o que
    // por si só descarta mensagens ainda não analisadas, exatamente as que os filtros
    // antigos já derrubavam em JS (`?? 0` / bairro undefined). Sem `!inner`, o limite de 50
    // seria aplicado ANTES do filtro e a busca devolveria uma amostra, não a resposta.
    const restrictsByAnalysis = !!data.neighborhood || (data.minRisk ?? 0) > 0;
    const select = restrictsByAnalysis
      ? "id, content, posted_at, group:whatsapp_groups(subject, neighborhood_tag), analysis:message_analyses!inner(topic, neighborhood, sentiment, risk_score, summary)"
      : "id, content, posted_at, group:whatsapp_groups(subject, neighborhood_tag), analysis:message_analyses(topic, neighborhood, sentiment, risk_score, summary)";

    let q = context.supabase
      .from("raw_messages")
      .select(select)
      .eq("org_id", data.orgId)
      .gte("posted_at", since)
      .textSearch("content", data.q, { type: "websearch", config: "portuguese" })
      .order("posted_at", { ascending: false })
      .limit(50);

    if (data.neighborhood) q = q.eq("analysis.neighborhood", data.neighborhood);
    if ((data.minRisk ?? 0) > 0) q = q.gte("analysis.risk_score", data.minRisk!);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export const searchWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), q: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: domains } = await context.supabase
      .from("org_vocabulary")
      .select("value")
      .eq("org_id", data.orgId)
      .eq("kind", "news_domain");
    const domainList = (domains ?? []).map((d) => d.value).join(", ");

    const domainHint = domainList ? ` (${domainList})` : "";
    const { googleSearch, groundedSearch } = await import("@/lib/web-search.server");

    // Busca REAL: Custom Search (se CSE) → grounding do Gemini (reusa GEMINI_API_KEY) → vazio.
    // O LLM NUNCA inventa URL — só ranqueia/resume os resultados reais (validados contra a lista).
    let results =
      process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID
        ? await googleSearch(`${data.q}${domainHint}`, 8)
        : [];
    if (results.length === 0) results = await groundedSearch(`${data.q}${domainHint}`, 8);
    if (results.length === 0) return [];

    try {
      const { callAi, MODEL_FLASH } = await import("@/lib/ai-gateway.server");
      const { text } = await callAi({
        model: MODEL_FLASH,
        messages: [
          {
            role: "system",
            content:
              "Você ranqueia e resume resultados de busca já fornecidos. Nunca invente ou altere URLs — use exatamente as fornecidas.",
          },
          {
            role: "user",
            content: `Busca: "${data.q}"\n\nResultados brutos (JSON):\n${JSON.stringify(results)}\n\nRanqueie por relevância e devolva em JSON estrito, mantendo as URLs EXATAMENTE como recebidas:\n{"results":[{"title":"...","url":"...","snippet":"...","source":"..."}]}`,
          },
        ],
        jsonObject: true,
        temperature: 0.1,
      });
      const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
        results?: Array<{ title: string; url: string; snippet: string; source?: string }>;
      };
      const validUrls = new Set(results.map((r) => r.url));
      const ranked = (parsed.results ?? []).filter((r) => validUrls.has(r.url));
      if (ranked.length > 0) return ranked;
    } catch {
      // Ranking/resumo falhou — devolve os resultados reais crus (sem alteração de URL).
    }
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: hostnameOf(r.url),
    }));
  });
