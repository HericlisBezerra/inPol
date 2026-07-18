import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTerritoryStats } from "@/lib/territory.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/territory")({
  head: () => ({ meta: [{ title: "Território — Inpol" }] }),
  component: Territory,
});

function colorFor(s: number) {
  if (s >= 0.25) return "#22c55e";
  if (s >= 0.05) return "#86efac";
  if (s >= -0.1) return "#94a3b8";
  if (s >= -0.3) return "#f59e0b";
  return "#ef4444";
}
function emojiFor(s: number) {
  if (s >= 0.25) return "😄";
  if (s >= 0.05) return "🙂";
  if (s >= -0.1) return "😐";
  if (s >= -0.3) return "😟";
  return "😡";
}

function Territory() {
  const { orgId } = useCurrentOrg();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["territory", orgId, days],
    enabled: !!orgId,
    queryFn: () => getTerritoryStats({ data: { orgId: orgId!, days } }),
  });

  const items = data?.items ?? [];
  const maxMsg = items.reduce((m, x) => Math.max(m, x.msgs), 1);

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="label-mono">🗺️ Território</div>
          <h1 className="font-display text-3xl mt-1">Mapa de aprovação por bairro</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Sentimento agregado dos últimos {days} dias por bairro mencionado nas mensagens
            analisadas.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded border ${d === days ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {!isLoading && items.length === 0 && (
        <Card className="p-6 bg-surface text-sm text-muted-foreground">
          Ainda sem mensagens com bairro classificado. Cadastre bairros no Vocabulário (Ajustes) e
          aguarde novas análises.
        </Card>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-4 bg-surface">
            <h3 className="font-display text-lg mb-3">🏆 Ranking</h3>
            <div className="space-y-2">
              {items.map((b, i) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono w-6">#{i + 1}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground font-mono inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {b.msgs} msgs · {emojiFor(b.sentiment)}{" "}
                        {b.sentiment.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={b.sentiment >= 0 ? "default" : "destructive"}
                    className="font-mono"
                  >
                    {b.approval}%
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-surface">
            <h3 className="font-display text-lg mb-3">Heatmap</h3>
            <div className="flex flex-wrap gap-2">
              {items.map((b) => {
                const size = 60 + (b.msgs / maxMsg) * 80;
                return (
                  <div
                    key={b.name}
                    style={{ width: size, height: size, background: colorFor(b.sentiment) }}
                    className="rounded flex items-center justify-center text-[10px] font-mono text-black/70 text-center px-1"
                    title={`${b.name} · ${b.msgs} msgs · ${b.sentiment.toFixed(2)}`}
                  >
                    {b.name}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted-foreground">
              <span>😡 muito negativo</span>
              <span>😟 negativo</span>
              <span>😐 neutro</span>
              <span>🙂 positivo</span>
              <span>😄 muito positivo</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
