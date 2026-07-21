import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getNewsFilters, listNewsFeed } from "@/lib/news.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/v2/sinais")({
  head: () => ({ meta: [{ title: "Sinais — Inpol v2" }] }),
  component: Screen,
});

/** S6 — Sinais: feed unificado de portais, Instagram, grupos e X.
 *  Dados reais via listNewsFeed/getNewsFilters (raw_messages + message_analyses). */

type Source = "whatsapp" | "news" | "instagram" | "x" | "facebook";
type Filter = "all" | Source;

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas as fontes" },
  { key: "whatsapp", label: "💬 Grupos" },
  { key: "news", label: "📰 Portais" },
  { key: "instagram", label: "📸 Instagram" },
  { key: "x", label: "𝕏 X" },
];

const SOURCE_TAG: Record<string, string> = {
  whatsapp: "💬 GRUPO",
  news: "📰 PORTAL",
  instagram: "📸 INSTAGRAM",
  x: "𝕏 X",
  facebook: "📘 FACEBOOK",
};

const DEFAULT_LIMIT = 80;
const LOAD_MORE_STEP = 40;

function riskTone(risk: number): "crit" | "warn" | "green" {
  if (risk >= 70) return "crit";
  if (risk >= 45) return "warn";
  return "green";
}

const RISK_TONE_CLASS: Record<"crit" | "warn" | "green", string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  green: "text-v2-green",
};

