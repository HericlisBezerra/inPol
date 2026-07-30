import type { ReactNode } from "react";

/**
 * Peças compartilhadas das telas de Ajustes.
 *
 * Arquivo prefixado com `-` para o TanStack Router NÃO tratá-lo como rota.
 *
 * O motivo de existir: Ajustes concentra 24 das 31 ações de escrita do app, e até
 * aqui nenhuma tela dizia o que acontece DEPOIS de salvar. O usuário cadastrava um
 * bairro sem saber que era isso que fazia a IA reconhecer o bairro nas mensagens.
 * `PanelHeader` obriga cada tela a declarar seu efeito downstream (prop `effect`,
 * não opcional) e `Consequence`/`FieldHint` fazem o mesmo por bloco e por campo —
 * o mesmo padrão de `hint` já usado em src/components/v2/person-sheet.tsx.
 */

/** Cabeçalho de painel. `effect` é obrigatório de propósito: nenhuma tela de Ajustes pode ser muda sobre a própria consequência. */
export function PanelHeader({
  title,
  description,
  effect,
  action,
}: {
  title: string;
  description: string;
  effect: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[16px] font-[650] text-v2-ink">{title}</div>
        <div className="mt-[3px] text-[13px] text-v2-ink-3">{description}</div>
        <div className="mt-2 flex max-w-[62ch] items-start gap-2 text-[12px] leading-snug text-v2-ink-2">
          <span aria-hidden className="mt-px flex-none text-v2-green">
            →
          </span>
          <span>{effect}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

type ConsequenceTone = "green" | "neutral" | "warn";

const CONSEQUENCE_TONE: Record<ConsequenceTone, string> = {
  green: "border-v2-green-border bg-v2-green-tint text-v2-green-ink",
  neutral: "border-v2-line bg-v2-surface text-v2-ink-2",
  warn: "border-v2-warn-strong bg-v2-warn-bg text-v2-warn",
};

/** Caixa "o que isso causa" ao pé de um bloco de configuração. */
export function Consequence({
  icon = "✦",
  tone = "green",
  children,
}: {
  icon?: string;
  tone?: ConsequenceTone;
  children: ReactNode;
}) {
  return (
    <div
      className={`mt-3.5 flex items-start gap-3 rounded-xl border px-4 py-[13px] ${CONSEQUENCE_TONE[tone]}`}
    >
      <span aria-hidden className="mt-px flex-none text-[13px]">
        {icon}
      </span>
      <span className="flex-1 text-[12.5px] leading-normal">{children}</span>
    </div>
  );
}

/** Microtexto de consequência colado a um campo/controle específico. */
export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1 block max-w-[52ch] text-[11.5px] leading-snug text-v2-ink-3">
      {children}
    </span>
  );
}

/** Rótulo de campo dos popovers de Ajustes — extraído porque repetia em 5 telas. */
export function FieldLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`block text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3 ${className}`}
    >
      {children}
    </label>
  );
}
