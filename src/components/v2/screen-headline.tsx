/**
 * A manchete da tela: a resposta pronta, antes de qualquer controle.
 *
 * A ferramenta é lida em voz alta numa reunião, projetada numa tela. Quem abre Território não
 * quer um mapa, quer saber onde está perdendo; quem abre Sinais quer saber o que é novo. Sem uma
 * frase de abertura, o dono da ferramenta vira intérprete e a sala espera ele rolar a tabela.
 *
 * Duas regras que valem em TODA manchete e por isso moram aqui, e não em cada rota:
 *
 *  1. Enquanto carrega, a manchete diz que está carregando. Nunca piscar uma frase provisória —
 *     numa reunião a primeira leitura é a que fica, e "nenhum caso em aberto" lido em voz alta
 *     antes do fetch chegar é uma afirmação falsa que ninguém volta atrás para corrigir.
 *  2. Quando a tela está cega (sem fonte, sem grupo, sem dado no período), a manchete declara a
 *     cegueira em vez de afirmar calmaria — mesmo contrato de `empty-signal.tsx`, só que no
 *     tamanho de manchete. Por isso o estado `blind` tem tom próprio: o `—` na frente é o mesmo
 *     sinal visual que o usuário já aprendeu nas células e cartões.
 */
import type { ReactNode } from "react";
import { BLIND_DASH } from "./empty-signal";

export type HeadlineTone = "crit" | "warn" | "green" | "flat";

const ACCENT: Record<HeadlineTone, string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  green: "text-v2-green",
  flat: "text-v2-ink-3",
};

/**
 * O número ou nome que importa dentro da manchete. Existe para que a sala ache o dado sem ler a
 * frase inteira — e para que o tom (vermelho/verde) venha de um lugar só.
 */
export function HeadlineAccent({
  tone = "crit",
  children,
}: {
  tone?: HeadlineTone;
  children: ReactNode;
}) {
  return <span className={ACCENT[tone]}>{children}</span>;
}

export function ScreenHeadline({
  eyebrow,
  loading,
  loadingLabel = "Carregando…",
  blind = false,
  children,
  note,
  className = "",
}: {
  /** Linha mono acima da manchete: nome da tela e recorte (período, filtro). */
  eyebrow?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  /** `true` quando a frase abaixo é uma declaração de cegueira, não uma leitura da cidade. */
  blind?: boolean;
  children: ReactNode;
  /** Microlinha de recorte logo abaixo: o que a manchete NÃO cobre. */
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {eyebrow && (
        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
          {eyebrow}
        </div>
      )}
      <h1
        className={`mt-1.5 max-w-[760px] text-[28px] font-semibold leading-[1.2] tracking-tight ${
          loading ? "text-v2-ink-3" : "text-v2-ink"
        }`}
      >
        {loading ? (
          loadingLabel
        ) : blind ? (
          <>
            <span className="text-v2-faint">{BLIND_DASH}</span> {children}
          </>
        ) : (
          children
        )}
      </h1>
      {!loading && note && (
        <div className="mt-2 max-w-[760px] text-[12.5px] leading-normal text-v2-ink-3">{note}</div>
      )}
    </div>
  );
}