function Screen() {
  const { orgId } = useCurrentOrg();
  const [filter, setFilter] = useState<Filter>("all");
  const [neighborhood, setNeighborhood] = useState("all");
  const [vocabTerm, setVocabTerm] = useState("all");
  const [onlyNegative, setOnlyNegative] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const filtersQuery = useQuery({
    queryKey: ["news-filters", orgId],
    queryFn: () => getNewsFilters({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  const feed = useQuery({
    queryKey: ["news-feed", orgId, filter, neighborhood, vocabTerm, onlyNegative, limit],
    queryFn: () =>
      listNewsFeed({
        data: {
          orgId: orgId as string,
          source: filter,
          neighborhood: neighborhood === "all" ? null : neighborhood,
          vocabTerm: vocabTerm === "all" ? null : vocabTerm,
          sentiment: onlyNegative ? "negative" : "all",
          days: 14,
          limit,
        },
      }),
    enabled: !!orgId,
  });

  const vocab = filtersQuery.data ?? [];
  const neighborhoods = useMemo(() => vocab.filter((v) => v.kind === "neighborhood"), [vocab]);
  const terms = useMemo(() => vocab.filter((v) => v.kind !== "neighborhood"), [vocab]);

  const rows = feed.data ?? [];
  const canLoadMore = rows.length >= limit;

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div className="mx-auto max-w-[920px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Sinais</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Tudo que a IA leu nas últimas horas — alimenta bairros, temas, alertas e relatórios.
          </p>
        </div>
        <span className="font-mono text-[11px] text-v2-green">
          ● {feed.isLoading ? "…" : rows.length} sinais carregados
        </span>
      </div>

      {/* Filters */}
      <div className="mb-1.5 mt-[18px] flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              t.key === filter
                ? "whitespace-nowrap rounded-full bg-v2-ink px-3.5 py-[7px] text-[12.5px] font-[650] text-white"
                : "whitespace-nowrap rounded-full border border-v2-line bg-v2-card px-3.5 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
            }
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <select
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className="rounded-lg border border-v2-line bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
        >
          <option value="all">Bairro ⌄</option>
          {neighborhoods.map((n) => (
            <option key={n.value} value={n.value}>
              {n.value}
            </option>
          ))}
        </select>
        <select
          value={vocabTerm}
          onChange={(e) => setVocabTerm(e.target.value)}
          className="rounded-lg border border-v2-line bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
        >
          <option value="all">Tema ⌄</option>
          {terms.map((t) => (
            <option key={`${t.kind}:${t.value}`} value={t.value}>
              {t.value}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyNegative((v) => !v)}
          className={
            onlyNegative
              ? "rounded-lg border border-v2-crit/40 bg-v2-crit-bg px-3 py-[7px] text-[12.5px] font-semibold text-v2-crit"
              : "rounded-lg border border-v2-crit/25 bg-v2-crit-bg/60 px-3 py-[7px] text-[12.5px] font-semibold text-v2-crit"
          }
        >
          {onlyNegative ? "✓ Só negativos" : "Só negativos ⌄"}
        </button>
      </div>

      <div className="mb-1.5 mt-3.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
        HOJE · {feed.isLoading ? "…" : rows.length} {rows.length === 1 ? "SINAL" : "SINAIS"}
      </div>

      {feed.isError && (
        <div className="mb-2 text-[12.5px] text-v2-crit">
          Não foi possível carregar os sinais. Tente novamente.
        </div>
      )}

      {/* Feed */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        {feed.isLoading && (
          <div className="px-5 py-4 text-[13px] text-v2-ink-3">Carregando sinais…</div>
        )}
        {!feed.isLoading && rows.length === 0 && (
          <div className="px-5 py-4 text-[13px] text-v2-ink-3">
            Nenhum sinal encontrado com esses filtros.
          </div>
        )}
        {rows.map((row, i) => (
          <SignalRow key={row.id} row={row} last={i === rows.length - 1} />
        ))}
      </div>

      {canLoadMore && (
        <div className="pb-0.5 pt-4 text-center">
          <button
            onClick={() => setLimit((l) => l + LOAD_MORE_STEP)}
            disabled={feed.isFetching}
            className="text-[13px] font-[650] text-v2-ink-3 disabled:opacity-50"
          >
            {feed.isFetching ? "Carregando…" : "Carregar mais sinais"}
          </button>
        </div>
      )}
    </div>
  );
}

type NewsRow = Awaited<ReturnType<typeof listNewsFeed>>[number];

function SignalRow({ row, last }: { row: NewsRow; last: boolean }) {
  const source = Array.isArray(row.source) ? row.source[0] : row.source;
  const analysis = Array.isArray(row.analysis) ? row.analysis[0] : row.analysis;
  const group = Array.isArray(row.group) ? row.group[0] : row.group;
  const payload = row.raw_payload as { url?: string; title?: string } | null;

  const risk = analysis?.risk_score ?? 0;
  const tone = riskTone(risk);
  const highlight = risk >= 80;
  const sentiment = Number(analysis?.sentiment ?? 0);
  const neighborhood = analysis?.neighborhood ?? group?.neighborhood_tag ?? undefined;

  const metaChips: { text: string; tone?: "crit" | "green" }[] = [];
  if (analysis?.topic) metaChips.push({ text: analysis.topic });
  if (neighborhood) metaChips.push({ text: `📍 ${neighborhood}` });
  if ((analysis?.mentioned_opponents?.length ?? 0) > 0) {
    metaChips.push({ text: "⚔ adversário", tone: "crit" });
  } else if (sentiment >= 0.15) {
    metaChips.push({ text: `${Math.round(sentiment * 100)}% positivo`, tone: "green" });
  }

  const origin = `${group?.subject ?? source?.label ?? "Fonte"} · ${new Date(row.posted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const title = payload?.title;
  const body = title ?? analysis?.summary ?? row.content;
  const detail = title && analysis?.summary ? analysis.summary : undefined;

  return (
    <div
      className={`flex gap-4 px-5 py-4 ${!last ? "border-b border-v2-track" : ""} ${
        highlight ? "bg-v2-crit-bg/50" : ""
      }`}
    >
      {/* Risk score */}
      <div className="w-11 flex-none text-center">
        <div className={`text-[22px] font-[650] ${RISK_TONE_CLASS[tone]}`}>{risk}</div>
        <div className="font-mono text-[9px] tracking-[0.08em] text-v2-faint">RISCO</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap font-mono text-[10.5px] text-v2-ink-3">
          <span className="rounded bg-v2-track px-[7px] py-0.5">
            {SOURCE_TAG[source?.kind ?? ""] ?? source?.kind ?? "FONTE"}
          </span>
          <span>{origin}</span>
          {metaChips.map((c) => (
            <span
              key={c.text}
              className={
                c.tone === "crit"
                  ? "text-v2-crit"
                  : c.tone === "green"
                    ? "text-v2-green"
                    : undefined
              }
            >
              {c.text}
            </span>
          ))}
        </div>
        <div className="mt-[5px] text-[14px] leading-normal text-v2-ink">
          {payload?.url ? (
            <a
              href={payload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
            >
              {body} ↗
            </a>
          ) : (
            body
          )}
        </div>
        {detail && (
          <div className="mt-[3px] text-[13px] leading-normal text-v2-ink-2">{detail}</div>
        )}
      </div>
    </div>
  );
}
