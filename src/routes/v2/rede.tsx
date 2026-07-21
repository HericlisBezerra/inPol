import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import {
  listInstances,
  listGroups,
  refreshGroups,
  toggleGroupMonitoring,
} from "@/lib/whatsapp.functions";
import { listVocabulary } from "@/lib/vocabulary.functions";

export const Route = createFileRoute("/v2/rede")({
  head: () => ({ meta: [{ title: "Rede — Inpol v2" }] }),
  component: Screen,
});

/**
 * S9 + S23 + S10 — Rede consolidada: Adversários / Pessoas / Grupos em abas.
 * Dados reais via org_adversaries, org_instagram_targets, tracked_members,
 * member_daily_stats e whatsapp.functions (listInstances/listGroups/...).
 * Métricas que o schema não modela (ex.: MSGS 7D por grupo, jogadas/sinais
 * comportamentais inferidos) ficam em estado vazio honesto — nunca inventadas.
 */
type TabId = "adversarios" | "pessoas" | "grupos";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Screen() {
  const { orgId } = useCurrentOrg();
  const [tab, setTab] = useState<TabId>("adversarios");

  const { data: advCount } = useQuery({
    queryKey: ["rede-count-adversaries", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { count } = await supabase
        .from("org_adversaries")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!);
      return count ?? 0;
    },
  });
  const { data: peopleCount } = useQuery({
    queryKey: ["rede-count-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { count } = await supabase
        .from("tracked_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!);
      return count ?? 0;
    },
  });
  const { data: groupsCount } = useQuery({
    queryKey: ["rede-count-groups", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { count } = await supabase
        .from("whatsapp_groups")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!);
      return count ?? 0;
    },
  });
  const { data: vocab = [] } = useQuery({
    queryKey: ["vocab", orgId],
    enabled: !!orgId,
    queryFn: () => listVocabulary({ data: { orgId: orgId as string } }),
  });
  const fontesCount = vocab.filter((v) => v.kind === "news_domain").length;

  const TABS: { id: TabId; label: string; count: number | null }[] = [
    { id: "adversarios", label: "⚔ Adversários", count: advCount ?? null },
    { id: "pessoas", label: "👤 Pessoas", count: peopleCount ?? null },
    { id: "grupos", label: "💬 Grupos", count: groupsCount ?? null },
  ];

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Rede</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Quem influencia o território: adversários, lideranças, grupos e fontes monitoradas.
          </p>
        </div>
        <button className="rounded-lg bg-v2-ink px-4 py-[9px] text-[13px] font-[650] text-white">
          ＋ Adicionar
        </button>
      </div>

      {/* Tabs */}
      <div
        className="mt-[18px] mb-5 flex gap-1.5 border-b border-v2-line"
        role="tablist"
        aria-label="Seções da rede"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3.5 pt-2 pb-2.5 text-[13.5px] ${
              tab === t.id
                ? "-mb-px border-b-2 border-v2-green font-[650] text-v2-ink"
                : "font-semibold text-v2-ink-3"
            }`}
          >
            {t.label} <span className="text-v2-faint">{t.count ?? "…"}</span>
          </button>
        ))}
        <Link
          to="/v2/ajustes/fontes"
          className="whitespace-nowrap px-3.5 pt-2 pb-2.5 text-[13.5px] font-semibold text-v2-ink-3"
        >
          📡 Fontes <span className="text-v2-faint">{fontesCount}</span>
        </Link>
      </div>

      {tab === "adversarios" && <TabAdversarios orgId={orgId} />}
      {tab === "pessoas" && <TabPessoas orgId={orgId} />}
      {tab === "grupos" && <TabGrupos orgId={orgId} />}
    </div>
  );
}

/* ─────────────────────────── Aba Adversários (S9) ─────────────────────────── */

type Adv = {
  id: string;
  display_name: string;
  handle: string | null;
  role: string | null;
  party: string | null;
  activity_score: number;
  top_topics: unknown;
  recent_actions: unknown;
};

type IgTarget = {
  id: string;
  handle: string;
  label: string | null;
  kind: "opponent" | "ally" | "press" | "other";
  active: boolean;
  last_scanned_at: string | null;
  last_status: string | null;
};

const KIND_LABEL: Record<IgTarget["kind"], string> = {
  opponent: "Opositor",
  ally: "Aliado",
  press: "Imprensa",
  other: "Outro",
};

function TabAdversarios({ orgId }: { orgId: string }) {
  const {
    data: adversaries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["org-adversaries", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("org_adversaries")
        .select("id, display_name, handle, role, party, activity_score, top_topics, recent_actions")
        .eq("org_id", orgId)
        .order("activity_score", { ascending: false });
      return (data ?? []) as Adv[];
    },
  });

  const { data: igTargets = [], isLoading: igLoading } = useQuery({
    queryKey: ["ig-targets", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("org_instagram_targets")
        .select("id, handle, label, kind, active, last_scanned_at, last_status")
        .eq("org_id", orgId)
        .order("kind")
        .order("handle");
      return (data ?? []) as IgTarget[];
    },
  });

  const top = adversaries[0];

  return (
    <div>
      {isError && (
        <div className="mb-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os adversários. Tente novamente.
        </div>
      )}

      {isLoading && <div className="text-[12.5px] text-v2-ink-3">Carregando…</div>}

      {!isLoading && adversaries.length === 0 && (
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
          Nenhum adversário cadastrado.
        </div>
      )}

      {adversaries.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {adversaries.map((a) => {
            const tone: "crit" | "warn" = a.activity_score >= 70 ? "crit" : "warn";
            const badge = a.activity_score >= 70 ? "MUITO ATIVO" : "ATIVO";
            const meta = [a.role, a.party, a.handle ? `@${a.handle.replace(/^@/, "")}` : null]
              .filter(Boolean)
              .join(" · ");
            const tags = Array.isArray(a.top_topics) ? (a.top_topics as string[]) : [];
            const plays = Array.isArray(a.recent_actions)
              ? (a.recent_actions as { date: string; action: string }[]).map((x) => ({
                  when: x.date,
                  text: x.action,
                }))
              : [];
            return (
              <AdversaryCard
                key={a.id}
                initials={initialsOf(a.display_name)}
                tone={tone}
                name={a.display_name}
                badge={badge}
                meta={meta || "—"}
                score={a.activity_score}
                tags={tags}
                plays={plays}
              />
            );
          })}
        </div>
      )}

      {top && top.activity_score > 0 && (
        <AiHint>
          <b>{top.display_name}</b> é quem concentra mais atividade mapeada no momento (score{" "}
          {top.activity_score}).
        </AiHint>
      )}

      {/* Instagram monitorado */}
      <div className="mt-5 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="flex items-center justify-between border-b border-v2-track px-5 py-3.5">
          <span className="text-[14px] font-[650] text-v2-ink">📸 Instagram monitorado</span>
          <button className="text-[12.5px] font-[650] text-v2-green">＋ Adicionar handle</button>
        </div>
        {igLoading && <div className="px-5 py-3.5 text-[12px] text-v2-ink-3">Carregando…</div>}
        {!igLoading && igTargets.length === 0 && (
          <div className="px-5 py-3.5 text-[12px] text-v2-ink-3">Nenhum handle cadastrado.</div>
        )}
        {igTargets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3">
            {igTargets.map((t, i) => {
              const isOk = t.last_status === "ok" && !!t.last_scanned_at;
              const status =
                t.last_status && t.last_status !== "ok"
                  ? `⚠ ${t.last_status}`
                  : t.last_scanned_at
                    ? `● ok · último scan ${new Date(t.last_scanned_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "○ aguardando primeiro scan";
              return (
                <InstaHandle
                  key={t.id}
                  handle={`@${t.handle.replace(/^@/, "")}`}
                  meta={`${KIND_LABEL[t.kind]} · ${t.active ? "ativo" : "pausado"}`}
                  status={status}
                  ok={isOk}
                  border={i % 3 !== 2 && i !== igTargets.length - 1}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AdversaryCard({
  initials,
  tone,
  name,
  badge,
  meta,
  score,
  tags,
  plays,
}: {
  initials: string;
  tone: "crit" | "warn";
  name: string;
  badge: string;
  meta: string;
  score: number;
  tags: string[];
  plays: { when: string; text: string }[];
}) {
  const toneText = tone === "crit" ? "text-v2-crit" : "text-v2-warn";
  const toneBg = tone === "crit" ? "bg-v2-crit-bg" : "bg-v2-warn-bg";
  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-full text-[14px] font-semibold ${toneBg} ${toneText}`}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15.5px] font-[650] text-v2-ink">{name}</span>
            <span
              className={`rounded px-[7px] py-0.5 font-mono text-[9.5px] font-bold ${toneBg} ${toneText}`}
            >
              {badge}
            </span>
          </div>
          <div className="mt-0.5 text-[12.5px] text-v2-ink-3">{meta}</div>
        </div>
        <div className="flex-none text-right">
          <div className={`text-[20px] font-[650] ${toneText}`}>{score}</div>
          <div className="font-mono text-[9px] tracking-[0.08em] text-v2-faint">ATIVIDADE</div>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-v2-track px-[9px] py-[3px] text-[11.5px] text-v2-ink-2"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3.5 border-t border-v2-track pt-3">
        <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          ÚLTIMAS JOGADAS
        </div>
        {plays.length === 0 && (
          <div className="mt-1.5 text-[12.5px] text-v2-faint">Sem atividades registradas.</div>
        )}
        {plays.map((p) => (
          <div
            key={p.when + p.text}
            className="mt-1.5 flex gap-2.5 text-[12.5px] text-v2-ink-2 first-of-type:mt-[7px]"
          >
            <span className="w-[46px] flex-none font-mono text-[10.5px] text-v2-faint">
              {p.when}
            </span>
            {p.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function InstaHandle({
  handle,
  meta,
  status,
  ok,
  border,
}: {
  handle: string;
  meta: string;
  status: string;
  ok?: boolean;
  border?: boolean;
}) {
  return (
    <div className={`px-5 py-3.5 ${border ? "md:border-r md:border-v2-track" : ""}`}>
      <div className="font-mono text-[12.5px] font-bold text-v2-ink">{handle}</div>
      <div className="mt-0.5 text-[11.5px] text-v2-ink-3">{meta}</div>
      <div className={`mt-1.5 font-mono text-[10px] ${ok ? "text-v2-green" : "text-v2-crit"}`}>
        {status}
      </div>
    </div>
  );
}

/* ─────────────────────────── Aba Pessoas (S23) ─────────────────────────── */

type Member = {
  id: string;
  display_name: string;
  role: string;
  neighborhood: string | null;
  tags: string[];
};

type MemberStat = {
  member_id: string;
  message_count: number | null;
  avg_sentiment: number | null;
};

function TabPessoas({ orgId }: { orgId: string }) {
  const {
    data: members = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["tracked-members-rede", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracked_members")
        .select("id, display_name, role, neighborhood, tags")
        .eq("org_id", orgId)
        .order("display_name");
      return (data ?? []) as Member[];
    },
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["member-stats-30d", orgId],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("member_daily_stats")
        .select("member_id, message_count, avg_sentiment")
        .eq("org_id", orgId)
        .gte("bucket_date", cutoff);
      return (data ?? []) as MemberStat[];
    },
  });

  const agg = useMemo(() => {
    const map = new Map<string, { msgs: number; sent: number; sentN: number }>();
    stats.forEach((s) => {
      const a = map.get(s.member_id) ?? { msgs: 0, sent: 0, sentN: 0 };
      a.msgs += s.message_count ?? 0;
      if (s.avg_sentiment != null) {
        a.sent += Number(s.avg_sentiment);
        a.sentN++;
      }
      map.set(s.member_id, a);
    });
    return map;
  }, [stats]);

  const topByMsgs = useMemo<{ name: string; msgs: number } | null>(() => {
    let best: { name: string; msgs: number } | null = null;
    members.forEach((m) => {
      const msgs = agg.get(m.id)?.msgs ?? 0;
      if (msgs > 0 && (!best || msgs > best.msgs)) best = { name: m.display_name, msgs };
    });
    return best;
  }, [members, agg]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex w-[280px] items-center gap-2 rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[13px] text-v2-ink-3">
          ⌕ Buscar pessoa…
        </div>
        <button className="rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[12.5px] font-semibold text-v2-ink-2">
          Papel ⌄
        </button>
        <button className="rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[12.5px] font-semibold text-v2-ink-2">
          Bairro ⌄
        </button>
        <div className="flex-1" />
        <button className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Nova pessoa
        </button>
      </div>

      {isError && (
        <div className="mb-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar as pessoas monitoradas. Tente novamente.
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.8fr_1fr_1fr_0.7fr_0.8fr_0.7fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>NOME</span>
          <span>PAPEL</span>
          <span>BAIRRO</span>
          <span>MSGS 30D</span>
          <span>SENTIMENTO</span>
          <span>SINAL</span>
        </div>

        {isLoading && <div className="px-5 py-3.5 text-[12.5px] text-v2-ink-3">Carregando…</div>}

        {!isLoading && members.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhuma pessoa cadastrada.
          </div>
        )}

        {members.map((m, i) => {
          const a = agg.get(m.id);
          const hasStats = !!a && a.sentN > 0;
          const sent = hasStats ? a!.sent / a!.sentN : 0;
          const sentimentLabel = hasStats
            ? `${sent >= 0 ? "+" : "−"}${Math.abs(sent).toFixed(2)} ${sent > 0.05 ? "▲" : sent < -0.05 ? "▼" : "—"}`
            : "— sem dados";
          const sentimentTone = !hasStats
            ? "obs"
            : sent > 0.05
              ? "green"
              : sent < -0.05
                ? "crit"
                : "obs";
          const signal = !hasStats
            ? "SEM DADOS"
            : sent > 0.05
              ? "SENTIMENTO POSITIVO"
              : sent < -0.05
                ? "SENTIMENTO NEGATIVO"
                : "NEUTRO";
          const signalTone = sentimentTone;
          return (
            <PersonRow
              key={m.id}
              initials={initialsOf(m.display_name)}
              avatarTone={hasStats && sent > 0.05 ? "green" : "neutral"}
              name={m.display_name}
              sub={(m.tags ?? [])[0] ?? ""}
              role={m.role.replace(/_/g, " ")}
              bairro={m.neighborhood ? `📍 ${m.neighborhood}` : "— sem bairro"}
              msgs={String(a?.msgs ?? 0)}
              sentiment={sentimentLabel}
              sentimentTone={sentimentTone}
              signal={signal}
              signalTone={signalTone}
              border={i < members.length - 1}
            />
          );
        })}
      </div>

      {topByMsgs && (
        <AiHint>
          <b>{topByMsgs.name}</b> é quem mais gerou mensagens monitoradas nos últimos 30 dias (
          {topByMsgs.msgs}).
        </AiHint>
      )}
    </div>
  );
}

const AVATAR_TONE: Record<string, string> = {
  green: "bg-v2-green-tint text-v2-green",
  neutral: "bg-v2-track text-v2-ink-3",
};
const SENTIMENT_TONE: Record<string, string> = {
  crit: "text-v2-crit",
  obs: "text-v2-ink-3",
  green: "text-v2-green",
};
const SIGNAL_TONE: Record<string, string> = {
  crit: "bg-v2-crit-bg text-v2-crit",
  obs: "bg-v2-track text-v2-ink-3",
  green: "bg-v2-green-tint text-v2-green",
};

function PersonRow({
  initials,
  avatarTone,
  name,
  sub,
  role,
  bairro,
  msgs,
  sentiment,
  sentimentTone,
  signal,
  signalTone,
  border,
}: {
  initials: string;
  avatarTone: string;
  name: string;
  sub: string;
  role: string;
  bairro: string;
  msgs: string;
  sentiment: string;
  sentimentTone: string;
  signal: string;
  signalTone: string;
  border?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.8fr_1fr_1fr_0.7fr_0.8fr_0.7fr] items-center gap-3 px-5 py-[13px] ${border ? "border-b border-v2-track" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-semibold ${AVATAR_TONE[avatarTone]}`}
        >
          {initials}
        </span>
        <div>
          <div className="text-[13.5px] font-semibold text-v2-ink">{name}</div>
          {sub && <div className="font-mono text-[10.5px] text-v2-faint">{sub}</div>}
        </div>
      </div>
      <span className="text-[12.5px] capitalize text-v2-ink-2">{role}</span>
      <span className="text-[12.5px] text-v2-ink-2">{bairro}</span>
      <span className="font-mono text-[12px] text-v2-ink">{msgs}</span>
      <span className={`font-mono text-[12px] ${SENTIMENT_TONE[sentimentTone]}`}>{sentiment}</span>
      <span
        className={`w-fit rounded px-[7px] py-[3px] font-mono text-[9.5px] font-bold ${SIGNAL_TONE[signalTone]}`}
      >
        {signal}
      </span>
    </div>
  );
}

/* ─────────────────────────── Aba Grupos (S10) ─────────────────────────── */

function TabGrupos({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [instanceId, setInstanceId] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const { data: instances = [] } = useQuery({
    queryKey: ["instances", orgId],
    queryFn: () => listInstances({ data: { orgId } }),
  });
  const activeInstance = instanceId ?? instances[0]?.id;

  const {
    data: groups = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["groups", orgId, activeInstance],
    queryFn: () => listGroups({ data: { orgId, instanceId: activeInstance } }),
    enabled: !!activeInstance,
  });

  const refresh = useMutation({
    mutationFn: () => refreshGroups({ data: { orgId, instanceId: activeInstance! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", orgId, activeInstance] }),
  });

  const toggle = useMutation({
    mutationFn: (vars: { groupId: string; monitored: boolean; tag: string | null }) =>
      toggleGroupMonitoring({
        data: {
          orgId,
          groupId: vars.groupId,
          monitored: vars.monitored,
          neighborhoodTag: vars.tag,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", orgId, activeInstance] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if ((g.subject ?? "").toLowerCase().includes(q)) return true;
      if ((g.neighborhood_tag ?? "").toLowerCase().includes(q)) return true;
      if ((g.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [groups, search]);

  const monitoredCount = groups.filter((g) => g.is_monitored).length;
  const missingNeighborhood = groups.filter((g) => g.is_monitored && !g.neighborhood_tag).length;

  if (instances.length === 0) {
    return (
      <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
        Conecte uma instância WhatsApp em Ajustes → WhatsApp para começar.
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex w-[300px] items-center gap-2 rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[13px] text-v2-ink-3">
          ⌕
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, bairro ou tag…"
            className="w-full bg-transparent text-[13px] text-v2-ink outline-none placeholder:text-v2-ink-3"
          />
        </div>
        <select
          value={activeInstance}
          onChange={(e) => setInstanceId(e.target.value)}
          className="rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[12.5px] font-semibold text-v2-ink-2 outline-none"
        >
          {instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.instance_name}
            </option>
          ))}
        </select>
        {missingNeighborhood > 0 && (
          <span className="rounded-full border border-v2-crit/25 bg-v2-crit-bg/50 px-3 py-2 text-[12.5px] font-semibold text-v2-crit">
            ⚠ {missingNeighborhood} sem bairro
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-v2-ink-3">
          {monitoredCount} monitorados de {groups.length}
        </span>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || !activeInstance}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink disabled:opacity-50"
        >
          ↻ {refresh.isPending ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[2.2fr_1.3fr_1fr_0.9fr_0.6fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>GRUPO</span>
          <span>BAIRRO VINCULADO</span>
          <span>TAGS</span>
          <span>MSGS 7D</span>
          <span className="text-right">MONITORAR</span>
        </div>

        {(isLoading || isFetching) && groups.length === 0 && (
          <div className="px-5 py-3.5 text-[12.5px] text-v2-ink-3">Carregando…</div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhum grupo. Clique em "Sincronizar" para importar da instância.
          </div>
        )}

        {groups.length > 0 && filtered.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhum grupo corresponde ao filtro.
          </div>
        )}

        {filtered.map((g, i) => (
          <GroupRow
            key={g.id}
            initials={(g.subject ?? "?").slice(0, 2).toUpperCase()}
            avatarTone={g.is_monitored ? "green" : "neutral"}
            name={g.subject ?? "Sem nome"}
            members={`${g.participant_count ?? 0} participantes`}
            bairro={
              g.neighborhood_tag ? (
                <span className="text-[12.5px] text-v2-ink">📍 {g.neighborhood_tag}</span>
              ) : (
                <span className="text-[12.5px] font-[650] text-v2-crit">
                  ⚠ sem bairro vinculado
                </span>
              )
            }
            tags={g.tags ?? []}
            on={g.is_monitored ?? false}
            onToggle={(checked) =>
              toggle.mutate({ groupId: g.id, monitored: checked, tag: g.neighborhood_tag ?? null })
            }
            border={i < filtered.length - 1}
            highlight={!!g.is_monitored && !g.neighborhood_tag}
            muted={!g.is_monitored}
          />
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  initials,
  avatarTone,
  name,
  members,
  bairro,
  tags,
  on,
  onToggle,
  border,
  highlight,
  muted,
}: {
  initials: string;
  avatarTone: string;
  name: string;
  members: string;
  bairro: React.ReactNode;
  tags: string[];
  on: boolean;
  onToggle: (checked: boolean) => void;
  border?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[2.2fr_1.3fr_1fr_0.9fr_0.6fr] items-center gap-3 px-5 py-[13px] ${border ? "border-b border-v2-track" : ""} ${highlight ? "bg-v2-crit-bg/40" : ""} ${muted ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-semibold ${AVATAR_TONE[avatarTone]}`}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-v2-ink">{name}</div>
          <div className="font-mono text-[10.5px] text-v2-faint">{members}</div>
        </div>
      </div>
      {bairro}
      <div className="flex gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-v2-track px-2 py-0.5 text-[10.5px] text-v2-ink-2"
          >
            {t}
          </span>
        ))}
      </div>
      {/* MSGS 7D não tem correspondência no schema (whatsapp_groups não guarda contagem
          de mensagens) — estado vazio honesto em vez de número inventado. */}
      <span className="font-mono text-[12px] text-v2-faint">—</span>
      <div className="text-right">
        <Toggle on={on} onChange={onToggle} />
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Monitorar grupo"
      onClick={() => onChange(!on)}
      className={`relative inline-block h-5 w-[34px] rounded-full transition-colors ${on ? "bg-v2-green" : "bg-v2-line-strong"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}

/* ─────────────────────────── Compartilhado ─────────────────────────── */

function AiHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
      <span>✦</span>
      <span className="flex-1 text-[12.5px] leading-relaxed text-v2-green-ink">{children}</span>
    </div>
  );
}
