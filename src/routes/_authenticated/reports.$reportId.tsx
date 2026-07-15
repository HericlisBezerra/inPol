import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/reports.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2, MessageSquare, AlertTriangle, TrendingUp, MapPin } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({ meta: [{ title: "Relatório — Inpol" }] }),
  component: ReportDetail,
});

const KIND_META: Record<string, { emoji: string; label: string; gradient: string }> = {
  daily: { emoji: "☀️", label: "Relatório diário", gradient: "from-amber-500/20 via-orange-500/10 to-transparent" },
  weekly: { emoji: "📅", label: "Panorama semanal", gradient: "from-sky-500/20 via-indigo-500/10 to-transparent" },
  monthly: { emoji: "📊", label: "Análise mensal", gradient: "from-emerald-500/20 via-teal-500/10 to-transparent" },
};

type TopicSample = { text: string; sentiment: number; risk: number; neighborhood: string | null; source: string; posted_at: string | null };
type TopicRow = { label: string; count: number; avg_sentiment?: number; max_risk?: number; samples?: TopicSample[] };
type NeighborhoodRow = { label: string; count: number; avg_sentiment?: number; top_topics?: Array<{ label: string; count: number }> };
type ExternalSignal = { title?: string; source?: string; label?: string | null; risk_score?: number; sentiment?: number | null; summary?: string; excerpt?: string; topic?: string | null; neighborhood?: string | null; url?: string | null; posted_at?: string | null };
type HighRiskRow = { text: string; risk: number; sentiment: number; topic: string; neighborhood: string | null; source: string; url: string | null; posted_at: string | null };
type AlertRow = { level?: string; topic?: string | null; neighborhood?: string | null; summary?: string; recommended_action?: string | null; created_at?: string };

type ReportData = {
  counts?: { messages_analyzed?: number; alerts?: Record<string, number>; by_source?: Record<string, number> };
  top_topics?: TopicRow[];
  top_neighborhoods?: NeighborhoodRow[];
  top_opponents?: Array<[string, number]>;
  sentiment_trend?: Array<{ d: string; v: number; count?: number }>;
  external_signals?: ExternalSignal[];
  high_risk_messages?: HighRiskRow[];
  sample_alerts?: AlertRow[];
};

const CHART_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7"];

