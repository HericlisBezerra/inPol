import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTerritoryStats } from "@/lib/territory.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { JundiaiMap, type MapBairro } from "@/components/v2/jundiai-map";

export const Route = createFileRoute("/_app/territorio")({
  head: () => ({ meta: [{ title: "Território — Inpol v2" }] }),
  component: Screen,
});

/** S5 — Território: mapa REAL de Jundiaí (Leaflet/OSM) por bairro + ranking com tendência.
 *  Dados reais via getTerritoryStats (org atual). Bairros que o mapa não reconhece entram
 *  no fluxo de vínculo manual (o vínculo é apenas de sessão — não há endpoint para persisti-lo). */

type Tone = "green" | "flat" | "warn" | "crit";

const APPROVAL_TONE: Record<Tone, string> = {
  green: "text-v2-green",
  flat: "text-v2-ink-3",
  warn: "text-v2-warn",
  crit: "text-v2-crit",
};

/** Coordenadas aproximadas dos bairros de Jundiaí que o mapa reconhece.
 *  Um bairro classificado pela IA que não estiver aqui vira "desconhecido" e
 *  precisa de vínculo manual — mesmo fluxo do design original. */
const COORDS: Record<string, { lat: number; lng: number }> = {
  Centro: { lat: -23.1866, lng: -46.895 },
  "Eloy Chaves": { lat: -23.158, lng: -46.928 },
  Medeiros: { lat: -23.229, lng: -46.908 },
  Anhangabaú: { lat: -23.202, lng: -46.915 },
  Retiro: { lat: -23.215, lng: -46.87 },
  "Vila Rami": { lat: -23.172, lng: -46.883 },
};

function toneForApproval(approval: number): Tone {
  if (approval >= 60) return "green";
  if (approval >= 40) return "flat";
  if (approval >= 25) return "warn";
  return "crit";
}

const RANGES = [
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
  { id: "90d", days: 90 },
] as const;

type Item = { name: string; msgs: number; sentiment: number; approval: number };

