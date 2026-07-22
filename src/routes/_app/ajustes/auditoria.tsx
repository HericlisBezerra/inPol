import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import {
  getLgpdPolicy,
  runPurgeNow,
  exportSubjectData,
  deleteSubjectData,
} from "@/lib/lgpd.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ajustes/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria LGPD — Ajustes" }] }),
  component: Screen,
});

type AuditRow = {
  id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  target_kind: string | null;
  target_id: string | null;
  metadata: unknown;
};

// Mapeia as ações conhecidas gravadas em audit_log (whatsapp.functions.ts, backfill.server.ts,
// reports-share.functions.ts, orgs.functions.ts) para um texto legível em pt-BR.
const ACTION_LABEL: Record<string, (row: AuditRow) => ReactNode> = {
  "whatsapp.instance.created": () => <>Conectou uma instância do WhatsApp</>,
  "whatsapp.instance.deleted": () => <>Removeu uma instância do WhatsApp</>,
  "whatsapp.groups.synced": (r) => {
    const count = (r.metadata as { count?: number } | null)?.count;
    return <>Sincronizou grupos do WhatsApp{typeof count === "number" ? ` · ${count}` : ""}</>;
  },
  "whatsapp.backfill.run": (r) => {
    const m = r.metadata as { days?: number; inserted?: number } | null;
    return (
      <>
        Rodou backfill de mensagens
        {m?.days ? ` · ${m.days}d` : ""}
        {typeof m?.inserted === "number" ? ` · ${m.inserted} inseridas` : ""}
      </>
    );
  },
  "report.share.sanitized": () => <>Revisou relatório para compartilhamento público</>,
  "report.share.enabled": () => <>Publicou link público de relatório</>,
  "report.share.revoked": () => <>Revogou link público de relatório</>,
  "org.created": () => <>Criou a organização</>,
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `hoje ${time}`;
  if (isYesterday) return `ontem ${time}`;
  return `${d.toLocaleDateString("pt-BR")} ${time}`;
}

