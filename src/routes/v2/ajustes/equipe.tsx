import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Ajustes" }] }),
  component: Equipe,
});

/** S17 — Ajustes · Equipe e usuários: papéis, 2FA e trilha LGPD por usuário. */

const GRID = "grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr] items-center gap-3 px-5";

function Equipe() {
  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Equipe e acesso</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Quem vê o quê. Todo acesso a mensagens fica registrado na trilha LGPD.
          </div>
        </div>
        <button className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Convidar
        </button>
      </div>

      {/* Tabela de usuários */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div
          className={`${GRID} border-b border-v2-line py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint`}
        >
          <span>USUÁRIO</span>
          <span>PAPEL</span>
          <span>2FA</span>
          <span>ÚLTIMO ACESSO</span>
        </div>

        {/* Marina — Dona */}
        <div className={`${GRID} border-b border-v2-track py-[13px]`}>
          <UserCell
            avatar={<Avatar initials="MC" className="bg-v2-green text-white" />}
            name="Marina Costa"
            meta="marina@jundiai.sp.gov.br"
          />
          <RoleBadge tone="green">Dona</RoleBadge>
          <span className="font-mono text-[11px] text-v2-green">● ativo</span>
          <span className="font-mono text-[11px] text-v2-ink-3">agora</span>
        </div>

        {/* Rafael — Analista */}
        <div className={`${GRID} border-b border-v2-track py-[13px]`}>
          <UserCell
            avatar={<Avatar initials="RS" className="bg-v2-green-tint text-v2-green-ink" />}
            name="Rafael Souza"
            meta="rafael@jundiai.sp.gov.br"
          />
          <RoleBadge>Analista</RoleBadge>
          <span className="font-mono text-[11px] text-v2-green">● ativo</span>
          <span className="font-mono text-[11px] text-v2-ink-3">há 2h</span>
        </div>

        {/* Tiago — 2FA pendente (linha destacada) */}
        <div className={`${GRID} border-b border-v2-track bg-v2-crit-bg/40 py-[13px]`}>
          <UserCell
            avatar={<Avatar initials="TA" className="bg-v2-track text-v2-ink-3" />}
            name="Tiago Alves"
            meta="tiago@gabinete.com"
          />
          <RoleBadge>Leitura</RoleBadge>
          <span className="font-mono text-[11px] text-v2-crit">⚠ pendente</span>
          <span className="font-mono text-[11px] text-v2-ink-3">há 12d</span>
        </div>

        {/* Convite pendente */}
        <div className={`${GRID} py-[13px] opacity-70`}>
          <UserCell
            avatar={
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full border-[1.5px] border-dashed border-v2-line-strong text-[13px] text-v2-faint">
                ✉
              </span>
            }
            name="paula@jundiai.sp.gov.br"
            meta="convite enviado há 1d"
          />
          <RoleBadge>Gestora</RoleBadge>
          <span className="font-mono text-[11px] text-v2-faint">—</span>
          <button className="w-fit text-left text-[12px] font-[650] text-v2-green">Reenviar</button>
        </div>
      </div>

      {/* Legenda de papéis */}
      <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-3.5">
        <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          O QUE CADA PAPEL PODE
        </div>
        <div className="text-[12.5px] leading-[1.7] text-v2-ink-2">
          <b className="text-v2-ink">Dono</b> tudo + Modo Eleição + LGPD ·{" "}
          <b className="text-v2-ink">Gestor</b> tudo menos equipe e organizações ·{" "}
          <b className="text-v2-ink">Analista</b> opera alertas, sinais e relatórios ·{" "}
          <b className="text-v2-ink">Leitura</b> só vê painéis (sem conteúdo bruto de mensagens).
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, className }: { initials: string; className: string }) {
  return (
    <span
      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}

function UserCell({ avatar, name, meta }: { avatar: ReactNode; name: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {avatar}
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-v2-ink">{name}</div>
        <div className="truncate font-mono text-[10.5px] text-v2-faint">{meta}</div>
      </div>
    </div>
  );
}

function RoleBadge({ children, tone }: { children: ReactNode; tone?: "green" }) {
  const styles = tone === "green" ? "bg-v2-green-tint text-v2-green" : "bg-v2-track text-v2-ink-2";
  return (
    <span className={`w-fit rounded-full px-2.5 py-[3px] text-[12px] font-[650] ${styles}`}>
      {children}
    </span>
  );
}