function Screen() {
  const { orgId } = useCurrentOrg();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30d");
  const days = RANGES.find((r) => r.id === range)?.days ?? 30;
  /** unknownName -> known bairro name it was linked to (vínculo só de sessão) */
  const [links, setLinks] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["territory", orgId, days],
    queryFn: () => getTerritoryStats({ data: { orgId: orgId as string, days } }),
    enabled: !!orgId,
  });

  const items: Item[] = data?.items ?? [];
  const known = items.filter((it) => COORDS[it.name]);
  const unknown = items.filter((it) => !COORDS[it.name]);
  const unlinked = unknown.filter((u) => !links[u.name]);

  const mapBairros = useMemo<MapBairro[]>(() => {
    const base: MapBairro[] = known.map((b) => ({
      name: b.name,
      approval: b.approval,
      sentiment: b.sentiment,
      msgs: b.msgs,
      tone: toneForApproval(b.approval),
      lat: COORDS[b.name].lat,
      lng: COORDS[b.name].lng,
    }));
    for (const u of unknown) {
      const target = links[u.name];
      if (!target) continue;
      const k = COORDS[target];
      if (!k) continue;
      base.push({
        name: u.name,
        approval: u.approval,
        sentiment: u.sentiment,
        msgs: u.msgs,
        tone: toneForApproval(u.approval),
        lat: k.lat,
        lng: k.lng,
        linked: true,
      });
    }
    return base;
  }, [known, unknown, links]);

  const best = known.length > 0 ? known[0] : undefined; // items já vêm ordenados por approval desc
  const worst = known.length > 0 ? known[known.length - 1] : undefined;

  const totalMsgs = items.reduce((s, it) => s + it.msgs, 0);
  const negatives = [...items]
    .filter((it) => it.approval < 50)
    .sort((a, b) => a.approval - b.approval)
    .slice(0, 2);
  const negativeShare =
    totalMsgs > 0 ? Math.round((negatives.reduce((s, it) => s + it.msgs, 0) / totalMsgs) * 100) : 0;

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Território</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Aprovação e sentimento por bairro de Jundiaí, a partir das mensagens analisadas.
          </p>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-v2-track p-[3px]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={
                r.id === range
                  ? "rounded-[7px] bg-v2-card px-3.5 py-1.5 text-[12.5px] font-[650] text-v2-ink shadow-[0_1px_2px_rgba(33,31,28,0.08)]"
                  : "px-3.5 py-1.5 text-[12.5px] font-semibold text-v2-ink-3"
              }
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os dados de território. Tente novamente.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="mt-[22px] rounded-[13px] border border-v2-line bg-v2-card px-6 py-10 text-center">
          <div className="text-[13.5px] font-[650] text-v2-ink">
            Ainda sem mensagens com bairro classificado
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[12.5px] leading-normal text-v2-ink-3">
            Cadastre bairros no Vocabulário (Ajustes) e aguarde novas análises para ver o mapa e o
            ranking de aprovação por região.
          </p>
        </div>
      ) : (
        <div className="mt-[22px] grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* Real Jundiaí map */}
          <div className="relative overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
            <JundiaiMap
              bairros={mapBairros}
              caption={`MAPA DE JUNDIAÍ · APROVAÇÃO ${range.toUpperCase()}`}
            />
            <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[1000] flex gap-3 rounded-lg bg-white/90 px-3 py-[7px] text-[11px] text-v2-ink-2">
              <LegendSwatch className="bg-v2-green" label={">60%"} />
              <LegendSwatch className="bg-v2-faint" label="40–60%" />
              <LegendSwatch className="bg-v2-warn-strong" label="25–40%" />
              <LegendSwatch className="bg-v2-crit" label={"<25%"} />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <StatCard
                label="Melhor bairro"
                value={best ? `${best.name} · ${best.approval}%` : "—"}
                tone="green"
              />
              <StatCard
                label="Pior bairro"
                value={worst ? `${worst.name} · ${worst.approval}%` : "—"}
                tone="crit"
              />
            </div>

            {/* Ranking */}
            <div className="flex-1 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[14px] font-[650] text-v2-ink">Ranking</span>
                <span className="font-mono text-[10.5px] text-v2-faint">APROVAÇÃO · MSGS</span>
              </div>
              <div className="flex flex-col">
                {isLoading && <span className="py-2 text-[12px] text-v2-ink-3">Carregando…</span>}
                {!isLoading &&
                  items.map((row, i) => (
                    <div
                      key={row.name}
                      className={`flex items-center gap-2.5 py-[9px] ${
                        i < items.length - 1 ? "border-b border-v2-track" : ""
                      }`}
                    >
                      <span className="w-[18px] font-mono text-[11px] text-v2-faint">{i + 1}</span>
                      <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">
                        {row.name}
                      </span>
                      <span
                        className={`w-[38px] text-right font-mono text-[12px] ${APPROVAL_TONE[toneForApproval(row.approval)]}`}
                      >
                        {row.approval}%
                      </span>
                      <span className="w-[60px] text-right font-mono text-[11px] text-v2-faint">
                        {row.msgs}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* AI insight */}
            {negatives.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
                <span>✦</span>
                <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
                  {negatives.map((n) => n.name).join(" e ")} concentram {negativeShare}% das
                  mensagens do período.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unknown-to-Maps bairros — link to a known one so they count on the map */}
      {unlinked.length > 0 && (
        <UnknownPanel
          unknown={unlinked}
          known={known}
          onLink={(name, target) => setLinks((prev) => ({ ...prev, [name]: target }))}
        />
      )}
      {Object.keys(links).length > 0 && (
        <p className="mt-3 font-mono text-[11px] text-v2-green">
          ✓{" "}
          {Object.entries(links)
            .map(([u, k]) => `${u} → ${k}`)
            .join(" · ")}{" "}
          — agora no mapa.
        </p>
      )}
    </div>
  );
}

function UnknownPanel({
  unknown,
  known,
  onLink,
}: {
  unknown: Item[];
  known: Item[];
  onLink: (name: string, target: string) => void;
}) {
  if (known.length === 0) return null;
  return (
    <div className="mt-4 rounded-[13px] border border-v2-warn-strong/40 bg-v2-warn-bg/50 px-[18px] py-4">
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <span className="text-[13.5px] font-[650] text-v2-ink">
          Bairros não localizados no mapa ({unknown.length})
        </span>
      </div>
      <p className="mt-1 max-w-[640px] text-[12.5px] leading-normal text-v2-ink-2">
        Estes bairros foram identificados nas mensagens mas o mapa de Jundiaí não os reconhece (nome
        informal, loteamento novo ou grafia diferente). Vincule cada um a um bairro conhecido para
        as mensagens contarem no território.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {unknown.map((u) => (
          <UnknownRow key={u.name} u={u} known={known} onLink={onLink} />
        ))}
      </div>
    </div>
  );
}

function UnknownRow({
  u,
  known,
  onLink,
}: {
  u: Item;
  known: Item[];
  onLink: (name: string, target: string) => void;
}) {
  const [target, setTarget] = useState<string>(known[0].name);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-v2-line bg-v2-card px-3.5 py-2.5">
      <span className="rounded bg-v2-warn-bg px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] text-v2-warn">
        DESCONHECIDO
      </span>
      <span className="text-[13.5px] font-semibold text-v2-ink">{u.name}</span>
      <span className="font-mono text-[11px] text-v2-faint">
        {u.msgs} msgs · {u.approval}%
      </span>
      <div className="flex-1" />
      <span className="text-[12px] text-v2-ink-3">Vincular a</span>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-lg border border-v2-line-strong bg-v2-card px-2.5 py-1.5 text-[12.5px] text-v2-ink outline-none focus:border-v2-green"
      >
        {known.map((k) => (
          <option key={k.name} value={k.name}>
            {k.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => onLink(u.name, target)}
        className="rounded-lg bg-v2-ink px-3.5 py-1.5 text-[12.5px] font-[650] text-white"
      >
        Vincular
      </button>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px]">
      <span className={`inline-block h-[9px] w-[9px] rounded-[2px] ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "crit";
}) {
  const color = tone === "green" ? "text-v2-green" : "text-v2-crit";
  return (
    <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      <div className={`mt-1 text-[17px] font-[650] ${color}`}>{value}</div>
    </div>
  );
}
