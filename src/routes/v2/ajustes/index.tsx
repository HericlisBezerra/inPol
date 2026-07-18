import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol v2" }] }),
  component: VisaoGeral,
});

/** S12 — Ajustes · visão geral (Vocabulário). Demo data espelhando o design. */

const BAIRROS = ["Vila Rami", "Retiro", "Centro", "Anhangabaú", "Eloy Chaves", "Medeiros"];

const SECTIONS: { id: string; icon: string; label: string; count: number; chips?: string[] }[] = [
  { id: "bairros", icon: "📍", label: "Bairros", count: 24, chips: BAIRROS },
  { id: "opositores", icon: "⚔", label: "Opositores", count: 4 },
  { id: "secretarias", icon: "🏛", label: "Secretarias", count: 9 },
  { id: "sensiveis", icon: "⚠", label: "Termos sensíveis", count: 16 },
];

function VisaoGeral() {
  const [open, setOpen] = useState<Record<string, boolean>>({ bairros: true });
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Vocabulário</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            É isso que a IA procura nas mensagens — bairros, temas, nomes e termos sensíveis.
          </div>
        </div>
        <button className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Novo termo
        </button>
      </div>

      {/* Acordeão de categorias */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        {SECTIONS.map((s, i) => (
          <div key={s.id}>
            <button
              onClick={() => toggle(s.id)}
              aria-expanded={!!open[s.id]}
              className={`flex w-full items-center justify-between px-5 py-[13px] text-left transition-colors hover:bg-v2-surface ${
                i > 0 ? "border-t border-v2-track" : ""
              }`}
            >
              <span className="whitespace-nowrap text-[13.5px] font-[650] text-v2-ink">
                {s.icon} {s.label}{" "}
                <span className="font-mono text-[11px] font-normal text-v2-faint">{s.count}</span>
              </span>
              <span className="text-[12px] text-v2-ink-3">
                {open[s.id] ? "recolher ⌃" : "expandir ⌄"}
              </span>
            </button>
            {open[s.id] && (
              <div className="flex flex-wrap gap-1.5 border-t border-v2-track px-5 py-3.5">
                {(s.chips ?? []).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-v2-track px-[11px] py-1 text-[12px] text-v2-ink"
                  >
                    {chip} <span className="text-v2-faint">×</span>
                  </span>
                ))}
                <button className="px-1.5 py-1 text-[12px] font-[650] text-v2-green">
                  ＋ adicionar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sugestões da IA */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span className="text-[14px]">✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          A IA sugeriu 3 termos novos com base nas mensagens: <b>"galeria pluvial"</b>,{" "}
          <b>"CEI Anhangabaú"</b>, <b>"linha 653"</b>.{" "}
          <button className="font-semibold text-v2-green hover:underline">
            Revisar sugestões →
          </button>
        </span>
      </div>
    </div>
  );
}
