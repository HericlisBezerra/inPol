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
    let q = context.supabase
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

    const { callAi, MODEL_FLASH } = await import("@/lib/ai-gateway.server");
    const domainList = (domains ?? []).map((d) => d.value).join(", ");
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
