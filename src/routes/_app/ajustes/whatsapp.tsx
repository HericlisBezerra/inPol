import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listInstances,
  listGroups,
  refreshGroups,
  toggleGroupMonitoring,
  setGroupTags,
} from "@/lib/whatsapp.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/ajustes/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — Ajustes" }] }),
  component: WhatsApp,
});

/**
 * S18 — Ajustes · WhatsApp: instâncias conectadas + grupos monitorados.
 * Dados reais via listInstances/listGroups/refreshGroups/toggleGroupMonitoring/setGroupTags.
 *
 * A Evolution API integrada (src/lib/evolution.server.ts) não expõe endpoint de QR code —
 * só connectionState, fetchInstances, fetchGroups, webhook e findMessages. Por isso o
 * pareamento não mostra um QR (que seria decorativo/enganoso); em vez disso orienta o
 * operador a atualizar o status quando a instância estiver "pareando".
 */

type InstanceRow = {
  id: string;
  instance_name: string;
  connected_phone: string | null;
  connection_status: string | null;
  last_seen_at: string | null;
};

type GroupItem = {
  id: string;
  instance_id: string;
  subject: string | null;
  participant_count: number | null;
  is_monitored: boolean | null;
  neighborhood_tag: string | null;
  tags: string[] | null;
};

type Tone = "ok" | "warn" | "crit" | "muted";

const TONE_CLASSES: Record<
  Tone,
  { iconBg: string; iconFg: string; badgeBg: string; badgeFg: string }
> = {
  ok: {
    iconBg: "bg-v2-green-tint",
    iconFg: "text-v2-green",
    badgeBg: "bg-v2-green-tint",
    badgeFg: "text-v2-green",
  },
  warn: {
    iconBg: "bg-v2-warn-bg",
    iconFg: "text-v2-warn",
    badgeBg: "bg-v2-warn-bg",
    badgeFg: "text-v2-warn",
  },
  crit: {
    iconBg: "bg-v2-crit-bg",
    iconFg: "text-v2-crit",
    badgeBg: "bg-v2-crit-bg",
    badgeFg: "text-v2-crit",
  },
  muted: {
    iconBg: "bg-v2-track",
    iconFg: "text-v2-ink-3",
    badgeBg: "bg-v2-track",
    badgeFg: "text-v2-ink-3",
  },
};

function statusMeta(state: string | null | undefined): { label: string; tone: Tone } {
  const s = (state ?? "").toLowerCase();
  if (s === "open" || s === "ok" || s === "connected") return { label: "● CONECTADA", tone: "ok" };
  if (s === "connecting" || s === "qr" || s === "pending" || s === "pendente")
    return { label: "⚠ PAREANDO", tone: "warn" };
  if (s === "close" || s === "closed" || s === "disconnected" || s === "error")
    return { label: "● DESCONECTADA", tone: "crit" };
  return { label: "○ DESCONHECIDA", tone: "muted" };
}

function maskPhone(phone: string | null) {
  if (!phone) return "número não informado";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  const country = digits.slice(0, 2);
  const area = digits.slice(2, 4);
  const last4 = digits.slice(-4);
  return `+${country} ${area} 9••••-${last4}`;
}

