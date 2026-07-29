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
import { listPeople } from "@/lib/people.functions";
import { listVocabulary } from "@/lib/vocabulary.functions";
import { fetchAllPages } from "@/lib/pg-paginate";
import { PersonSheet } from "@/components/v2/person-sheet";
import { STANCE_TONE, initialsOfName } from "@/components/v2/person-shared";

export const Route = createFileRoute("/_app/rede")({
  head: () => ({ meta: [{ title: "Rede — Inpol v2" }] }),
  component: Screen,
});

/**
 * S9 + S23 + S10 — Rede consolidada: Adversários / Pessoas / Grupos em abas.
 *
 * As abas Adversários e Pessoas agora leem a MESMA fonte — `org_people` via listPeople —
 * porque adversário e pessoa monitorada deixaram de ser tabelas diferentes: são a mesma
 * ficha com `stance` diferente. Antes, mudar alguém de lado exigia recadastrar; e o @ do
 * Instagram, o WhatsApp e o nome que a IA reconhece ficavam em três telas separadas.
 * Clicar em qualquer linha/card abre a ficha única (PersonSheet), onde tudo é editado.
 *
 * Métricas que o schema não modela (ex.: MSGS 7D por grupo) ficam em estado vazio
 * honesto — nunca inventadas.
 */
type TabId = "adversarios" | "pessoas" | "grupos";

/** Linha de `org_people` (contrato de people.functions). */
type PersonRow = {
  id: string;
  display_name: string;
  stance: "adversario" | "aliado" | "neutro" | "interno";
  party: string | null;
  role: string | null;
  department_id: string | null;
  department_name: string | null;
  vocabulary_id: string | null;
  elected_official_id: string | null;
  elected_name: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  tags: string[];
  notes: string | null;
  instagram_handle: string | null;
  instagram_active: boolean | null;
  whatsapp_count: number;
  created_at: string;
  updated_at: string;
};

