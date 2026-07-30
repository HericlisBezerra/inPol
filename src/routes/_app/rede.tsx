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
import { STANCE_TONE, STANCES, initialsOfName, type Stance } from "@/components/v2/person-shared";
import { BlindNote, BlindValue } from "@/components/v2/empty-signal";

export const Route = createFileRoute("/_app/rede")({
  head: () => ({ meta: [{ title: "Rede — Inpol v2" }] }),
  component: Screen,
});

/**
 * S9 + S23 + S10 — Rede consolidada: Pessoas / Grupos em abas.
 *
 * Adversário e pessoa monitorada deixaram de ser tabelas diferentes: são a mesma ficha
 * (`org_people`) com `stance` diferente. Enquanto havia duas abas lendo a mesma fonte, o
 * usuário via a mesma gente duas vezes e a promessa de "um lugar só" não se sustentava —
 * por isso agora existe UMA lista de pessoas, e o posicionamento virou filtro dentro dela.
 * Clicar em qualquer linha abre a ficha única (PersonSheet), onde tudo é editado.
 *
 * Métricas que o schema não modela (ex.: MSGS 7D por grupo) ficam em estado vazio
 * honesto — nunca inventadas.
 */
type TabId = "pessoas" | "grupos";

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
  const [tab, setTab] = useState<TabId>("pessoas");
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

  const TABS: { id: TabId; label: string; count: number | null }[] = [
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
          to="/ajustes/escuta/imprensa"
          className="whitespace-nowrap px-3.5 pt-2 pb-2.5 text-[13.5px] font-semibold text-v2-ink-3"
        >
          📡 Fontes <span className="text-v2-faint">{fontesCount}</span>
        </Link>
      </div>

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

/* ─────────────────── Aba Pessoas (S9 + S23, unificadas) ─────────────────── */

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

type MemberStat = {
  member_id: string;
  message_count: number | null;
  avg_sentiment: number | null;
};

/** Uma pessoa já resolvida com todos os sinais cruzados — o que a linha precisa desenhar. */
type PersonView = {
  person: PersonRow;
  /** `null` = a pessoa não tem linha em org_adversaries (dado inexistente, não zero). */
  score: number | null;
  tags: string[];
  plays: { when: string; text: string }[];
  /** `null` = nenhum tracked_member vinculado, então não há o que medir. */
  msgs: number | null;
  sentiment: number | null;
};

/**
 * Grade única para o cabeçalho e para as linhas. Duplicar a string em dois lugares foi
 * o que já desalinhou a tabela antes — mexer aqui move as duas.
 */
const ROW_GRID =
  "grid grid-cols-[24px_1.8fr_0.8fr_1.1fr_0.9fr_1.05fr_0.65fr_0.95fr_0.7fr] items-center gap-3";

type StanceFilter = "todos" | Stance;

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
  const [stance, setStance] = useState<StanceFilter>("todos");
  // Só uma linha expandida por vez: as "últimas jogadas" são leitura de contexto, não
  // comparação lado a lado — e manter várias abertas destrói a densidade da tabela.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  /**
   * Cruza pessoa × sinais × estatísticas uma vez só. A distinção entre "sem vínculo"
   * (null) e "zero mensagens" (0) é o ponto: mostrar 0 para quem nunca foi vinculado a um
   * tracked_member faria o gabinete concluir "essa pessoa está quieta" quando na verdade
   * ninguém está ouvindo.
   */
  const views = useMemo<PersonView[]>(() => {
    const signalByPerson = new Map<string, AdvSignals>();
    signals.forEach((s) => {
      if (s.person_id) signalByPerson.set(s.person_id, s);
    });

    const memberToPerson = new Map<string, string>();
    const measurable = new Set<string>();
    memberLinks.forEach((m) => {
      if (!m.person_id) return;
      memberToPerson.set(m.id, m.person_id);
      measurable.add(m.person_id);
    });

    const agg = new Map<string, { msgs: number; sent: number; sentN: number }>();
    stats.forEach((s) => {
      const personId = memberToPerson.get(s.member_id);
      if (!personId) return;
      const a = agg.get(personId) ?? { msgs: 0, sent: 0, sentN: 0 };
      a.msgs += s.message_count ?? 0;
      if (s.avg_sentiment != null) {
        a.sent += Number(s.avg_sentiment);
        a.sentN++;
      }
      agg.set(personId, a);
    });

    return people.map((p) => {
      const sig = signalByPerson.get(p.id);
      const a = agg.get(p.id);
      const recent = sig?.recent_actions;
      return {
        person: p,
        score: sig ? (sig.activity_score ?? 0) : null,
        // top_topics (curadoria da IA sobre o adversário) tem prioridade sobre as tags
        // manuais da ficha; quem não tem sinal cai nas tags e segue mostrando algo.
        tags: Array.isArray(sig?.top_topics) ? (sig.top_topics as string[]) : p.tags,
        plays: Array.isArray(recent)
          ? (recent as { date: string; action: string }[]).map((x) => ({
              when: x.date,
              text: x.action,
            }))
          : [],
        msgs: measurable.has(p.id) ? (a?.msgs ?? 0) : null,
        sentiment: a && a.sentN > 0 ? a.sent / a.sentN : null,
      };
    });
  }, [people, signals, memberLinks, stats]);

  /** Busca aplicada ANTES do posicionamento, para que as contagens dos chips já reflitam
   *  o termo digitado — chip prometendo 4 e entregando 0 é pior que chip zerado. */
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return views;
    return views.filter(({ person: p, tags }) => {
      return (
        p.display_name.toLowerCase().includes(q) ||
        (p.role ?? "").toLowerCase().includes(q) ||
        (p.party ?? "").toLowerCase().includes(q) ||
        (p.neighborhood ?? "").toLowerCase().includes(q) ||
        (p.department_name ?? "").toLowerCase().includes(q) ||
        (p.instagram_handle ?? "").toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [views, search]);

  const counts = useMemo(() => {
    const byStance = { adversario: 0, aliado: 0, neutro: 0, interno: 0 } as Record<Stance, number>;
    searched.forEach((v) => byStance[v.person.stance]++);
    return byStance;
  }, [searched]);

  const ordered = useMemo(() => {
    const rows = stance === "todos" ? searched : searched.filter((v) => v.person.stance === stance);
    // Quem tem sinal de atividade sobe: numa org com centenas de fichas, o que importa
    // primeiro é quem se mexeu. Empate cai no volume medido e, por fim, no alfabeto.
    return [...rows].sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        (b.msgs ?? -1) - (a.msgs ?? -1) ||
        a.person.display_name.localeCompare(b.person.display_name, "pt-BR"),
    );
  }, [searched, stance]);

  const topActive = ordered.find((v) => (v.score ?? 0) > 0) ?? null;
  const topByMsgs = useMemo(() => {
    let best: PersonView | null = null;
    views.forEach((v) => {
      if ((v.msgs ?? 0) > 0 && (!best || (v.msgs ?? 0) > (best.msgs ?? 0))) best = v;
    });
    return best as PersonView | null;
  }, [views]);

  const CHIPS: { value: StanceFilter; label: string; count: number }[] = [
    { value: "todos", label: "Todos", count: searched.length },
    ...STANCES.map((s) => ({
      value: s.value as StanceFilter,
      label: `${s.label}s`,
      count: counts[s.value],
    })),
  ];

  return (
    <div>
      {/* Toolbar: busca + posicionamento como segmented control (o antigo <select> escondia
          as contagens, que são justamente o que responde "quem eu tenho mapeado"). */}
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
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar por posicionamento"
        >
          {CHIPS.map((c) => {
            const active = stance === c.value;
            const tone = c.value === "todos" ? null : STANCE_TONE[c.value];
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStance(c.value)}
                className={`rounded-full px-3 py-[7px] text-[12.5px] transition-colors ${
                  active
                    ? `font-[650] ${tone ? tone.chip : "bg-v2-track text-v2-ink"}`
                    : "border border-v2-line bg-v2-card font-semibold text-v2-ink-3 hover:border-v2-line-strong"
                }`}
              >
                {c.label} <span className="font-mono text-[11px] opacity-70">{c.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-v2-ink-3">
          {ordered.length} de {people.length}
        </span>
      </div>

      {isError && (
        <div className="mb-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar as pessoas. Tente novamente.
        </div>
      )}

      {/* Tabela — escolhida em vez de cards porque a lista é comparativa (quem está sendo
          ouvido? quem se mexeu?) e precisa aguentar centenas de linhas sem virar rolagem
          infinita. O que era exclusivo dos cards (tópicos e jogadas) vive no expandir. */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div
          className={`${ROW_GRID} border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint`}
        >
          <span aria-hidden />
          <span>NOME</span>
          <span>POSIÇÃO</span>
          <span>CARGO / SECRETARIA</span>
          <span>BAIRRO</span>
          <span>MONITORAMENTO</span>
          <span>MSGS 30D</span>
          <span>SENTIMENTO</span>
          <span className="text-right">ATIVIDADE</span>
        </div>

        {isLoading && <div className="px-5 py-3.5 text-[12.5px] text-v2-ink-3">Carregando…</div>}

        {!isLoading && !isError && people.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            Nenhuma pessoa cadastrada. Use “＋ Adicionar pessoa” para mapear adversários, aliados e
            lideranças no mesmo lugar.
          </div>
        )}

        {!isLoading && people.length > 0 && ordered.length === 0 && (
          <div className="px-5 py-6 text-center text-[12.5px] text-v2-ink-3">
            {stance === "todos"
              ? "Nenhuma pessoa corresponde à busca."
              : `Nenhuma pessoa com o posicionamento “${STANCE_TONE[stance].label}”${
                  search.trim() ? " para essa busca" : ""
                }. Troque o filtro ou ajuste o posicionamento na ficha da pessoa.`}
          </div>
        )}

        {ordered.map((v, i) => (
          <PersonRowLine
            key={v.person.id}
            view={v}
            expanded={expandedId === v.person.id}
            onToggleExpand={() =>
              setExpandedId((cur) => (cur === v.person.id ? null : v.person.id))
            }
            border={i < ordered.length - 1}
            onOpen={() => onOpen(v.person.id)}
          />
        ))}
      </div>

      {/* A tabela mistura métrica medida e métrica impossível de medir; a legenda ensina a
          diferença uma vez, para o `—` não ser lido como "zero bonitinho". */}
      <BlindNote className="mt-2">
        <b className="font-[650]">0</b> = houve monitoramento e o resultado foi zero.{" "}
        <b className="font-[650]">—</b> = não há como saber (sem vínculo de WhatsApp, sem ficha de
        adversário ou sem @ cadastrado).
      </BlindNote>

      {topActive && (
        <AiHint>
          <b>{topActive.person.display_name}</b> é quem concentra mais atividade mapeada no momento
          (score {topActive.score}).
        </AiHint>
      )}
      {topByMsgs && (
        <AiHint>
          <b>{topByMsgs.person.display_name}</b> é quem mais gerou mensagens monitoradas nos últimos
          30 dias ({topByMsgs.msgs}).
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
                    : "○ nunca varrido";
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
      {/* Três estados, não dois: varrido ok (verde), erro de varredura (vermelho) e
          nunca varrido (cinza) — este último é ausência de leitura, não falha. */}
      <div
        className={`mt-1.5 font-mono text-[10px] ${
          ok ? "text-v2-green" : status.startsWith("○") ? "text-v2-faint" : "text-v2-crit"
        }`}
      >
        {status}
      </div>
    </div>
  );
}

const AVATAR_TONE: Record<string, string> = {
  green: "bg-v2-green-tint text-v2-green",
  neutral: "bg-v2-track text-v2-ink-3",
};

function PersonRowLine({
  view,
  expanded,
  onToggleExpand,
  border,
  onOpen,
}: {
  view: PersonView;
  expanded: boolean;
  onToggleExpand: () => void;
  border?: boolean;
  onOpen: () => void;
}) {
  const { person, score, tags, plays, msgs, sentiment } = view;
  const tone = STANCE_TONE[person.stance];
  const cargo = [person.role, person.department_name].filter(Boolean).join(" · ") || "—";
  const hasDetail = tags.length > 0 || plays.length > 0;

  const igOn = !!person.instagram_active;
  const igKnown = !!person.instagram_handle;
  const waCount = person.whatsapp_count;
  const unmonitored = !igKnown && waCount === 0;

  // O motivo do sentimento vazio muda tudo: sem vínculo ninguém mediu; com vínculo e zero
  // mensagem, medimos e não houve o que pontuar.
  const sentimentWhy = msgs == null ? "sem vínculo de WhatsApp" : "sem mensagem no período";
  const sentimentLabel =
    sentiment == null
      ? null
      : `${sentiment >= 0 ? "+" : "−"}${Math.abs(sentiment).toFixed(2)} ${
          sentiment > 0.05 ? "▲" : sentiment < -0.05 ? "▼" : "—"
        }`;
  const sentimentTone =
    sentiment == null
      ? "text-v2-ink-3"
      : sentiment > 0.05
        ? "text-v2-green"
        : sentiment < -0.05
          ? "text-v2-crit"
          : "text-v2-ink-3";

  return (
    <div className={border ? "border-b border-v2-track" : ""}>
      {/* O clique na linha inteira abre a ficha via um botão full-bleed atrás das células;
          assim o expandir pode ser um botão irmão, sem aninhar <button> dentro de <button>. */}
      <div className={`group relative ${ROW_GRID} px-5 py-[13px]`}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ficha de ${person.display_name}`}
          className="absolute inset-0 z-0 transition-colors group-hover:bg-v2-track/60"
        />
        {hasDetail ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Recolher" : "Expandir"} tópicos e jogadas de ${person.display_name}`}
            className="relative z-10 grid h-5 w-5 place-items-center rounded text-[10px] text-v2-ink-3 hover:bg-v2-track hover:text-v2-ink"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span aria-hidden />
        )}

        <span className="pointer-events-none relative z-[1] flex min-w-0 items-center gap-2.5">
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
              {person.party || tags[0] || (person.elected_name ? "via TSE" : "")}
            </span>
          </span>
        </span>

        <span
          className={`pointer-events-none relative z-[1] w-fit rounded px-[7px] py-[3px] font-mono text-[9.5px] font-bold uppercase ${tone.chip}`}
        >
          {tone.label}
        </span>
        <span className="pointer-events-none relative z-[1] truncate text-[12.5px] text-v2-ink-2">
          {cargo}
        </span>
        <span className="pointer-events-none relative z-[1] truncate text-[12.5px] text-v2-ink-2">
          {person.neighborhood ? `📍 ${person.neighborhood}` : "— sem bairro"}
        </span>

        {/* Monitoramento: o que revela se a pessoa está de fato sendo acompanhada. Handle
            cadastrado mas inativo é um estado próprio — some da varredura sem avisar.
            Sem `title` nas células: elas são pointer-events-none (o clique pertence à
            linha inteira), então tooltip aqui nunca dispararia. */}
        <span className="pointer-events-none relative z-[1] flex flex-wrap gap-1.5 font-mono text-[10.5px]">
          {unmonitored ? (
            <span className="text-v2-faint">○ sem canal</span>
          ) : (
            <>
              {igKnown && (
                <span className={igOn ? "text-v2-green" : "text-v2-warn"}>
                  📸 {igOn ? "varrendo" : "pausado"}
                </span>
              )}
              {waCount > 0 && <span className="text-v2-green">💬 {waCount}</span>}
            </>
          )}
        </span>

        <span
          className={`pointer-events-none relative z-[1] font-mono text-[12px] ${msgs == null ? "text-v2-faint" : "text-v2-ink"}`}
        >
          {msgs == null ? <BlindValue why="sem vínculo de WhatsApp" showWhy={false} /> : msgs}
        </span>
        <span
          className={`pointer-events-none relative z-[1] font-mono text-[12px] ${sentimentTone}`}
        >
          {sentimentLabel ?? <BlindValue why={sentimentWhy} />}
        </span>

        {/* Score só existe para quem tem ficha em org_adversaries; para os demais, um traço
            discreto — "0" leria como "inativo", que é uma afirmação que não temos. */}
        <span className="pointer-events-none relative z-[1] text-right">
          {score == null ? (
            <span className="font-mono text-[12px] text-v2-faint">—</span>
          ) : (
            <>
              <span
                className={`block text-[15px] font-[650] ${score >= 70 ? "text-v2-crit" : score > 0 ? "text-v2-warn" : "text-v2-ink-3"}`}
              >
                {score}
              </span>
              {score > 0 && (
                <span
                  className={`block font-mono text-[9px] tracking-[0.06em] ${score >= 70 ? "text-v2-crit" : "text-v2-warn"}`}
                >
                  {score >= 70 ? "MUITO ATIVO" : "ATIVO"}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {expanded && hasDetail && (
        <div className="border-t border-v2-track bg-v2-bg/40 px-5 pt-3 pb-4 pl-[52px]">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
          {plays.length > 0 && (
            <div className={tags.length > 0 ? "mt-3" : ""}>
              <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
                ÚLTIMAS JOGADAS
              </div>
              {plays.map((p) => (
                <div
                  key={p.when + p.text}
                  className="mt-1.5 flex gap-2.5 text-[12.5px] text-v2-ink-2"
                >
                  <span className="w-[46px] flex-none font-mono text-[10.5px] text-v2-faint">
                    {p.when}
                  </span>
                  {p.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
            members={g.participant_count}
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

      <BlindNote className="mt-2">
        MSGS 7D aparece como <b className="font-[650]">—</b> para todos os grupos: o volume por
        grupo não é armazenado. Grupo sem bairro vinculado é escutado, mas não entra no Território.
      </BlindNote>
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
  /** `null` = a Evolution não devolveu a contagem; "0 participantes" seria um grupo vazio. */
  members: number | null;
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
          <div className="font-mono text-[10.5px] text-v2-faint">
            {members == null ? (
              <BlindValue why="participantes não sincronizados" />
            ) : (
              `${members} participantes`
            )}
          </div>
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
          de mensagens) — `—` com motivo, nunca um zero que leria como "grupo parado". */}
      <span className="font-mono text-[12px]">
        <BlindValue why="volume por grupo não é medido" showWhy={false} />
      </span>
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
