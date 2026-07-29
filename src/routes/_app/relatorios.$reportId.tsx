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

/** Prose editorial — mesmo tratamento do relatório público (Fraunces nos títulos,
 *  fio verde nas citações de cidadão, tabelas/listas contidas). */
const PROSE = [
  "prose mt-6 max-w-none",
  "text-[15.5px] leading-[1.75] text-v2-ink-2",
  "prose-p:my-[0.9em]",
  "prose-headings:font-display prose-headings:tracking-[-0.015em] prose-headings:text-v2-ink",
  "prose-h1:text-[24px] prose-h1:font-[600]",
  "prose-h2:mt-[1.8em] prose-h2:text-[21px] prose-h2:font-[600]",
  "prose-h3:mt-[1.5em] prose-h3:text-[17px] prose-h3:font-[650]",
  "prose-strong:font-[650] prose-strong:text-v2-ink",
  "prose-a:font-medium prose-a:text-v2-green prose-a:no-underline hover:prose-a:text-v2-green-hover",
  "prose-blockquote:border-l-2 prose-blockquote:border-v2-green-border prose-blockquote:pl-4",
  "prose-blockquote:font-display prose-blockquote:text-[15px] prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-v2-ink",
  "prose-li:my-[0.35em] prose-li:marker:text-v2-faint",
  "prose-table:text-[13.5px] prose-th:border-b prose-th:border-v2-line-strong prose-th:text-left prose-th:font-[650] prose-th:text-v2-ink prose-td:border-b prose-td:border-v2-line prose-td:py-2",
  "prose-code:rounded prose-code:bg-v2-track prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:text-v2-ink prose-code:before:content-none prose-code:after:content-none",
  "prose-hr:my-9 prose-hr:border-v2-line",
].join(" ");

type ReportData = {
  counts?: {
    messages_analyzed?: number;
    alerts?: { vermelho?: number; laranja?: number; amarelo?: number };
  };
  top_topics?: Array<{ label?: string; count?: number; avg_sentiment?: number }>;
  top_neighborhoods?: Array<{ label?: string; avg_sentiment?: number }>;
} | null;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** S8 — Relatório: leitura executiva do relatório REAL (getReport). Decisão primeiro, dados depois. */
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
      {/* Top bar: back + export — some na impressão */}
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
  const data = (report.data ?? null) as ReportData;

  const msgs = data?.counts?.messages_analyzed;
  const a = data?.counts?.alerts;
  const totalAlerts =
    a && (a.vermelho != null || a.laranja != null || a.amarelo != null)
      ? (a.vermelho ?? 0) + (a.laranja ?? 0) + (a.amarelo ?? 0)
      : undefined;
  const topTopic = data?.top_topics?.[0]?.label;
  const topics = (data?.top_topics ?? []).filter((t) => t.label).slice(0, 5);

  return (
    <>
      {/* Kicker + título reais */}
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

      {/* Stat tiles (do data agregado, quando presente) */}
      {(msgs != null || totalAlerts != null || topTopic) && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {msgs != null && (
            <StatTile label="Mensagens analisadas" value={msgs.toLocaleString("pt-BR")} />
          )}
          {totalAlerts != null && (
            <StatTile
              label="Alertas no período"
              value={String(totalAlerts)}
              valueClass={totalAlerts > 0 ? "text-v2-crit" : undefined}
            />
          )}
          {topTopic && <StatTile label="Tema dominante" value={topTopic} />}
        </div>
      )}

      {/* Temas do período (do data, quando presente) */}
      {topics.length > 0 && (
        <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
          <div className="text-[14px] font-[650] text-v2-ink">Temas do período</div>
          <div className="mt-3 flex flex-col gap-[9px]">
            {topics.map((t, i) => (
              <div key={i} className="flex justify-between text-[13px] text-v2-ink">
                <span>{t.label}</span>
                <span className="font-mono text-[11px] text-v2-ink-3">
                  {t.count != null ? `${t.count} msgs` : ""}
                  {t.avg_sentiment != null
                    ? ` · ${t.avg_sentiment >= 0 ? "+" : ""}${t.avg_sentiment.toFixed(2)}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrativa completa (markdown REAL da IA) */}
      <article className={PROSE}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown ?? ""}</ReactMarkdown>
      </article>

      {/* Rodapé meta real */}
      <div className="mt-8 border-t border-v2-line pt-4 text-center font-mono text-[11px] text-v2-faint">
        gerado por Inpol IA · {fmtDateTime(report.generated_at)}
        {report.model_version ? ` · ${report.model_version}` : ""}
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[11px] border border-v2-line bg-v2-card px-[15px] py-[13px]">
      <div className="text-[11.5px] text-v2-ink-3">{label}</div>
      <div className={`mt-[3px] text-[19px] font-[650] ${valueClass ?? "text-v2-ink"}`}>
        {value}
      </div>
    </div>
  );
}
