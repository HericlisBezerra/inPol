import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, acknowledgeAlert, syncNow } from "@/lib/dashboard.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  MapPin,
  RefreshCw,
  Eye,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Inpol" }] }),
  component: Dashboard,
});

function levelColor(level: string) {
  if (level === "critical" || level === "vermelho")
    return "bg-destructive/20 text-destructive border-destructive/40";
  if (level === "high" || level === "laranja")
    return "bg-amber-500/20 text-amber-500 border-amber-500/40";
  if (level === "medium" || level === "amarelo")
    return "bg-yellow-500/20 text-yellow-500 border-yellow-500/40";
  return "bg-muted text-muted-foreground border-border";
}

function Dashboard() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => getDashboard({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const ack = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert({ data: { orgId: orgId!, alertId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", orgId] });
      toast.success("Alerta arquivado");
    },
  });

  if (!orgId) return <div className="p-8 text-muted-foreground">Selecione uma organização.</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="label-mono">🎛️ Painel</div>
          <h1 className="font-display text-3xl mt-1">Visão geral em tempo real ⚡</h1>
        </div>
        <SyncButton orgId={orgId} />
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiBig
          icon={<Eye className="size-4" />}
          label="Cobertura de grupos monitorados"
          value={data?.kpi ? `${data.kpi.coverage}%` : "—"}
          delta={
            data?.kpi ? `${data.kpi.monitored}/${data.kpi.totalGroups} grupos monitorados` : ""
          }
          tone="positive"
        />
        <KpiBig
          icon={<Clock className="size-4" />}
          label="Mensagens analisadas (7d)"
          value={data?.kpi ? data.kpi.analyzed7d.toLocaleString("pt-BR") : "—"}
          delta="fonte: IA + WhatsApp"
          tone="positive"
        />
        <KpiBig
          icon={<Sparkles className="size-4" />}
          label="Horas/dia liberadas do assessor"
          value={data?.kpi ? `${data.kpi.hoursSavedPerDay}h` : "—"}
          delta="baseado em 6s por mensagem"
          tone="positive"
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          icon={<MessageSquare className="size-4" />}
          label="Mensagens / 24h"
          value={isLoading ? "—" : (data?.msg24h ?? 0).toLocaleString("pt-BR")}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label="Alertas abertos"
          value={isLoading ? "—" : (data?.alerts.length ?? 0)}
          accent={(data?.alerts.length ?? 0) > 0 ? "warn" : undefined}
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Temas ativos (7d)"
          value={isLoading ? "—" : (data?.topics.length ?? 0)}
        />
      </div>

      <section>
        <h2 className="font-display text-xl mb-3">🚨 Alertas abertos</h2>
        <div className="space-y-2">
          {(data?.alerts ?? []).length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground bg-surface">
              Nenhum alerta aberto.
            </Card>
          )}
          {data?.alerts.map((a) => (
            <Card key={a.id} className="p-4 bg-surface">
              <div className="flex items-start gap-3">
                <Badge className={`${levelColor(a.level)} border`}>{a.level}</Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{a.topic ?? "Sem tópico"}</span>
                    {a.neighborhood && (
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {a.neighborhood}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.summary}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => ack.mutate(a.id)}
                  disabled={ack.isPending}
                >
                  Arquivar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-xl mb-3">🔥 Temas em alta</h2>
          <Card className="p-4 bg-surface">
            {(data?.topics ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
            <ul className="space-y-2">
              {data?.topics.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {t.message_count} msg · risco {t.max_risk}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <h2 className="font-display text-xl mb-3">💬 Mensagens críticas recentes</h2>
          <Card className="p-4 bg-surface space-y-3">
            {(data?.recentCritical ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma.</p>
            )}
            {data?.recentCritical.map((m) => (
              <div key={m.id} className="text-sm border-b border-border pb-2 last:border-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">risco {m.risk_score}</span>
                  {m.neighborhood && <span>· {m.neighborhood}</span>}
                  {m.topic && <span>· {m.topic}</span>}
                </div>
                <p className="mt-1">{m.summary}</p>
              </div>
            ))}
          </Card>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: "warn";
}) {
  return (
    <Card className="p-5 bg-surface">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="label-mono">{label}</span>
      </div>
      <div className={`font-display text-4xl mt-2 ${accent === "warn" ? "text-warning" : ""}`}>
        {value}
      </div>
    </Card>
  );
}

function KpiBig({
  icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "negative";
}) {
  return (
    <Card className="p-5 bg-surface">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="label-mono text-[10px]">{label}</span>
      </div>
      <div className="font-display text-4xl mt-2 text-primary">{value}</div>
      <div
        className={`text-xs mt-1 ${tone === "positive" ? "text-emerald-500" : "text-destructive"}`}
      >
        {delta}
      </div>
    </Card>
  );
}

function SyncButton({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncNow);
  const mut = useMutation({
    mutationFn: () => syncFn({ data: { orgId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["dashboard", orgId] });
      qc.invalidateQueries({ queryKey: ["alerts-all", orgId] });
      toast.success(`Sincronização concluída · ${r.alerts_upserted} alerta(s) atualizados`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na sincronização"),
  });
  return (
    <Button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`} /> Sincronizar agora
    </Button>
  );
}
