import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RestrictedGate } from "@/components/restricted-gate";
import {
  listInstances,
  createInstance,
  getInstanceStatus,
  deleteInstance,
} from "@/lib/whatsapp.functions";
import { usePlatformAdmin } from "@/lib/use-platform-admin";
import { listVocabulary, addVocabulary, removeVocabulary } from "@/lib/vocabulary.functions";
import {
  tseListMunicipios,
  importElected,
  listElected,
  setElectedAlignment,
  deleteElected,
  syncAllElectedToVocabulary,
} from "@/lib/elected.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, ChevronsUpDown, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol" }] }),
  component: () => (
    <RestrictedGate>
      <Settings />
    </RestrictedGate>
  ),
});

const VOCAB_KINDS = [
  ["focus_term", "Palavra de foco"],
  ["neighborhood", "Bairro"],
  ["opponent", "Opositor"],
  ["ally", "Aliado"],
  ["department", "Secretaria"],
  ["facility", "Equipamento público"],
  ["sensitive_term", "Termo sensível"],
  ["news_domain", "Domínio de notícia"],
] as const;

function Settings() {
  const { orgId } = useCurrentOrg();
  if (!orgId) return <div className="p-8 text-muted-foreground">Selecione uma organização.</div>;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <header>
        <div className="label-mono">Ajustes</div>
        <h1 className="font-display text-3xl mt-1">Configurações</h1>
      </header>
      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="vocab">Vocabulário</TabsTrigger>
          <TabsTrigger value="elected">Eleitos (TSE)</TabsTrigger>
        </TabsList>
        <TabsContent value="whatsapp" className="mt-4">
          <InstancesTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="vocab" className="mt-4">
          <VocabTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="elected" className="mt-4">
          <ElectedTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstancesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = usePlatformAdmin();
  const { data: instances = [] } = useQuery({
    queryKey: ["instances", orgId],
    queryFn: () => listInstances({ data: { orgId } }),
  });

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createInstance({
        data: { orgId, instanceName: name, evolutionBaseUrl: url, evolutionApiKey: key },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instances", orgId] });
      setName("");
      setUrl("");
      setKey("");
      toast.success("Instância adicionada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  // Sempre usa o domínio publicado para webhooks — evita URLs de preview (*.lovableproject.com)
  // que mudam a cada build e não são acessíveis externamente de forma estável.
  const webhookBase = "https://inpol.hebe.digital";

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card className="p-6 bg-surface space-y-3">
          <h3 className="font-display text-lg">Conectar instância WhatsApp</h3>
          <p className="text-xs text-muted-foreground">
            Visível apenas para administradores da plataforma.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Nome (instance)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="gabinete-jundiai"
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://evo.exemplo.com"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} type="password" />
            </div>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !name || !url || !key}
          >
            Adicionar
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {instances.map((i) => (
          <InstanceCard
            key={i.id}
            orgId={orgId}
            instance={i}
            webhookBase={webhookBase}
            onCopy={copy}
            isAdmin={isAdmin}
          />
        ))}
        {instances.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Nenhuma instância conectada ainda."
              : "Nenhum número de WhatsApp vinculado. Solicite ao administrador da plataforma a conexão."}
          </p>
        )}
      </div>
    </div>
  );
}

type InstanceRow = {
  id: string;
  instance_name: string;
  evolution_base_url: string;
  webhook_token: string;
  connection_status: string | null;
  last_seen_at: string | null;
};

function statusVariant(state: string | null | undefined): {
  label: string;
  className: string;
} {
  const s = (state ?? "").toLowerCase();
  if (s === "open" || s === "ok" || s === "connected")
    return {
      label: "conectado",
      className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    };
  if (s === "connecting" || s === "qr" || s === "pending" || s === "pendente")
    return {
      label: state ?? "conectando",
      className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    };
  if (s === "close" || s === "closed" || s === "disconnected" || s === "error")
    return {
      label: state ?? "desconectado",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    };
  return {
    label: state ?? "desconhecido",
    className: "bg-muted text-muted-foreground border-border",
  };
}

