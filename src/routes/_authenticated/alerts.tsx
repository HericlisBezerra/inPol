import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { runDetectAlerts, resolveAlert } from "@/lib/alerts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alertas — Inpol" }] }),
  component: Alerts,
});

function levelColor(l: string) {
  if (l === "vermelho") return "bg-destructive/20 text-destructive border-destructive/40";
  if (l === "laranja") return "bg-amber-500/20 text-amber-500 border-amber-500/40";
  return "bg-yellow-500/20 text-yellow-500 border-yellow-500/40";
}
function levelEmoji(l: string) {
  if (l === "vermelho") return "🔴";
  if (l === "laranja") return "🟠";
  return "🟡";
}
function stageMeta(stage: string | null | undefined, level: string) {
  const s = stage ?? (level === "vermelho" ? "ativo" : "borbulhando");
  if (s === "manchete") return { label: "manchete iminente", eta: "0–12h", emoji: "🔥" };
  if (s === "ativo") return { label: "ativo", eta: "12–48h", emoji: "⚡" };
  return { label: "borbulhando", eta: "48–72h", emoji: "💭" };
}

function Alerts() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const runFn = useServerFn(runDetectAlerts);
  const resolveFn = useServerFn(resolveAlert);

  const { data = [], refetch } = useQuery({
    queryKey: ["alerts-all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("org_id", orgId!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const detectMut = useMutation({
    mutationFn: () => runFn({ data: { orgId: orgId! } }),
    onSuccess: (r) => {
      toast.success(`Varredura concluída · ${r.upserted} alerta(s) atualizados`);
      qc.invalidateQueries({ queryKey: ["alerts-all", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na detecção"),
  });

  const resolveMut = useMutation({
    mutationFn: (alertId: string) => resolveFn({ data: { alertId } }),
    onSuccess: () => {
      toast.success("Alerta resolvido");
      refetch();
    },
  });

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="label-mono">🚨 Alertas</div>
          <h1 className="font-display text-3xl mt-1">Crises detectadas antes da imprensa 📰</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Cada tema tóxico recebe alerta classificado por estágio. Clique para ver o roteiro de ação.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={detectMut.isPending || !orgId}
          onClick={() => detectMut.mutate()}
        >
          <RefreshCw className={`size-4 mr-2 ${detectMut.isPending ? "animate-spin" : ""}`} />
          Detectar agora
        </Button>
      </header>

      <div className="space-y-3">
        {data.map((a) => {
          const s = stageMeta((a as { stage?: string }).stage, a.level);
          return (
            <Card key={a.id} className="p-4 bg-surface hover:bg-surface-2 transition-colors">
              <div className="flex items-start gap-3">
                <Badge className={`${levelColor(a.level)} border uppercase font-mono text-[10px]`}>
                  {levelEmoji(a.level)} {a.level}
                </Badge>
                <div className="flex-1 min-w-0">
                  <Link to="/alerts/$alertId" params={{ alertId: a.id }} className="block">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{a.topic}</span>
                      {a.neighborhood && (
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {a.neighborhood}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.summary}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-muted-foreground">Estágio:</span>
                      <span className="font-mono">{s.emoji} {s.label}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-primary">⏱️ janela: {s.eta}</span>
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      resolveMut.mutate(a.id);
                    }}
                    title="Marcar como resolvido"
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                  <Link to="/alerts/$alertId" params={{ alertId: a.id }}>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
        {data.length === 0 && (
          <Card className="p-6 bg-surface text-sm text-muted-foreground">
            Nenhum alerta aberto. Clique em "Detectar agora" para varrer as últimas 72h.
          </Card>
        )}
      </div>
    </div>
  );
}
