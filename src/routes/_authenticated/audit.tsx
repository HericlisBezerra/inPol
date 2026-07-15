import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Download, Trash2, RefreshCw } from "lucide-react";
import { RestrictedGate } from "@/components/restricted-gate";
import { getLgpdPolicy, saveLgpdPolicy, runPurgeNow } from "@/lib/lgpd.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Auditoria LGPD — Inpol" }] }),
  component: () => (
    <RestrictedGate>
      <Audit />
    </RestrictedGate>
  ),
});

const LGPD_LABEL: Record<string, string> = {
  collection: "📥 Coleta",
  anonymization: "🕶️ Anonimização",
  retention_purge: "🗑️ Descarte por retenção",
  export_request: "📤 Pedido de exportação",
  consent: "✅ Consentimento",
};
const KIND_LABEL: Record<string, string> = {
  message: "mensagem", system: "sistema", group: "grupo", member: "pessoa", author: "titular",
};

function Audit() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");

  const getPol = useServerFn(getLgpdPolicy);
  const savePol = useServerFn(saveLgpdPolicy);
  const purge = useServerFn(runPurgeNow);

  const { data: pol } = useQuery({
    queryKey: ["lgpd-policy", orgId],
    enabled: !!orgId,
    queryFn: () => getPol({ data: { orgId: orgId! } }),
  });

  const [retention, setRetention] = useState<number>(180);
  const [allowExport, setAllowExport] = useState<boolean>(true);
  const [dpoEmail, setDpoEmail] = useState<string>("");

  useEffect(() => {
    if (pol) {
      setRetention(pol.retention_days ?? 180);
      setAllowExport(pol.allow_export ?? true);
      setDpoEmail(pol.dpo_email ?? "");
    }
  }, [pol]);

  const saveMut = useMutation({
    mutationFn: () =>
      savePol({ data: { orgId: orgId!, retentionDays: retention, allowExport, dpoEmail: dpoEmail || null } }),
    onSuccess: () => { toast.success("Política salva"); qc.invalidateQueries({ queryKey: ["lgpd-policy", orgId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const purgeMut = useMutation({
    mutationFn: () => purge({ data: { orgId: orgId! } }),
    onSuccess: (r) => { toast.success(`Purga executada · ${r.deleted} mensagens removidas`); qc.invalidateQueries({ queryKey: ["lgpd", orgId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const { data: lgpd = [] } = useQuery({
    queryKey: ["lgpd", orgId, filter],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from("lgpd_events")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter) q = q.eq("event_type", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const exportCsv = () => {
    const header = ["created_at", "event_type", "subject_kind", "subject_id"];
    const rows = lgpd.map((e) => [e.created_at, e.event_type, e.subject_kind ?? "", e.subject_id ?? ""]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lgpd-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <header className="flex items-start gap-3">
        <ShieldCheck className="size-6 text-primary mt-2" />
        <div>
          <div className="label-mono">🛡️ Compliance · LGPD</div>
          <h1 className="font-display text-3xl mt-1">Trilha auditável 📋</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Cada coleta, anonimização, descarte e exportação é registrada automaticamente.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-surface">
          <h3 className="font-display text-lg mb-3">Política</h3>
          <div className="space-y-3">
            <div>
              <Label>Retenção (dias)</Label>
              <Input type="number" min={7} max={3650} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Mensagens mais antigas são deletadas pela purga mensal automática.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir exportação por titular</Label>
                <p className="text-xs text-muted-foreground">Habilita download dos dados de um autor específico.</p>
              </div>
              <Switch checked={allowExport} onCheckedChange={setAllowExport} />
            </div>
            <div>
              <Label>E-mail do DPO</Label>
              <Input type="email" value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)} placeholder="dpo@..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>Salvar política</Button>
              <Button variant="outline" disabled={purgeMut.isPending} onClick={() => confirm("Executar purga agora?") && purgeMut.mutate()}>
                <Trash2 className="size-4 mr-1" /> Purgar agora
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-surface">
          <h3 className="font-display text-lg mb-3">Filtros e export</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilter("")} className={`px-3 py-1 rounded border text-xs ${filter === "" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>todos</button>
              {Object.entries(LGPD_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1 rounded border text-xs ${filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{v}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4 mr-1" /> Exportar CSV</Button>
              <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["lgpd", orgId, filter] })}>
                <RefreshCw className="size-4 mr-1" /> Recarregar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">Mostrando {lgpd.length} eventos.</div>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-surface">
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {lgpd.map((e) => (
            <div key={e.id} className="text-sm border-b border-border pb-2 last:border-0">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs">{LGPD_LABEL[e.event_type] ?? e.event_type}</Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {KIND_LABEL[e.subject_kind ?? ""] ?? e.subject_kind ?? "—"} · {e.subject_id ?? ""}
              </div>
            </div>
          ))}
          {lgpd.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhum evento no filtro atual.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
