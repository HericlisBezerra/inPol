import { Sparkles } from "lucide-react";

export function DemoBanner({ orgName }: { orgName: string }) {
  return (
    <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/30 px-6 py-2 flex items-center gap-2 text-sm">
      <Sparkles className="size-4 text-primary" />
      <span className="font-medium text-primary">Modo Demonstração</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {orgName} · dados fictícios para apresentação comercial. Nada aqui está conectado a sistemas reais.
      </span>
    </div>
  );
}