function InstanceCard({
  orgId,
  instance: i,
  webhookBase,
  onCopy,
  isAdmin,
}: {
  orgId: string;
  instance: InstanceRow;
  webhookBase: string;
  onCopy: (t: string) => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const webhookUrl = `${webhookBase}/api/public/evolution/webhook/${i.webhook_token}`;
  const check = useMutation({
    mutationFn: () => getInstanceStatus({ data: { orgId, instanceId: i.id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["instances", orgId] });
      toast.success(`Status: ${r.state}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const del = useMutation({
    mutationFn: () => deleteInstance({ data: { orgId, instanceId: i.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instances", orgId] });
      toast.success("Instância removida");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const v = statusVariant(i.connection_status);

  return (
    <Card className="p-4 bg-surface">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{i.instance_name}</div>
          {isAdmin && <div className="label-mono mt-1 truncate">{i.evolution_base_url}</div>}
          {i.last_seen_at && (
            <div className="text-xs text-muted-foreground mt-1">
              Visto em {new Date(i.last_seen_at).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={v.className}>
            {v.label}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => check.mutate()}
            disabled={check.isPending}
            title="Verificar conexão"
          >
            <RefreshCw className={cn("size-3.5", check.isPending && "animate-spin")} />
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (
                  confirm(
                    `Remover a instância "${i.instance_name}"? Grupos vinculados serão apagados.`,
                  )
                )
                  del.mutate();
              }}
              disabled={del.isPending}
              title="Remover instância"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {isAdmin && (
        <>
          <div className="mt-3 p-3 bg-background rounded-md flex items-center gap-2">
            <code className="text-xs font-mono flex-1 truncate">{webhookUrl}</code>
            <Button size="sm" variant="ghost" onClick={() => onCopy(webhookUrl)}>
              <Copy className="size-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Configure este webhook na Evolution API ({i.instance_name}) — evento{" "}
            <code>messages.upsert</code>.
          </p>
        </>
      )}
    </Card>
  );
}

function VocabTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["vocab", orgId],
    queryFn: () => listVocabulary({ data: { orgId } }),
  });

  const [kind, setKind] = useState<(typeof VOCAB_KINDS)[number][0]>("neighborhood");
  const [value, setValue] = useState("");

  const add = useMutation({
    mutationFn: () => addVocabulary({ data: { orgId, kind, value, aliases: [] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
      setValue("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const rm = useMutation({
    mutationFn: (id: string) => removeVocabulary({ data: { orgId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", orgId] }),
  });

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.kind] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-surface flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 min-w-0">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOCAB_KINDS.map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>Valor</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button onClick={() => add.mutate()} disabled={!value.trim()}>
          Adicionar
        </Button>
      </Card>

      {VOCAB_KINDS.map(([k, label]) => (
        <div key={k}>
          <h3 className="font-display text-sm mb-2">{label}</h3>
          <div className="flex flex-wrap gap-2">
            {(grouped[k] ?? []).map((it) => (
              <Badge key={it.id} variant="outline" className="gap-1">
                {it.value}
                <button onClick={() => rm.mutate(it.id)} className="ml-1 hover:text-destructive">
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
            {(grouped[k] ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">vazio</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const ELECTION_YEARS = [2024, 2020, 2016, 2012];
const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function ElectedTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [uf, setUf] = useState("SP");
  const [year, setYear] = useState<number>(2024);
  const [muniCode, setMuniCode] = useState<string>("");
  const [muniName, setMuniName] = useState<string>("");
  const [muniOpen, setMuniOpen] = useState(false);
  const [filterAlign, setFilterAlign] = useState<"all" | "ally" | "opponent" | "neutral">("all");
  const [onlyElected, setOnlyElected] = useState(true);

  const muniQuery = useQuery({
    queryKey: ["tse-municipios", uf, year],
    queryFn: () => tseListMunicipios({ data: { uf, ano: year } }),
    enabled: !!uf,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const listQuery = useQuery({
    queryKey: ["elected", orgId, filterAlign, onlyElected],
    queryFn: () => listElected({ data: { orgId, alignment: filterAlign, onlyElected } }),
  });

  const importMut = useMutation({
    mutationFn: () => importElected({ data: { orgId, uf, codMunicipioTse: muniCode, ano: year } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      toast.success(`${r.imported} candidatos importados (${r.elected} eleitos)`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const alignMut = useMutation({
    mutationFn: (vars: { id: string; alignment: "ally" | "opponent" | "neutral" | "management" }) =>
      setElectedAlignment({ data: { orgId, id: vars.id, alignment: vars.alignment } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
    },
  });

  const syncMut = useMutation({
    mutationFn: () => syncAllElectedToVocabulary({ data: { orgId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
      toast.success(`${r.synced} eleitos sincronizados ao vocabulário`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteElected({ data: { orgId, id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
    },
  });

  const items = listQuery.data ?? [];
  const municipios = muniQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-surface space-y-3">
        <h3 className="font-display text-lg">Importar do TSE (DivulgaCandContas)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>UF</Label>
            <Select
              value={uf}
              onValueChange={(v) => {
                setUf(v);
                setMuniCode("");
                setMuniName("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Município</Label>
            <Popover open={muniOpen} onOpenChange={setMuniOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={muniQuery.isLoading}
                >
                  {muniName || (muniQuery.isLoading ? "Carregando..." : "Selecione")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[360px]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cidade..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma cidade.</CommandEmpty>
                    <CommandGroup>
                      {municipios.map((m) => (
                        <CommandItem
                          key={m.codigo}
                          value={m.nome}
                          onSelect={() => {
                            setMuniCode(m.codigo);
                            setMuniName(m.nome);
                            setMuniOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              muniCode === m.codigo ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {m.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Eleição</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ELECTION_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => importMut.mutate()} disabled={importMut.isPending || !muniCode}>
          <Download className="size-4 mr-2" />
          {importMut.isPending ? "Importando..." : "Importar candidatos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Anos pares municipais (2024, 2020, 2016) trazem prefeito/vice/vereador. Anos pares gerais
          (2022, 2018) trazem deputados/governador/senador.
        </p>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch checked={onlyElected} onCheckedChange={setOnlyElected} id="only-elected" />
          <Label htmlFor="only-elected" className="cursor-pointer">
            Apenas eleitos
          </Label>
        </div>
        <Select value={filterAlign} onValueChange={(v) => setFilterAlign(v as typeof filterAlign)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos alinhamentos</SelectItem>
            <SelectItem value="management">Gestão</SelectItem>
            <SelectItem value="ally">Aliados</SelectItem>
            <SelectItem value="opponent">Opositores</SelectItem>
            <SelectItem value="neutral">Neutros</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="ml-auto"
        >
          <RefreshCw className={cn("size-3.5 mr-2", syncMut.isPending && "animate-spin")} />
          Sincronizar ao vocabulário
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Eleitos marcados como <strong>Gestão</strong>, <strong>Aliado</strong> ou{" "}
        <strong>Opositor</strong> entram automaticamente no vocabulário e passam a ser mensurados
        pelo sistema (Gestão vira <em>Palavra de foco</em>).
      </p>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum registro. Importe acima.</p>
        )}
        {items.map((p) => (
          <Card key={p.id} className="p-3 bg-surface flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{p.nome_urna ?? p.nome}</span>
                {p.is_elected && <Badge variant="default">Eleito</Badge>}
                <Badge variant="outline">{p.cargo_nome}</Badge>
                {p.partido_sigla && <Badge variant="outline">{p.partido_sigla}</Badge>}
              </div>
              <div className="label-mono mt-1">
                #{p.numero} · {p.ano_eleicao} · {p.uf}
              </div>
            </div>
            <Select
              value={p.alignment}
              onValueChange={(v) =>
                alignMut.mutate({
                  id: p.id,
                  alignment: v as "ally" | "opponent" | "neutral" | "management",
                })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="management">Gestão</SelectItem>
                <SelectItem value="ally">Aliado</SelectItem>
                <SelectItem value="opponent">Opositor</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => delMut.mutate(p.id)}>
              <Trash2 className="size-3" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
