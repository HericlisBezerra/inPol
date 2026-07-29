import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getReport } from "@/lib/reports.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/relatorios/$reportId")({
  head: () => ({ meta: [{ title: "Relatório — Inpol v2" }] }),
  component: Screen,
});

const KIND_LABEL: Record<string, string> = {
  daily: "Relatório diário",
  weekly: "Relatório semanal",
  monthly: "Análise mensal",
};

/** Shape real do `reports.data` (espelha ReportData em report-fallback.ts, tudo opcional
 *  porque relatórios antigos podem não ter todos os blocos). */
type Sample = {
  text?: string;
  neighborhood?: string | null;
  source?: string;
  risk?: number;
  sentiment?: number;
  posted_at?: string;
};
type ReportData = {
  counts?: {
    messages_analyzed?: number;
    alerts?: { vermelho?: number; laranja?: number; amarelo?: number };
    by_source?: Record<string, number>;
  };
  sentiment_trend?: Array<{ d?: string; v?: number; count?: number }>;
  top_topics?: Array<{
    label?: string;
    count?: number;
    avg_sentiment?: number;
    max_risk?: number;
    samples?: Sample[];
  }>;
  top_neighborhoods?: Array<{
    label?: string;
    count?: number;
    avg_sentiment?: number;
    top_topics?: Array<{ label?: string; count?: number }>;
  }>;
  top_opponents?: Array<[string, number]>;
  external_signals?: Array<{
    source?: string;
    label?: string | null;
    title?: string;
    url?: string | null;
    excerpt?: string;
    risk_score?: number;
  }>;
  high_risk_messages?: Array<{
    text?: string;
    risk?: number;
    topic?: string;
    neighborhood?: string | null;
    source?: string;
    url?: string | null;
  }>;
} | null;

/* ── helpers ─────────────────────────────────────────────────── */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

/** Tom pelo sentimento (mesma escala de níveis do design). */
function sentTone(v: number | undefined) {
  if (v == null) return "text-v2-faint";
  if (v > 0.05) return "text-v2-green";
  if (v < -0.15) return "text-v2-crit";
  if (v < -0.05) return "text-v2-warn";
  return "text-v2-ink-3";
}
/** Tom pelo risco (0–100). */
function riskTone(r: number | undefined) {
  if (r == null) return "text-v2-faint";
  if (r >= 80) return "text-v2-crit";
  if (r >= 50) return "text-v2-warn";
  return "text-v2-obs";
}

/** Descarta amostras que não são fala de gente: boilerplate de scrape de portal
 *  ("[Pular para o conteúdo](…)", menus, sopa de URL) e fragmentos curtos demais.
 *  O ideal é filtrar isso na ingestão; aqui é defesa de renderização para a citação
 *  exibida ser sempre um sinal legítimo. */
function isUsableQuote(text: string | undefined): boolean {
  const s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 25) return false;
  const linkish = (s.match(/\]\(|https?:\/\//g) ?? []).length;
  if (linkish >= 2) return false; // 2+ links/URLs → navegação de página, não fala
  if (/pular para o (conte[úu]do|menu)/i.test(s)) return false;
  return true;
}

/** Extrai uma seção do markdown pelo título (ex.: "Resumo executivo") — usada para dar
 *  destaque ao "se você só ler uma coisa" SEM inventar conteúdo: é o texto real da IA. */
function extractSection(md: string, headingContains: string): string | null {
  const lines = md.split("\n");
  const start = lines.findIndex(
    (l) => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(headingContains.toLowerCase()),
  );
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const text = body.join("\n").trim();
  return text.length > 0 ? text : null;
}

/** S8 — Relatório: leitura executiva do relatório REAL. Decisão primeiro, dados depois. */
function Screen() {
  const { reportId } = Route.useParams();
  const { orgId } = useCurrentOrg();

  const {
    data: report,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["report", orgId, reportId],
    queryFn: () => getReport({ data: { orgId: orgId as string, reportId } }),
    enabled: !!orgId,
  });

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/relatorios" className="text-[13px] text-v2-ink-3 hover:text-v2-ink">
          ← Relatórios
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!report}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-[13px] py-[7px] text-[12.5px] font-[650] text-v2-ink transition-colors hover:border-v2-ink-3 disabled:opacity-50"
        >
          ⇩ PDF
        </button>
      </div>

      {!orgId && <div className="mt-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>}
      {orgId && isLoading && (
        <div className="mt-6 text-[13px] text-v2-ink-3">Carregando relatório…</div>
      )}
      {orgId && isError && (
        <div className="mt-6 text-[13px] text-v2-crit">
          Não foi possível carregar o relatório. Tente novamente.
        </div>
      )}
      {orgId && !isLoading && !isError && !report && (
        <div className="mt-6 text-[13px] text-v2-ink-3">
          Relatório não encontrado.{" "}
          <Link to="/relatorios" className="font-semibold text-v2-green">
            Voltar
          </Link>
        </div>
      )}

      {report && <ReportBody report={report} />}
    </div>
  );
}