function WhatsApp() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const {
    data: instances = [],
    isLoading: loadingInstances,
    isError: errorInstances,
  } = useQuery({
    queryKey: ["whatsapp-instances", orgId],
    queryFn: () => listInstances({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["whatsapp-groups", orgId],
    queryFn: () => listGroups({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  const refresh = useMutation({
    mutationFn: (instanceId: string) =>
      refreshGroups({ data: { orgId: orgId as string, instanceId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-groups", orgId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-instances", orgId] });
    },
  });

  const toggle = useMutation({
    mutationFn: (vars: { groupId: string; monitored: boolean; tag: string | null }) =>
      toggleGroupMonitoring({
        data: {
          orgId: orgId as string,
          groupId: vars.groupId,
          monitored: vars.monitored,
          neighborhoodTag: vars.tag,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-groups", orgId] }),
  });

  const tagsMut = useMutation({
    mutationFn: (vars: { groupId: string; tags: string[] }) =>
      setGroupTags({ data: { orgId: orgId as string, groupId: vars.groupId, tags: vars.tags } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-groups", orgId] }),
  });

  const groupsByInstance = useMemo(() => {
    const map: Record<string, GroupItem[]> = {};
    for (const g of groups as GroupItem[]) {
      (map[g.instance_id] ??= []).push(g);
    }
    return map;
  }, [groups]);

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Instâncias WhatsApp</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Cada instância é um número que participa dos grupos monitorados.
          </div>
        </div>
        <button className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Nova instância
        </button>
      </div>

      {errorInstances && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar as instâncias. Tente novamente.
        </div>
      )}

      {loadingInstances && (
        <div className="mt-4 text-[12.5px] text-v2-ink-3">Carregando instâncias…</div>
      )}

      {!loadingInstances && !errorInstances && instances.length === 0 && (
        <div className="mt-4 rounded-[13px] border border-dashed border-v2-line bg-v2-card px-5 py-9 text-center text-[13px] text-v2-ink-3">
          Nenhuma instância WhatsApp conectada ainda.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {(instances as InstanceRow[]).map((inst) => (
          <InstanceCard
            key={inst.id}
            instance={inst}
            groups={groupsByInstance[inst.id] ?? []}
            loadingGroups={loadingGroups}
            expanded={expanded === inst.id}
            onToggleExpand={() => setExpanded((e) => (e === inst.id ? null : inst.id))}
            onRefreshGroups={() => refresh.mutate(inst.id)}
            refreshing={refresh.isPending && refresh.variables === inst.id}
            onToggleMonitor={(groupId, monitored, tag) =>
              toggle.mutate({ groupId, monitored, tag })
            }
            onSetTags={(groupId, tags) => tagsMut.mutate({ groupId, tags })}
          />
        ))}
      </div>

      {/* Nota LGPD */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>🛡</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          O inPol só lê grupos dos quais o número participa legitimamente. Mensagens privadas nunca
          são coletadas — política LGPD aplicada na ingestão.
        </span>
      </div>
    </div>
  );
}

function InstanceCard({
  instance,
  groups,
  loadingGroups,
  expanded,
  onToggleExpand,
  onRefreshGroups,
  refreshing,
  onToggleMonitor,
  onSetTags,
}: {
  instance: InstanceRow;
  groups: GroupItem[];
  loadingGroups: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRefreshGroups: () => void;
  refreshing: boolean;
  onToggleMonitor: (groupId: string, monitored: boolean, tag: string | null) => void;
  onSetTags: (groupId: string, tags: string[]) => void;
}) {
  const meta = statusMeta(instance.connection_status);
  const tone = TONE_CLASSES[meta.tone];
  const monitoredCount = groups.filter((g) => g.is_monitored).length;

  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[16px] ${tone.iconBg} ${tone.iconFg}`}
        >
          ✆
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-[650] text-v2-ink">{instance.instance_name}</div>
          <div className="font-mono text-[10.5px] text-v2-faint">
            {maskPhone(instance.connected_phone)}
          </div>
        </div>
        <span
          className={`rounded px-2 py-[3px] font-mono text-[9.5px] font-bold ${tone.badgeBg} ${tone.badgeFg}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-v2-track pt-3 text-[12.5px] text-v2-ink-2">
        <span>
          <b className="text-v2-ink">{groups.length}</b> grupos
        </span>
        <span>
          <b className="text-v2-ink">{monitoredCount}</b> monitorados
        </span>
        <span>
          {instance.last_seen_at ? (
            <>
              última sincronização{" "}
              <b className="text-v2-ink">
                {new Date(instance.last_seen_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </b>
            </>
          ) : (
            "ainda sem sincronização"
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <button
          onClick={onToggleExpand}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-3 py-1.5 text-[12px] font-[650] text-v2-ink"
        >
          {expanded ? "Ocultar grupos" : "Ver grupos"}
        </button>
        <button
          onClick={onRefreshGroups}
          disabled={refreshing}
          className="px-1 py-1.5 text-[12px] font-[650] text-v2-green disabled:opacity-50"
        >
          {refreshing ? "Sincronizando…" : "↻ Atualizar grupos"}
        </button>
      </div>

      {meta.tone === "warn" && (
        <div className="mt-3.5 border-t border-v2-track pt-3 text-[12.5px] leading-[1.6] text-v2-ink-2">
          Instância pareando — abra o WhatsApp no celular de campo →{" "}
          <b className="text-v2-ink">Aparelhos conectados</b> e confirme a conexão. Clique em{" "}
          <b>Atualizar grupos</b> para verificar quando estiver concluída.
        </div>
      )}

      {expanded && (
        <div className="mt-3.5 border-t border-v2-track pt-3">
          {loadingGroups && <div className="text-[12px] text-v2-ink-3">Carregando grupos…</div>}
          {!loadingGroups && groups.length === 0 && (
            <div className="text-[12px] text-v2-faint">
              Nenhum grupo sincronizado ainda. Use "Atualizar grupos".
            </div>
          )}
          <div className="space-y-2">
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                onToggleMonitor={onToggleMonitor}
                onSetTags={onSetTags}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({
  group,
  onToggleMonitor,
  onSetTags,
}: {
  group: GroupItem;
  onToggleMonitor: (groupId: string, monitored: boolean, tag: string | null) => void;
  onSetTags: (groupId: string, tags: string[]) => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const tags = group.tags ?? [];

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v || tags.includes(v)) {
      setTagDraft("");
      return;
    }
    onSetTags(group.id, [...tags, v]);
    setTagDraft("");
  };
  const removeTag = (t: string) =>
    onSetTags(
      group.id,
      tags.filter((x) => x !== t),
    );

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-v2-track px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-[600] text-v2-ink">
          {group.subject ?? "Sem nome"}
        </div>
        <div className="font-mono text-[10.5px] text-v2-faint">
          {group.participant_count ?? 0} participantes
          {group.neighborhood_tag ? ` · ${group.neighborhood_tag}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-v2-track px-2 py-0.5 text-[10.5px] text-v2-ink-2"
          >
            {t}{" "}
            <button
              onClick={() => removeTag(t)}
              className="text-v2-faint hover:text-v2-crit"
              aria-label={`Remover tag ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          onBlur={addTag}
          placeholder="+ tag"
          className="w-16 rounded-full border border-v2-line bg-v2-surface px-2 py-0.5 text-[10.5px] text-v2-ink outline-none focus:border-v2-green"
        />
      </div>
      <button
        role="switch"
        aria-checked={!!group.is_monitored}
        aria-label="Monitorar grupo"
        onClick={() =>
          onToggleMonitor(group.id, !group.is_monitored, group.neighborhood_tag ?? null)
        }
        className={`relative inline-block h-5 w-[34px] flex-none rounded-full transition-colors ${
          group.is_monitored ? "bg-v2-green" : "bg-v2-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            group.is_monitored ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
