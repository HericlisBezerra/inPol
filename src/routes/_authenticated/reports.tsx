import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/reports.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Inpol" }] }),
  component: ReportsLayout,
});

function ReportsLayout() {
  const { orgId } = useCurrentOrg();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showDetail = pathname.startsWith("/reports/");

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", orgId],
    queryFn: () => listReports({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  if (showDetail) return <Outlet />;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label-mono">📄 Relatórios</div>
          <h1 className="font-display text-3xl mt-1">Sínteses geradas por IA 🤖</h1>
          <p className="text-sm text-muted-foreground mt-1">Diário às 08h, semanal toda segunda, mensal todo dia 1º.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled title="Geração manual temporariamente desativada">
            ☀️ Gerar diário
          </Button>
          <Button size="sm" variant="outline" disabled title="Geração manual temporariamente desativada">
            📅 Semanal
          </Button>
          <Button size="sm" variant="outline" disabled title="Geração manual temporariamente desativada">
            📊 Mensal
          </Button>
        </div>
      </header>
      <p className="text-xs text-muted-foreground -mt-4">⏸️ Geração manual temporariamente desativada. Os agendamentos automáticos continuam ativos.</p>

      <div className="space-y-2">
        {reports.length === 0 && (
          <Card className="p-6 bg-surface text-sm text-muted-foreground">
            Nenhum relatório ainda. Gere um agora ou aguarde o agendamento diário das 8h.
          </Card>
        )}
        {reports.map((r) => (
          <Link
            key={r.id}
            to="/reports/$reportId"
            params={{ reportId: r.id }}
            className="block"
          >
            <Card className="p-4 bg-surface hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{r.kind === "daily" ? "☀️" : r.kind === "weekly" ? "📅" : "📊"}</span>
                  <div>
                    <div className="label-mono">{r.kind}</div>
                    <div className="font-medium mt-0.5">{r.title}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  🕐 {new Date(r.generated_at).toLocaleString("pt-BR")}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
