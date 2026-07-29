/**
 * Tokens e helpers compartilhados entre a ficha da pessoa (person-sheet) e as listas
 * da Rede. Ficam fora do componente para não quebrar o fast refresh — um arquivo de
 * componente que também exporta constantes perde o hot reload.
 */

export const STANCES = [
  { value: "adversario", label: "Adversário" },
  { value: "aliado", label: "Aliado" },
  { value: "neutro", label: "Neutro" },
  { value: "interno", label: "Interno" },
] as const;

export type Stance = (typeof STANCES)[number]["value"];

/** Cor por posicionamento. Adversário chama atenção; interno é informativo, não alarme. */
export const STANCE_TONE: Record<Stance, { chip: string; text: string; label: string }> = {
  adversario: { chip: "bg-v2-crit-bg text-v2-crit", text: "text-v2-crit", label: "Adversário" },
  aliado: { chip: "bg-v2-green-tint text-v2-green", text: "text-v2-green", label: "Aliado" },
  neutro: { chip: "bg-v2-track text-v2-ink-3", text: "text-v2-ink-3", label: "Neutro" },
  interno: { chip: "bg-v2-blue-bg text-v2-blue", text: "text-v2-blue", label: "Interno" },
};

export function initialsOfName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
