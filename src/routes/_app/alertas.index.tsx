import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listAlerts } from "@/lib/dashboard.functions";
import { resolveAlert } from "@/lib/alerts.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/alertas/")({
  head: () => ({ meta: [{ title: "Alertas — Inpol v2" }] }),
  component: Alertas,
});

/** S3 — Alertas: agrupado por estágio, com janela de ação e triagem em 1 clique.
 * Dados reais via listAlerts/acknowledgeAlert/resolveAlert. `listAlerts` não expõe a
 * coluna `stage` nem `resolved_at` — os 3 grupos visuais (manchete/ativo/borbulhando)
 * são derivados do `level` (vermelho/laranja/amarelo), que é o sinal de severidade
 * mais próximo disponível na assinatura atual do backend.
 */

type AlertRow = {
  id: string;
  level: string;
  topic: string;
  neighborhood: string | null;
  summary: string | null;
  recommended_action: string | null;
  created_at: string;
};

const GROUPS: { level: string; icon: string; label: string; color: string; dot: string }[] = [
  {
    level: "vermelho",
    icon: "🔥",
    label: "MANCHETE IMINENTE · 0–12H",
    color: "text-v2-crit",
    dot: "bg-v2-crit",
  },
  {
    level: "laranja",
    icon: "⚡",
    label: "ATIVO · 12–48H",
    color: "text-v2-warn",
    dot: "bg-v2-warn-strong",
  },
  {
    level: "amarelo",
    icon: "💭",
    label: "BORBULHANDO · 48–72H",
    color: "text-v2-obs",
    dot: "bg-v2-faint",
  },
];

function relTime(iso: string) {
  try {
    return `desde ${format(new Date(iso), "EEE HH:mm", { locale: ptBR })}`;
  } catch {
    return "";
  }
}

function agoTime(iso: string) {
  try {
    return `varrido há ${formatDistanceToNowStrict(new Date(iso), { locale: ptBR })}`;
  } catch {
    return "";
  }
}

function Alertas() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const {
    data: alerts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["alerts", orgId],
    queryFn: () => listAlerts({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  const resolve = useMutation({
    mutationFn: (alertId: string) => resolveAlert({ data: { alertId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", orgId] }),
  });

  const rows = alerts as AlertRow[];
  const grouped = rows.reduce<Record<string, AlertRow[]>>((acc, a) => {
    (acc[a.level] ??= []).push(a);
    return acc;
  }, {});
  const mostRecent = rows[0]?.created_at;

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
            {mostRecent ? agoTime(mostRecent) : ""}
          </span>
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
            ↻ Detectar agora
          </button>
        </div>
      </div>

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os alertas. Tente novamente.
        </div>
      )}

      {/* Stage counters */}
      <div className="mt-5 mb-[26px] flex flex-col gap-2.5 sm:flex-row">
        {GROUPS.map((g) => (
          <StageStat
            key={g.level}
            dot={g.dot}
            label={
              g.level === "vermelho"
                ? "Manchete iminente"
                : g.level === "laranja"
                  ? "Ativo"
                  : "Borbulhando"
            }
            count={isLoading ? "…" : (grouped[g.level]?.length ?? 0)}
          />
        ))}
        <StageStat dot="bg-v2-green" label="Resolvidos (7d)" count="—" />
      </div>

      {!isLoading && rows.length === 0 && !isError && (
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-6 text-center text-[13.5px] text-v2-ink-3">
          Nenhum alerta em aberto no momento. 🎉
        </div>
      )}

      {GROUPS.map((g) => {
        const items = grouped[g.level] ?? [];
        if (items.length === 0) return null;
        const [first, ...rest] = items;
        return (
          <div key={g.level}>
            <div className={`mb-2 font-mono text-[11px] font-bold tracking-[0.1em] ${g.color}`}>
              {g.icon} {g.label}
            </div>

            {g.level === "vermelho" ? (
              <FeaturedAlert alert={first} onResolve={() => resolve.mutate(first.id)} />
            ) : (
              <AlertRowItem
                alert={first}
                onResolve={() => resolve.mutate(first.id)}
                className="mb-[22px]"
              />
            )}
            {rest.map((a) => (
              <AlertRowItem
                key={a.id}
                alert={a}
                onResolve={() => resolve.mutate(a.id)}
                className="mb-[22px]"
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StageStat({ dot, label, count }: { dot: string; label: string; count: number | string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[11px] border border-v2-line bg-v2-card px-4 py-3">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="flex-1 text-[13px] text-v2-ink-2">{label}</span>
      <span className="text-[18px] font-[650] text-v2-ink">{count}</span>
    </div>
  );
}

function FeaturedAlert({ alert, onResolve }: { alert: AlertRow; onResolve: () => void }) {
  return (
    <div className="mb-[22px] overflow-hidden rounded-[13px] border border-v2-line bg-v2-card shadow-[0_1px_2px_rgba(33,31,28,0.04)]">
      <div className="h-1 bg-v2-crit" />
      <div className="px-[22px] py-[18px]">
        <div className="flex items-start gap-3.5">
          <div className="flex-1">
            <Link
              to="/alertas/$alertId"
              params={{ alertId: alert.id }}
              className="text-[17px] font-[650] text-v2-ink hover:text-v2-green"
            >
              {alert.topic}
            </Link>
            {alert.summary && (
              <p className="mt-[5px] text-[13.5px] leading-[1.55] text-v2-ink-2">{alert.summary}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-3.5 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
              {alert.neighborhood && <span>📍 {alert.neighborhood}</span>}
              <span>{relTime(alert.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-none flex-col gap-2">
            <Link
              to="/alertas/$alertId"
              params={{ alertId: alert.id }}
              className="rounded-lg bg-v2-ink px-4 py-2 text-center text-[13px] font-[650] text-white"
            >
              Roteiro de ação
            </Link>
            <button
              onClick={onResolve}
              className="text-center text-[13px] font-[650] text-v2-green"
            >
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
  );
}

function AlertRowItem({
  alert,
  onResolve,
  className = "",
}: {
  alert: AlertRow;
  onResolve: () => void;
  className?: string;
}) {
  const meta = [
    alert.neighborhood ? `📍 ${alert.neighborhood}` : null,
    relTime(alert.created_at),
  ].filter(Boolean) as string[];
  return (
    <div
      className={`flex items-center gap-3.5 rounded-xl border border-v2-line bg-v2-card px-[22px] py-4 ${className}`}
    >
      <div className="flex-1">
        <Link
          to="/alertas/$alertId"
          params={{ alertId: alert.id }}
          className="text-[15px] font-[650] text-v2-ink hover:text-v2-green"
        >
          {alert.topic}
        </Link>
        {alert.summary && <p className="mt-1 text-[13px] text-v2-ink-2">{alert.summary}</p>}
        {meta.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3.5 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-none items-center gap-2.5">
        <Link
          to="/alertas/$alertId"
          params={{ alertId: alert.id }}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-[7px] text-[13px] font-[650] text-v2-ink"
        >
          Roteiro
        </Link>
        <button onClick={onResolve} className="text-[13px] font-[650] text-v2-green">
          ✓
        </button>
      </div>
    </div>
  );
}
