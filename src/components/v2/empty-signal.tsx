/**
 * Vocabulário visual único para a distinção mais cara do produto: "não houve" ≠ "não escutei".
 *
 * Num painel de inteligência política, um `0` lido como calmaria quando na verdade não havia
 * grupo, fonte ou coordenada naquele ponto é a falha que mais custa: o gabinete decide sobre um
 * silêncio que o próprio sistema fabricou. Por isso a regra é rígida e vale em TODAS as telas:
 *
 *   `0`  → houve monitoramento no período e o resultado foi zero  (é uma afirmação)
 *   `—`  → não há como saber: sem fonte, sem vínculo, sem coordenada  (é uma ausência)
 *
 * Todo `—` carrega o motivo junto — visível quando cabe, em `title` quando não cabe — e, sempre
 * que existir caminho de correção, o motivo aponta para ele ("sem grupo neste bairro").
 * Nunca renderize `0` para um valor que nasceu de ausência de vínculo: use `null` e passe por aqui.
 */
import type { ReactNode } from "react";

/** O traço é sempre o mesmo caractere: o usuário aprende a forma uma vez só. */
export const BLIND_DASH = "—";

/**
 * O `—` com o motivo. `why` é curto e em minúsculas ("sem grupo neste bairro") porque aparece
 * colado ao traço, dentro de células e cartões.
 */
export function BlindValue({
  why,
  showWhy = true,
  className = "",
}: {
  why: string;
  showWhy?: boolean;
  className?: string;
}) {
  return (
    <span className={`text-v2-faint ${className}`} title={why}>
      {BLIND_DASH}
      {showWhy && <span className="ml-1.5 text-[11.5px]">{why}</span>}
    </span>
  );
}

/**
 * Célula numérica que respeita a convenção: `value === null` significa "não medimos", nunca zero.
 * Quem chama é responsável por só passar `0` quando o zero foi de fato observado.
 */
export function SignalNumber({
  value,
  why,
  showWhy = false,
  className = "",
  format = (n: number) => n.toLocaleString("pt-BR"),
}: {
  value: number | null | undefined;
  why: string;
  showWhy?: boolean;
  className?: string;
  format?: (n: number) => string;
}) {
  if (value == null) return <BlindValue why={why} showWhy={showWhy} className={className} />;
  return <span className={className}>{format(value)}</span>;
}

/** Microtexto de rodapé: explica o recorte de um bloco inteiro (o que ele NÃO cobre). */
export function BlindNote({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-[11.5px] leading-normal text-v2-faint ${className}`}>{children}</p>;
}

/** Selo curto para marcar um bloco cujo dado não existe no backend — nunca esconder a limitação. */
export function BlindTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-v2-obs-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-v2-faint">
      {children}
    </span>
  );
}

/**
 * Bloco de ponto cego: diz o que o sistema não consegue ver, por quê, e — quando existe — leva
 * ao lugar onde o usuário conserta. Tom `warn` quando há ação possível; `flat` quando é só
 * limitação de integração (não adianta piscar em amarelo pra algo que o gabinete não resolve).
 */
export function BlindPanel({
  title,
  children,
  tone = "warn",
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  tone?: "warn" | "flat";
  /** O caminho de correção. Fica a cargo de quem chama porque cada tela leva a uma rota tipada. */
  action?: ReactNode;
  className?: string;
}) {
  const box =
    tone === "warn" ? "border-v2-warn-strong/40 bg-v2-warn-bg/50" : "border-v2-line bg-v2-card";
  return (
    <div className={`rounded-[13px] border px-[18px] py-4 ${box} ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-v2-faint">{BLIND_DASH}</span>
        <span className="text-[13.5px] font-[650] text-v2-ink">{title}</span>
      </div>
      {children && (
        <div className="mt-1 max-w-[640px] text-[12.5px] leading-normal text-v2-ink-2">
          {children}
        </div>
      )}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** Botão/rota de correção com o mesmo peso visual em todas as telas. */
export const BLIND_ACTION_CLASS =
  "inline-block rounded-lg border border-v2-line-strong bg-v2-card px-3 py-1.5 text-[12.5px] font-[650] text-v2-ink";
