import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/fontes")({
  head: () => ({ meta: [{ title: "Fontes locais — Ajustes" }] }),
  component: Screen,
});

/** S19 — Ajustes · Fontes locais: portais e rádios varridos a cada 2h. Demo data. */
function Screen() {
  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Fontes locais</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Portais, blogs e rádios da cidade. Matérias entram em Sinais já analisadas.
          </div>
        </div>
        <button className="rounded-[9px] bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Adicionar fonte
        </button>
      </div>

      {/* Sources table */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.9fr_1fr_0.9fr_0.9fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>FONTE</span>
          <span>TIPO</span>
          <span>MATÉRIAS 7D</span>
          <span>STATUS</span>
        </div>
        <SourceRow
          name="Tribuna de Jundiaí"
          url="tribunadejundiai.com.br"
          type="Portal"
          count="34"
          status="ok"
        />
        <SourceRow
          name="Jundiaí Agora"
          url="jundiaiagora.com.br"
          type="Portal"
          count="21"
          status="ok"
        />
        <SourceRow
          name="Rádio Difusora FM"
          url="difusorajundiai.com.br"
          type="Rádio (transcrição)"
          count="—"
          status="down"
        />
        <SourceRow
          name="Blog do Edinho"
          url="blogdoedinho.net"
          type="Blog"
          count="3"
          status="paused"
          last
        />
      </div>

      {/* AI suggestion */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          A IA detectou um site novo citando a prefeitura 6× esta semana:{" "}
          <b>noticiasdaregiao.com.br</b>.{" "}
          <button className="font-semibold text-v2-green hover:text-v2-green-hover">
            Adicionar como fonte →
          </button>
        </span>
      </div>
    </div>
  );
}

function SourceRow({
  name,
  url,
  type,
  count,
  status,
  last,
}: {
  name: string;
  url: string;
  type: string;
  count: string;
  status: "ok" | "down" | "paused";
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.9fr_1fr_0.9fr_0.9fr] items-center gap-3 px-5 py-[13px] ${
        !last ? "border-b border-v2-track" : ""
      } ${status === "down" ? "bg-v2-crit-bg/50" : ""} ${status === "paused" ? "opacity-65" : ""}`}
    >
      <div>
        <div className="text-[13.5px] font-semibold text-v2-ink">{name}</div>
        <div className="font-mono text-[10.5px] text-v2-faint">{url}</div>
      </div>
      <span className="text-[12px] text-v2-ink-2">{type}</span>
      <span
        className={`font-mono text-[12px] ${count === "—" || status === "paused" ? "text-v2-ink-3" : "text-v2-ink"}`}
      >
        {count}
      </span>
      {status === "ok" && (
        <span className="font-mono text-[11px] text-v2-green">● varrendo 2/2h</span>
      )}
      {status === "down" && (
        <span className="font-mono text-[11px] text-v2-crit">⚠ feed fora do ar</span>
      )}
      {status === "paused" && <span className="font-mono text-[11px] text-v2-faint">pausado</span>}
    </div>
  );
}
