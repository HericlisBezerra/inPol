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
    const q = context.supabase
      .from("raw_messages")
      .select(
        "id, content, posted_at, group:whatsapp_groups(subject, neighborhood_tag), analysis:message_analyses(topic, neighborhood, sentiment, risk_score, summary)",
      )
      .eq("org_id", data.orgId)
      .gte("posted_at", since)
      .textSearch("content", data.q, { type: "websearch", config: "portuguese" })
      .order("posted_at", { ascending: false })
      .limit(50);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.neighborhood) {
      filtered = filtered.filter((r) => {
        const an = Array.isArray(r.analysis) ? r.analysis[0] : r.analysis;
        return an?.neighborhood === data.neighborhood;
      });
    }
    if (data.minRisk !== undefined) {
      filtered = filtered.filter((r) => {
        const an = Array.isArray(r.analysis) ? r.analysis[0] : r.analysis;
        return (an?.risk_score ?? 0) >= data.minRisk!;
      });
    }
    return filtered;
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

    const hasGoogle = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
    if (hasGoogle) {
      // Resultados reais do Google Custom Search — o LLM só ranqueia/resume, nunca inventa URL.
      const { googleSearch } = await import("@/lib/web-search.server");
      const domainHint = domainList ? ` (${domainList})` : "";
      const results = await googleSearch(`${data.q}${domainHint}`, 8);
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
        // Se o LLM falhar em preservar URLs válidas, cai para os resultados brutos do Google.
        if (ranked.length > 0) return ranked;
      } catch {
        // Ranking/resumo falhou — ainda temos resultados reais do Google, sem grounding de resumo.
      }
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: hostnameOf(r.url),
      }));
    }

    console.warn(
      "searchWeb: GOOGLE_API_KEY/GOOGLE_CSE_ID não configurados — usando busca via LLM sem grounding (risco de URL inventada).",
    );
    const { callAi, MODEL_FLASH } = await import("@/lib/ai-gateway.server");
    const prompt = `Busque na imprensa local (domínios sugeridos: ${domainList || "tribunadejundiai.com.br, bomdiajundiai.com.br, g1.globo.com"}) por: "${data.q}"

Responda com até 8 resultados em JSON estrito:
{"results":[{"title":"...","url":"...","snippet":"...","source":"..."}]}

Se não souber de fato, retorne {"results":[]}. Não invente URLs.`;
    try {
      const { text } = await callAi({
        model: MODEL_FLASH,
        messages: [
          {
            role: "system",
            content:
              "Você é um buscador de imprensa. Use apenas conhecimento factual; nunca invente URLs ou notícias.",
          },
          { role: "user", content: prompt },
        ],
        jsonObject: true,
        temperature: 0.1,
      });
      const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
        results?: Array<{ title: string; url: string; snippet: string; source?: string }>;
      };
      return parsed.results ?? [];
    } catch {
      return [];
    }
  });
