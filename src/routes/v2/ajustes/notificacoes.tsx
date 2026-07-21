import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Ajustes" }] }),
  component: Screen,
});

type Canais = [boolean, boolean, boolean, boolean]; // APP · PUSH · WHATSAPP · E-MAIL

const EVENTOS: { label: ReactNode; note?: string; canais: Canais }[] = [
  {
    label: <b>Alerta crítico</b>,
    note: "fura horário de silêncio",
    canais: [true, true, true, false],
  },
  { label: "Alerta atenção / escalada", canais: [true, true, false, false] },
  { label: "Briefing diário (08h)", canais: [true, false, true, true] },
  { label: "Adversário viraliza (>200 shares)", canais: [true, true, false, false] },
  { label: "Sessão da Câmara resumida", canais: [true, false, false, true] },
];

/**
 * S27 — Ajustes · Notificações: o que chega, por onde e para quem. Demo data.
 *
 * Investigado em 2026-07-20: não existe backend de preferências de notificação
 * no projeto (sem tabela `notification_settings`/equivalente nas migrations, sem
 * server fn em `src/lib/*.functions.ts`, sem menção em `settings.tsx`). Os toggles
 * abaixo só mudam estado local (useState) — não persistem e resetam ao recarregar.
 * Se/quando esse backend existir, ligar aqui seguindo o padrão de
 * `src/routes/v2/ajustes/index.tsx` (useQuery/useMutation + useCurrentOrg + invalidate).
 */
function Screen() {
  return (
    <div>
      {/* Panel header */}
      <div>
        <div className="text-[16px] font-[650] text-v2-ink">Notificações</div>
        <div className="mt-[3px] text-[13px] text-v2-ink-3">
          Regra de ouro: crítico fura tudo; o resto respeita horário de silêncio.
        </div>
        <div className="mt-1 text-[11.5px] text-v2-faint">
          Preferências ainda não são salvas nesta tela — alterações abaixo são só de demonstração.
        </div>
      </div>

      {/* Matrix */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr_0.7fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>EVENTO</span>
          <span>APP</span>
          <span>PUSH</span>
          <span>WHATSAPP</span>
          <span>E-MAIL</span>
        </div>
        {EVENTOS.map((e, i) => (
          <EventoRow key={i} {...e} last={i === EVENTOS.length - 1} />
        ))}
      </div>

      {/* Silence + phone cards */}
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
          <div className="text-[13px] font-[650] text-v2-ink">🌙 Horário de silêncio</div>
          <div className="mt-1 text-[12.5px] text-v2-ink-2">22:00 — 07:00 · exceto críticos</div>
        </div>
        <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
          <div className="text-[13px] font-[650] text-v2-ink">✆ WhatsApp do prefeito</div>
          <div className="mt-1 text-[12.5px] text-v2-ink-2">
            +55 11 9••••-0001 ·{" "}
            <button className="font-semibold text-v2-green hover:text-v2-green-hover">
              alterar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventoRow({
  label,
  note,
  canais,
  last,
}: {
  label: ReactNode;
  note?: string;
  canais: Canais;
  last?: boolean;
}) {
  const [state, setState] = useState<Canais>(canais);
  return (
    <div
      className={`grid grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr_0.7fr] items-center gap-3 px-5 py-[13px] text-[13px] text-v2-ink ${
        !last ? "border-b border-v2-track" : ""
      }`}
    >
      <div>
        {label}
        {note && <div className="font-mono text-[10.5px] text-v2-crit">{note}</div>}
      </div>
      {state.map((on, i) => (
        <button
          key={i}
          onClick={() => setState((prev) => prev.map((v, j) => (j === i ? !v : v)) as Canais)}
          aria-pressed={on}
          className={`justify-self-start text-left ${on ? "text-v2-green" : "text-v2-line-strong"}`}
        >
          {on ? "●" : "○"}
        </button>
      ))}
    </div>
  );
}
