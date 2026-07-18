import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/sinais")({
  head: () => ({ meta: [{ title: "Sinais — Inpol v2" }] }),
  component: Screen,
});

/** S6 — Sinais: feed unificado de portais, Instagram, grupos e X. Dados demo. */

type Source = "grupos" | "portais" | "instagram" | "x";
type Filter = "todas" | Source;

const TABS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas as fontes" },
  { key: "grupos", label: "💬 Grupos" },
  { key: "portais", label: "📰 Portais" },
  { key: "instagram", label: "📸 Instagram" },
  { key: "x", label: "𝕏 X" },
];

type Signal = {
  id: string;
  source: Source;
  risk: number;
  riskTone: "crit" | "warn" | "green";
  sourceTag: string;
  origin: string;
  metaChips: { text: string; tone?: "crit" | "green" }[];
  body: ReactNode;
  detail?: string;
  actions?: { label: string; primary?: boolean }[];
  highlight?: boolean;
};

const SIGNALS: Signal[] = [
  {
    id: "vila-rami",
    source: "grupos",
    risk: 84,
    riskTone: "crit",
    sourceTag: "💬 GRUPO",
    origin: "Moradores Vila Rami · 14:28",
    metaChips: [{ text: "enchentes", tone: "crit" }],
    body: '"terceira vez que alaga e ninguém aparece, cadê o prefeito? vou chamar a record"',
    actions: [{ label: "＋ Anexar ao alerta Vila Rami", primary: true }, { label: "Ver conversa" }],
    highlight: true,
  },
  {
    id: "ubs-retiro",
    source: "portais",
    risk: 58,
    riskTone: "warn",
    sourceTag: "📰 PORTAL",
    origin: "Tribuna de Jundiaí · 13:50",
    metaChips: [{ text: "saúde" }, { text: "📍 Retiro" }],
    body: (
      <span className="font-semibold">Moradores do Retiro relatam espera de 5 horas em UBS ↗</span>
    ),
    detail:
      'Matéria cita "problema recorrente de agendamento" e busca posicionamento da Secretaria de Saúde.',
  },
  {
    id: "adversario-x",
    source: "x",
    risk: 47,
    riskTone: "warn",
    sourceTag: "𝕏 X",
    origin: "@parimoschi · 12:40",
    metaChips: [{ text: "⚔ adversário", tone: "crit" }],
    body: '"Zona norte abandonada mais uma vez. Enquanto isso, festa no centro." — 320 reposts',
  },
  {
    id: "ciclovia",
    source: "instagram",
    risk: 12,
    riskTone: "green",
    sourceTag: "📸 INSTAGRAM",
    origin: "@prefjundiai · 13:12",
    metaChips: [{ text: "94% positivo", tone: "green" }],
    body: "Post da nova ciclovia: 1,8 mil curtidas em 3h — melhor engajamento do mês.",
    actions: [{ label: "Sugerir amplificação →", primary: true }],
  },
];

const RISK_TONE: Record<Signal["riskTone"], string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  green: "text-v2-green",
};
const CHIP_TONE = { crit: "text-v2-crit", green: "text-v2-green" };

function Screen() {
  const [filter, setFilter] = useState<Filter>("todas");
  const visible = SIGNALS.filter((s) => filter === "todas" || s.source === filter);
  const todayCount = filter === "todas" ? 42 : visible.length;

  return (
    <div className="mx-auto max-w-[920px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">Sinais</h1>
          <p className="mt-1 text-[13.5px] text-v2-ink-3">
            Tudo que a IA leu nas últimas horas — alimenta bairros, temas, alertas e relatórios.
          </p>
        </div>
        <span className="font-mono text-[11px] text-v2-green">● ao vivo · 1.284 sinais/h</span>
      </div>

      {/* Filters */}
      <div className="mb-1.5 mt-[18px] flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              t.key === filter
                ? "whitespace-nowrap rounded-full bg-v2-ink px-3.5 py-[7px] text-[12.5px] font-[650] text-white"
                : "whitespace-nowrap rounded-full border border-v2-line bg-v2-card px-3.5 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
            }
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button className="rounded-lg border border-v2-line bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2">
          Bairro ⌄
        </button>
        <button className="rounded-lg border border-v2-line bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2">
          Tema ⌄
        </button>
        <button className="rounded-lg border border-v2-crit/25 bg-v2-crit-bg/60 px-3 py-[7px] text-[12.5px] font-semibold text-v2-crit">
          Só negativos ⌄
        </button>
      </div>

      <div className="mb-1.5 mt-3.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
        HOJE · {todayCount} {todayCount === 1 ? "SINAL" : "SINAIS"}
      </div>

      {/* Feed */}
      <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        {visible.map((s, i) => (
          <SignalRow key={s.id} signal={s} last={i === visible.length - 1} />
        ))}
      </div>

      <div className="pb-0.5 pt-4 text-center">
        <button className="text-[13px] font-[650] text-v2-ink-3">
          Carregar mais 38 sinais de hoje
        </button>
      </div>
    </div>
  );
}

function SignalRow({ signal, last }: { signal: Signal; last: boolean }) {
  return (
    <div
      className={`flex gap-4 px-5 py-4 ${!last ? "border-b border-v2-track" : ""} ${
        signal.highlight ? "bg-v2-crit-bg/50" : ""
      }`}
    >
      {/* Risk score */}
      <div className="w-11 flex-none text-center">
        <div className={`text-[22px] font-[650] ${RISK_TONE[signal.riskTone]}`}>{signal.risk}</div>
        <div className="font-mono text-[9px] tracking-[0.08em] text-v2-faint">RISCO</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap font-mono text-[10.5px] text-v2-ink-3">
          <span className="rounded bg-v2-track px-[7px] py-0.5">{signal.sourceTag}</span>
          <span>{signal.origin}</span>
          {signal.metaChips.map((c) => (
            <span key={c.text} className={c.tone ? CHIP_TONE[c.tone] : undefined}>
              {c.text}
            </span>
          ))}
        </div>
        <div className="mt-[5px] text-[14px] leading-normal text-v2-ink">{signal.body}</div>
        {signal.detail && (
          <div className="mt-[3px] text-[13px] leading-normal text-v2-ink-2">{signal.detail}</div>
        )}
        {signal.actions && (
          <div className="mt-2 flex gap-2">
            {signal.actions.map((a) => (
              <button
                key={a.label}
                className={`text-[12px] ${a.primary ? "font-[650] text-v2-green" : "text-v2-ink-3"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
