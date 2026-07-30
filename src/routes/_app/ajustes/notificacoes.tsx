import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ajustes/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações (prévia) — Ajustes" }] }),
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
 * Ajustes · Notificações — PRÉVIA SEM BACKEND.
 *
 * Investigado em 2026-07-20 e reconfirmado na reorganização: não existe backend de
 * preferências de notificação (sem tabela `notification_settings` ou equivalente nas
 * migrations, sem server fn em `src/lib/*.functions.ts`). Os toggles só mudam estado
 * local e resetam ao recarregar.
 *
 * Por isso esta tela saiu do caminho principal de Ajustes (fica no grupo "Ainda sem
 * backend", com selo de prévia) e o aviso virou um bloco em destaque no topo, não uma
 * linha cinza fácil de pular. Uma tela que finge salvar é pior do que uma tela ausente:
 * o gabinete configuraria o alerta crítico e ficaria sem receber, achando que recebeu.
 *
 * Quando o backend existir, ligar aqui seguindo o padrão das outras telas de Ajustes
 * (useQuery/useMutation + useCurrentOrg + invalidate) e devolver a tela ao grupo certo
 * na navegação de src/routes/_app/ajustes/route.tsx.
 */
function Screen() {
  return (
    <div>
      {/* Cabeçalho — sem PanelHeader de propósito: as outras telas declaram o efeito de
          salvar, e esta não tem efeito nenhum. O aviso ocupa esse lugar. */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-[650] text-v2-ink">Notificações</span>
          <span className="rounded bg-v2-warn-bg px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-v2-warn">
            prévia
          </span>
        </div>
        <div className="mt-[3px] text-[13px] text-v2-ink-3">
          Regra de ouro pretendida: crítico fura tudo; o resto respeita horário de silêncio.
        </div>
      </div>

      <div className="mt-3.5 rounded-[13px] border border-v2-warn-strong bg-v2-warn-bg px-5 py-4">
        <div className="text-[13.5px] font-[650] text-v2-warn">Esta tela ainda não salva nada</div>
        <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-normal text-v2-warn">
          As preferências de notificação ainda não têm backend. Os interruptores abaixo mudam só na
          sua tela e voltam ao original assim que você recarregar — nada é gravado e nada muda o que
          o inPol envia hoje. É uma prévia do desenho, mantida aqui para referência.
        </p>
        <p className="mt-2 max-w-[64ch] text-[12.5px] leading-normal text-v2-warn">
          Enquanto isso, os alertas continuam aparecendo normalmente dentro do app, na tela de
          Alertas.
        </p>
      </div>

      {/* Matriz (demonstração) */}
      <div className="mt-3.5 overflow-hidden rounded-[13px] border border-dashed border-v2-line-strong bg-v2-card">
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

      {/* Silêncio + telefone (também demonstração) */}
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 rounded-xl border border-dashed border-v2-line-strong bg-v2-card px-4 py-3.5">
          <div className="text-[13px] font-[650] text-v2-ink">🌙 Horário de silêncio</div>
          <div className="mt-1 text-[12.5px] text-v2-ink-2">22:00 — 07:00 · exceto críticos</div>
          <div className="mt-1 text-[11.5px] text-v2-faint">
            Valor de exemplo, não configurável.
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-dashed border-v2-line-strong bg-v2-card px-4 py-3.5">
          <div className="text-[13px] font-[650] text-v2-ink">✆ WhatsApp do prefeito</div>
          <div className="mt-1 text-[12.5px] text-v2-ink-2">+55 11 9••••-0001</div>
          <div className="mt-1 text-[11.5px] text-v2-faint">
            Valor de exemplo, não configurável.
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
          // O title reforça no hover que o clique não persiste — o botão parece um toggle real.
          title="Prévia: esta alteração não é salva"
          className={`justify-self-start text-left ${on ? "text-v2-green" : "text-v2-line-strong"}`}
        >
          {on ? "●" : "○"}
        </button>
      ))}
    </div>
  );
}