function Screen() {
  const { orgId } = useCurrentOrg();
  const [tab, setTab] = useState<TabId>("adversarios");
  // `undefined` = ficha fechada; `null` = ficha em modo criação; string = editando.
  const [sheetId, setSheetId] = useState<string | null | undefined>(undefined);

  const {
    data: people = [],
    isLoading: peopleLoading,
    isError: peopleError,
  } = useQuery({
    queryKey: ["people", orgId],
    enabled: !!orgId,
    queryFn: () => listPeople({ data: { orgId: orgId as string } }) as Promise<PersonRow[]>,
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

  const adversaries = useMemo(() => people.filter((p) => p.stance === "adversario"), [people]);

  const TABS: { id: TabId; label: string; count: number | null }[] = [
    { id: "adversarios", label: "⚔ Adversários", count: peopleLoading ? null : adversaries.length },
    { id: "pessoas", label: "👤 Pessoas", count: peopleLoading ? null : people.length },
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
        {tab !== "grupos" && (
          <button
            onClick={() => setSheetId(null)}
            className="rounded-lg bg-v2-ink px-4 py-[9px] text-[13px] font-[650] text-white"
          >
            ＋ Adicionar pessoa
          </button>
        )}
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
          to="/ajustes/fontes"
          className="whitespace-nowrap px-3.5 pt-2 pb-2.5 text-[13.5px] font-semibold text-v2-ink-3"
        >
          📡 Fontes <span className="text-v2-faint">{fontesCount}</span>
        </Link>
      </div>

      {tab === "adversarios" && (
        <TabAdversarios
          orgId={orgId}
          adversaries={adversaries}
          isLoading={peopleLoading}
          isError={peopleError}
          onOpen={setSheetId}
        />
      )}
      {tab === "pessoas" && (
        <TabPessoas
          orgId={orgId}
          people={people}
          isLoading={peopleLoading}
          isError={peopleError}
          onOpen={setSheetId}
        />
      )}
      {tab === "grupos" && <TabGrupos orgId={orgId} />}

      {sheetId !== undefined && (
        <PersonSheet orgId={orgId} personId={sheetId} onClose={() => setSheetId(undefined)} />
      )}
    </div>
  );
}

/* ─────────────────────────── Aba Adversários (S9) ─────────────────────────── */

/** Sinais legados que ainda vivem em `org_adversaries` e não migraram para org_people. */
type AdvSignals = {
  person_id: string | null;
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

function TabAdversarios({
  orgId,
  adversaries,
  isLoading,
  isError,
  onOpen,
}: {
  orgId: string;
  adversaries: PersonRow[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (id: string) => void;
}) {
  // Score de atividade e "últimas jogadas" continuam em org_adversaries (a migração foi
  // aditiva). Cruzamos por person_id para não perder esses sinais enquanto não migram.
  const { data: signals = [] } = useQuery({
    queryKey: ["adversary-signals", orgId],
    queryFn: async () => {
      // Select numa `const string`: com literal, o typegen tenta resolver `person_id` na
      // definição desatualizada (types.ts é auto-gerado e ainda não conhece a coluna) e
      // derruba a query inteira num SelectQueryError. Mesmo padrão de reports.server.ts.
      const cols: string = "person_id, activity_score, top_topics, recent_actions";
      const { data } = await supabase
        .from("org_adversaries")
        .select(cols)
        .eq("org_id", orgId)
        .returns<AdvSignals[]>();
      return data ?? [];
    },
  });

  const signalByPerson = useMemo(() => {
    const map = new Map<string, AdvSignals>();
    signals.forEach((s) => {
      if (s.person_id) map.set(s.person_id, s);
    });
    return map;
  }, [signals]);

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

  const ordered = useMemo(
    () =>
      [...adversaries].sort(
        (a, b) =>
          (signalByPerson.get(b.id)?.activity_score ?? 0) -
            (signalByPerson.get(a.id)?.activity_score ?? 0) ||
          a.display_name.localeCompare(b.display_name, "pt-BR"),
      ),
    [adversaries, signalByPerson],
  );

  const top = ordered[0];
  const topScore = top ? (signalByPerson.get(top.id)?.activity_score ?? 0) : 0;

  return (
    <div>
      {isError && (
        <div className="mb-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os adversários. Tente novamente.
        </div>
      )}

      {isLoading && <div className="text-[12.5px] text-v2-ink-3">Carregando…</div>}

      {!isLoading && !isError && ordered.length === 0 && (
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
          Nenhum adversário cadastrado. Use “＋ Adicionar pessoa” e marque o posicionamento como
          Adversário.
        </div>
      )}

      {ordered.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {ordered.map((p) => {
            const sig = signalByPerson.get(p.id);
            const score = sig?.activity_score ?? 0;
            const topTopics = sig?.top_topics;
            const recentActions = sig?.recent_actions;
            const tags = Array.isArray(topTopics) ? (topTopics as string[]) : p.tags;
            const plays = Array.isArray(recentActions)
              ? (recentActions as { date: string; action: string }[]).map((x) => ({
                  when: x.date,
                  text: x.action,
                }))
              : [];
            return (
              <AdversaryCard
                key={p.id}
                person={p}
                score={score}
                tags={tags}
                plays={plays}
                onOpen={() => onOpen(p.id)}
              />
            );
          })}
        </div>
      )}

      {top && topScore > 0 && (
        <AiHint>
          <b>{top.display_name}</b> é quem concentra mais atividade mapeada no momento (score{" "}
          {topScore}).
        </AiHint>
      )}

      {/* Instagram monitorado */}
      <div className="mt-5 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="flex items-center justify-between border-b border-v2-track px-5 py-3.5">
          <span className="text-[14px] font-[650] text-v2-ink">📸 Instagram monitorado</span>
          {/* Não há mais "adicionar handle" avulso: o @ passou a ser um campo da ficha da
              pessoa, para que preenchê-lo signifique de fato ligar a varredura. */}
          <span className="text-[11.5px] text-v2-ink-3">
            Os @ são cadastrados na ficha de cada pessoa.
          </span>
        </div>
        {igLoading && <div className="px-5 py-3.5 text-[12px] text-v2-ink-3">Carregando…</div>}
        {!igLoading && igTargets.length === 0 && (
          <div className="px-5 py-3.5 text-[12px] text-v2-ink-3">
            Nenhum handle cadastrado. Abra a ficha de uma pessoa e preencha o @ do Instagram.
          </div>
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
  person,
  score,
  tags,
  plays,
  onOpen,
}: {
  person: PersonRow;
  score: number;
  tags: string[];
  plays: { when: string; text: string }[];
  onOpen: () => void;
}) {
  const tone: "crit" | "warn" = score >= 70 ? "crit" : "warn";
  const toneText = tone === "crit" ? "text-v2-crit" : "text-v2-warn";
  const toneBg = tone === "crit" ? "bg-v2-crit-bg" : "bg-v2-warn-bg";
  const badge = score >= 70 ? "MUITO ATIVO" : "ATIVO";
  const meta =
    [
      person.role,
      person.party,
      person.department_name,
      person.instagram_handle ? `@${person.instagram_handle.replace(/^@/, "")}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ficha de ${person.display_name}`}
      className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px] text-left transition-colors hover:border-v2-line-strong"
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-[42px] w-[42px] flex-none place-items-center overflow-hidden rounded-full text-[14px] font-semibold ${toneBg} ${toneText}`}
        >
          {person.avatar_url ? (
            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOfName(person.display_name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15.5px] font-[650] text-v2-ink">{person.display_name}</span>
            <span
              className={`rounded px-[7px] py-0.5 font-mono text-[9.5px] font-bold ${toneBg} ${toneText}`}
            >
              {badge}
            </span>
            {person.elected_name && (
              <span className="rounded bg-v2-blue-bg px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-blue">
                TSE
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-v2-ink-3">{meta}</div>
          <div className="mt-1 flex gap-2.5 font-mono text-[10.5px] text-v2-faint">
            <span className={person.instagram_active ? "text-v2-green" : undefined}>
              📸 {person.instagram_active ? "varrendo" : "sem varredura"}
            </span>
            <span className={person.whatsapp_count > 0 ? "text-v2-green" : undefined}>
              💬 {person.whatsapp_count} whatsapp
            </span>
          </div>
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
    </button>
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

type MemberStat = {
  member_id: string;
  message_count: number | null;
  avg_sentiment: number | null;
};

function TabPessoas({
  orgId,
  people,
  isLoading,
  isError,
  onOpen,
}: {
  orgId: string;
  people: PersonRow[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [stance, setStance] = useState<"todos" | PersonRow["stance"]>("todos");

  // Volume/sentimento ainda são medidos por `tracked_members.id` (member_daily_stats não
  // conhece person_id). Este mapa member→person é a ponte enquanto as stats não migram.
  const { data: memberLinks = [] } = useQuery({
    queryKey: ["tracked-members-person-map", orgId],
    queryFn: async () => {
      // `const string` pelo mesmo motivo do bloco de sinais acima: `person_id` ainda não
      // está no typegen.
      const cols: string = "id, person_id";
      const { data } = await supabase
        .from("tracked_members")
        .select(cols)
        .eq("org_id", orgId)
        .returns<{ id: string; person_id: string | null }[]>();
      return data ?? [];
    },
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["member-stats-30d", orgId],
    queryFn: () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      // Paginado porque estas linhas são AGREGADAS abaixo (msgs 30d e sentimento médio por
      // pessoa): a tabela tem uma linha por pessoa POR DIA, então ~34 pessoas monitoradas já
      // estouram as 1.000 do PostgREST — e o corte não dá erro, só faz as últimas pessoas da
      // lista aparecerem com "0 msgs / sem dados".
      return fetchAllPages<MemberStat>((from, to) =>
        supabase
          .from("member_daily_stats")
          .select("member_id, message_count, avg_sentiment")
          .eq("org_id", orgId)
          .gte("bucket_date", cutoff)
          .order("id", { ascending: true }) // ordem estável: sem isso a paginação repete/pula linhas
          .range(from, to),
      );
    },
  });

  /** Agregado por PESSOA (soma de todos os tracked_members apontando para ela). */
  const agg = useMemo(() => {
    const memberToPerson = new Map<string, string>();
    memberLinks.forEach((m) => {
      if (m.person_id) memberToPerson.set(m.id, m.person_id);
    });
    const map = new Map<string, { msgs: number; sent: number; sentN: number }>();
    stats.forEach((s) => {
      const personId = memberToPerson.get(s.member_id);
      if (!personId) return;
      const a = map.get(personId) ?? { msgs: 0, sent: 0, sentN: 0 };
      a.msgs += s.message_count ?? 0;
      if (s.avg_sentiment != null) {
        a.sent += Number(s.avg_sentiment);
        a.sentN++;
      }
      map.set(personId, a);
    });
    return map;
  }, [stats, memberLinks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (stance !== "todos" && p.stance !== stance) return false;
      if (!q) return true;
      return (
        p.display_name.toLowerCase().includes(q) ||
        (p.role ?? "").toLowerCase().includes(q) ||
        (p.party ?? "").toLowerCase().includes(q) ||
        (p.neighborhood ?? "").toLowerCase().includes(q) ||
        (p.department_name ?? "").toLowerCase().includes(q) ||
        (p.instagram_handle ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [people, search, stance]);

  const topByMsgs = useMemo<{ name: string; msgs: number } | null>(() => {
    let best: { name: string; msgs: number } | null = null;
    people.forEach((p) => {
      const msgs = agg.get(p.id)?.msgs ?? 0;
      if (msgs > 0 && (!best || msgs > best.msgs)) best = { name: p.display_name, msgs };
    });
    return best;
  }, [people, agg]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex w-[280px] items-center gap-2 rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[13px] text-v2-ink-3">
          ⌕
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo, bairro, tag…"
            aria-label="Buscar pessoa"
            className="w-full bg-transparent text-[13px] text-v2-ink outline-none placeholder:text-v2-ink-3"
          />
        </div>
        <select
          value={stance}
          onChange={(e) => setStance(e.target.value as typeof stance)}
          aria-label="Filtrar por posicionamento"
          className="rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[12.5px] font-semibold text-v2-ink-2 outline-none"
        >
          <option value="todos">Todos os posicionamentos</option>
          <option value="adversario">Adversários</option>
          <option value="aliado">Aliados</option>
          <option value="neutro">Neutros</option>
          <option value="interno">Internos</option>
        </select>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-v2-ink-3">
          {filtered.length} de {people.length}
        </span>
      </div>

      {isError && (
        <div className="mb-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar as pessoas. Tente novamente.
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.9fr_0.9fr_1.1fr_1fr_0.9fr_0.7fr_0.9fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>NOME</span>
          <span>POSIÇÃO</span>
          <span>CARGO / SECRETARIA</span>
          <span>BAIRRO</span>
          <span>CANAIS</span>
          <span>MSGS 30D</span>
          <span>SENTIMENTO</span>
        </div>

        {isLoading && <div className="px-5 py-3.5 text-[12.5px] text-v2-ink-3">Carregando…</div>}

        {!isLoading && !isError && people.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhuma pessoa cadastrada. Use “＋ Adicionar pessoa”.
          </div>
        )}

        {people.length > 0 && filtered.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhuma pessoa corresponde ao filtro.
          </div>
        )}

        {filtered.map((p, i) => {
          const a = agg.get(p.id);
          const hasStats = !!a && a.sentN > 0;
          const sent = hasStats ? a.sent / a.sentN : 0;
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
          return (
            <PersonRowLine
              key={p.id}
              person={p}
              msgs={String(a?.msgs ?? 0)}
              sentiment={sentimentLabel}
              sentimentTone={sentimentTone}
              border={i < filtered.length - 1}
              onOpen={() => onOpen(p.id)}
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

function PersonRowLine({
  person,
  msgs,
  sentiment,
  sentimentTone,
  border,
  onOpen,
}: {
  person: PersonRow;
  msgs: string;
  sentiment: string;
  sentimentTone: string;
  border?: boolean;
  onOpen: () => void;
}) {
  const tone = STANCE_TONE[person.stance];
  const cargo = [person.role, person.department_name].filter(Boolean).join(" · ") || "—";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ficha de ${person.display_name}`}
      className={`grid w-full grid-cols-[1.9fr_0.9fr_1.1fr_1fr_0.9fr_0.7fr_0.9fr] items-center gap-3 px-5 py-[13px] text-left transition-colors hover:bg-v2-track/60 ${border ? "border-b border-v2-track" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full text-[11px] font-semibold ${AVATAR_TONE.neutral}`}
        >
          {person.avatar_url ? (
            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOfName(person.display_name)
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold text-v2-ink">
            {person.display_name}
          </span>
          <span className="block truncate font-mono text-[10.5px] text-v2-faint">
            {person.party || person.tags[0] || (person.elected_name ? "via TSE" : "")}
          </span>
        </span>
      </span>
      <span
        className={`w-fit rounded px-[7px] py-[3px] font-mono text-[9.5px] font-bold uppercase ${tone.chip}`}
      >
        {tone.label}
      </span>
      <span className="truncate text-[12.5px] text-v2-ink-2">{cargo}</span>
      <span className="truncate text-[12.5px] text-v2-ink-2">
        {person.neighborhood ? `📍 ${person.neighborhood}` : "— sem bairro"}
      </span>
      <span className="flex gap-1.5 font-mono text-[10.5px]">
        <span
          title={person.instagram_handle ? `@${person.instagram_handle}` : "sem Instagram"}
          className={person.instagram_active ? "text-v2-green" : "text-v2-faint"}
        >
          📸
        </span>
        <span className={person.whatsapp_count > 0 ? "text-v2-green" : "text-v2-faint"}>
          💬{person.whatsapp_count}
        </span>
      </span>
      <span className="font-mono text-[12px] text-v2-ink">{msgs}</span>
      <span className={`font-mono text-[12px] ${SENTIMENT_TONE[sentimentTone]}`}>{sentiment}</span>
    </button>
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
