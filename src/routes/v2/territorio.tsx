import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { JundiaiMap, type MapBairro } from "@/components/v2/jundiai-map";

export const Route = createFileRoute("/v2/territorio")({
  head: () => ({ meta: [{ title: "Território — Inpol v2" }] }),
  component: Screen,
});

/** S5 — Território: mapa REAL de Jundiaí (Leaflet/OSM) por bairro + ranking com tendência.
 *  Bairros que o mapa não reconhece entram no fluxo de vínculo manual. Dados demo. */

type Tone = "green" | "flat" | "warn" | "crit";

const APPROVAL_TONE: Record<Tone, string> = {
  green: "text-v2-green",
  flat: "text-v2-ink-3",
  warn: "text-v2-warn",
  crit: "text-v2-crit",
};
const TREND_TONE: Record<Tone, string> = {
  green: "text-v2-green",
  flat: "text-v2-faint",
  warn: "text-v2-crit",
  crit: "text-v2-crit",
};

/** Bairros reais de Jundiaí, com coordenadas aproximadas — o mapa os reconhece e posiciona. */
type Bairro = {
  name: string;
  approval: number;
  msgs: number;
  trend: string;
  tone: Tone;
  lat: number;
  lng: number;
};
const KNOWN: Bairro[] = [
  {
    name: "Centro",
    approval: 71,
    msgs: 312,
    trend: "▲6",
    tone: "green",
    lat: -23.1866,
    lng: -46.895,
  },
  {
    name: "Eloy Chaves",
    approval: 64,
    msgs: 187,
    trend: "▲2",
    tone: "green",
    lat: -23.158,
    lng: -46.928,
  },
  {
    name: "Medeiros",
    approval: 54,
    msgs: 96,
    trend: "—",
    tone: "flat",
    lat: -23.229,
    lng: -46.908,
  },
  {
    name: "Anhangabaú",
    approval: 51,
    msgs: 142,
    trend: "▼1",
    tone: "flat",
    lat: -23.202,
    lng: -46.915,
  },
  { name: "Retiro", approval: 38, msgs: 265, trend: "▼9", tone: "warn", lat: -23.215, lng: -46.87 },
  {
    name: "Vila Rami",
    approval: 22,
    msgs: 438,
    trend: "▼18",
    tone: "crit",
    lat: -23.172,
    lng: -46.883,
  },
];

/** Bairros cadastrados pelo usuário que o Maps NÃO reconhece (sem coordenada). */
type UnknownBairro = { name: string; approval: number; msgs: number; tone: Tone };
const UNKNOWN_SEED: UnknownBairro[] = [
  { name: "Vila Nova Esperança", approval: 41, msgs: 47, tone: "flat" },
  { name: "Recanto do Guaçu", approval: 29, msgs: 61, tone: "warn" },
];

const RANGES = ["7d", "30d", "90d"] as const;

function Screen() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  /** unknownName -> known bairro name it was linked to */
  const [links, setLinks] = useState<Record<string, string>>({});

  const mapBairros = useMemo<MapBairro[]>(() => {
    const base: MapBairro[] = KNOWN.map((b) => ({
      name: b.name,
      approval: b.approval,
      msgs: b.msgs,
      tone: b.tone,
      lat: b.lat,
      lng: b.lng,
    }));
    for (const u of UNKNOWN_SEED) {
      const target = links[u.name];
      if (!target) continue;
      const k = KNOWN.find((b) => b.name === target);
      if (!k) continue;
      base.push({
        name: u.name,
        approval: u.approval,
        msgs: u.msgs,
        tone: u.tone,
        lat: k.lat,
        lng: k.lng,
        linked: true,
      });
    }
    return base;
  }, [links]);

  const unlinked = UNKNOWN_SEED.filter((u) => !links[u.name]);

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
              key={r}
              onClick={() => setRange(r)}
              className={
                r === range
                  ? "rounded-[7px] bg-v2-card px-3.5 py-1.5 text-[12.5px] font-[650] text-v2-ink shadow-[0_1px_2px_rgba(33,31,28,0.08)]"
                  : "px-3.5 py-1.5 text-[12.5px] font-semibold text-v2-ink-3"
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

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
              value="Centro · 71%"
              trend="▲ 6pts em 30d"
              tone="green"
            />
            <StatCard
              label="Pior bairro"
              value="Vila Rami · 22%"
              trend="▼ 18pts em 30d"
              tone="crit"
            />
          </div>

          {/* Ranking */}
          <div className="flex-1 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[14px] font-[650] text-v2-ink">Ranking</span>
              <span className="font-mono text-[10.5px] text-v2-faint">
                APROVAÇÃO · MSGS · TENDÊNCIA
              </span>
            </div>
            <div className="flex flex-col">
              {KNOWN.map((row, i) => (
                <div
                  key={row.name}
                  className={`flex items-center gap-2.5 py-[9px] ${
                    i < KNOWN.length - 1 ? "border-b border-v2-track" : ""
                  }`}
                >
                  <span className="w-[18px] font-mono text-[11px] text-v2-faint">{i + 1}</span>
                  <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">{row.name}</span>
                  <span
                    className={`w-[38px] text-right font-mono text-[12px] ${APPROVAL_TONE[row.tone]}`}
                  >
                    {row.approval}%
                  </span>
                  <span className="w-[60px] text-right font-mono text-[11px] text-v2-faint">
                    {row.msgs}
                  </span>
                  <span
                    className={`w-[44px] text-right font-mono text-[11px] ${TREND_TONE[row.tone]}`}
                  >
                    {row.trend}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI insight */}
          <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
            <span>✦</span>
            <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
              Retiro e Vila Rami concentram 58% das mensagens negativas do mês — ambos na zona
              norte.
            </span>
          </div>
        </div>
      </div>

      {/* Unknown-to-Maps bairros — link to a known one so they count on the map */}
      {unlinked.length > 0 && (
        <UnknownPanel
          unknown={unlinked}
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
  onLink,
}: {
  unknown: UnknownBairro[];
  onLink: (name: string, target: string) => void;
}) {
  return (
    <div className="mt-4 rounded-[13px] border border-v2-warn-strong/40 bg-v2-warn-bg/50 px-[18px] py-4">
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <span className="text-[13.5px] font-[650] text-v2-ink">
          Bairros não localizados no mapa ({unknown.length})
        </span>
      </div>
      <p className="mt-1 max-w-[640px] text-[12.5px] leading-normal text-v2-ink-2">
        Estes bairros foram cadastrados no vocabulário mas o mapa de Jundiaí não os reconhece (nome
        informal, loteamento novo ou grafia diferente). Vincule cada um a um bairro conhecido para
        as mensagens contarem no território.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {unknown.map((u) => (
          <UnknownRow key={u.name} u={u} onLink={onLink} />
        ))}
      </div>
    </div>
  );
}

function UnknownRow({
  u,
  onLink,
}: {
  u: UnknownBairro;
  onLink: (name: string, target: string) => void;
}) {
  const [target, setTarget] = useState<string>(KNOWN[0].name);
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
        {KNOWN.map((k) => (
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
  trend,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  tone: "green" | "crit";
}) {
  const color = tone === "green" ? "text-v2-green" : "text-v2-crit";
  return (
    <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      <div className={`mt-1 text-[17px] font-[650] ${color}`}>{value}</div>
      <div className={`mt-0.5 font-mono text-[11px] ${color}`}>{trend}</div>
    </div>
  );
}
