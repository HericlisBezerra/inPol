import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/alertas/$alertId")({
  head: () => ({ meta: [{ title: "Alerta — Inpol v2" }] }),
  component: AlertaDetalhe,
});

type Step = {
  id: number;
  title: string;
  detail?: string;
  doneNote?: string;
  deadline?: string;
  urgent?: boolean;
  actions?: boolean;
};

const STEPS: Step[] = [
  { id: 1, title: "Confirmar situação com a Defesa Civil", doneNote: "concluído 09:40 · Marina" },
  {
    id: 2,
    title: "Publicar pronunciamento oficial reconhecendo o problema",
    detail: "Rascunho pronto pela IA — revise e publique no Instagram e nos grupos oficiais.",
    deadline: "até 11:00",
    urgent: true,
    actions: true,
  },
  {
    id: 3,
    title: "Enviar secretário de Obras à Vila Rami com equipe de imprensa",
    deadline: "até 14:00",
  },
  {
    id: 4,
    title: "Responder à Tribuna com posicionamento + cronograma de obra",
    deadline: "até 16:00",
  },
  {
    id: 5,
    title: "Publicar follow-up com fotos da ação nos grupos dos bairros",
    deadline: "amanhã",
  },
];

/** S4 — Alerta: roteiro de ação com checklist acionável + comparativo sem/com inPol. Demo data. */
function AlertaDetalhe() {
  const [done, setDone] = useState<Set<number>>(() => new Set([1]));
  const toggle = (id: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <Link to="/v2/alertas" className="text-[13px] text-v2-ink-3 hover:text-v2-green">
        ← Voltar para alertas
      </Link>

      {/* Header + progress */}
      <div className="mt-4 flex flex-col items-start justify-between gap-5 md:flex-row">
        <div className="max-w-[600px]">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-v2-crit-bg px-[9px] py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] text-v2-crit">
              CRÍTICO
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-v2-crit">
              ⏱ JANELA: ATÉ 12:00
            </span>
          </div>
          <h1 className="mt-2.5 text-[26px] font-[650] leading-[1.25] tracking-[-0.015em] text-v2-ink">
            Enchente na Vila Rami sem resposta da prefeitura
          </h1>
          <p className="mt-2 text-[14px] leading-[1.6] text-v2-ink-2">
            214 mensagens em 6 grupos citam abandono. Vídeo com 3,2 mil compartilhamentos; Tribuna
            de Jundiaí sondando moradores para matéria.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-4 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
            <span>📍 Vila Rami</span>
            <span>💬 214 msgs</span>
            <span>📈 sent −0.55</span>
            <span>desde qui 22:14</span>
          </div>
        </div>

        <div className="w-full flex-none rounded-xl border border-v2-line bg-v2-card px-[18px] py-4 md:w-[250px]">
          <div className="font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            PROGRESSO DO ROTEIRO
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[26px] font-[650] text-v2-ink">
              {done.size}
              <span className="text-v2-faint">/5</span>
            </span>
            <span className="text-[12px] text-v2-ink-3">passos concluídos</span>
          </div>
          <div className="mt-2.5 h-1.5 rounded-[3px] bg-v2-track">
            <div
              className="h-full rounded-[3px] bg-v2-green transition-all"
              style={{ width: `${(done.size / 5) * 100}%` }}
            />
          </div>
          <div className="mt-2.5 text-[12px] text-v2-ink-3">
            Responsável: <b className="text-v2-ink">Marina C.</b>
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="mt-[26px] grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* Left: checklist */}
        <div>
          <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            ROTEIRO DE AÇÃO · GERADO PELA IA ÀS 09:12
          </div>
          <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
            {STEPS.map((step, i) => (
              <ChecklistRow
                key={step.id}
                step={step}
                done={done.has(step.id)}
                onToggle={() => toggle(step.id)}
                last={i === STEPS.length - 1}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
            <span>✦</span>
            <span className="flex-1 text-[12.5px] leading-[1.5] text-v2-green-ink">
              Casos parecidos (UBS Maringá, mar/2026) resolvidos em 48h quando o passo 2 saiu antes
              do meio-dia.
            </span>
          </div>
        </div>

        {/* Right: why act now + key messages */}
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
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-v2-ink-2">
                  Qui: vídeo viraliza → Sex: vereador reposta → Sáb:{" "}
                  <b className="text-v2-crit">manchete negativa</b> e narrativa da oposição pronta.
                </p>
              </div>
              <div className="flex-1 pl-3.5">
                <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-green">
                  COM O ROTEIRO
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-v2-ink-2">
                  Hoje: pronunciamento + visita → Sáb:{" "}
                  <b className="text-v2-green">"Prefeitura age rápido na Vila Rami"</b>. Mesma
                  semana, manchete invertida.
                </p>
              </div>
            </div>
            <div className="border-t border-v2-track pt-3 font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
              LINHA DO TEMPO DO TEMA
            </div>
            <div className="mt-2 flex flex-col gap-[7px] text-[12.5px] text-v2-ink-2">
              <TimelineRow at="qui 22:14">primeiras 12 reclamações em 2 grupos</TimelineRow>
              <TimelineRow at="sex 06:30">vídeo do alagamento começa a circular</TimelineRow>
              <TimelineRow at="sex 08:05">3,2 mil shares · 6 grupos · sent −0.55</TimelineRow>
              <TimelineRow at="sex 09:12" crit>
                <b className="text-v2-crit">escalado para CRÍTICO</b>
              </TimelineRow>
            </div>
          </div>

          <div className="mt-3 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
              MENSAGENS-CHAVE (3 DE 214)
            </div>
            <p className="mt-2 text-[12.5px] italic leading-[1.55] text-v2-ink-2">
              "terceira vez que alaga e ninguém aparece, cadê o prefeito?"
            </p>
            <p className="mt-2 text-[12.5px] italic leading-[1.55] text-v2-ink-2">
              "na chuva de ontem perdi o sofá, a prefeitura prometeu a galeria em 2024"
            </p>
            <button className="mt-2.5 text-[12.5px] font-[650] text-v2-green">Ver todas →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({
  step,
  done,
  onToggle,
  last,
}: {
  step: Step;
  done: boolean;
  onToggle: () => void;
  last: boolean;
}) {
  return (
    <div
      className={`flex gap-[13px] px-[18px] py-[15px] ${!last ? "border-b border-v2-track" : ""}`}
      style={
        done
          ? {
              background:
                "color-mix(in srgb, var(--color-v2-card) 62%, var(--color-v2-green-tint))",
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Desmarcar: ${step.title}` : `Concluir: ${step.title}`}
        className={`grid h-5 w-5 flex-none place-items-center rounded-md text-[11px] ${
          done
            ? "bg-v2-green text-white"
            : step.urgent
              ? "border-2 border-v2-crit"
              : "border-2 border-v2-line-strong"
        }`}
      >
        {done ? "✓" : ""}
      </button>
      <div className="flex-1">
        <div
          className={`text-[14px] ${
            done
              ? "font-semibold text-v2-ink-3 line-through"
              : step.urgent
                ? "font-[650] text-v2-ink"
                : "font-semibold text-v2-ink"
          }`}
        >
          {step.title}
        </div>
        {done && step.doneNote && (
          <div className="mt-0.5 text-[12px] text-v2-faint">{step.doneNote}</div>
        )}
        {!done && step.detail && (
          <div className="mt-[3px] text-[12.5px] leading-[1.5] text-v2-ink-2">{step.detail}</div>
        )}
        {!done && step.actions && (
          <div className="mt-2 flex gap-2">
            <button className="rounded-[7px] bg-v2-ink px-3 py-1.5 text-[12px] font-[650] text-white">
              Ver rascunho
            </button>
            <button className="px-1 py-1.5 text-[12px] font-[650] text-v2-ink-3">
              Atribuir a alguém
            </button>
          </div>
        )}
      </div>
      {!done && step.deadline && (
        <span
          className={`flex-none font-mono text-[10.5px] ${step.urgent ? "text-v2-crit" : "text-v2-faint"}`}
        >
          {step.deadline}
        </span>
      )}
    </div>
  );
}

function TimelineRow({
  at,
  crit,
  children,
}: {
  at: string;
  crit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`w-16 flex-none font-mono text-[10.5px] ${crit ? "text-v2-crit" : "text-v2-faint"}`}
      >
        {at}
      </span>
      <span>{children}</span>
    </div>
  );
}
