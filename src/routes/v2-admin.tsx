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
      </main>
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
