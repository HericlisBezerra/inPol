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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { upsertMember, deleteMember } from "@/lib/people.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({ meta: [{ title: "Pessoas monitoradas — Inpol" }] }),
  component: People,
});

type Member = {
  id: string;
  display_name: string;
  role: string;
  neighborhood: string | null;
  tags: string[];
};

function People() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Member | null>(null);
  const [open, setOpen] = useState(false);

  const upsertFn = useServerFn(upsertMember);
  const delFn = useServerFn(deleteMember);

  const { data: members = [] } = useQuery({
    queryKey: ["tracked-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tracked_members")
        .select("id, display_name, role, neighborhood, tags")
        .eq("org_id", orgId!)
        .order("display_name");
      return (data ?? []) as Member[];
    },
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["member-stats", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_daily_stats")
        .select("member_id, message_count, avg_sentiment, insults_count, avg_response_minutes")
        .eq("org_id", orgId!);
      return data ?? [];
    },
  });

  const upsertMut = useMutation({
    mutationFn: (m: Partial<Member> & { displayName: string; role: string }) =>
      upsertFn({
        data: {
          id: m.id,
          orgId: orgId!,
          displayName: m.displayName,
          role: m.role,
          neighborhood: m.neighborhood ?? null,
          tags: m.tags ?? [],
        },
      }),
    onSuccess: () => {
      toast.success("Pessoa salva");
      qc.invalidateQueries({ queryKey: ["tracked-members", orgId] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { orgId: orgId!, id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["tracked-members", orgId] });
    },
  });

  const agg = new Map<
    string,
    { msgs: number; sent: number; sentN: number; insults: number; resp: number; respN: number }
  >();
  stats.forEach((s) => {
    const a = agg.get(s.member_id) ?? { msgs: 0, sent: 0, sentN: 0, insults: 0, resp: 0, respN: 0 };
    a.msgs += s.message_count ?? 0;
    if (s.avg_sentiment != null) {
      a.sent += Number(s.avg_sentiment);
      a.sentN++;
    }
    a.insults += s.insults_count ?? 0;
    if (s.avg_response_minutes != null) {
      a.resp += Number(s.avg_response_minutes);
      a.respN++;
    }
    agg.set(s.member_id, a);
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <header className="flex items-start justify-between">
        <div>
          <div className="label-mono">👥 Pessoas monitoradas</div>
          <h1 className="font-display text-3xl mt-1">Lideranças e militantes 🎯</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Cadastre pessoas relevantes (líderes de bairro, vereadores, militantes) e acompanhe
            volume/sentimento/xingamentos individuais.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4 mr-1" /> Nova pessoa
        </Button>
      </header>

      <Card className="bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead className="text-right">Sentimento</TableHead>
              <TableHead className="text-right">Xingam.</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const a = agg.get(m.id);
              const sent = a && a.sentN > 0 ? a.sent / a.sentN : 0;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.role}</TableCell>
                  <TableCell className="text-muted-foreground">{m.neighborhood ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{a?.msgs ?? 0}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${sent >= 0 ? "text-emerald-500" : "text-destructive"}`}
                  >
                    {sent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{a?.insults ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(m.tags ?? []).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(m);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        confirm(`Remover ${m.display_name}?`) && deleteMut.mutate(m.id)
                      }
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma pessoa cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <MemberDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={(v) => upsertMut.mutate(v)}
        pending={upsertMut.isPending}
      />
    </div>
  );
}

function MemberDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Member | null;
  onSubmit: (v: {
    id?: string;
    displayName: string;
    role: string;
    neighborhood: string | null;
    tags: string[];
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial?.display_name ?? "");
  const [role, setRole] = useState(initial?.role ?? "lider_bairro");
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(initial?.display_name ?? "");
          setRole(initial?.role ?? "lider_bairro");
          setNeighborhood(initial?.neighborhood ?? "");
          setTags((initial?.tags ?? []).join(", "));
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Papel</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="lider_bairro, vereador, militante..."
            />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !name.trim() || !role.trim()}
            onClick={() =>
              onSubmit({
                id: initial?.id,
                displayName: name.trim(),
                role: role.trim(),
                neighborhood: neighborhood.trim() || null,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
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