function ReportDetail() {
  const { reportId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const { data: report, isLoading } = useQuery({
    queryKey: ["report", orgId, reportId],
    queryFn: () => getReport({ data: { orgId: orgId!, reportId } }),
    enabled: !!orgId,
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">⏳ Carregando relatório…</div>;
  if (!report) return <div className="p-8 text-muted-foreground">Relatório não encontrado.</div>;

  const meta = KIND_META[report.kind] ?? KIND_META.daily;
  const data = (report.data ?? {}) as ReportData;
  const topTopics = (data.top_topics ?? []).map((topic, index) => ({ ...topic, color: CHART_COLORS[index % CHART_COLORS.length] }));
  const alertPie = [
    { name: "🔴 Vermelho", value: data.counts?.alerts?.vermelho ?? 0, color: "#ef4444" },
    { name: "🟠 Laranja", value: data.counts?.alerts?.laranja ?? 0, color: "#f59e0b" },
    { name: "🟡 Amarelo", value: data.counts?.alerts?.amarelo ?? 0, color: "#eab308" },
  ];
  const sourceCounts = data.counts?.by_source ?? {};
  const hottest = topTopics[0];
  const topNeighborhood = data.top_neighborhoods?.[0];
  const topExternal = data.external_signals?.[0];

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <Link to="/reports" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3" /> Voltar para relatórios
      </Link>

      {/* Hero */}
      <Card className={`relative overflow-hidden p-8 bg-gradient-to-br ${meta.gradient} border-primary/20`}>
        <div className="absolute -top-10 -right-10 text-[180px] opacity-20 select-none">{meta.emoji}</div>
        <div className="relative">
          <div className="label-mono text-xs">{meta.label}</div>
          <h1 className="font-display text-4xl mt-2 max-w-2xl">{report.title}</h1>
          <div className="text-sm text-muted-foreground mt-2 font-mono">
            🗓️ {new Date(report.period_start).toLocaleDateString("pt-BR")} → {new Date(report.period_end).toLocaleDateString("pt-BR")}
          </div>
          <div className="flex gap-2 mt-5 print:hidden">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Download className="size-3.5" /> Baixar PDF (imprimir)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                import("sonner").then((m) => m.toast.success("Link copiado"));
              }}
            >
              <Share2 className="size-3.5" /> Compartilhar
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard emoji="💬" icon={<MessageSquare className="size-3.5" />} label="Mensagens" value={(data.counts?.messages_analyzed ?? 0).toLocaleString("pt-BR")} delta={`${sourceCounts.news ?? 0} portais · ${sourceCounts.instagram ?? 0} Instagram`} tone="up" />
        <KpiCard emoji="🚨" icon={<AlertTriangle className="size-3.5" />} label="Alertas" value={String(alertPie.reduce((sum, item) => sum + item.value, 0))} delta={`${alertPie[0].value} críticos`} tone="warn" />
        <KpiCard emoji="🔥" icon={<TrendingUp className="size-3.5" />} label="Temas quentes" value={String(topTopics.length)} delta={hottest?.label ?? "sem tema dominante"} tone="up" />
        <KpiCard emoji="📍" icon={<MapPin className="size-3.5" />} label="Bairros ativos" value={String(data.top_neighborhoods?.length ?? 0)} delta={topNeighborhood?.label ?? "sem bairro detectado"} tone="neutral" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-surface lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📈</span>
            <h3 className="font-display text-lg">Sentimento ao longo do período</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">média diária — 0 é neutro, &gt;0 positivo</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={data.sentiment_trend ?? []}>
                <defs>
                  <linearGradient id="sentG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[-0.5, 0.5]} />
                <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} fill="url(#sentG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-surface">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🚨</span>
            <h3 className="font-display text-lg">Alertas por nível</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">distribuição na semana</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alertPie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {alertPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2 text-xs">
            {alertPie.map((a) => (
              <div key={a.name} className="flex justify-between"><span>{a.name}</span><span className="font-mono">{a.value}</span></div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-surface lg:col-span-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔥</span>
            <h3 className="font-display text-lg">Temas mais mencionados</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">contagem de menções no período</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={topTopics} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="label" stroke="var(--muted-foreground)" fontSize={11} width={120} />
                <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {topTopics.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Highlights cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HighlightCard tone="bad" emoji="🚨" title="Maior risco" body={hottest ? `${hottest.label} · risco máx ${hottest.max_risk ?? 0} · ${hottest.count} menções.` : "Sem risco relevante no período."} />
        <HighlightCard tone="good" emoji="🌟" title="Bairro mais ativo" body={topNeighborhood ? `${topNeighborhood.label} · ${topNeighborhood.count} sinais · sentimento ${topNeighborhood.avg_sentiment}.` : "Nenhum bairro detectado pelo vocabulário."} />
        <HighlightCard tone="watch" emoji="👀" title="Sinal externo" body={topExternal ? `${topExternal.source}: ${topExternal.title ?? topExternal.summary}` : "Sem sinal externo analisado no período."} />
      </div>

      {/* Narrative */}
      <Card className="p-8 bg-surface">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📝</span>
          <h2 className="font-display text-2xl">Narrativa executiva</h2>
        </div>
        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-normal prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-6 prose-h2:flex prose-h2:items-center prose-h2:gap-2 prose-p:text-foreground/90 prose-strong:text-foreground prose-li:my-1 prose-ul:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report.markdown}
          </ReactMarkdown>
        </article>
      </Card>

      {/* Expandable raw data */}
      <Card className="p-6 bg-surface">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔎</span>
          <h2 className="font-display text-xl">Dados detalhados</h2>
          <span className="text-xs text-muted-foreground ml-2">expanda para ver os sinais brutos que alimentaram este relatório</span>
        </div>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="topics">
            <AccordionTrigger className="text-sm">🔥 Temas com citações reais ({(data.top_topics ?? []).length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {(data.top_topics ?? []).map((topic) => (
                  <div key={topic.label} className="border-l-2 border-primary/40 pl-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display text-base capitalize">{topic.label.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground font-mono">{topic.count} menções · sent {topic.avg_sentiment ?? 0} · risco máx {topic.max_risk ?? 0}</span>
                    </div>
                    {(topic.samples ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1.5 text-xs">
                        {(topic.samples ?? []).map((s, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-[10px] uppercase font-mono mr-2 opacity-70">{s.source}{s.neighborhood ? ` · ${s.neighborhood}` : ""}</span>
                            <span className="italic">"{s.text}"</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="external">
            <AccordionTrigger className="text-sm">📰 Sinais externos ({(data.external_signals ?? []).length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {(data.external_signals ?? []).map((s, i) => (
                  <div key={i} className="text-xs border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-mono opacity-70">{s.source}{s.label ? ` · ${s.label}` : ""}</span>
                      {s.risk_score !== undefined && <span className="font-mono text-[10px] text-destructive">risco {s.risk_score}</span>}
                      {s.topic && <span className="text-[10px] font-mono text-muted-foreground">{s.topic}</span>}
                    </div>
                    <div className="mt-1 font-medium text-foreground/90">
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title}</a> : s.title}
                    </div>
                    {s.summary && <p className="text-muted-foreground mt-0.5">{s.summary}</p>}
                    {s.excerpt && s.excerpt !== s.summary && <p className="italic text-muted-foreground/80 mt-1">"{s.excerpt}"</p>}
                  </div>
                ))}
                {(data.external_signals ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum sinal externo capturado no período.</p>}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="highrisk">
            <AccordionTrigger className="text-sm">⚠️ Mensagens de maior risco ({(data.high_risk_messages ?? []).length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {(data.high_risk_messages ?? []).map((m, i) => (
                  <div key={i} className="text-xs border-l-2 border-destructive/40 pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-destructive">risco {m.risk}</span>
                      <span className="text-[10px] uppercase font-mono opacity-70">{m.source}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{m.topic}{m.neighborhood ? ` · ${m.neighborhood}` : ""}</span>
                    </div>
                    <p className="italic text-muted-foreground mt-1">
                      {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="hover:underline">"{m.text}"</a> : `"${m.text}"`}
                    </p>
                  </div>
                ))}
                {(data.high_risk_messages ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma mensagem com risco elevado no período.</p>}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="neighborhoods">
            <AccordionTrigger className="text-sm">📍 Bairros × temas ({(data.top_neighborhoods ?? []).length})</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {(data.top_neighborhoods ?? []).map((n) => (
                  <div key={n.label} className="p-2 rounded border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="font-display">{n.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{n.count} · sent {n.avg_sentiment}</span>
                    </div>
                    {(n.top_topics ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(n.top_topics ?? []).map((t) => (
                          <span key={t.label} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t.label} · {t.count}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="alerts">
            <AccordionTrigger className="text-sm">🚨 Alertas do período ({(data.sample_alerts ?? []).length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {(data.sample_alerts ?? []).map((a, i) => {
                  const dot = a.level === "vermelho" ? "🔴" : a.level === "laranja" ? "🟠" : "🟡";
                  return (
                    <div key={i} className="text-xs border-l-2 border-amber-500/40 pl-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{dot}</span>
                        <span className="font-mono text-[10px] uppercase">{a.topic}</span>
                        {a.neighborhood && <span className="text-[10px] text-muted-foreground">{a.neighborhood}</span>}
                      </div>
                      <p className="text-muted-foreground mt-0.5">{a.summary}</p>
                      {a.recommended_action && <p className="text-foreground/80 mt-0.5"><strong>Ação:</strong> {a.recommended_action}</p>}
                    </div>
                  );
                })}
                {(data.sample_alerts ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum alerta disparado no período.</p>}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center py-4">
        🤖 Gerado por Inpol · modelo {report.model_version} · {new Date(report.generated_at).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function KpiCard({ emoji, icon, label, value, delta, tone }: { emoji: string; icon: React.ReactNode; label: string; value: string; delta: string; tone: "up" | "warn" | "neutral" }) {
  const toneClass = tone === "up" ? "text-emerald-500" : tone === "warn" ? "text-destructive" : "text-muted-foreground";
  return (
    <Card className="p-4 bg-surface relative overflow-hidden">
      <div className="absolute -top-3 -right-2 text-5xl opacity-20 select-none">{emoji}</div>
      <div className="relative">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="label-mono text-[10px]">{label}</span>
        </div>
        <div className="font-display text-3xl mt-1">{value}</div>
        <div className={`text-[11px] mt-1 ${toneClass}`}>{delta}</div>
      </div>
    </Card>
  );
}

function HighlightCard({ tone, emoji, title, body }: { tone: "bad" | "good" | "watch"; emoji: string; title: string; body: string }) {
  const cls = tone === "bad" ? "border-destructive/40 bg-destructive/5" : tone === "good" ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5";
  return (
    <Card className={`p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{emoji}</span>
        <h4 className="font-display text-base">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}
