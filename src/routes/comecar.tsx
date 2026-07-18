import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/comecar")({
  head: () => ({
    meta: [{ title: "Criar organização — Inpol" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Screen,
});

/** S25 — Onboarding (standalone): passo 1 de 3 — criar organização. */
function Screen() {
  const [tipo, setTipo] = useState<"gestao" | "campanha">("gestao");

  return (
    <div className="v2-root grid min-h-screen place-items-center bg-v2-surface px-6 py-10 text-v2-ink">
      <div className="w-full max-w-[520px]">
        <div className="text-center">
          <span className="font-display text-[24px] font-semibold text-v2-ink">
            In<i className="text-v2-green">pol</i>
            <span className="text-v2-green">.</span>
          </span>
        </div>

        {/* Stepper — 3 passos */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <StepDot n={1} active />
          <span className="text-[12.5px] font-[650] text-v2-ink">Organização</span>
          <span className="h-0.5 w-10 bg-v2-line" />
          <StepDot n={2} />
          <span className="text-[12.5px] text-v2-ink-3">Modo</span>
          <span className="h-0.5 w-10 bg-v2-line" />
          <StepDot n={3} />
          <span className="text-[12.5px] text-v2-ink-3">Fontes</span>
        </div>

        {/* Cartão do passo */}
        <div className="mt-6 rounded-2xl border border-v2-line bg-v2-card p-7 shadow-[0_8px_28px_rgba(33,31,28,0.06)]">
          <h1 className="text-[19px] font-[650] text-v2-ink">Vamos criar sua organização</h1>
          <p className="mt-1 text-[13px] text-v2-ink-3">
            Cada prefeitura ou campanha é uma organização separada, com dados isolados.
          </p>

          <div className="mt-5">
            <label htmlFor="org-nome" className="mb-1.5 block text-[12.5px] font-[650] text-v2-ink">
              Nome da organização
            </label>
            <input
              id="org-nome"
              type="text"
              defaultValue="Prefeitura de Jundiaí"
              className="w-full rounded-[10px] border-[1.5px] border-v2-green bg-v2-surface px-3.5 py-[11px] text-[14px] text-v2-ink shadow-[0_0_0_3px_rgba(14,123,91,0.1)] outline-none"
            />
          </div>

          <div className="mt-3.5">
            <div className="mb-1.5 text-[12.5px] font-[650] text-v2-ink">Município</div>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[10px] border border-v2-line-strong bg-v2-surface px-3.5 py-[11px] text-[14px] text-v2-ink-2"
            >
              <span>Jundiaí — SP</span>
              <span className="text-v2-faint">⌄</span>
            </button>
            <div className="mt-1.5 font-mono text-[11px] text-v2-green">
              ✓ importa automaticamente os 19 vereadores eleitos (TSE 2024)
            </div>
          </div>

          <div className="mt-3.5">
            <div className="mb-1.5 text-[12.5px] font-[650] text-v2-ink">Tipo</div>
            <div className="flex gap-2">
              <TipoOption
                label="🏛 Gestão (prefeitura)"
                selected={tipo === "gestao"}
                onClick={() => setTipo("gestao")}
              />
              <TipoOption
                label="🗳 Campanha eleitoral"
                selected={tipo === "campanha"}
                onClick={() => setTipo("campanha")}
              />
            </div>
          </div>

          <Link
            to="/v2"
            className="mt-[22px] block rounded-[10px] bg-v2-ink py-3 text-center text-[14px] font-[650] text-white"
          >
            Continuar →
          </Link>
        </div>

        <p className="mt-3.5 text-center text-[12px] text-v2-faint">
          Prefere ver antes?{" "}
          <Link to="/v2" className="font-medium text-v2-green">
            Entrar no modo demo com dados fictícios
          </Link>
        </p>
      </div>
    </div>
  );
}

function StepDot({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className={`grid h-[26px] w-[26px] place-items-center rounded-full text-[12px] font-semibold ${
        active ? "bg-v2-green text-white" : "bg-v2-track text-v2-ink-3"
      }`}
    >
      {n}
    </span>
  );
}

function TipoOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex-1 rounded-[10px] py-2.5 text-center text-[13px] ${
        selected
          ? "border-[1.5px] border-v2-green bg-v2-green-tint font-[650] text-v2-green"
          : "border border-v2-line-strong font-semibold text-v2-ink-2"
      }`}
    >
      {label}
    </button>
  );
}
