import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

const sourceSchema = z.enum(["all", "news", "instagram", "whatsapp", "facebook", "x"]);

/** Faixas de sentimento usadas pela UI. Precisam bater com o predicado JS de desempate. */
const SENTIMENT_NEGATIVE_MAX = -0.15;
const SENTIMENT_POSITIVE_MIN = 0.15;

/** O PostgREST corta o valor de um filtro na primeira vírgula e nas aspas, então
 *  termos de vocabulário ("Vila Arens, Centro") quebrariam o parser de `or=(...)`. */
function sanitizeFilterValue(value: string): string {
  return value.replace(/["\\(),]/g, " ").trim();
}

/** Embeds do PostgREST vêm como objeto (1:1) ou array (1:N) dependendo da FK detectada;
 *  o select é montado em runtime, então tipamos a linha à mão. */
type Embed<T> = T | T[] | null;

export type NewsFeedRow = {
  id: string;
  content: string | null;
  posted_at: string;
  raw_payload: Json | null;
  analysis_status: string;
  source: Embed<{ kind: string; label: string | null }>;
  group: Embed<{ subject: string | null; neighborhood_tag: string | null }>;
  analysis: Embed<{
    topic: string | null;
    subtopic: string | null;
    neighborhood: string | null;
    sentiment: number | null;
    risk_score: number;
    summary: string | null;
    mentioned_opponents: string[];
    mentioned_entities: string[];
    mentioned_allies: string[];
    is_actionable: boolean;
  }>;
};

function one<T>(embed: Embed<T>): T | null | undefined {
  return Array.isArray(embed) ? embed[0] : embed;
}

export const getNewsFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: vocab, error } = await context.supabase
      .from("org_vocabulary")
      .select("kind, value")
      .eq("org_id", data.orgId)
      .in("kind", ["neighborhood", "opponent", "ally", "facility", "sensitive_term", "focus_term"])
      .order("kind")
      .order("value");
    if (error) throw new Error(error.message);
    return vocab ?? [];
  });

export const listNewsFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        source: sourceSchema.default("all"),
        neighborhood: z.string().optional().nullable(),
        vocabTerm: z.string().optional().nullable(),
        sentiment: z.enum(["all", "negative", "neutral", "positive"]).default("all"),
        q: z.string().max(120).optional().nullable(),
        days: z.number().min(1).max(90).default(14),
        limit: z.number().min(20).max(200).default(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<NewsFeedRow[]> => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    // Bairro e termo de vocabulário são ORs que atravessam DUAS tabelas (raw_messages,
    // message_analyses, whatsapp_groups). O PostgREST não sabe expressar `or=(...)` cruzando
    // embeds, então quebramos em ramos: (A1∨A2)∧(B1∨B2) vira a união dos 4 pares, cada um
    // uma query própria já filtrada no banco. Como cada ramo traz os `limit` mais recentes
    // do seu próprio conjunto, a união ordenada e cortada em `limit` é exata — nenhum sinal
    // que caberia no topo global fica de fora.
    const neighborhoodBranches: Array<"analysis" | "group" | null> = data.neighborhood
      ? ["analysis", "group"]
      : [null];
    const termBranches: Array<"content" | "analysis" | null> = data.vocabTerm
      ? ["content", "analysis"]
      : [null];

    const term = data.vocabTerm ? sanitizeFilterValue(data.vocabTerm) : "";
    const freeText = data.q?.trim();

    const branches = neighborhoodBranches.flatMap((nb) => termBranches.map((tb) => ({ nb, tb })));

    const results = await Promise.all(
      branches.map(async ({ nb, tb }) => {
        // `!inner` só entra quando o ramo depende da relação — senão excluiríamos
        // mensagens sem análise/sem grupo que hoje aparecem no feed.
        const needsAnalysis = nb === "analysis" || tb === "analysis" || data.sentiment !== "all";
        const needsGroup = nb === "group";
        const select =
          "id, content, posted_at, raw_payload, analysis_status," +
          " source:sources!inner(kind, label)," +
          ` group:whatsapp_groups${needsGroup ? "!inner" : ""}(subject, neighborhood_tag),` +
          ` analysis:message_analyses${needsAnalysis ? "!inner" : ""}(topic, subtopic,` +
          " neighborhood, sentiment, risk_score, summary, mentioned_opponents," +
          " mentioned_entities, mentioned_allies, is_actionable)";

        let query = context.supabase
          .from("raw_messages")
          .select(select)
          .eq("org_id", data.orgId)
          .gte("posted_at", since)
          .order("posted_at", { ascending: false })
          .limit(data.limit);

        if (data.source !== "all") {
          query = query.eq("source.kind", data.source);
        } else {
          query = query.in("source.kind", ["news", "instagram", "whatsapp", "facebook", "x"]);
        }
        if (freeText) query = query.ilike("content", `%${freeText}%`);

        if (nb === "analysis") query = query.eq("analysis.neighborhood", data.neighborhood!);
        if (nb === "group") query = query.eq("group.neighborhood_tag", data.neighborhood!);

        if (tb === "content") query = query.ilike("content", `%${term}%`);
        if (tb === "analysis") {
          // Arrays de menções casam por elemento inteiro (`cs`); os campos escalares
          // aceitam substring, como fazia o filtro em JS.
          query = query.or(
            [
              `topic.ilike.*${term}*`,
              `subtopic.ilike.*${term}*`,
              `neighborhood.ilike.*${term}*`,
              `mentioned_opponents.cs.{"${term}"}`,
              `mentioned_allies.cs.{"${term}"}`,
              `mentioned_entities.cs.{"${term}"}`,
            ].join(","),
            { referencedTable: "analysis" },
          );
        }

        if (data.sentiment === "negative") {
          query = query.lte("analysis.sentiment", SENTIMENT_NEGATIVE_MAX);
        } else if (data.sentiment === "positive") {
          query = query.gte("analysis.sentiment", SENTIMENT_POSITIVE_MIN);
        } else if (data.sentiment === "neutral") {
          // Mudança consciente: o filtro em JS tratava score ausente como 0 (= neutro).
          // No banco, sentiment NULL fica de fora — "sem análise" não é "neutro".
          query = query
            .gte("analysis.sentiment", SENTIMENT_NEGATIVE_MAX)
            .lte("analysis.sentiment", SENTIMENT_POSITIVE_MIN);
        }

        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []) as unknown as NewsFeedRow[];
      }),
    );

    const byId = new Map<string, NewsFeedRow>();
    for (const rows of results) for (const row of rows) byId.set(row.id, row);

    const merged = [...byId.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at));

    // Único resíduo em JS: a precedência do bairro (a análise manda; a tag do grupo é
    // fallback). O ramo "group" pode trazer mensagem cuja análise aponta OUTRO bairro —
    // aqui ela cai. Não é amostragem: o universo já veio filtrado do banco.
    const filtered = data.neighborhood
      ? merged.filter((row) => {
          const analysis = one(row.analysis);
          const group = one(row.group);
          return (analysis?.neighborhood ?? group?.neighborhood_tag) === data.neighborhood;
        })
      : merged;

    return filtered.slice(0, data.limit);
  });
