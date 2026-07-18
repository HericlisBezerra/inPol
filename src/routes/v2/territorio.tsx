import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/territorio")({
  head: () => ({ meta: [{ title: "Território — Inpol v2" }] }),
  component: Screen,
});

/** S5 — Território: mapa de calor por bairro + ranking com tendência. Dados demo. */

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

const RANKING: {
  pos: number;
  name: string;
  approval: string;
  approvalTone: Tone;
  msgs: string;
  trend: string;
  trendTone: Tone;
}[] = [
  {
    pos: 1,
    name: "Centro",
    approval: "71%",
    approvalTone: "green",
    msgs: "312",
    trend: "▲6",
    trendTone: "green",
  },
  {
    pos: 2,
    name: "Eloy Chaves",
    approval: "64%",
    approvalTone: "green",
    msgs: "187",
    trend: "▲2",
    trendTone: "green",
  },
  {
    pos: 3,
    name: "Medeiros",
    approval: "54%",
    approvalTone: "flat",
    msgs: "96",
    trend: "—",
    trendTone: "flat",
  },
  {
    pos: 4,
    name: "Anhangabaú",
    approval: "51%",
    approvalTone: "flat",
    msgs: "142",
    trend: "▼1",
    trendTone: "flat",
  },
  {
    pos: 5,
    name: "Retiro",
    approval: "38%",
    approvalTone: "warn",
    msgs: "265",
    trend: "▼9",
    trendTone: "warn",
  },
  {
    pos: 6,
    name: "Vila Rami",
    approval: "22%",
    approvalTone: "crit",
    msgs: "438",
    trend: "▼18",
    trendTone: "crit",
  },
];

const RANGES = ["7d", "30d", "90d"] as const;

function Screen() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Território</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Aprovação e sentimento por bairro, a partir das mensagens analisadas.
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
        {/* Heatmap */}
        <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          <div className="relative h-[420px] bg-gradient-to-br from-v2-track to-v2-line">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 640 420"
              preserveAspectRatio="xMidYMid slice"
              role="img"
              aria-label="Mapa de calor de Jundiaí por bairro"
            >
              <path
                d="M80,90 L200,60 L290,95 L320,180 L250,230 L140,205 Z"
                className="fill-v2-green stroke-white"
                opacity=".32"
                strokeWidth="2"
              />
              <path
                d="M200,60 L340,40 L420,110 L320,180 L290,95 Z"
                className="fill-v2-green stroke-white"
                opacity=".18"
                strokeWidth="2"
              />
              <path
                d="M320,180 L420,110 L520,150 L500,260 L390,270 Z"
                className="fill-v2-faint stroke-white"
                opacity=".25"
                strokeWidth="2"
              />
              <path
                d="M250,230 L320,180 L390,270 L330,340 L220,320 Z"
                className="fill-v2-warn-strong stroke-white"
                opacity=".4"
                strokeWidth="2"
              />
              <path
                d="M330,340 L390,270 L500,260 L540,350 L420,390 Z"
                className="fill-v2-crit stroke-white"
                opacity=".5"
                strokeWidth="2"
              />
              <text x="170" y="150" fontSize="13" fontWeight="650" className="fill-v2-ink">
                Centro
              </text>
              <text x="320" y="100" fontSize="12" className="fill-v2-ink">
                Eloy Chaves
              </text>
              <text x="420" y="200" fontSize="12" className="fill-v2-ink">
                Anhangabaú
              </text>
              <text x="270" y="285" fontSize="12" fontWeight="650" className="fill-v2-ink">
                Retiro
              </text>
              <text x="400" y="335" fontSize="13" fontWeight="650" className="fill-white">
                Vila Rami
              </text>
            </svg>

            <div className="absolute left-4 top-3.5 rounded-md bg-white/85 px-2.5 py-[5px] font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-ink-3">
              MAPA DE JUNDIAÍ · APROVAÇÃO {range.toUpperCase()}
            </div>

            <div className="absolute bottom-3.5 left-4 flex gap-3 rounded-lg bg-white/90 px-3 py-[7px] text-[11px] text-v2-ink-2">
              <LegendSwatch className="bg-v2-green opacity-60" label={">60%"} />
              <LegendSwatch className="bg-v2-faint opacity-60" label="40–60%" />
              <LegendSwatch className="bg-v2-warn-strong opacity-70" label="25–40%" />
              <LegendSwatch className="bg-v2-crit opacity-70" label={"<25%"} />
            </div>

            {/* Hover card — Vila Rami */}
            <div className="absolute bottom-14 right-4 w-[180px] rounded-[10px] bg-v2-ink p-3 px-3.5 text-white shadow-[0_8px_24px_rgba(33,31,28,0.3)]">
              <div className="text-[13px] font-[650]">Vila Rami</div>
              <div
                className="mt-1 font-mono text-[11px]"
                style={{ color: "color-mix(in srgb, var(--color-v2-crit) 40%, white)" }}
              >
                22% aprovação · ▼ 18pts
              </div>
              <div className="mt-1 text-[11.5px] text-v2-line-strong">
                438 msgs · tema: enchentes
              </div>
              <button className="mt-1.5 text-[11.5px] font-[650] text-v2-mint">
                Ver mensagens do bairro →
              </button>
            </div>
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
              {RANKING.map((row, i) => (
                <div
                  key={row.pos}
                  className={`flex items-center gap-2.5 py-[9px] ${
                    i < RANKING.length - 1 ? "border-b border-v2-track" : ""
                  }`}
                >
                  <span className="w-[18px] font-mono text-[11px] text-v2-faint">{row.pos}</span>
                  <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">{row.name}</span>
                  <span
                    className={`w-[38px] text-right font-mono text-[12px] ${APPROVAL_TONE[row.approvalTone]}`}
                  >
                    {row.approval}
                  </span>
                  <span className="w-[60px] text-right font-mono text-[11px] text-v2-faint">
                    {row.msgs}
                  </span>
                  <span
                    className={`w-[44px] text-right font-mono text-[11px] ${TREND_TONE[row.trendTone]}`}
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
