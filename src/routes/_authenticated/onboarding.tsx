import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrg, enterDemoMode } from "@/lib/orgs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === "1" ? "1" : undefined,
  }),
  component: Onboarding,
});

type UF = { id: number; sigla: string; nome: string };
type Municipio = { id: number; nome: string };

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setOrgId } = useCurrentOrg();
  const [name, setName] = useState("Gabinete Jundiaí");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [ufOpen, setUfOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  const ufQuery = useQuery({
    queryKey: ["ibge-ufs"],
    queryFn: async (): Promise<UF[]> => {
      const r = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
      );
      if (!r.ok) throw new Error("Falha ao carregar UFs");
      return r.json();
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  const cityQuery = useQuery({
    queryKey: ["ibge-municipios", state],
    enabled: !!state,
    queryFn: async (): Promise<Municipio[]> => {
      const r = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`,
      );
      if (!r.ok) throw new Error("Falha ao carregar municípios");
      return r.json();
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  const ufs = useMemo(() => ufQuery.data ?? [], [ufQuery.data]);
  const cities = useMemo(() => cityQuery.data ?? [], [cityQuery.data]);

  const mut = useMutation({
    mutationFn: () => createOrg({ data: { name, city, state } }),
    onSuccess: async (org) => {
      setOrgId(org.id);
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      toast.success("Organização criada");
      navigate({ to: "/settings" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const demoMut = useMutation({
    mutationFn: () => enterDemoMode(),
    onSuccess: async ({ orgId: newId }) => {
      setOrgId(newId);
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      toast.success("Modo demo ativado");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="font-display text-3xl mb-2">Bem-vindo ao Inpol</h1>
      <p className="text-muted-foreground mb-6">
        Crie sua organização para começar a monitorar grupos de WhatsApp e gerar
        relatórios de inteligência política.
      </p>

      <Card className="p-5 mb-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-display text-lg">Quer ver o Inpol em ação primeiro?</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Entre no modo demonstração com a organização <b>Prefeitura de Jundiaí</b> populada com 90 dias de dados fictícios — grupos, alertas, mapa, adversários e relatórios.
            </p>
            <Button onClick={() => demoMut.mutate()} disabled={demoMut.isPending}>
              {demoMut.isPending ? "Preparando demo..." : "Entrar no Modo Demo"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-surface space-y-4">
        <div>
          <Label htmlFor="n">Nome da organização</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <div>
            <Label>UF</Label>
            <Popover open={ufOpen} onOpenChange={setUfOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={ufQuery.isLoading}
                >
                  {state
                    ? `${state} — ${ufs.find((u) => u.sigla === state)?.nome ?? ""}`
                    : ufQuery.isLoading
                    ? "Carregando..."
                    : "Selecione"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[280px]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar UF..." />
                  <CommandList>
                    <CommandEmpty>Nenhum estado.</CommandEmpty>
                    <CommandGroup>
                      {ufs.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={`${u.sigla} ${u.nome}`}
                          onSelect={() => {
                            setState(u.sigla);
                            setCity("");
                            setUfOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              state === u.sigla ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {u.sigla} — {u.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Cidade</Label>
            <Popover open={cityOpen} onOpenChange={setCityOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={!state || cityQuery.isLoading}
                >
                  {city ||
                    (!state
                      ? "Selecione a UF primeiro"
                      : cityQuery.isLoading
                      ? "Carregando..."
                      : "Selecione a cidade")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[360px]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cidade..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma cidade.</CommandEmpty>
                    <CommandGroup>
                      {cities.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.nome}
                          onSelect={() => {
                            setCity(c.nome);
                            setCityOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              city === c.nome ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !name || !city || !state}
          className="w-full"
        >
          {mut.isPending ? "Criando..." : "Criar organização"}
        </Button>
      </Card>
    </div>
  );
}
