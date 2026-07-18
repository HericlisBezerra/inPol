import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getNewsFilters, listNewsFeed } from "@/lib/news.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "Notícias e sinais — Inpol" }] }),
  component: NewsPage,
});

type SourceFilter = "all" | "news" | "instagram" | "whatsapp" | "facebook" | "x";
type SentimentFilter = "all" | "negative" | "neutral" | "positive";

const SOURCE_LABEL: Record<string, string> = {
  all: "Todas",
  news: "Portais",
  instagram: "Instagram",
  whatsapp: "Grupos",
  facebook: "Facebook",
  x: "X",
};

function NewsPage() {
  const { orgId } = useCurrentOrg();
  const [source, setSource] = useState<SourceFilter>("all");
  const [neighborhood, setNeighborhood] = useState("all");
  const [vocabTerm, setVocabTerm] = useState("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [q, setQ] = useState("");

  const filters = useQuery({
    queryKey: ["news-filters", orgId],
    queryFn: () => getNewsFilters({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const feed = useQuery({
    queryKey: ["news-feed", orgId, source, neighborhood, vocabTerm, sentiment, q],
    queryFn: () =>
      listNewsFeed({
        data: {
          orgId: orgId!,
          source,
          neighborhood: neighborhood === "all" ? null : neighborhood,
          vocabTerm: vocabTerm === "all" ? null : vocabTerm,
          sentiment,
          q: q.trim() || null,
          days: 30,
          limit: 160,
        },
      }),
    enabled: !!orgId,
  });

  const vocab = filters.data ?? [];
  const neighborhoods = useMemo(() => vocab.filter((v) => v.kind === "neighborhood"), [vocab]);
  const terms = useMemo(() => vocab.filter((v) => v.kind !== "neighborhood"), [vocab]);

  if (!orgId) return <div className="p-8 text-muted-foreground">Selecione uma organização.</div>;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label-mono">Sinais externos e internos</div>
          <h1 className="font-display text-3xl mt-1">Notícias, Instagram e grupos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo aqui alimenta bairros, tópicos, alertas e relatórios com base no vocabulário dos
            ajustes.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => feed.refetch()}
          disabled={feed.isFetching}
          className="gap-2 w-fit"
        >
          <RefreshCw className={`size-4 ${feed.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={neighborhood} onValueChange={setNeighborhood}>
          <SelectTrigger>
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os bairros</SelectItem>
            {neighborhoods.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vocabTerm} onValueChange={setVocabTerm}>
          <SelectTrigger>
            <SelectValue placeholder="Vocabulário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo vocabulário</SelectItem>
            {terms.map((v) => (
              <SelectItem key={`${v.kind}:${v.value}`} value={v.value}>
                {v.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sentiment} onValueChange={(v) => setSentiment(v as SentimentFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo sentimento</SelectItem>
            <SelectItem value="negative">Negativo</SelectItem>
            <SelectItem value="neutral">Neutro</SelectItem>
            <SelectItem value="positive">Positivo</SelectItem>
          </SelectContent>
        </Select>

        <Input placeholder="Buscar texto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </section>

      <section className="space-y-3">
        {feed.isLoading && (
          <Card className="p-6 bg-surface text-sm text-muted-foreground">Carregando sinais…</Card>
        )}
        {feed.data?.length === 0 && (
          <Card className="p-6 bg-surface text-sm text-muted-foreground">
            Nenhum sinal encontrado com esses filtros.
          </Card>
        )}
        {feed.data?.map((row) => {
          const sourceData = Array.isArray(row.source) ? row.source[0] : row.source;
          const analysis = Array.isArray(row.analysis) ? row.analysis[0] : row.analysis;
          const group = Array.isArray(row.group) ? row.group[0] : row.group;
          const payload = row.raw_payload as { url?: string; title?: string } | null;
          const title =
            payload?.title ?? analysis?.summary ?? String(row.content ?? "").slice(0, 120);
          const risk = analysis?.risk_score ?? 0;
          return (
            <Card key={row.id} className="p-4 bg-surface">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="gap-1">
                      <Newspaper className="size-3" />{" "}
                      {SOURCE_LABEL[sourceData?.kind ?? ""] ?? sourceData?.kind ?? "fonte"}
                    </Badge>
                    <span className="font-mono">
                      {new Date(row.posted_at).toLocaleString("pt-BR")}
                    </span>
                    {group?.subject && <span>· {group.subject}</span>}
                    {(analysis?.neighborhood ?? group?.neighborhood_tag) && (
                      <span>· {analysis?.neighborhood ?? group?.neighborhood_tag}</span>
                    )}
                    {analysis?.topic && <span>· {analysis.topic}</span>}
                  </div>
                  {payload?.url ? (
                    <a
                      href={payload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-primary inline-flex items-center gap-1"
                    >
                      {title} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <h2 className="font-medium">{title}</h2>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {analysis?.summary ?? row.content}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ...(analysis?.mentioned_opponents ?? []),
                      ...(analysis?.mentioned_entities ?? []),
                      ...(analysis?.mentioned_allies ?? []),
                    ]
                      .slice(0, 8)
                      .map((term) => (
                        <Badge key={term} variant="secondary">
                          {term}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="md:text-right shrink-0">
                  <div
                    className={`font-display text-3xl ${risk >= 70 ? "text-destructive" : risk >= 45 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {risk}
                  </div>
                  <div className="label-mono text-[10px]">risco</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    sent. {Number(analysis?.sentiment ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
