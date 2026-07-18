import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/alertas/")({
  head: () => ({ meta: [{ title: "Alertas — Inpol v2" }] }),
  component: Alertas,
});

/** S3 — Alertas: agrupado por estágio, com janela de ação e triagem em 1 clique. Demo data. */
function Alertas() {
  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Alertas</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Crises detectadas antes da imprensa. Cada tema recebe estágio e janela de ação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-mono text-[11px] text-v2-ink-3">
            varrido há 4 min
          </span>
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
            ↻ Detectar agora
          </button>
        </div>
      </div>

      {/* Stage counters */}
      <div className="mt-5 mb-[26px] flex flex-col gap-2.5 sm:flex-row">
        <StageStat dot="bg-v2-crit" label="Manchete iminente" count={1} />
        <StageStat dot="bg-v2-warn-strong" label="Ativo" count={1} />
        <StageStat dot="bg-v2-faint" label="Borbulhando" count={1} />
        <StageStat dot="bg-v2-green" label="Resolvidos (7d)" count={6} />
      </div>

      {/* MANCHETE IMINENTE */}
      <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-crit">
        🔥 MANCHETE IMINENTE · 0–12H
      </div>
      <div className="mb-[22px] overflow-hidden rounded-[13px] border border-v2-line bg-v2-card shadow-[0_1px_2px_rgba(33,31,28,0.04)]">
        <div className="h-1 bg-v2-crit" />
        <div className="px-[22px] py-[18px]">
          <div className="flex items-start gap-3.5">
            <div className="flex-1">
              <Link
                to="/v2/alertas/$alertId"
                params={{ alertId: "vila-rami" }}
                className="text-[17px] font-[650] text-v2-ink hover:text-v2-green"
              >
                Enchente na Vila Rami sem resposta da prefeitura
              </Link>
              <p className="mt-[5px] text-[13.5px] leading-[1.55] text-v2-ink-2">
                214 mensagens em 6 grupos citam abandono; vídeo com 3,2 mil compartilhamentos.
                Tribuna de Jundiaí sondando moradores.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3.5 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
                <span>📍 Vila Rami</span>
                <span>desde qui 22:14</span>
                <span className="text-v2-crit">escalou 2× em 12h</span>
              </div>
            </div>
            <div className="flex flex-none flex-col gap-2">
              <Link
                to="/v2/alertas/$alertId"
                params={{ alertId: "vila-rami" }}
                className="rounded-lg bg-v2-ink px-4 py-2 text-center text-[13px] font-[650] text-white"
              >
                Roteiro de ação
              </Link>
              <button className="text-center text-[13px] font-[650] text-v2-green">
                ✓ Resolver
              </button>
            </div>
          </div>
          {/* Stage meter */}
          <div className="mt-3.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-v2-ink-3">ESTÁGIO</span>
            <div className="flex gap-1">
              <span className="h-1.5 w-14 rounded-[3px] bg-v2-warn-strong" />
              <span
                className="h-1.5 w-14 rounded-[3px]"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-v2-warn-strong) 45%, var(--color-v2-crit))",
                }}
              />
              <span className="h-1.5 w-14 rounded-[3px] bg-v2-crit" />
            </div>
            <span className="font-mono text-[10px] text-v2-crit">MANCHETE</span>
          </div>
        </div>
      </div>

      {/* ATIVO */}
      <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-warn">
        ⚡ ATIVO · 12–48H
      </div>
      <AlertRow
        alertId="retiro-ubs"
        title="Fila de 5h no posto de saúde do Retiro"
        desc="87 reclamações em 48h, sentimento −0.61. Vereador de oposição repostando prints."
        meta={["📍 Retiro", "desde qua 09:30"]}
        className="mb-[22px]"
      />

      {/* BORBULHANDO */}
      <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
        💭 BORBULHANDO · 48–72H
      </div>
      <AlertRow
        alertId="creche-anhangabau"
        title="Boato sobre fechamento de creche no Anhangabaú"
        desc="12 menções em 2 grupos. Sem confirmação oficial — monitorando propagação."
      />
    </div>
  );
}

function StageStat({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[11px] border border-v2-line bg-v2-card px-4 py-3">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="flex-1 text-[13px] text-v2-ink-2">{label}</span>
      <span className="text-[18px] font-[650] text-v2-ink">{count}</span>
    </div>
  );
}

function AlertRow({
  alertId,
  title,
  desc,
  meta,
  className = "",
}: {
  alertId: string;
  title: string;
  desc: string;
  meta?: string[];
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-xl border border-v2-line bg-v2-card px-[22px] py-4 ${className}`}
    >
      <div className="flex-1">
        <Link
          to="/v2/alertas/$alertId"
          params={{ alertId }}
          className="text-[15px] font-[650] text-v2-ink hover:text-v2-green"
        >
          {title}
        </Link>
        <p className="mt-1 text-[13px] text-v2-ink-2">{desc}</p>
        {meta && (
          <div className="mt-2 flex flex-wrap gap-3.5 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-none items-center gap-2.5">
        <Link
          to="/v2/alertas/$alertId"
          params={{ alertId }}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-[7px] text-[13px] font-[650] text-v2-ink"
        >
          Roteiro
        </Link>
        <button className="text-[13px] font-[650] text-v2-green">✓</button>
      </div>
    </div>
  );
}
