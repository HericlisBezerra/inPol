import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

export const Route = createFileRoute("/v2/relatorios/")({
  head: () => ({ meta: [{ title: "Relatórios — Inpol v2" }] }),
  component: Screen,
});

/** S7 — Relatórios: lista com TL;DR visível — sem abrir já se sabe o que tem dentro. Demo data. */
function Screen() {
  return (
    <div className="mx-auto w-full max-w-[820px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Relatórios</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Diário às 08h · semanal segunda · mensal dia 1º. Também chegam no seu WhatsApp.
          </p>
        </div>
        <button className="rounded-lg bg-v2-ink px-4 py-2 text-[13px] font-[650] text-white">
          Gerar agora ⌄
        </button>
      </div>

      {/* Report list */}
      <div className="mt-[22px] flex flex-col gap-2.5">
        <ReportCard
          reportId="diario-18-jul"
          kind="DIÁRIO"
          kindClass="text-v2-green bg-v2-green-tint"
          title="Sexta, 18 de julho — dia de agir na Vila Rami"
          when="hoje 08:00"
          tldr={
            <>
              <b className="font-bold text-v2-crit">1.</b> Enchente Vila Rami exige resposta até 12h
              &nbsp; <b className="font-bold text-v2-warn">2.</b> UBS Retiro subindo (▲44%) &nbsp;{" "}
              <b className="font-bold text-v2-green">3.</b> Ciclovia é o melhor conteúdo da semana
            </>
          }
          stats={["18,4 mil msgs", "3 alertas"]}
        />
        <ReportCard
          reportId="semanal-28"
          kind="SEMANAL"
          kindClass="text-v2-blue bg-v2-blue-bg"
          title="Semana 28 — sentimento em alta, zona norte em queda"
          when="seg 08:00"
          tldr={
            <>
              Sentimento geral +0.18 (▲0.05). Zona norte concentra 58% das negativas. Oposição
              ativou pauta &ldquo;abandono&rdquo;.
            </>
          }
          stats={["96 mil msgs", "9 alertas"]}
        />
        <ReportCard
          reportId="mensal-junho"
          kind="MENSAL"
          kindClass="text-v2-purple bg-v2-purple-bg"
          title="Junho — balanço do semestre e mapa de riscos"
          when="01 jul 08:00"
          dimmed
        />
      </div>

      {/* IA hint */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span className="text-[14px]">✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          Quer o diário mais curto, ou focado em um tema? Ajuste o formato em{" "}
          <b>Preferências de relatório</b>.
        </span>
      </div>
    </div>
  );
}

function ReportCard({
  reportId,
  kind,
  kindClass,
  kindStyle,
  title,
  when,
  tldr,
  stats,
  dimmed,
}: {
  reportId: string;
  kind: string;
  kindClass?: string;
  kindStyle?: CSSProperties;
  title: string;
  when: string;
  tldr?: ReactNode;
  stats?: string[];
  dimmed?: boolean;
}) {
  return (
    <Link
      to="/v2/relatorios/$reportId"
      params={{ reportId }}
      className={`block rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px] transition-colors hover:border-v2-line-strong ${
        dimmed ? "opacity-75" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`rounded px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.08em] ${kindClass ?? ""}`}
          style={kindStyle}
        >
          {kind}
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-[650] text-v2-ink">{title}</span>
        <span className="font-mono text-[11px] text-v2-faint">{when}</span>
      </div>
      {tldr && (
        <div className="mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-2 border-t border-v2-track pt-3">
          <div className="min-w-[260px] flex-1 text-[13px] leading-[1.55] text-v2-ink-2">
            {tldr}
          </div>
          <div className="flex flex-none items-center gap-3.5 font-mono text-[11px] text-v2-ink-3">
            {stats?.map((s) => (
              <span key={s}>{s}</span>
            ))}
            <span className="font-bold text-v2-green">Abrir →</span>
          </div>
        </div>
      )}
    </Link>
  );
}