/** S24 — Ajustes · Auditoria LGPD: trilha imutável de acessos (audit_log) + política de retenção. */
function Screen() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  const getPol = useServerFn(getLgpdPolicy);
  const purge = useServerFn(runPurgeNow);
  const exportSubject = useServerFn(exportSubjectData);
  const deleteSubject = useServerFn(deleteSubjectData);

  const [subjectHash, setSubjectHash] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: pol } = useQuery({
    queryKey: ["lgpd-policy", orgId],
    enabled: !!orgId,
    queryFn: () => getPol({ data: { orgId: orgId! } }),
  });

  const {
    data: trail = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["audit-log", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, actor_id, created_at, target_kind, target_id, metadata")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditRow[];
    },
  });

  const purgeMut = useMutation({
    mutationFn: () => purge({ data: { orgId: orgId! } }),
    onSuccess: (r) => {
      toast.success(`Expurgo executado · ${r.deleted} mensagens removidas`);
      setConfirmingPurge(false);
      qc.invalidateQueries({ queryKey: ["audit-log", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao expurgar"),
  });

  const exportSubjectMut = useMutation({
    mutationFn: () => exportSubject({ data: { orgId: orgId!, authorHash: subjectHash.trim() } }),
    onSuccess: (r) => toast.success(`${r.rows.length} mensagens encontradas para o titular`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao exportar"),
  });

  const deleteSubjectMut = useMutation({
    mutationFn: () => deleteSubject({ data: { orgId: orgId!, authorHash: subjectHash.trim() } }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} mensagens excluídas do titular`);
      setConfirmingDelete(false);
      setSubjectHash("");
      qc.invalidateQueries({ queryKey: ["audit-log", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const exportCsv = () => {
    const header = ["created_at", "actor_id", "action", "target_kind", "target_id"];
    const rows = trail.map((e) => [
      e.created_at,
      e.actor_id ?? "",
      e.action,
      e.target_kind ?? "",
      e.target_id ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const accessCount30d = trail.filter((e) => {
    const d = new Date(e.created_at);
    return Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Auditoria LGPD</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Todo acesso a conteúdo bruto fica registrado. Registro imutável, exportável para a ANPD.
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={trail.length === 0}
          className="rounded-[9px] border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink disabled:opacity-50"
        >
          ⇩ Exportar CSV
        </button>
      </div>

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar a trilha de auditoria. Tente novamente.
        </div>
      )}

      {/* Stat cards */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Eventos registrados (30d)</div>
          <div className="mt-[3px] text-[20px] font-[650] text-v2-ink">
            {isLoading ? "…" : accessCount30d.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Retenção configurada</div>
          <div className="mt-[3px] text-[20px] font-[650] text-v2-ink">
            {pol ? `${pol.retention_days}d` : "…"}
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Expurgo manual</div>
          {confirmingPurge ? (
            <div className="mt-[3px] flex items-center gap-2">
              <button
                onClick={() => purgeMut.mutate()}
                disabled={purgeMut.isPending}
                className="text-[13px] font-[650] text-v2-crit hover:underline disabled:opacity-50"
              >
                {purgeMut.isPending ? "Expurgando…" : "Confirmar expurgo"}
              </button>
              <button
                onClick={() => setConfirmingPurge(false)}
                className="text-[12px] text-v2-ink-3 hover:underline"
              >
                cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingPurge(true)}
              className="mt-[3px] text-[15px] font-[650] text-v2-green hover:text-v2-green-hover"
            >
              Executar agora →
            </button>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div className="mt-3.5 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[0.9fr_1.2fr_1.6fr_0.8fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>QUANDO</span>
          <span>QUEM</span>
          <span>AÇÃO</span>
          <span>ORIGEM</span>
        </div>
        {isLoading && (
          <div className="px-5 py-6 text-[12.5px] text-v2-ink-3">Carregando trilha…</div>
        )}
        {!isLoading && trail.length === 0 && !isError && (
          <div className="px-5 py-6 text-[12.5px] text-v2-faint">
            Nenhum evento registrado ainda.
          </div>
        )}
        {trail.map((e, i) => (
          <TrailRow
            key={e.id}
            when={formatWhen(e.created_at)}
            who={e.actor_id ? `Usuário ${e.actor_id.slice(0, 8)}` : "Sistema"}
            action={ACTION_LABEL[e.action]?.(e) ?? e.action}
            origin={e.target_kind ?? "—"}
            last={i === trail.length - 1}
          />
        ))}
      </div>

      {/* Data-subject requests */}
      <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-3.5">
        <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          SOLICITAÇÕES DE TITULARES
        </div>
        <p className="mb-2.5 text-[12px] text-v2-ink-3">
          Informe o hash do autor (LGPD art. 18) para exportar ou excluir as mensagens dele nesta
          organização.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={subjectHash}
            onChange={(e) => setSubjectHash(e.target.value)}
            placeholder="author_hash…"
            className="min-w-[220px] flex-1 rounded-lg border border-v2-line bg-v2-surface px-2.5 py-1.5 text-[12.5px] text-v2-ink outline-none focus:border-v2-green"
          />
          <button
            onClick={() => exportSubjectMut.mutate()}
            disabled={!subjectHash.trim() || exportSubjectMut.isPending}
            className="rounded-lg border border-v2-line-strong bg-v2-card px-3 py-1.5 text-[12.5px] font-[650] text-v2-ink disabled:opacity-50"
          >
            {exportSubjectMut.isPending ? "Exportando…" : "Exportar dados"}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <button
                onClick={() => deleteSubjectMut.mutate()}
                disabled={!subjectHash.trim() || deleteSubjectMut.isPending}
                className="rounded-lg bg-v2-crit px-3 py-1.5 text-[12.5px] font-[650] text-white disabled:opacity-50"
              >
                {deleteSubjectMut.isPending ? "Excluindo…" : "Confirmar exclusão"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-[12px] text-v2-ink-3 hover:underline"
              >
                cancelar
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={!subjectHash.trim()}
              className="rounded-lg border border-v2-crit px-3 py-1.5 text-[12.5px] font-[650] text-v2-crit disabled:opacity-50"
            >
              Excluir dados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TrailRow({
  when,
  who,
  whoTone,
  action,
  origin,
  flagged,
  last,
}: {
  when: string;
  who: string;
  whoTone?: "crit";
  action: ReactNode;
  origin: string;
  flagged?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[0.9fr_1.2fr_1.6fr_0.8fr] items-center gap-3 px-5 py-3 text-[12.5px] text-v2-ink ${
        !last ? "border-b border-v2-track" : ""
      } ${flagged ? "bg-v2-crit-bg/50" : ""}`}
    >
      <span className="font-mono text-[11px] text-v2-ink-3">{when}</span>
      <span className={whoTone === "crit" ? "font-[650] text-v2-crit" : ""}>{who}</span>
      <span>{action}</span>
      <span className="font-mono text-[11px] text-v2-ink-3">{origin}</span>
    </div>
  );
}
