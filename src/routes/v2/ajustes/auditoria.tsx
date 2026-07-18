import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria LGPD — Ajustes" }] }),
  component: Screen,
});

/** S24 — Ajustes · Auditoria LGPD: trilha imutável de acessos + solicitações de titulares. Demo data. */
function Screen() {
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
        <button className="rounded-[9px] border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
          ⇩ Exportar CSV
        </button>
      </div>

      {/* Stat cards */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Acessos a mensagens (30d)</div>
          <div className="mt-[3px] text-[20px] font-[650] text-v2-ink">1.204</div>
        </div>
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Solicitações de titulares</div>
          <div className="mt-[3px] text-[20px] font-[650] text-v2-ink">
            2 <span className="font-mono text-[11px] font-normal text-v2-warn">1 no prazo</span>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-[13px]">
          <div className="text-[12px] text-v2-ink-3">Expurgos executados</div>
          <div className="mt-[3px] text-[20px] font-[650] text-v2-green">✓ em dia</div>
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
        <TrailRow
          when="hoje 14:31"
          who="Marina Costa"
          action={<>Leu 12 mensagens do alerta &quot;Vila Rami&quot;</>}
          origin="painel"
        />
        <TrailRow
          when="hoje 11:02"
          who="Rafael Souza"
          action={<>Buscou &quot;ubs retiro&quot; · 87 resultados</>}
          origin="⌘K"
        />
        <TrailRow
          when="ontem 22:14"
          who="Tiago Alves"
          whoTone="crit"
          action={
            <>
              Tentou exportar mensagens brutas — <b>bloqueado</b> (papel Leitura)
            </>
          }
          origin="relatórios"
          flagged
        />
        <TrailRow
          when="ontem 08:00"
          who="Sistema"
          action={<>Expurgo automático: 4.812 mensagens &gt; 180 dias</>}
          origin="cron"
          last
        />
      </div>

      {/* Data-subject requests */}
      <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-3.5">
        <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          SOLICITAÇÕES DE TITULARES
        </div>
        <div className="flex items-center gap-3 border-b border-v2-track py-2">
          <span className="rounded-[5px] bg-v2-warn-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-warn">
            PRAZO: 6D
          </span>
          <span className="flex-1 text-[13px] text-v2-ink">
            Protocolo #2041 — exclusão de mensagens (morador Vila Rami)
          </span>
          <button className="text-[12.5px] font-[650] text-v2-green hover:text-v2-green-hover">
            Tratar →
          </button>
        </div>
        <div className="flex items-center gap-3 py-2">
          <span className="rounded-[5px] bg-v2-green-tint px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-green">
            CONCLUÍDA
          </span>
          <span className="flex-1 text-[13px] text-v2-ink">
            Protocolo #2038 — acesso a dados (jornalista)
          </span>
          <span className="font-mono text-[11px] text-v2-faint">resp. em 9d</span>
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
