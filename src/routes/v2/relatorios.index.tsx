import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/reports.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/v2/relatorios/")({
  head: () => ({ meta: [{ title: "Relatórios — Inpol v2" }] }),
  component: Screen,
});

const KIND_META: Record<string, { label: string; kindClass: string }> = {
  daily: { label: "DIÁRIO", kindClass: "text-v2-green bg-v2-green-tint" },
  weekly: { label: "SEMANAL", kindClass: "text-v2-blue bg-v2-blue-bg" },
  monthly: { label: "MENSAL", kindClass: "text-v2-purple bg-v2-purple-bg" },
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * S7 — Relatórios: lista com TL;DR visível — sem abrir já se sabe o que tem dentro.
 * Dados reais via listReports (org atual). Botão "Gerar agora" mantido apenas visual —
 * a geração manual está desativada em toda a base (ver src/routes/_authenticated/reports.tsx);
 * não reativar sem pedido explícito.
 */
function Screen() {
  const { orgId } = useCurrentOrg();

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["reports", orgId],
    queryFn: () => listReports({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

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
        <button
          disabled
          title="Geração manual temporariamente desativada"
          className="rounded-lg bg-v2-ink px-4 py-2 text-[13px] font-[650] text-white disabled:opacity-50"
        >
          Gerar agora ⌄
        </button>
      </div>

      {!orgId && (
        <div className="mt-[22px] text-[13px] text-v2-ink-3">Selecione uma organização.</div>
      )}

      {orgId && isError && (
        <div className="mt-[22px] text-[13px] text-v2-crit">
          Não foi possível carregar os relatórios. Tente novamente.
        </div>
      )}

      {orgId && isLoading && <div className="mt-[22px] text-[13px] text-v2-ink-3">Carregando…</div>}

      {orgId && !isLoading && !isError && reports.length === 0 && (
        <div className="mt-[22px] text-[13px] text-v2-ink-3">
          Nenhum relatório ainda. O primeiro chega no próximo agendamento.
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 && (
        <div className="mt-[22px] flex flex-col gap-2.5">
          {reports.map((r) => {
            const meta = KIND_META[r.kind] ?? { label: r.kind.toUpperCase(), kindClass: "" };
            return (
              <ReportCard
                key={r.id}
                reportId={r.id}
                kind={meta.label}
                kindClass={meta.kindClass}
                title={r.title ?? meta.label}
                when={formatWhen(r.generated_at)}
              />
            );
          })}
        </div>
      )}

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
