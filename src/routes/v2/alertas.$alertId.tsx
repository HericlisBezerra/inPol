import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listAlerts, acknowledgeAlert } from "@/lib/dashboard.functions";
import { resolveAlert } from "@/lib/alerts.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/v2/alertas/$alertId")({
  head: () => ({ meta: [{ title: "Alerta — Inpol v2" }] }),
  component: AlertaDetalhe,
});

/** S4 — Alerta: roteiro de ação + comparativo sem/com inPol.
 * Cabeçalho, badges e ação recomendada vêm de `listAlerts` (não há um `getAlert`
 * dedicado na assinatura autorizada, então buscamos a lista completa da org —
 * incluindo reconhecidos — e filtramos pelo id da rota). Abrir o alerta o
 * reconhece automaticamente (não existe botão "Reconhecer" no design; ver nota
 * abaixo). "Resolver" fica disponível no painel de progresso.
 * O roteiro passo-a-passo, o comparativo sem/com Inpol e as "mensagens-chave"
 * continuam ilustrativos: o backend autorizado não expõe passos de ação
 * granulares nem o conteúdo das mensagens de evidência — apenas
 * `recommended_action` como texto único.
 */

type AlertRow = {
  id: string;
  level: string;
  topic: string;
  neighborhood: string | null;
  summary: string | null;
  recommended_action: string | null;
  evidence_message_ids: string[] | null;
  acknowledged_at: string | null;
  created_at: string;
};

const TIMELINE_BAD = [
  {
    day: "Seg · manhã",
    text: "Primeiras reclamações em um grupo. Assessor lê de relance. Acha pontual.",
  },
  {
    day: "Ter",
    text: "Mais reclamações em grupos diferentes. Comentário ácido em matéria local. Ninguém alerta o prefeito.",
  },
  { day: "Qua", text: "Oposição compartilha os prints. Centenas de compartilhamentos em horas." },
  { day: "Qui · noite", text: "Imprensa liga pedindo posicionamento oficial." },
  { day: "Sex", text: "Manchete negativa. Prefeitura reage tarde demais." },
];
const TIMELINE_GOOD = [
  { day: "Seg", text: "Alerta no relatório: tema identificado. Estágio: monitorando." },
  { day: "Ter · manhã", text: "Gabinete reúne responsável. Identifica a causa raiz." },
  { day: "Qua · manhã", text: "Visita oficial ao local. Equipe documenta solução em andamento." },
  { day: "Qui", text: "Publicação oficial reconhecendo o problema e a ação em curso." },
  { day: "Sex", text: "Manchete positiva. Mesma cidade, mesma semana, narrativa invertida." },
];

function levelMeta(level: string) {
  if (level === "vermelho")
    return { label: "CRÍTICO", badge: "bg-v2-crit-bg text-v2-crit", ink: "text-v2-crit" };
  if (level === "laranja")
    return { label: "ATENÇÃO", badge: "bg-v2-warn-bg text-v2-warn", ink: "text-v2-warn" };
  return { label: "OBSERVAÇÃO", badge: "bg-v2-obs-bg text-v2-obs", ink: "text-v2-obs" };
}

