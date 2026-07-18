import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchInternal, searchWeb } from "@/lib/search.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search as SearchIcon, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Busca — Inpol" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { orgId } = useCurrentOrg();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"internal" | "web">("internal");

  const internal = useMutation({
    mutationFn: () => searchInternal({ data: { orgId: orgId!, q, days: 30 } }),
  });
  const web = useMutation({
    mutationFn: () => searchWeb({ data: { orgId: orgId!, q } }),
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !orgId) return;
    if (tab === "internal") internal.mutate();
    else web.mutate();
  };

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <header>
        <div className="label-mono">Busca</div>
        <h1 className="font-display text-3xl mt-1">Pesquisar inteligência</h1>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "internal" | "web")}>
        <TabsList>
          <TabsTrigger value="internal">Mensagens internas</TabsTrigger>
          <TabsTrigger value="web">Imprensa local</TabsTrigger>
        </TabsList>

        <form onSubmit={onSearch} className="flex gap-2 mt-4">
          <Input
            placeholder={
              tab === "internal" ? "Buscar em mensagens dos grupos…" : "Buscar em notícias locais…"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" disabled={internal.isPending || web.isPending}>
            <SearchIcon className="size-4 mr-2" /> Buscar
          </Button>
        </form>

        <TabsContent value="internal" className="mt-4 space-y-2">
          {internal.isPending && <p className="text-muted-foreground text-sm">Buscando…</p>}
          {internal.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum resultado.</p>
          )}
          {internal.data?.map((r) => {
            const grp = Array.isArray(r.group) ? r.group[0] : r.group;
            const an = Array.isArray(r.analysis) ? r.analysis[0] : r.analysis;
            return (
              <Card key={r.id} className="p-4 bg-surface">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-mono">{new Date(r.posted_at).toLocaleString("pt-BR")}</span>
                  {grp?.subject && <span>· {grp.subject}</span>}
                  {an?.neighborhood && <span>· {an.neighborhood}</span>}
                  {an?.risk_score != null && (
                    <span className="font-mono">· risco {an.risk_score}</span>
                  )}
                </div>
                <p className="text-sm">{r.content}</p>
                {an?.summary && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{an.summary}</p>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="web" className="mt-4 space-y-2">
          {web.isPending && <p className="text-muted-foreground text-sm">Buscando…</p>}
          {web.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum resultado.</p>
          )}
          {web.data?.map((r, i) => (
            <Card key={i} className="p-4 bg-surface">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary inline-flex items-center gap-1"
              >
                {r.title} <ExternalLink className="size-3" />
              </a>
              {r.source && <div className="label-mono mt-1">{r.source}</div>}
              <p className="text-sm text-muted-foreground mt-1">{r.snippet}</p>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
