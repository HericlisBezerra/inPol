import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, type KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInstances,
  listGroups,
  refreshGroups,
  toggleGroupMonitoring,
  setGroupTags,
} from "@/lib/whatsapp.functions";
import { listVocabulary, addVocabulary } from "@/lib/vocabulary.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  RefreshCw,
  ChevronsUpDown,
  Check,
  Users,
  MapPin,
  Plus,
  Search as SearchIcon,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "Grupos — Inpol" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const { orgId } = useCurrentOrg();
  if (!orgId) return <div className="p-8 text-muted-foreground">Selecione uma organização.</div>;
  return (
    <div className="p-8 max-w-6xl space-y-6">
      <header>
        <div className="label-mono">WhatsApp</div>
        <h1 className="font-display text-3xl mt-1">Grupos monitorados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ative o monitoramento e vincule cada grupo a um bairro.
        </p>
      </header>
      <GroupsView orgId={orgId} />
    </div>
  );
}

function GroupsView({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: instances = [] } = useQuery({
    queryKey: ["instances", orgId],
    queryFn: () => listInstances({ data: { orgId } }),
  });
  const [instanceId, setInstanceId] = useState<string | undefined>();
  const activeInstance = instanceId ?? instances[0]?.id;

  const { data: groups = [], isFetching } = useQuery({
    queryKey: ["groups", orgId, activeInstance],
    queryFn: () => listGroups({ data: { orgId, instanceId: activeInstance } }),
    enabled: !!activeInstance,
  });

  const { data: vocab = [] } = useQuery({
    queryKey: ["vocab", orgId],
    queryFn: () => listVocabulary({ data: { orgId } }),
  });
  const neighborhoods = useMemo(
    () => vocab.filter((v) => v.kind === "neighborhood").map((v) => v.value),
    [vocab],
  );

  const refresh = useMutation({
    mutationFn: () => refreshGroups({ data: { orgId, instanceId: activeInstance! } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["groups", orgId, activeInstance] });
      toast.success(`${r.synced} grupos sincronizados`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggle = useMutation({
    mutationFn: (vars: { groupId: string; monitored: boolean; tag: string | null }) =>
      toggleGroupMonitoring({
        data: {
          orgId,
          groupId: vars.groupId,
          monitored: vars.monitored,
          neighborhoodTag: vars.tag,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", orgId, activeInstance] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const addNeighborhood = useMutation({
    mutationFn: (value: string) =>
      addVocabulary({ data: { orgId, kind: "neighborhood", value, aliases: [] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", orgId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const tagsMut = useMutation({
    mutationFn: (vars: { groupId: string; tags: string[] }) =>
      setGroupTags({ data: { orgId, groupId: vars.groupId, tags: vars.tags } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", orgId, activeInstance] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("__all__");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => (g.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (tagFilter !== "__all__" && !(g.tags ?? []).includes(tagFilter)) return false;
      if (!q) return true;
      if ((g.subject ?? "").toLowerCase().includes(q)) return true;
      if ((g.neighborhood_tag ?? "").toLowerCase().includes(q)) return true;
      if ((g.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [groups, search, tagFilter]);

  if (instances.length === 0)
    return (
      <Card className="p-6 bg-surface">
        <p className="text-sm text-muted-foreground">
          Conecte uma instância WhatsApp em Ajustes → WhatsApp para começar.
        </p>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeInstance} onValueChange={setInstanceId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {instances.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.instance_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || !activeInstance}
          variant="outline"
        >
          <RefreshCw className={cn("size-4 mr-2", refresh.isPending && "animate-spin")} />
          Sincronizar grupos
        </Button>
        {isFetching && <span className="text-xs text-muted-foreground">carregando…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, bairro ou tag…"
            className="pl-9"
          />
        </div>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas as tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {groups.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            Nenhum grupo. Clique em “Sincronizar grupos”.
          </p>
        )}
        {groups.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            Nenhum grupo corresponde ao filtro.
          </p>
        )}
        {filtered.map((g) => (
          <Card key={g.id} className="p-4 bg-surface flex gap-3 items-start">
            <Avatar className="size-12 shrink-0">
              <AvatarImage src={g.picture_url ?? undefined} alt={g.subject ?? ""} />
              <AvatarFallback>{(g.subject ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.subject ?? "Sem nome"}</div>
                  <div className="label-mono mt-0.5 flex items-center gap-1">
                    <Users className="size-3" />
                    {g.participant_count ?? 0} participantes
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">monitorar</span>
                  <Switch
                    checked={g.is_monitored ?? false}
                    onCheckedChange={(checked) =>
                      toggle.mutate({
                        groupId: g.id,
                        monitored: checked,
                        tag: g.neighborhood_tag ?? null,
                      })
                    }
                  />
                </div>
              </div>

              <NeighborhoodPicker
                value={g.neighborhood_tag ?? ""}
                options={neighborhoods}
                onChange={(v) =>
                  toggle.mutate({
                    groupId: g.id,
                    monitored: g.is_monitored ?? false,
                    tag: v || null,
                  })
                }
                onCreate={async (v) => {
                  await addNeighborhood.mutateAsync(v);
                  toggle.mutate({
                    groupId: g.id,
                    monitored: g.is_monitored ?? false,
                    tag: v,
                  });
                }}
              />

              <TagsEditor
                tags={g.tags ?? []}
                suggestions={allTags}
                pending={tagsMut.isPending}
                onChange={(next) => tagsMut.mutate({ groupId: g.id, tags: next })}
              />

              {g.is_monitored && !g.neighborhood_tag && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/40">
                  Sem bairro vinculado
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NeighborhoodPicker({
  value,
  options,
  onChange,
  onCreate,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onCreate: (v: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trimmed = search.trim();
  const exists = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <MapPin className="size-3.5" />
            {value || <span className="text-muted-foreground">Vincular bairro…</span>}
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar ou criar bairro…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed ? (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent inline-flex items-center gap-2"
                  onClick={async () => {
                    await onCreate(trimmed);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Plus className="size-3.5" /> Criar “{trimmed}”
                </button>
              ) : (
                "Digite para buscar."
              )}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">Remover vínculo</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-3.5 mr-2", opt === value ? "opacity-100" : "opacity-0")}
                  />
                  {opt}
                </CommandItem>
              ))}
              {trimmed && !exists && (
                <CommandItem
                  value={`__create_${trimmed}`}
                  onSelect={async () => {
                    await onCreate(trimmed);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Plus className="size-3.5 mr-2" /> Criar “{trimmed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagsEditor({
  tags,
  suggestions,
  pending,
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  pending?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const lower = trimmed.toLowerCase();
  const sugg = suggestions.filter(
    (s) => !tags.includes(s) && (!trimmed || s.toLowerCase().includes(lower)),
  );

  const add = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (tags.includes(v)) return;
    onChange([...tags, v]);
    setDraft("");
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TagIcon className="size-3.5 text-muted-foreground" />
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="hover:text-destructive"
              aria-label={`Remover ${t}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={tags.length ? "+ tag" : "Adicionar tag…"}
          disabled={pending}
          className="h-7 w-32 text-xs"
        />
      </div>
      {trimmed && sugg.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sugg.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-xs px-2 py-0.5 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