function AlertaDetalhe() {
  const { alertId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const {
    data: alerts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["alerts", orgId, "all"],
    queryFn: () => listAlerts({ data: { orgId: orgId as string, includeAcked: true } }),
    enabled: !!orgId,
  });

  const alert = (alerts as AlertRow[] | undefined)?.find((a) => a.id === alertId);

  const ack = useMutation({
    mutationFn: () => acknowledgeAlert({ data: { orgId: orgId as string, alertId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", orgId] });
    },
  });
  const resolve = useMutation({
    mutationFn: () => resolveAlert({ data: { alertId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", orgId] });
    },
  });

  // Abrir o alerta reconhece automaticamente — não há botão "Reconhecer" no design.
  useEffect(() => {
    if (alert && !alert.acknowledged_at && orgId && !ack.isPending) {
      ack.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id, alert?.acknowledged_at, orgId]);

  if (isLoading) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 text-[13.5px] text-v2-ink-3">Carregando alerta…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 text-[13.5px] text-v2-crit">
          Não foi possível carregar este alerta. Tente novamente.
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div>
        <BackLink />
        <div className="mt-10 flex flex-col items-center gap-2 rounded-[13px] border border-v2-line bg-v2-card px-6 py-12 text-center">
          <span className="text-[28px]">🔍</span>
          <h1 className="text-[17px] font-[650] text-v2-ink">Alerta não encontrado</h1>
          <p className="max-w-sm text-[13px] text-v2-ink-3">
            Este alerta pode ter sido removido ou o link está incorreto.
          </p>
          <Link
            to="/v2/alertas"
            className="mt-2 rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink"
          >
            Voltar para alertas
          </Link>
        </div>
      </div>
    );
  }

  const meta = levelMeta(alert.level);
  const evidenceCount = alert.evidence_message_ids?.length ?? 0;

  return (
    <div>
      <BackLink />

      {/* Header + progress */}
      <div className="mt-4 flex flex-col items-start justify-between gap-5 md:flex-row">
        <div className="max-w-[600px]">
          <div className="flex items-center gap-2.5">
            <span
              className={`rounded px-[9px] py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] ${meta.badge}`}
            >
              {meta.label}
            </span>
            {alert.acknowledged_at && (
              <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-v2-ink-3">
                ✓ reconhecido
              </span>
            )}
          </div>
          <h1 className="mt-2.5 text-[26px] font-[650] leading-[1.25] tracking-[-0.015em] text-v2-ink">
            {alert.topic}
          </h1>
          {alert.summary && (
            <p className="mt-2 text-[14px] leading-[1.6] text-v2-ink-2">{alert.summary}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-4 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
            {alert.neighborhood && <span>📍 {alert.neighborhood}</span>}
            {evidenceCount > 0 && <span>💬 {evidenceCount} msgs</span>}
            <span>desde {format(new Date(alert.created_at), "EEE HH:mm", { locale: ptBR })}</span>
          </div>
        </div>

        <div className="w-full flex-none rounded-xl border border-v2-line bg-v2-card px-[18px] py-4 md:w-[250px]">
          <div className="font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            STATUS
          </div>
          <div className="mt-1.5 text-[14px] font-[650] text-v2-ink">
            {alert.acknowledged_at ? "Reconhecido" : "Novo"}
          </div>
          <button
            onClick={() => resolve.mutate()}
            disabled={resolve.isPending}
            className="mt-3.5 w-full rounded-lg bg-v2-green px-3.5 py-2 text-center text-[13px] font-[650] text-white disabled:opacity-60"
          >
            {resolve.isPending
              ? "Resolvendo…"
              : resolve.isSuccess
                ? "✓ Resolvido"
                : "✓ Marcar como resolvido"}
          </button>
        </div>
      </div>

      {/* Two columns */}
      <div className="mt-[26px] grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* Left: recommended action */}
        <div>
          <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            AÇÃO RECOMENDADA
          </div>
          <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            {alert.recommended_action ? (
              <p className="text-[14px] leading-[1.6] text-v2-ink">{alert.recommended_action}</p>
            ) : (
              <p className="text-[13px] text-v2-ink-3">
                Nenhuma ação recomendada gerada para este alerta.
              </p>
            )}
          </div>
        </div>

        {/* Right: why act now */}
        <div>
          <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            POR QUE AGIR AGORA
          </div>
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-3.5 flex">
              <div className="flex-1 border-r border-v2-track pr-3.5">
                <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-crit">
                  SEM AÇÃO
                </div>
                <div className="mt-1.5 flex flex-col gap-2">
                  {TIMELINE_BAD.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-[12.5px] leading-[1.55] text-v2-ink-2">
                      <b className="text-v2-ink-3">{s.day}:</b> {s.text}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex-1 pl-3.5">
                <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-green">
                  COM AÇÃO
                </div>
                <div className="mt-1.5 flex flex-col gap-2">
                  {TIMELINE_GOOD.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-[12.5px] leading-[1.55] text-v2-ink-2">
                      <b className="text-v2-ink-3">{s.day}:</b> {s.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-v2-track pt-3 text-[11.5px] leading-[1.5] text-v2-ink-3">
              Comparativo ilustrativo baseado em casos semelhantes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/v2/alertas" className="text-[13px] text-v2-ink-3 hover:text-v2-green">
      ← Voltar para alertas
    </Link>
  );
}
