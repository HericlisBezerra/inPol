import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/eleitos")({
  head: () => ({ meta: [{ title: "Eleitos (TSE) — Ajustes" }] }),
  component: Screen,
});

type Alinhamento = "base" | "indep" | "oposicao";

const VEREADORES: { name: string; party: string; votes: string; initial: Alinhamento }[] = [
  { name: "Rosana Lima", party: "MDB", votes: "11.204", initial: "base" },
  { name: "Edson Prado", party: "PSD", votes: "9.877", initial: "indep" },
  { name: "João Parimoschi", party: "PL", votes: "8.412", initial: "oposicao" },
];

/** S26 — Ajustes · Eleitos (TSE): importa vereadores e define alinhamento inicial. Demo data. */
function Screen() {
  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Eleitos (TSE)</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Vereadores importados dos dados abertos do TSE. Alinhamento vira automático após 10
            votações.
          </div>
        </div>
        <button className="rounded-[9px] border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
          ⇩ Importar TSE 2024
        </button>
      </div>

      <div className="mt-3 font-mono text-[11px] text-v2-green">
        ✓ 19 vereadores importados · Jundiaí — SP · última sincronização 12 jul
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.7fr_0.8fr_0.9fr_1.1fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>VEREADOR</span>
          <span>PARTIDO</span>
          <span>VOTOS 2024</span>
          <span>ALINHAMENTO INICIAL</span>
        </div>
        {VEREADORES.map((v, i) => (
          <VereadorRow key={v.name} {...v} last={i === VEREADORES.length - 1} />
        ))}
      </div>

      {/* AI note */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          Todos os nomes entram no Vocabulário automaticamente — menções nos grupos e na imprensa já
          são rastreadas.
        </span>
      </div>
    </div>
  );
}

const PILL_ACTIVE: Record<Alinhamento, string> = {
  base: "border-v2-green bg-v2-green-tint font-[650] text-v2-green",
  indep: "border-v2-warn-strong bg-v2-warn-bg font-[650] text-v2-warn",
  oposicao: "border-v2-crit bg-v2-crit-bg font-[650] text-v2-crit",
};

function VereadorRow({
  name,
  party,
  votes,
  initial,
  last,
}: {
  name: string;
  party: string;
  votes: string;
  initial: Alinhamento;
  last?: boolean;
}) {
  const [selected, setSelected] = useState<Alinhamento>(initial);
  const options: { key: Alinhamento; label: string }[] = [
    { key: "base", label: "Base" },
    { key: "indep", label: "Indep." },
    { key: "oposicao", label: "Oposição" },
  ];
  return (
    <div
      className={`grid grid-cols-[1.7fr_0.8fr_0.9fr_1.1fr] items-center gap-3 px-5 py-3 text-[13px] ${
        !last ? "border-b border-v2-track" : ""
      }`}
    >
      <span className="font-semibold text-v2-ink">{name}</span>
      <span className="text-v2-ink-2">{party}</span>
      <span className="font-mono text-[12px] text-v2-ink">{votes}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setSelected(o.key)}
            className={`rounded-full border px-2.5 py-[3px] text-[11px] ${
              selected === o.key ? PILL_ACTIVE[o.key] : "border-v2-line text-v2-ink-3"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
