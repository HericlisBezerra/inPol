import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listCasos, type CasoResumo } from "@/lib/casos.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/casos/")({
  head: () => ({ meta: [{ title: "Casos — Inpol v2" }] }),
  component: Casos,
});

/** Lista de casos — a porta de entrada do dossiê (tema × bairro).
 *  Cada linha é um acontecimento, não um alerta: um caso pode ter disparado seis
 *  alertas ao longo de três semanas e continua sendo UM caso. */

const JANELAS = [
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
  { dias: 180, label: "180 dias" },
];

const NIVEL: Record<string, { label: string; badge: string; barra: string }> = {
  vermelho: { label: "CRÍTICO", badge: "bg-v2-crit-bg text-v2-crit", barra: "bg-v2-crit" },
  laranja: { label: "ATENÇÃO", badge: "bg-v2-warn-bg text-v2-warn", barra: "bg-v2-warn-strong" },
  amarelo: { label: "OBSERVAÇÃO", badge: "bg-v2-obs-bg text-v2-obs", barra: "bg-v2-faint" },
};

function temaLegivel(tema: string) {
  return tema.replace(/_/g, " ");
}

function dia(iso: string) {
  try {
    return format(new Date(iso), "d MMM", { locale: ptBR });
  } catch {
    return "—";
  }
}

function Casos() {
  const { orgId } = useCurrentOrg();
  const [days, setDays] = useState(90);
  const [busca, setBusca] = useState("");

  const q = useQuery({
    queryKey: ["casos", orgId, days],
    queryFn: () => listCasos({ data: { orgId: orgId as string, days } }),
    enabled: !!orgId,
  });

  const casos = useMemo(() => {
    const todos = (q.data ?? []) as CasoResumo[];
    const termo = busca.trim().toLowerCase();
    if (!termo) return todos;
    return todos.filter(
      (c) => c.tema.toLowerCase().includes(termo) || (c.bairro ?? "").toLowerCase().includes(termo),
    );
  }, [q.data, busca]);

  const abertos = casos.filter((c) => c.aberto).length;

  if (!orgId) {
    return <div className="text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Casos</h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] leading-[1.55] text-v2-ink-3">
            Um caso é um tema num bairro — o acontecimento inteiro, com sua linha do tempo,
            evidência e desdobramentos. É a peça que a reunião discute.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por tema ou bairro"
            className="w-[220px] rounded-lg border border-v2-line bg-v2-card px-3 py-[7px] text-[12.5px] text-v2-ink placeholder:text-v2-faint"
          />
          <div className="flex overflow-hidden rounded-lg border border-v2-line">
            {JANELAS.map((j) => (
              <button
                key={j.dias}
                onClick={() => setDays(j.dias)}
                className={
                  j.dias === days
                    ? "bg-v2-ink px-3 py-[7px] text-[12.5px] font-[650] text-v2-card"
                    : "bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
                }
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading && (
        <div className="mt-6 text-[13px] text-v2-ink-3">Reunindo os casos do período…</div>
      )}

      {q.isError && (
        <div className="mt-6 rounded-xl border border-v2-crit/30 bg-v2-crit-bg px-4 py-3 text-[13px] text-v2-crit">
          Não foi possível carregar os casos. Tente novamente.
        </div>
      )}

      {!q.isLoading && !q.isError && (
        <>
          <div className="mt-5 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-v2-faint">
            {casos.length} {casos.length === 1 ? "CASO" : "CASOS"} · {abertos} EM ABERTO ·{" "}
            {JANELAS.find((j) => j.dias === days)?.label.toUpperCase()}
          </div>

          {casos.length === 0 && (
            <div className="mt-3 rounded-[13px] border border-v2-line bg-v2-card px-5 py-6 text-[13.5px] text-v2-ink-3">
              {busca
                ? "Nenhum caso bate com esse filtro."
                : "Nenhum caso no período. Casos nascem dos alertas — sem alerta detectado, não há caso para reunir."}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {casos.map((c) => (
              <LinhaCaso key={c.casoId} caso={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LinhaCaso({ caso }: { caso: CasoResumo }) {
  const nivel = NIVEL[caso.level] ?? NIVEL.amarelo;
  return (
    <Link
      to="/casos/$casoId"
      params={{ casoId: caso.casoId }}
      className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-v2-line bg-v2-card transition-colors hover:border-v2-line-strong"
    >
      <span className={`w-[3px] flex-none ${nivel.barra}`} />
      <div className="min-w-0 flex-1 px-[18px] py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`rounded px-[7px] py-0.5 font-mono text-[9.5px] font-bold tracking-[0.08em] ${nivel.badge}`}
          >
            {nivel.label}
          </span>
          <span className="text-[15px] font-[650] capitalize text-v2-ink">
            {temaLegivel(caso.tema)}
          </span>
          {caso.bairro ? (
            <span className="font-mono text-[11.5px] text-v2-ink-3">📍 {caso.bairro}</span>
          ) : (
            <span className="font-mono text-[11.5px] text-v2-faint">sem bairro identificado</span>
          )}
          {!caso.aberto && (
            <span className="font-mono text-[10.5px] font-semibold text-v2-green">✓ resolvido</span>
          )}
        </div>
        {caso.resumo && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-v2-ink-2">{caso.resumo}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-3.5 whitespace-nowrap font-mono text-[11px] text-v2-ink-3">
          <span>
            {dia(caso.primeiroSinal)} → {dia(caso.ultimoSinal)}
          </span>
          <span>{caso.mensagens} sinais</span>
          <span>
            {caso.alertas} {caso.alertas === 1 ? "alerta" : "alertas"}
          </span>
          {typeof caso.riscoMax === "number" && <span>risco máx {caso.riscoMax}</span>}
        </div>
      </div>
      <span className="flex flex-none items-center pr-4 text-[13px] text-v2-faint">→</span>
    </Link>
  );
}