function ReportBody({ report }: { report: NonNullable<Awaited<ReturnType<typeof getReport>>> }) {
  const kindLabel = KIND_LABEL[report.kind] ?? report.kind;
  const d = (report.data ?? null) as ReportData;
  const md = report.markdown ?? "";

  const msgs = d?.counts?.messages_analyzed;
  const al = d?.counts?.alerts;
  const totalAlerts =
    al && (al.vermelho != null || al.laranja != null || al.amarelo != null)
      ? (al.vermelho ?? 0) + (al.laranja ?? 0) + (al.amarelo ?? 0)
      : undefined;

  const trend = (d?.sentiment_trend ?? []).filter((p) => typeof p.v === "number");
  const avgSent =
    trend.length > 0 ? trend.reduce((s, p) => s + (p.v ?? 0), 0) / trend.length : undefined;

  const topics = (d?.top_topics ?? []).filter((t) => t.label);
  // "Tema dominante" ignora o balde genérico `outros` — ele domina o volume mas não informa.
  const headline = topics.find((t) => t.label && !/^outros?$/i.test(t.label)) ?? topics[0];

  const bairros = (d?.top_neighborhoods ?? []).filter((b) => b.label);
  const signals = (d?.external_signals ?? []).filter((s) => s.title);
  const risky = (d?.high_risk_messages ?? []).filter((m) => isUsableQuote(m.text));
  const opponents = (d?.top_opponents ?? []).filter((o) => Array.isArray(o) && o[0]);
  const resumo = extractSection(md, "resumo executivo");

  // Citações reais: até 2 amostras por tema relevante (pula o balde `outros` e o lixo de scrape).
  const quoteTopics = topics
    .filter((t) => t.label && !/^outros?$/i.test(t.label))
    .map((t) => ({ ...t, samples: (t.samples ?? []).filter((s) => isUsableQuote(s.text)) }))
    .filter((t) => t.samples.length > 0)
    .slice(0, 5);
  const quoteCount = quoteTopics.reduce((s, t) => s + Math.min(2, t.samples.length), 0);

  return (
    <>
      {/* Kicker + título */}
      <div className="mt-[18px]">
        <span className="rounded bg-v2-green-tint px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-v2-green">
          {kindLabel} · {fmtDateTime(report.generated_at)}
        </span>
      </div>
      <h1 className="mt-2.5 font-display text-[27px] font-[650] leading-[1.25] tracking-[-0.015em] text-v2-ink">
        {report.title ?? kindLabel}
      </h1>
      <div className="mt-1.5 font-mono text-[11.5px] text-v2-faint">
        Período: {fmtDate(report.period_start)} — {fmtDate(report.period_end)}
      </div>

      {/* SE VOCÊ SÓ LER UMA COISA — resumo executivo REAL extraído da narrativa */}
      {resumo && (
        <div className="mt-[18px] rounded-[13px] border border-v2-line bg-v2-card px-6 py-5">
          <div className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            SE VOCÊ SÓ LER UMA COISA
          </div>
          <div className="mt-3 font-display text-[15px] leading-[1.6] text-v2-ink [&_strong]:font-[650]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resumo}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* KPIs */}
      {(msgs != null || totalAlerts != null || avgSent != null || headline?.label) && (
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {msgs != null && (
            <StatTile label="Mensagens analisadas" value={msgs.toLocaleString("pt-BR")} />
          )}
          {totalAlerts != null && (
            <StatTile
              label="Alertas no período"
              value={String(totalAlerts)}
              valueClass={totalAlerts > 0 ? "text-v2-crit" : undefined}
              hint={
                al
                  ? `${al.vermelho ?? 0} vermelho · ${al.laranja ?? 0} laranja · ${al.amarelo ?? 0} amarelo`
                  : undefined
              }
            />
          )}
          {avgSent != null && (
            <StatTile
              label="Sentimento médio"
              value={signed(avgSent)}
              valueClass={sentTone(avgSent)}
            />
          )}
          {headline?.label && (
            <StatTile
              label="Tema dominante"
              value={headline.label}
              hint={headline.count != null ? `${headline.count} menções` : undefined}
            />
          )}
        </div>
      )}

      {/* Gráfico de sentimento + temas do período */}
      {(trend.length > 1 || topics.length > 0) && (
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-[1.4fr_1fr]">
          {trend.length > 1 && <SentimentChart trend={trend} />}
          {topics.length > 0 && (
            <div className="rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
              <div className="text-[14px] font-[650] text-v2-ink">Temas do período</div>
              <div className="mt-3 flex flex-col gap-[9px]">
                {topics.slice(0, 6).map((t, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-v2-ink">{t.label}</span>
                    <span className="flex-none font-mono text-[11px] text-v2-ink-3">
                      {t.count ?? 0}
                      {t.avg_sentiment != null && (
                        <span className={sentTone(t.avg_sentiment)}>
                          {" "}
                          · {signed(t.avg_sentiment)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mapa de calor por bairro */}
      {bairros.length > 0 && (
        <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-[650] text-v2-ink">Bairros × temas</span>
            <Link to="/territorio" className="font-mono text-[10.5px] text-v2-green print:hidden">
              ver mapa →
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {bairros.slice(0, 8).map((b, i) => (
              <BairroRow key={i} b={b} max={bairros[0]?.count ?? 1} />
            ))}
          </div>
        </div>
      )}

      {/* Narrativa completa — o miolo analítico, aberto por padrão */}
      {md && (
        <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-[26px] py-[22px]">
          <article className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Deep-dives (dados estruturados por trás da narrativa) */}
      {(quoteCount > 0 || risky.length > 0 || signals.length > 0 || opponents.length > 0) && (
        <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-1.5">
          {quoteCount > 0 && (
            <ExpandRow title={`🔎 Citações reais por tema (${quoteCount})`}>
              <div className="flex flex-col gap-4">
                {quoteTopics.map((t, i) => (
                  <div key={i}>
                    <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-v2-ink-3">
                      {t.label}
                      {t.count != null ? ` · ${t.count} msgs` : ""}
                    </div>
                    <div className="mt-2 flex flex-col gap-3">
                      {(t.samples ?? []).slice(0, 2).map((s, j) => (
                        <Quote key={j} s={s} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ExpandRow>
          )}

          {risky.length > 0 && (
            <ExpandRow title={`⚠️ Mensagens de maior risco (${risky.length})`}>
              <div className="flex flex-col gap-3">
                {risky.slice(0, 8).map((m, i) => (
                  <div key={i} className="border-l-2 border-v2-crit/40 pl-3.5">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]">
                      <span className={riskTone(m.risk)}>RISCO {m.risk ?? "—"}</span>
                      <span className="text-v2-faint">
                        {[m.topic, m.neighborhood, m.source].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="mt-1 font-display text-[14px] italic leading-relaxed text-v2-ink">
                      &ldquo;{trim(m.text, 240)}&rdquo;
                    </div>
                  </div>
                ))}
              </div>
            </ExpandRow>
          )}

          {signals.length > 0 && (
            <ExpandRow title={`📰 Sinais externos — imprensa e redes (${signals.length})`}>
              <div className="flex flex-col gap-3">
                {signals.slice(0, 8).map((s, i) => (
                  <div key={i} className="border-l-2 border-v2-line-strong pl-3.5">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-v2-faint">
                      <span>{[s.source, s.label].filter(Boolean).join(" · ")}</span>
                      {s.risk_score != null && (
                        <span className={riskTone(s.risk_score)}>RISCO {s.risk_score}</span>
                      )}
                    </div>
                    <div className="mt-1 text-[13.5px] font-[650] leading-snug text-v2-ink">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-v2-ink hover:text-v2-green"
                        >
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                    </div>
                    {s.excerpt && (
                      <div className="mt-1 text-[12.5px] leading-[1.55] text-v2-ink-2">
                        {trim(s.excerpt, 220)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ExpandRow>
          )}

          {opponents.length > 0 && (
            <ExpandRow title={`🎭 Opositores mencionados (${opponents.length})`} last>
              <div className="flex flex-col gap-2">
                {opponents.slice(0, 10).map(([name, count], i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-semibold text-v2-ink">
                      {name}
                    </span>
                    <Bar value={count} max={opponents[0]?.[1] ?? 1} tone="bg-v2-obs" />
                    <span className="w-[60px] flex-none text-right font-mono text-[11px] text-v2-ink-3">
                      {count} msgs
                    </span>
                  </div>
                ))}
              </div>
            </ExpandRow>
          )}
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-[18px] border-t border-v2-line pt-4 text-center font-mono text-[11px] text-v2-faint">
        gerado por Inpol IA · {fmtDateTime(report.generated_at)}
        {report.model_version ? ` · ${report.model_version}` : ""}
      </div>
    </>
  );
}

/* ── blocos ──────────────────────────────────────────────────── */

/** Série de sentimento do período (SVG, escala automática, linha de base em 0). */
function SentimentChart({ trend }: { trend: Array<{ d?: string; v?: number; count?: number }> }) {
  const W = 460;
  const H = 120;
  const BASE = 62;
  const AMP = 42;
  // Escala relativa ao maior desvio (piso de 0.2 pra não exagerar ruído perto de zero).
  const maxAbs = Math.max(0.2, ...trend.map((p) => Math.abs(p.v ?? 0)));
  const x = (i: number) => (trend.length === 1 ? W / 2 : (i / (trend.length - 1)) * W);
  const y = (v: number) => BASE - (v / maxAbs) * AMP;
  const pts = trend.map((p, i) => `${x(i).toFixed(1)},${y(p.v ?? 0).toFixed(1)}`).join(" ");
  const last = trend[trend.length - 1];
  const lastV = last?.v ?? 0;

  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-[650] text-v2-ink">Sentimento · período</span>
        <span className="font-mono text-[10.5px] text-v2-faint">0 = NEUTRO</span>
      </div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2.5 overflow-visible"
        role="img"
        aria-label="Série de sentimento médio por dia no período"
      >
        <line
          x1="0"
          y1={BASE}
          x2={W}
          y2={BASE}
          strokeWidth="1"
          strokeDasharray="3 4"
          className="stroke-v2-line"
        />
        <polyline points={pts} fill="none" strokeWidth="2" className="stroke-v2-green" />
        {trend.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.v ?? 0)}
            r="2.5"
            className={(p.v ?? 0) < -0.05 ? "fill-v2-crit" : "fill-v2-green"}
          />
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-v2-faint">
        <span>{trend[0]?.d}</span>
        <span className={sentTone(lastV)}>
          fim do período: {signed(lastV)}
          {last?.count != null ? ` · ${last.count} msgs` : ""}
        </span>
        <span>{last?.d}</span>
      </div>
    </div>
  );
}

function BairroRow({
  b,
  max,
}: {
  b: {
    label?: string;
    count?: number;
    avg_sentiment?: number;
    top_topics?: Array<{ label?: string; count?: number }>;
  };
  max: number;
}) {
  const temas = (b.top_topics ?? [])
    .filter((t) => t.label && !/^outros?$/i.test(t.label))
    .slice(0, 2)
    .map((t) => t.label)
    .join(" · ");
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-[110px] flex-none truncate font-semibold text-v2-ink">{b.label}</span>
      <span className="min-w-0 flex-1 truncate text-v2-ink-2">{temas || "—"}</span>
      <Bar
        value={b.count ?? 0}
        max={max}
        tone={
          (b.avg_sentiment ?? 0) > 0.05
            ? "bg-v2-green"
            : (b.avg_sentiment ?? 0) < -0.15
              ? "bg-v2-crit"
              : (b.avg_sentiment ?? 0) < -0.05
                ? "bg-v2-warn-strong"
                : "bg-v2-line-strong"
        }
      />
      <span
        className={`w-[86px] flex-none text-right font-mono text-[11px] ${sentTone(b.avg_sentiment)}`}
      >
        {b.count ?? 0} · {b.avg_sentiment != null ? signed(b.avg_sentiment) : "—"}
      </span>
    </div>
  );
}

/** Barra proporcional (volume) — dá leitura visual sem depender de lib de gráfico. */
function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <span className="hidden h-1.5 w-[84px] flex-none overflow-hidden rounded-full bg-v2-track sm:block">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

function Quote({ s }: { s: Sample }) {
  const meta = [s.source, s.neighborhood].filter(Boolean).join(" · ").toUpperCase();
  const tone = s.risk != null && s.risk >= 50 ? riskTone(s.risk) : sentTone(s.sentiment);
  return (
    <div className="border-l-2 border-v2-line-strong pl-3.5">
      <div className={`font-mono text-[10px] font-semibold tracking-[0.06em] ${tone}`}>
        {meta || "SINAL"}
        {s.risk != null ? ` · RISCO ${s.risk}` : ""}
      </div>
      <div className="mt-1 font-display text-[14px] italic leading-relaxed text-v2-ink">
        &ldquo;{trim(s.text, 240)}&rdquo;
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[11px] border border-v2-line bg-v2-card px-[15px] py-[13px]">
      <div className="text-[11.5px] text-v2-ink-3">{label}</div>
      <div className={`mt-[3px] truncate text-[19px] font-[650] ${valueClass ?? "text-v2-ink"}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 font-mono text-[10px] text-v2-faint">{hint}</div>}
    </div>
  );
}

function ExpandRow({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={!last ? "border-b border-v2-track" : ""}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3.5 text-left"
      >
        <span className="text-[13.5px] font-[650] text-v2-ink">{title}</span>
        <span className="text-[12px] text-v2-ink-3 print:hidden">
          {open ? "recolher ⌃" : "expandir ⌄"}
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

const trim = (s: string | undefined, n: number) => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** Prose editorial — mesmo tratamento do relatório público. */
const PROSE = [
  "prose max-w-none",
  "text-[15px] leading-[1.75] text-v2-ink-2",
  "prose-p:my-[0.9em]",
  "prose-headings:font-display prose-headings:tracking-[-0.015em] prose-headings:text-v2-ink",
  "prose-h1:text-[22px] prose-h1:font-[600] prose-h1:mt-0",
  "prose-h2:mt-[1.6em] prose-h2:text-[19px] prose-h2:font-[600]",
  "prose-h3:mt-[1.4em] prose-h3:text-[16px] prose-h3:font-[650]",
  "prose-strong:font-[650] prose-strong:text-v2-ink",
  "prose-a:font-medium prose-a:text-v2-green prose-a:no-underline hover:prose-a:text-v2-green-hover",
  "prose-blockquote:border-l-2 prose-blockquote:border-v2-green-border prose-blockquote:pl-4",
  "prose-blockquote:font-display prose-blockquote:text-[15px] prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-v2-ink",
  "prose-li:my-[0.35em] prose-li:marker:text-v2-faint",
  "prose-table:text-[13.5px] prose-th:border-b prose-th:border-v2-line-strong prose-th:text-left prose-th:font-[650] prose-th:text-v2-ink prose-td:border-b prose-td:border-v2-line prose-td:py-2",
  "prose-code:rounded prose-code:bg-v2-track prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:text-v2-ink prose-code:before:content-none prose-code:after:content-none",
  "prose-hr:my-9 prose-hr:border-v2-line",
].join(" ");
