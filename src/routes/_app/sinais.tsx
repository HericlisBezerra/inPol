import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getNewsFilters, listNewsFeed } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { BLIND_ACTION_CLASS, BlindNote, BlindPanel } from "@/components/v2/empty-signal";
import { HeadlineAccent, ScreenHeadline } from "@/components/v2/screen-headline";

export const Route = createFileRoute("/_app/sinais")({
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
const FEED_DAYS = 14;

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

/** Como cada aba do feed é alimentada — o que precisa existir para ela ter o que mostrar. */
const SOURCE_REQUIREMENT: Record<Source, string> = {
  whatsapp: "nenhum grupo de WhatsApp monitorado",
  news: "nenhum portal de imprensa configurado",
  instagram: "nenhum perfil de Instagram monitorado",
  x: "nenhuma fonte de X configurada",
  facebook: "nenhuma fonte de Facebook configurada",
};

/** Janela do "novo" da manchete: o que chegou desde ontem a esta hora. */
const NEW_WINDOW_MS = 24 * 3600_000;

function timeAgo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

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
          days: FEED_DAYS,
          limit,
        },
      }),
    enabled: !!orgId,
  });

  /**
   * Quais fontes existem de fato. Sem isto, uma aba vazia é indistinguível de uma aba silenciosa:
   * o Instagram "morto" com 25 posts era exatamente isso — a tela não sabia dizer se o perfil
   * estava sem publicar ou se nunca tinha sido cadastrado.
   */
  const coverage = useQuery({
    queryKey: ["sinais-cobertura", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [srcRes, groupRes, igRes] = await Promise.all([
        supabase.from("sources").select("kind, is_active").eq("org_id", orgId!),
        supabase
          .from("whatsapp_groups")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .eq("is_monitored", true),
        supabase
          .from("org_instagram_targets")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .eq("active", true),
      ]);
      const active = new Set(
        (srcRes.data ?? []).filter((s) => s.is_active).map((s) => s.kind as string),
      );
      return {
        // Instância conectada sem grupo monitorado continua surda: a fonte precisa do alvo.
        whatsapp: (groupRes.count ?? 0) > 0,
        news: active.has("news") || active.has("web_search"),
        instagram: (igRes.count ?? 0) > 0,
        x: active.has("x"),
        facebook: active.has("facebook"),
      } satisfies Record<Source, boolean>;
    },
  });

  /** `undefined` enquanto carrega — não afirmamos "sem fonte" antes de saber. */
  const isConfigured = (s: Source): boolean | undefined =>
    coverage.data ? coverage.data[s] : undefined;
  // Só as fontes que têm aba: apontar um ponto cego sem caminho de correção vira ruído.
  const missingSources = coverage.data
    ? TABS.map((t) => t.key).filter((k): k is Source => k !== "all" && !coverage.data[k])
    : [];

  const vocab = useMemo(() => filtersQuery.data ?? [], [filtersQuery.data]);
  const neighborhoods = useMemo(() => vocab.filter((v) => v.kind === "neighborhood"), [vocab]);
  const terms = useMemo(() => vocab.filter((v) => v.kind !== "neighborhood"), [vocab]);

  // Memoizado porque alimenta o cálculo da manchete: sem isso o `[]` de fallback é um array novo
  // a cada render e o `useMemo` abaixo nunca aproveitaria o cache.
  const rows = useMemo(() => feed.data ?? [], [feed.data]);
  // Os filtros agora rodam no banco, então a lista vir cheia significa "existe mais lá atrás"
  // — e não mais "o corte já tinha acontecido antes de filtrar". O "+" torna o número honesto.
  const canLoadMore = rows.length >= limit;
  const countLabel = feed.isLoading ? "…" : `${rows.length}${canLoadMore ? "+" : ""}`;

  /**
   * O material da manchete: "o que é novo?".
   *
   * O feed vem ordenado por `posted_at` desc e é cortado em `limit` — ou seja, a truncagem come
   * os sinais MAIS ANTIGOS. Isso define exatamente o que temos direito de afirmar:
   *   • as últimas 24h estão completas se não há mais nada a carregar OU se o sinal mais antigo
   *     já carregado é anterior ao corte de 24h (o corte nunca alcançou a janela recente);
   *   • "assunto que não existia antes" só pode ser dito com os 14 dias inteiros carregados —
   *     senão um tema antigo cortado pelo limite viraria "novidade" por acidente de paginação,
   *     que é justamente o tipo de número que engana numa reunião.
   */
  const novidade = useMemo(() => {
    const cutoff = Date.now() - NEW_WINDOW_MS;
    const at = (r: NewsRow) => new Date(r.posted_at).getTime();
    const topicOf = (r: NewsRow) => {
      const a = Array.isArray(r.analysis) ? r.analysis[0] : r.analysis;
      const t = a?.topic?.trim();
      return t ? t.toLowerCase() : null;
    };
    const recent = rows.filter((r) => at(r) >= cutoff);
    const older = rows.filter((r) => at(r) < cutoff);
    const oldest = rows[rows.length - 1];
    const last24Complete = !canLoadMore || (!!oldest && at(oldest) < cutoff);
    const olderTopics = new Set(older.map(topicOf).filter(Boolean));
    const recentTopics = [...new Set(recent.map(topicOf).filter(Boolean))] as string[];
    return {
      recentCount: recent.length,
      last24Complete,
      windowComplete: !canLoadMore,
      /** Temas vistos nas 24h que não aparecem no resto da janela carregada. */
      fresh: recentTopics.filter((t) => !olderTopics.has(t)),
      latest: rows[0]?.posted_at ?? null,
    };
  }, [rows, canLoadMore]);

  const filtrado =
    filter !== "all" || neighborhood !== "all" || vocabTerm !== "all" || onlyNegative;
  const allSourcesOff = coverage.data ? Object.values(coverage.data).every((v) => !v) : false;

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  const headline = (() => {
    if (feed.isError) return { blind: true, text: <>Não foi possível carregar os sinais agora.</> };
    if (allSourcesOff) {
      return {
        blind: true,
        text: <>Nenhuma fonte de escuta configurada — não há novidade porque não há coleta.</>,
      };
    }
    if (filter !== "all" && isConfigured(filter) === false) {
      return {
        blind: true,
        text: (
          <>
            {SOURCE_REQUIREMENT[filter]} — o vazio desta aba é falta de escuta, não ausência de
            movimento.
          </>
        ),
      };
    }
    if (rows.length === 0) {
      return {
        blind: true,
        text: (
          <>
            Nada coletado nos últimos {FEED_DAYS} dias
            {filtrado ? " com os filtros atuais" : ""}.
          </>
        ),
      };
    }
    if (novidade.recentCount === 0) {
      return {
        blind: false,
        text: (
          <>
            Nada novo nas últimas 24h — o sinal mais recente chegou{" "}
            <HeadlineAccent tone="flat">
              {novidade.latest ? timeAgo(novidade.latest) : ""}
            </HeadlineAccent>
            .
          </>
        ),
      };
    }
    const n = novidade.recentCount;
    const sufixo = novidade.last24Complete ? "" : "+"; // corte ainda pode estar dentro das 24h
    if (novidade.windowComplete && novidade.fresh.length > 0) {
      return {
        blind: false,
        text: (
          <>
            <HeadlineAccent>
              {novidade.fresh.length} assunto{novidade.fresh.length > 1 ? "s" : ""}
            </HeadlineAccent>{" "}
            {novidade.fresh.length > 1 ? "apareceram" : "apareceu"} nas últimas 24h que não
            {novidade.fresh.length > 1 ? " apareciam" : " aparecia"} antes nos {FEED_DAYS} dias — em{" "}
            {n} sinais.
          </>
        ),
      };
    }
    return {
      blind: false,
      text: (
        <>
          <HeadlineAccent tone="flat">
            {n}
            {sufixo} sinais
          </HeadlineAccent>{" "}
          nas últimas 24h
          {novidade.windowComplete
            ? " — nenhum assunto que já não aparecesse antes."
            : ` — os ${FEED_DAYS} dias não estão carregados por inteiro, então não dá para dizer quais assuntos são novos.`}
        </>
      ),
    };
  })();

  return (
    <div className="mx-auto max-w-[920px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ScreenHeadline
          eyebrow="SINAIS · ÚLTIMAS 24H"
          // A cobertura decide se um feed vazio é silêncio ou surdez; não afirmar antes dela.
          loading={feed.isLoading || coverage.isLoading}
          loadingLabel="Lendo os sinais…"
          blind={headline.blind}
          note={
            <>
              Contagem do que foi coletado, não do que aconteceu na cidade
              {filtrado && " · recorte dos filtros atuais"}
              {missingSources.length > 0 && ` · ${missingSources.length} frente(s) sem escuta`}.
            </>
          }
        >
          {headline.text}
        </ScreenHeadline>
        <span className="font-mono text-[11px] text-v2-green">
          ● {countLabel} sinais carregados
        </span>
      </div>

      {/* Filters */}
      <div className="mb-1.5 mt-[18px] flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          // Aba sem fonte cadastrada ganha "—" no próprio rótulo: o usuário vê o ponto cego
          // ANTES de clicar e concluir, do feed vazio, que aquela frente está quieta.
          const off = t.key !== "all" && isConfigured(t.key) === false;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              title={off ? SOURCE_REQUIREMENT[t.key as Source] : undefined}
              className={
                t.key === filter
                  ? "whitespace-nowrap rounded-full bg-v2-ink px-3.5 py-[7px] text-[12.5px] font-[650] text-white"
                  : `whitespace-nowrap rounded-full border border-v2-line bg-v2-card px-3.5 py-[7px] text-[12.5px] font-semibold ${
                      off ? "text-v2-faint" : "text-v2-ink-2"
                    }`
              }
            >
              {t.label}
              {off && <span className="ml-1.5 font-mono text-[11px] opacity-80">—</span>}
            </button>
          );
        })}
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

      {/* Cobertura das fontes — o feed é a soma do que escutamos, e essa soma tem buracos
          nomeáveis. Sem este bloco, "N sinais" passa como se fosse tudo que existiu. */}
      {missingSources.length > 0 && (
        <BlindPanel
          className="mt-3.5"
          title={`${missingSources.length} frente(s) sem escuta`}
          action={
            <Link to="/ajustes/escuta/imprensa" className={BLIND_ACTION_CLASS}>
              Configurar fontes
            </Link>
          }
        >
          {missingSources.map((s) => SOURCE_REQUIREMENT[s]).join(" · ")}. Nada dessas frentes entra
          no feed, nos temas, nos alertas ou nos relatórios.
        </BlindPanel>
      )}

      <div className="mb-1 mt-3.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
        ÚLTIMOS {FEED_DAYS} DIAS · {countLabel} {rows.length === 1 ? "SINAL" : "SINAIS"}
      </div>
      <BlindNote className="mb-1.5">
        Contagem do que foi coletado — não do que aconteceu na cidade.
      </BlindNote>

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
        {/* Feed vazio: se a fonte selecionada nem existe, isto não é "nada aconteceu" — é
            "não escutamos". Um portal sem cadastro nunca vai render notícia por mais que se
            espere, e a tela precisa dizer isso em vez de sugerir paciência. */}
        {!feed.isLoading && rows.length === 0 && (
          <div className="px-5 py-4 text-[13px] text-v2-ink-3">
            {filter !== "all" && isConfigured(filter) === false ? (
              <>
                <span className="text-v2-faint">—</span>{" "}
                <b className="font-[650] text-v2-ink">{SOURCE_REQUIREMENT[filter]}.</b> O vazio aqui
                é falta de escuta, não ausência de movimento.
              </>
            ) : (
              "Nenhum sinal encontrado com esses filtros — houve coleta no período e nada bateu."
            )}
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
