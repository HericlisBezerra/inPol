import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/organizacoes")({
  head: () => ({ meta: [{ title: "Organizações — Ajustes" }] }),
  component: Screen,
});

/** S20 — Ajustes · Organizações: multi-prefeitura, planos e separação legal. Demo data. */
function Screen() {
  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Organizações</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Você participa de 3 organizações. Dados nunca se misturam entre elas.
          </div>
        </div>
        <button className="rounded-[9px] bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Criar organização
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {/* Current org — Prefeitura */}
        <div className="flex items-center gap-3.5 rounded-[13px] border-[1.5px] border-v2-green bg-v2-card px-5 py-[18px]">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-v2-green text-[15px] font-semibold text-white">
            J
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-[650] text-v2-ink">Prefeitura de Jundiaí</span>
              <span className="rounded bg-v2-green-tint px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-green">
                ATUAL
              </span>
              <span className="rounded bg-v2-gold/20 px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-panel-gold">
                MODO GESTÃO
              </span>
            </div>
            <div className="mt-[3px] text-[12.5px] text-v2-ink-3">
              Plano Cidade · 4 usuários · 142 grupos · 2 instâncias
            </div>
          </div>
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-[7px] text-[13px] font-[650] text-v2-ink">
            Gerenciar
          </button>
        </div>

        {/* Campanha */}
        <div className="flex items-center gap-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-v2-panel/10 text-[15px] font-semibold text-v2-panel">
            V
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-[650] text-v2-ink">Campanha Marina 2028</span>
              <span className="rounded bg-v2-warn-bg px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-warn">
                MODO ELEIÇÃO
              </span>
            </div>
            <div className="mt-[3px] text-[12.5px] text-v2-ink-3">
              Plano Campanha · 9 usuários · dados separados da prefeitura (exigência legal)
            </div>
          </div>
          <button className="px-2.5 py-[7px] text-[13px] font-[650] text-v2-green hover:text-v2-green-hover">
            Entrar →
          </button>
        </div>

        {/* Demo */}
        <div className="flex items-center gap-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px] opacity-75">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-v2-track text-[16px] text-v2-ink-3">
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-[650] text-v2-ink">Prefeitura de Jundiaí (DEMO)</div>
            <div className="mt-[3px] text-[12.5px] text-v2-ink-3">
              Ambiente de demonstração com dados fictícios
            </div>
          </div>
          <button className="px-2.5 py-[7px] text-[13px] font-[650] text-v2-green hover:text-v2-green-hover">
            Entrar →
          </button>
        </div>
      </div>

      {/* Legal separation note */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-gold/40 bg-v2-warn-bg px-4 py-[13px]">
        <span>⚖</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-panel-gold">
          <b>Separação legal:</b> organizações de gestão (recursos públicos) e de campanha (recursos
          de campanha) têm faturamento, dados e equipes isolados — exigência da Lei 9.504 e da LGPD.
        </span>
      </div>
    </div>
  );
}
