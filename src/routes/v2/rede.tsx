import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/rede")({
  head: () => ({ meta: [{ title: "Rede — Inpol v2" }] }),
  component: Screen,
});

/** S9 + S23 + S10 — Rede consolidada: Adversários / Pessoas / Grupos em abas. Demo data. */
type TabId = "adversarios" | "pessoas" | "grupos";

const TABS: { id: TabId; label: string; count: number }[] = [
  { id: "adversarios", label: "⚔ Adversários", count: 4 },
  { id: "pessoas", label: "👤 Pessoas", count: 12 },
  { id: "grupos", label: "💬 Grupos", count: 142 },
];

function Screen() {
  const [tab, setTab] = useState<TabId>("adversarios");
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
            {t.label} <span className="text-v2-faint">{t.count}</span>
          </button>
        ))}
        <Link
          to="/v2/ajustes/fontes"
          className="whitespace-nowrap px-3.5 pt-2 pb-2.5 text-[13.5px] font-semibold text-v2-ink-3"
        >
          📡 Fontes <span className="text-v2-faint">20</span>
        </Link>
      </div>

      {tab === "adversarios" && <TabAdversarios />}
      {tab === "pessoas" && <TabPessoas />}
      {tab === "grupos" && <TabGrupos />}
    </div>
  );
}

/* ─────────────────────────── Aba Adversários (S9) ─────────────────────────── */

