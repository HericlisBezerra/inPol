import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Globe, Newspaper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({ meta: [{ title: "Fontes — Inpol" }] }),
  component: Sources,
});

function Sources() {
  const { orgId } = useCurrentOrg();

  const { data: sources = [] } = useQuery({
    queryKey: ["sources", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sources")
        .select("id, kind, label, is_active, config")
        .eq("org_id", orgId!);
      return data ?? [];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-monitored", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_groups")
        .select("id, subject, participant_count, is_monitored")
        .eq("org_id", orgId!)
        .eq("is_monitored", true)
        .order("subject");
      return data ?? [];
    },
  });

  const wa = groups;
  const social = sources.filter((s) => ["instagram", "facebook", "x"].includes(s.kind));
  const news = sources.filter((s) => s.kind === "news" || s.kind === "web_search");

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <header>
        <div className="label-mono">📡 Fontes</div>
        <h1 className="font-display text-3xl mt-1">
          Três frentes. <em className="text-primary not-italic">Um relatório.</em>
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
          O Inpol monitora três territórios em paralelo. Cada fonte cadastrada é varrida
          automaticamente.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-surface">
          <div className="flex items-start gap-3 mb-4">
            <MessageSquare className="size-5 text-primary mt-1" />
            <div>
              <h3 className="font-display text-lg leading-tight">WhatsApp dos bairros</h3>
              <p className="text-xs text-muted-foreground">Grupos legitimamente acessados</p>
            </div>
          </div>
          <div className="space-y-3">
            {wa.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhum grupo monitorado. Vá em Grupos e ative os desejados.
              </div>
            )}
            {wa.slice(0, 10).map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.subject}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {g.participant_count ?? 0} membros
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40 border">
                  ● ao vivo
                </Badge>
              </div>
            ))}
            {wa.length > 10 && (
              <div className="text-xs text-muted-foreground">+ {wa.length - 10} grupos</div>
            )}
          </div>
        </Card>

        <Card className="p-5 bg-surface">
          <div className="flex items-start gap-3 mb-4">
            <Globe className="size-5 text-primary mt-1" />
            <div>
              <h3 className="font-display text-lg leading-tight">Redes públicas</h3>
              <p className="text-xs text-muted-foreground">Perfis e menções abertas</p>
            </div>
          </div>
          <div className="space-y-3">
            {social.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhuma rede configurada. Adicione perfis no Vocabulário ou solicite ao
                administrador da plataforma.
              </div>
            )}
            {social.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.kind}</div>
                </div>
                <Badge
                  className={
                    s.is_active
                      ? "bg-amber-500/20 text-amber-500 border-amber-500/40 border"
                      : "border-border"
                  }
                >
                  {s.is_active ? "◉ varredura" : "pausado"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-surface">
          <div className="flex items-start gap-3 mb-4">
            <Newspaper className="size-5 text-primary mt-1" />
            <div>
              <h3 className="font-display text-lg leading-tight">Imprensa</h3>
              <p className="text-xs text-muted-foreground">Portais e matérias públicas</p>
            </div>
          </div>
          <div className="space-y-3">
            {news.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhuma fonte de imprensa cadastrada. Portais são varridos automaticamente a cada 2h
                assim que o administrador da plataforma habilitar.
              </div>
            )}
            {news.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.kind}</div>
                </div>
                <Badge
                  className={
                    s.is_active
                      ? "bg-amber-500/20 text-amber-500 border-amber-500/40 border"
                      : "border-border"
                  }
                >
                  {s.is_active ? "◉ varredura" : "pausado"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
