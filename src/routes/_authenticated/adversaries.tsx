import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, TrendingDown, Activity, Plus, Pencil, Trash2, Instagram, RefreshCw } from "lucide-react";
import { useState } from "react";
import { upsertAdversary, deleteAdversary } from "@/lib/people.functions";
import { upsertInstagramTarget, deleteInstagramTarget, scanInstagramTargetNow } from "@/lib/instagram.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/adversaries")({
  head: () => ({ meta: [{ title: "Adversários — Inpol" }] }),
  component: Adversaries,
});

type Adv = {
  id: string;
  display_name: string;
  handle: string | null;
  role: string | null;
  party: string | null;
  activity_score: number;
  sentiment: number | null;
  top_topics: unknown;
  recent_actions: unknown;
};

function Adversaries() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Adv | null>(null);
  const upsertFn = useServerFn(upsertAdversary);
  const delFn = useServerFn(deleteAdversary);

  const { data = [] } = useQuery({
    queryKey: ["adversaries", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("org_adversaries")
        .select("*")
        .eq("org_id", orgId!)
        .order("activity_score", { ascending: false });
      return (data ?? []) as Adv[];
    },
  });

  const upsertMut = useMutation({
    mutationFn: (v: { id?: string; displayName: string; handle: string | null; role: string | null; party: string | null; topTopics: string[] }) =>
      upsertFn({ data: { orgId: orgId!, ...v } }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["adversaries", orgId] }); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { orgId: orgId!, id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["adversaries", orgId] }); },
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <header className="flex items-start justify-between">
        <div>
          <div className="label-mono">⚔️ Adversários</div>
          <h1 className="font-display text-3xl mt-1">Adversários ativos no território 🎯</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Cadastre quem está empurrando narrativa contra o gabinete. Volume e sentimento serão preenchidos automaticamente.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> Novo adversário
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((a) => {
          const topics = Array.isArray(a.top_topics) ? (a.top_topics as string[]) : [];
          const actions = Array.isArray(a.recent_actions) ? (a.recent_actions as { date: string; action: string }[]) : [];
          return (
            <Card key={a.id} className="p-5 bg-surface">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-full bg-destructive/15 flex items-center justify-center text-destructive">
                  <Swords className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg truncate">{a.display_name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="font-mono text-xs">
                        <Activity className="size-3 mr-1" /> {a.activity_score}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="size-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => confirm(`Remover ${a.display_name}?`) && delMut.mutate(a.id)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{[a.role, a.party, a.handle].filter(Boolean).join(" · ")}</div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <TrendingDown className="size-3 text-destructive" />
                    <span className="font-mono">sentimento {(a.sentiment ?? 0).toFixed(2)}</span>
                  </div>
                  {topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {topics.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  )}
                  {actions.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3 space-y-1.5">
                      <div className="label-mono text-[10px]">Atividades recentes</div>
                      {actions.map((x, i) => (
                        <div key={i} className="text-xs flex gap-2">
                          <span className="text-muted-foreground font-mono w-12 shrink-0">{x.date}</span>
                          <span>{x.action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {data.length === 0 && (
          <Card className="p-6 col-span-full bg-surface text-sm text-muted-foreground">
            Nenhum adversário cadastrado.
          </Card>
        )}
      </div>

      <InstagramTargets orgId={orgId} />

      <AdvDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={(v) => upsertMut.mutate(v)}
        pending={upsertMut.isPending}
      />
    </div>
  );
}

type IgTarget = {
  id: string;
  handle: string;
  label: string | null;
  kind: "opponent" | "ally" | "press" | "other";
  active: boolean;
  posts_per_scan: number;
  last_scanned_at: string | null;
  last_status: string | null;
};

function InstagramTargets({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<IgTarget["kind"]>("opponent");
  const upsertFn = useServerFn(upsertInstagramTarget);
  const delFn = useServerFn(deleteInstagramTarget);
  const scanFn = useServerFn(scanInstagramTargetNow);

  const { data = [] } = useQuery({
    queryKey: ["ig-targets", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("org_instagram_targets")
        .select("*")
        .eq("org_id", orgId!)
        .order("kind")
        .order("handle");
      return (data ?? []) as IgTarget[];
    },
  });

  const addMut = useMutation({
    mutationFn: () => upsertFn({ data: { orgId: orgId!, handle, label: label || null, kind, postsPerScan: 10, active: true } }),
    onSuccess: () => {
      toast.success("Handle cadastrado");
      qc.invalidateQueries({ queryKey: ["ig-targets", orgId] });
      setOpen(false); setHandle(""); setLabel(""); setKind("opponent");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { orgId: orgId!, id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["ig-targets", orgId] }); },
  });
  const scanMut = useMutation({
    mutationFn: (id: string) => scanFn({ data: { orgId: orgId!, targetId: id } }),
    onSuccess: (r) => { toast.success(`Scan concluído: ${r.inserted} novos posts`); qc.invalidateQueries({ queryKey: ["ig-targets", orgId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro no scan"),
  });

  const kindLabel: Record<IgTarget["kind"], string> = {
    opponent: "Opositor", ally: "Aliado", press: "Imprensa", other: "Outro",
  };

  return (
    <section className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-start justify-between">
        <div>
          <div className="label-mono">📸 Instagram monitorado</div>
          <h2 className="font-display text-2xl mt-1">Perfis públicos monitorados</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Adicione @handles de opositores, aliados ou imprensa. Scan automático a cada 6h. Só posts públicos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Adicionar handle</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((t) => (
          <Card key={t.id} className="p-4 bg-surface">
            <div className="flex items-start gap-2">
              <Instagram className="size-4 text-muted-foreground mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="font-mono text-sm truncate">@{t.handle}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" disabled={scanMut.isPending} onClick={() => scanMut.mutate(t.id)}>
                      <RefreshCw className={`size-3 ${scanMut.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => confirm(`Remover @${t.handle}?`) && delMut.mutate(t.id)}>
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {t.label && <div className="text-xs text-muted-foreground truncate">{t.label}</div>}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px]">{kindLabel[t.kind]}</Badge>
                  {t.active ? <Badge variant="secondary" className="text-[10px]">ativo</Badge> : <Badge variant="outline" className="text-[10px]">pausado</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                  {t.last_scanned_at ? `último scan ${new Date(t.last_scanned_at).toLocaleString("pt-BR")}` : "aguardando primeiro scan"}
                </div>
                {t.last_status && t.last_status !== "ok" && (
                  <div className="text-[10px] text-destructive mt-1 truncate" title={t.last_status}>{t.last_status}</div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {data.length === 0 && (
          <Card className="p-5 col-span-full bg-surface text-sm text-muted-foreground">
            Nenhum handle cadastrado. Adicione @parimoschi, @tribunajundiai etc.
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo perfil Instagram</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Handle (sem @)</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} placeholder="parimoschi" />
            </div>
            <div>
              <Label>Rótulo (opcional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Vereador Parimoschi" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as IgTarget["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="opponent">Opositor</SelectItem>
                  <SelectItem value="ally">Aliado</SelectItem>
                  <SelectItem value="press">Imprensa</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={addMut.isPending || !handle.trim()} onClick={() => addMut.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AdvDialog({
  open, onOpenChange, initial, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Adv | null;
  onSubmit: (v: { id?: string; displayName: string; handle: string | null; role: string | null; party: string | null; topTopics: string[] }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState("");
  const [party, setParty] = useState("");
  const [topics, setTopics] = useState("");

  const reset = (a: Adv | null) => {
    setName(a?.display_name ?? "");
    setHandle(a?.handle ?? "");
    setRole(a?.role ?? "");
    setParty(a?.party ?? "");
    setTopics(Array.isArray(a?.top_topics) ? (a?.top_topics as string[]).join(", ") : "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) reset(initial); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar adversário" : "Novo adversário"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Handle (@)</Label><Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@parimoschi" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Papel</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Vereador" /></div>
            <div><Label>Partido</Label><Input value={party} onChange={(e) => setParty(e.target.value)} placeholder="PT, PSOL..." /></div>
          </div>
          <div><Label>Temas (vírgula)</Label><Input value={topics} onChange={(e) => setTopics(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              onSubmit({
                id: initial?.id,
                displayName: name.trim(),
                handle: handle.trim() || null,
                role: role.trim() || null,
                party: party.trim() || null,
                topTopics: topics.split(",").map((t) => t.trim()).filter(Boolean),
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
