import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2-admin")({
  head: () => ({
    meta: [{ title: "Admin — Inpol v2" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap",
      },
    ],
  }),
  component: Screen,
});

/**
 * S28 — Admin da plataforma (interno inPol): saúde das organizações e da ingestão.
 * Tela STANDALONE: chrome próprio (header escuro exclusivo), sem o topnav do cliente.
 */
function Screen() {
  return (
    <div className="v2-root min-h-screen bg-v2-bg text-v2-ink">
      {/* Header próprio do admin — escuro, sem nav do cliente */}
      <header className="flex items-center gap-6 border-b border-v2-line bg-v2-ink px-10 py-3.5">
        <span className="font-display text-[21px] font-semibold text-v2-card">
          In<i className="text-v2-mint">pol</i>
          <span className="text-v2-mint">.</span>
        </span>
        <span className="rounded bg-v2-gold px-2 py-[3px] font-mono text-[9.5px] font-bold tracking-[0.1em] text-v2-panel-gold">
          ADMIN PLATAFORMA
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-v2-faint">acesso restrito · registrado</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-v2-mint text-[12px] font-semibold text-v2-panel">
          IN
        </span>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 py-8">
        {/* KPIs da plataforma */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Organizações ativas" value="28" />
          <Kpi label="Msgs ingeridas / 24h" value="412 mil" />
          <Kpi label="Fila de análise IA" value="saudável · 40s" tone="green" />
          <Kpi label="Instâncias com erro" value="3" tone="crit" />
        </div>

        {/* Tabela de organizações */}
        <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
                <span>ORGANIZAÇÃO</span>
                <span>PLANO</span>
                <span>MODO</span>
                <span>INGESTÃO 24H</span>
                <span>STATUS</span>
              </div>
              <OrgRow
                org="Prefeitura de Jundiaí"
                plano="Cidade"
                modo="GESTÃO"
                modoTone="green"
                ingestao="18,4 mil"
                status="● ok"
                statusTone="green"
                border
              />
              <OrgRow
                org="Prefeitura de Itupeva"
                plano="Gabinete"
                modo="GESTÃO"
                modoTone="green"
                ingestao="0 ▼"
                ingestaoTone="crit"
                status="⚠ instância desconectada há 6h"
                statusTone="crit"
                alert
                border
              />
              <OrgRow
                org="Campanha Marina 2028"
                plano="Guerra"
                modo="ELEIÇÃO"
                modoTone="warn"
                ingestao="31,2 mil"
                status="● ok"
                statusTone="green"
              />
            </div>
          </div>
        </div>

        {/* Saúde do pipeline */}
        <div className="mt-8 mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-v2-green" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-v2-ink-3">
            Saúde do pipeline
          </span>
          <span className="font-mono text-[10.5px] text-v2-faint">· Prefeitura de Jundiaí</span>
        </div>

        {/* Coleta por fonte */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SourceCard
            name="WhatsApp · Evolution"
            last="sincronizado há 4 min"
            volume="18,4 mil msgs / 24h"
            statusText="webhook ativo"
            statusTone="green"
          />
          <SourceCard
            name="Imprensa · Firecrawl + grounding"
            last="varredura há 2h"
            volume="142 artigos / 24h"
            statusText="ok"
            statusTone="green"
          />
          <SourceCard
            name="Instagram · Apify"
            last="coleta há 3h"
            volume="1,2 mil posts / 24h"
            statusText="ok"
            statusTone="green"
          />
        </div>

        {/* Cotas grátis do mês (free-first) + Análise/Relatórios */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[13.5px] font-[650] text-v2-ink">Cotas grátis do mês</span>
              <span className="font-mono text-[10px] text-v2-faint">FREE-FIRST</span>
            </div>
            <QuotaBar
              label="Firecrawl (descoberta + scrape)"
              used={640}
              total={1000}
              tone="green"
            />
            <QuotaBar label="Grounding Gemini (buffer)" used={180} total={5000} tone="green" />
            <div className="mt-2 font-mono text-[10.5px] text-v2-faint">
              DeepSeek (micro-análise): sem cota grátis · ~$1,80 no mês
            </div>
          </div>
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-3 text-[13.5px] font-[650] text-v2-ink">
              Análise & relatórios (24h)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MiniStat label="Resolvido por matemática (L0)" value="58%" tone="green" />
              <MiniStat label="Resolvido por IA (DeepSeek)" value="42%" />
              <MiniStat label="Fila de análise" value="12 pendentes" />
              <MiniStat label="Em erro (reprocessando)" value="3" tone="warn" />
              <MiniStat label="Relatórios gerados" value="3" tone="green" />
              <MiniStat label="Em modo contingência" value="0" tone="green" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SourceCard({
  name,
  last,
  volume,
  statusText,
  statusTone,
}: {
  name: string;
  last: string;
  volume: string;
  statusText: string;
  statusTone: "green" | "warn" | "crit";
}) {
  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-[650] text-v2-ink">{name}</span>
        <span
          className={`flex items-center gap-1.5 font-mono text-[10.5px] ${TONE_TEXT[statusTone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full bg-current`} />
          {statusText}
        </span>
      </div>
      <div className="mt-2 text-[15px] font-[650] text-v2-ink">{volume}</div>
      <div className="mt-0.5 font-mono text-[11px] text-v2-faint">{last}</div>
    </div>
  );
}

function QuotaBar({
  label,
  used,
  total,
  tone,
}: {
  label: string;
  used: number;
  total: number;
  tone: "green" | "warn" | "crit";
}) {
  const pct = Math.max(2, Math.min(100, Math.round((used / total) * 100)));
  const fill =
    tone === "crit" ? "bg-v2-crit" : tone === "warn" ? "bg-v2-warn-strong" : "bg-v2-green";
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-[12.5px]">
        <span className="text-v2-ink-2">{label}</span>
        <span className="font-mono text-[11px] text-v2-ink-3">
          {used.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="mt-1.5 h-[5px] rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "warn";
}) {
  const color =
    tone === "green" ? "text-v2-green" : tone === "warn" ? "text-v2-warn" : "text-v2-ink";
  return (
    <div>
      <div className="text-[11.5px] leading-tight text-v2-ink-3">{label}</div>
      <div className={`mt-0.5 text-[16px] font-[650] ${color}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "crit" }) {
  const valueColor =
    tone === "green" ? "text-v2-green" : tone === "crit" ? "text-v2-crit" : "text-v2-ink";
  return (
    <div className="rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      <div className={`mt-[3px] text-[22px] font-[650] ${valueColor}`}>{value}</div>
    </div>
  );
}

const TONE_TEXT: Record<string, string> = {
  green: "text-v2-green",
  warn: "text-v2-warn",
  crit: "text-v2-crit",
};

function OrgRow({
  org,
  plano,
  modo,
  modoTone,
  ingestao,
  ingestaoTone,
  status,
  statusTone,
  alert,
  border,
}: {
  org: string;
  plano: string;
  modo: string;
  modoTone: "green" | "warn";
  ingestao: string;
  ingestaoTone?: "crit";
  status: string;
  statusTone: "green" | "crit";
  alert?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.6fr_0.8fr_0.8fr_0.9fr_0.9fr] items-center gap-3 px-5 py-3 text-[13px] ${
        border ? "border-b border-v2-track" : ""
      } ${alert ? "bg-v2-crit-bg/50" : ""}`}
    >
      <span className="font-semibold text-v2-ink">{org}</span>
      <span className="text-v2-ink-2">{plano}</span>
      <span className={`font-mono text-[10.5px] ${TONE_TEXT[modoTone]}`}>{modo}</span>
      <span
        className={`font-mono text-[12px] ${ingestaoTone ? TONE_TEXT[ingestaoTone] : "text-v2-ink"}`}
      >
        {ingestao}
      </span>
      <span className={`font-mono text-[11px] ${TONE_TEXT[statusTone]}`}>{status}</span>
    </div>
  );
}