function TabAdversarios() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <AdversaryCard
          initials="JP"
          tone="crit"
          name="João Parimoschi"
          badge="MUITO ATIVO"
          meta="Vereador · PL · @parimoschi"
          score={87}
          tags={["zona norte", "enchentes", "saúde"]}
          plays={[
            { when: "hoje", text: "Repostou prints da UBS do Retiro (320 reposts)" },
            { when: "ontem", text: 'Pauta "abandono da zona norte" no X e Instagram' },
          ]}
        />
        <AdversaryCard
          initials="CB"
          tone="warn"
          name="Carla Bertolli"
          badge="ATIVO"
          meta="Pré-candidata · PSOL · @carlabertolli"
          score={54}
          tags={["educação", "creches"]}
          plays={[
            { when: "ter", text: "Live sobre vagas em creches (2,1 mil views)" },
            { when: "seg", text: "Amplificou boato da creche do Anhangabaú" },
          ]}
        />
      </div>

      <AiHint>
        <b>Padrão detectado:</b> Parimoschi publica sobre zona norte sempre ~2h depois de picos
        negativos nos grupos — ele monitora os mesmos espaços.
      </AiHint>

      {/* Instagram monitorado */}
      <div className="mt-5 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="flex items-center justify-between border-b border-v2-track px-5 py-3.5">
          <span className="text-[14px] font-[650] text-v2-ink">📸 Instagram monitorado</span>
          <button className="text-[12.5px] font-[650] text-v2-green">＋ Adicionar handle</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3">
          <InstaHandle
            handle="@parimoschi"
            meta="Opositor · scan 6/6h"
            status="● ok · último scan 13:40"
            ok
            border
          />
          <InstaHandle
            handle="@tribunajundiai"
            meta="Imprensa · scan 6/6h"
            status="● ok · último scan 13:38"
            ok
            border
          />
          <InstaHandle
            handle="@carlabertolli"
            meta="Opositora · scan 6/6h"
            status="⚠ perfil privado — sem acesso"
          />
        </div>
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
      <div className="mt-3.5 border-t border-v2-track pt-3">
        <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          ÚLTIMAS JOGADAS
        </div>
        {plays.map((p) => (
          <div
            key={p.text}
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

function TabPessoas() {
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
        <PersonRow
          initials="DS"
          avatarTone="green"
          name="Dona Sônia"
          sub="líder comunitária"
          role="Liderança de bairro"
          bairro="📍 Vila Rami"
          msgs="214"
          sentiment="−0.48 ▼"
          sentimentTone="crit"
          signal="MOBILIZANDO"
          signalTone="crit"
          border
        />
        <PersonRow
          initials="PM"
          avatarTone="neutral"
          name="Pastor Miguel"
          sub="influente em 4 grupos"
          role="Liderança religiosa"
          bairro="📍 Retiro"
          msgs="96"
          sentiment="−0.05 —"
          sentimentTone="obs"
          signal="NEUTRO"
          signalTone="obs"
          border
        />
        <PersonRow
          initials="CA"
          avatarTone="green"
          name="Carlão do Esporte"
          sub="apoiador declarado"
          role="Militante"
          bairro="📍 Centro"
          msgs="142"
          sentiment="+0.42 ▲"
          sentimentTone="green"
          signal="DEFENDENDO"
          signalTone="green"
        />
      </div>

      <AiHint>
        <b>Dona Sônia</b> (Vila Rami) organizou o abaixo-assinado da enchente — é a voz a ouvir na
        visita de hoje.
      </AiHint>
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
          <div className="font-mono text-[10.5px] text-v2-faint">{sub}</div>
        </div>
      </div>
      <span className="text-[12.5px] text-v2-ink-2">{role}</span>
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

function TabGrupos() {
  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex w-[300px] items-center gap-2 rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[13px] text-v2-ink-3">
          ⌕ Buscar por nome, bairro ou tag…
        </div>
        <button className="rounded-lg border border-v2-line bg-v2-card px-3 py-2 text-[12.5px] font-semibold text-v2-ink-2">
          Instância: Gabinete ⌄
        </button>
        <span className="rounded-full border border-v2-crit/25 bg-v2-crit-bg/50 px-3 py-2 text-[12.5px] font-semibold text-v2-crit">
          ⚠ 3 sem bairro
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-v2-ink-3">136 monitorados de 142</span>
        <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
          ↻ Sincronizar
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

        <GroupRow
          initials="MV"
          avatarTone="green"
          name="Moradores Vila Rami"
          members="248 participantes"
          bairro={<span className="text-[12.5px] text-v2-ink">📍 Vila Rami</span>}
          tags={["zona norte"]}
          msgs="438 ▲"
          msgsTone="crit"
          on
          border
        />
        <GroupRow
          initials="V2"
          avatarTone="neutral"
          name="Moradores Vila Rami 2"
          members="104 participantes"
          bairro={<span className="text-[12.5px] font-[650] text-v2-crit">⚠ Vincular bairro…</span>}
          tags={[]}
          msgs="96"
          msgsTone="obs"
          on
          border
          highlight
        />
        <GroupRow
          initials="RC"
          avatarTone="neutral"
          name="Retiro Comunidade"
          members="312 participantes"
          bairro={<span className="text-[12.5px] text-v2-ink">📍 Retiro</span>}
          tags={["saúde", "zona norte"]}
          msgs="265 ▲"
          msgsTone="warn"
          on
          border
        />
        <GroupRow
          initials="FC"
          avatarTone="neutral"
          name="Feira do Centro — avisos"
          members="89 participantes"
          bairro={<span className="text-[12.5px] text-v2-ink-3">📍 Centro</span>}
          tags={[]}
          msgs="12"
          msgsTone="faint"
          muted
        />
      </div>
    </div>
  );
}

const MSGS_TONE: Record<string, string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  obs: "text-v2-ink-3",
  faint: "text-v2-faint",
};

function GroupRow({
  initials,
  avatarTone,
  name,
  members,
  bairro,
  tags,
  msgs,
  msgsTone,
  on,
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
  msgs: string;
  msgsTone: string;
  on?: boolean;
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
      <span className={`font-mono text-[12px] ${MSGS_TONE[msgsTone]}`}>{msgs}</span>
      <div className="text-right">
        <Toggle on={!!on} />
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  const [checked, setChecked] = useState(on);
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label="Monitorar grupo"
      onClick={() => setChecked((c) => !c)}
      className={`relative inline-block h-5 w-[34px] rounded-full transition-colors ${checked ? "bg-v2-green" : "bg-v2-line-strong"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "right-0.5" : "left-0.5"}`}
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
