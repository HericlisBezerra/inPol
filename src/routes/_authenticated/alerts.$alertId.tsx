import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alerts/$alertId")({
  head: () => ({ meta: [{ title: "Alerta — Inpol" }] }),
  component: AlertDetail,
});

const TIMELINE_BAD = [
  { day: "Seg · manhã", text: "3 reclamações sobre agendamento em um grupo da zona oeste. Assessor lê de relance. Acha pontual." },
  { day: "Ter", text: "Mais 5 reclamações em 2 grupos diferentes. Comentário ácido em matéria do Bom Dia Jundiaí. Ninguém alerta o prefeito." },
  { day: "Qua", text: "Vereador de oposição compartilha os prints no Instagram. 200 compartilhamentos em 6h." },
  { day: "Qui · noite", text: "A Tribuna de Jundiaí liga pedindo posicionamento oficial." },
  { day: "Sex", text: "Manchete: \"Moradores reclamam de fila na UBS Maringá; prefeitura promete resposta\"" },
];
const TIMELINE_GOOD = [
  { day: "Seg · 14h", text: "Alerta laranja no relatório: tema em 3 grupos + 22 comentários negativos em portais. Estágio: borbulhando." },
  { day: "Ter · manhã", text: "Prefeito reúne secretário de saúde. Identifica que o agendamento estava com problema técnico há 9 dias." },
  { day: "Qua · manhã", text: "Visita oficial à UBS com câmera. Equipe documenta solução em andamento." },
  { day: "Qui · 10h", text: "Publicação no Instagram da gestão: \"Estive na UBS Maringá, ouvi os moradores, contratamos reforço.\"" },
  { day: "Sex", text: "Manchete: \"Prefeito vai à UBS Maringá e anuncia reforço; moradores comemoram\"" },
];

function AlertDetail() {
  const { alertId } = Route.useParams();
  const { orgId } = useCurrentOrg();

  const { data: alert } = useQuery({
    queryKey: ["alert", alertId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").eq("id", alertId).maybeSingle();
      return data;
    },
  });

  if (!alert) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <Link to="/alerts" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ChevronLeft className="size-4" /> Voltar para alertas
      </Link>

      <header>
        <Badge className="bg-destructive/20 text-destructive border-destructive/40 border uppercase font-mono text-[10px]">
          {alert.level}
        </Badge>
        <h1 className="font-display text-3xl mt-2">{alert.topic}</h1>
        {alert.neighborhood && (
          <div className="text-muted-foreground text-sm mt-1 inline-flex items-center gap-1">
            <MapPin className="size-3" /> {alert.neighborhood}
          </div>
        )}
        <p className="text-sm mt-3 max-w-3xl">{alert.summary}</p>
        {alert.recommended_action && (
          <Card className="p-4 mt-4 bg-primary/10 border-primary/30 max-w-3xl">
            <div className="label-mono text-xs mb-1 text-primary">Ação recomendada</div>
            <p className="text-sm">{alert.recommended_action}</p>
          </Card>
        )}
      </header>

      <section>
        <h2 className="font-display text-xl mb-1">Como 48 horas mudam uma manchete</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          Comparativo do mesmo cenário — sem e com o Inpol.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 bg-surface border-destructive/30">
            <div className="font-display text-lg flex items-center gap-2 mb-4">
              <span className="size-2 rounded-full bg-destructive" /> Sem Inpol
            </div>
            <div className="space-y-3">
              {TIMELINE_BAD.map((s, i) => (
                <div key={i} className="border-l-2 border-border pl-3">
                  <div className="label-mono text-[10px] text-muted-foreground">{s.day}</div>
                  <p className="text-sm mt-0.5">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-sm text-destructive">
              Gabinete reativo. Manchete negativa. Oposição com narrativa pronta.
            </div>
          </Card>

          <Card className="p-5 bg-surface border-primary/30">
            <div className="font-display text-lg flex items-center gap-2 mb-4">
              <span className="size-2 rounded-full bg-primary" /> Com Inpol
            </div>
            <div className="space-y-3">
              {TIMELINE_GOOD.map((s, i) => (
                <div key={i} className="border-l-2 border-primary/40 pl-3">
                  <div className="label-mono text-[10px] text-primary">{s.day}</div>
                  <p className="text-sm mt-0.5">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-sm text-primary">
              Gabinete antecipou. Manchete positiva. <b>Mesma cidade, mesma semana, manchete invertida.</b>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
