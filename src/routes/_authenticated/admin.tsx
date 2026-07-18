import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  amIPlatformAdmin,
  adminListUsers,
  adminCreateUser,
  adminDeleteUser,
  adminSetPassword,
  adminSetOrgMembership,
  adminRemoveOrgMembership,
  adminListOrgs,
  adminCreateOrg,
  adminDeleteOrg,
  adminGetPlatformSettings,
  adminUpdatePlatformSettings,
  adminListOrgNumbers,
  adminAssignOrgNumber,
  adminUnassignOrgNumber,
  adminListEvolutionInstances,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, KeyRound, UserPlus, Building2, Phone, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Inpol" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AdminPanel,
});

function AdminPanel() {
  const { data: me, isLoading } = useQuery({
    queryKey: ["platform-admin"],
    queryFn: () => amIPlatformAdmin(),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!me?.isAdmin)
    return (
      <div className="p-8 max-w-xl">
        <Card className="p-6 bg-surface">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-6 text-destructive" />
            <div>
              <h1 className="font-display text-xl">Acesso restrito</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Este painel é exclusivo para administradores da plataforma.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <header>
        <div className="label-mono">Administração</div>
        <h1 className="font-display text-3xl mt-1">Painel administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários, organizações e a instância Evolution do sistema.
        </p>
      </header>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="orgs">Organizações</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="orgs" className="mt-4">
          <OrgsTab />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsappTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- USERS ---------------- */

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminListUsers(),
  });
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => adminListOrgs(),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateUser({ data: { email, password, fullName: fullName || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEmail("");
      setPassword("");
      setFullName("");
      toast.success("Usuário criado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => adminDeleteUser({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário deletado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-surface space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <UserPlus className="size-4" /> Criar usuário
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Senha temporária</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mín. 8 caracteres"
            />
          </div>
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !email || password.length < 8}
        >
          Criar usuário
        </Button>
      </Card>

      <div className="space-y-2">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            orgs={orgs}
            onDelete={() => {
              if (confirm(`Deletar ${u.email}? Esta ação é irreversível.`)) deleteMut.mutate(u.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

type AdminUser = Awaited<ReturnType<typeof adminListUsers>>[number];
type AdminOrg = Awaited<ReturnType<typeof adminListOrgs>>[number];

function UserRow({
  user,
  orgs,
  onDelete,
}: {
  user: AdminUser;
  orgs: AdminOrg[];
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [newPass, setNewPass] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [role, setRole] = useState<"owner" | "analyst" | "viewer">("viewer");

  const passMut = useMutation({
    mutationFn: () => adminSetPassword({ data: { userId: user.id, password: newPass } }),
    onSuccess: () => {
      toast.success("Senha atualizada");
      setNewPass("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const addMemMut = useMutation({
    mutationFn: () => adminSetOrgMembership({ data: { userId: user.id, orgId, role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Vinculado à organização");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const rmMemMut = useMutation({
    mutationFn: (targetOrg: string) =>
      adminRemoveOrgMembership({ data: { userId: user.id, orgId: targetOrg } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <Card className="p-4 bg-surface space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {user.full_name || user.email}
            {user.is_platform_admin && <Badge variant="default">master admin</Badge>}
            {!user.email_confirmed_at && <Badge variant="outline">não confirmado</Badge>}
          </div>
          <div className="label-mono mt-1 truncate">{user.email}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {user.memberships.length === 0 && (
          <span className="text-xs text-muted-foreground">Sem organizações</span>
        )}
        {user.memberships.map((m) => (
          <Badge key={m.org_id} variant="outline" className="gap-2">
            {m.org_name} · {m.role}
            <button onClick={() => rmMemMut.mutate(m.org_id)} className="hover:text-destructive">
              <Trash2 className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">Vincular à organização</Label>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher…" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Papel</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">owner</SelectItem>
              <SelectItem value="analyst">analyst</SelectItem>
              <SelectItem value="viewer">viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => addMemMut.mutate()}
          disabled={!orgId || addMemMut.isPending}
        >
          Vincular
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Nova senha</Label>
          <Input
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="mín. 8"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => passMut.mutate()}
          disabled={newPass.length < 8 || passMut.isPending}
        >
          <KeyRound className="size-3.5 mr-1" /> Alterar
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- ORGS ---------------- */

function OrgsTab() {
  const qc = useQueryClient();
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => adminListOrgs(),
  });
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateOrg({ data: { name, city: city || undefined, state: state || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      setName("");
      setCity("");
      setState("");
      toast.success("Organização criada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const deleteMut = useMutation({
    mutationFn: (orgId: string) => adminDeleteOrg({ data: { orgId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success("Organização deletada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-surface space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Building2 className="size-4" /> Nova organização
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
          </div>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={!name || createMut.isPending}>
          Criar
        </Button>
      </Card>

      <div className="space-y-2">
        {orgs.map((o) => (
          <Card key={o.id} className="p-3 bg-surface flex items-center justify-between gap-3">
            <div>
              <div className="font-medium flex items-center gap-2">
                {o.name}
                {o.is_demo && <Badge variant="outline">demo</Badge>}
              </div>
              <div className="label-mono mt-1">
                {o.city ?? "—"} / {o.state ?? "—"} · {o.slug}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                if (confirm(`Deletar organização "${o.name}"? Todos os dados dela serão apagados.`))
                  deleteMut.mutate(o.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- WHATSAPP ---------------- */

function WhatsappTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: () => adminGetPlatformSettings(),
  });
  const { data: numbers = [] } = useQuery({
    queryKey: ["admin-org-numbers"],
    queryFn: () => adminListOrgNumbers(),
  });
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => adminListOrgs(),
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [orgId, setOrgId] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [label, setLabel] = useState("");

  const savedUrl = settings?.evolution_base_url ?? "";

  const saveMut = useMutation({
    mutationFn: () =>
      adminUpdatePlatformSettings({
        data: {
          evolutionBaseUrl: baseUrl || savedUrl || undefined,
          evolutionApiKey: apiKey || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-evolution-instances"] });
      setApiKey("");
      toast.success("Configuração atualizada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const {
    data: evoData,
    refetch: refetchInstances,
    isFetching: instancesLoading,
  } = useQuery({
    queryKey: ["admin-evolution-instances"],
    queryFn: () => adminListEvolutionInstances(),
    enabled: !!settings?.evolution_base_url,
  });
  const instances = evoData?.instances ?? [];

  const assignMut = useMutation({
    mutationFn: () => {
      const inst = instances.find((i) => i.name === selectedInstance);
      const phoneJid = inst?.ownerJid || selectedInstance;
      const finalLabel = label || inst?.profileName || selectedInstance;
      return adminAssignOrgNumber({
        data: {
          orgId,
          phoneJid,
          label: finalLabel,
          instanceName: selectedInstance,
          connectedPhone: inst?.ownerJid,
          connectionStatus: inst?.status,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-org-numbers"] });
      qc.invalidateQueries({ queryKey: ["instances", orgId] });
      setSelectedInstance("");
      setLabel("");
      toast.success("Instância vinculada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const unassignMut = useMutation({
    mutationFn: (id: string) => adminUnassignOrgNumber({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-org-numbers"] });
      qc.invalidateQueries({ queryKey: ["instances"] });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-surface space-y-3">
        <h3 className="font-display text-lg">Conexão Evolution (sistema)</h3>
        <p className="text-xs text-muted-foreground">
          Configure a URL base e a API Key. As instâncias existentes na Evolution serão listadas
          abaixo para vincular a organizações.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>
              Base URL{" "}
              {savedUrl && (
                <span className="text-xs text-muted-foreground">· atual: {savedUrl}</span>
              )}
            </Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={savedUrl || "https://zap.hebe.digital"}
            />
          </div>
          <div>
            <Label>
              API Key <span className="text-xs text-muted-foreground">· vazio mantém a atual</span>
            </Label>
            <Input
              value={apiKey}
              type="password"
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Salvar
          </Button>
          <Button variant="outline" onClick={() => refetchInstances()} disabled={instancesLoading}>
            {instancesLoading ? "Consultando…" : "Testar / listar instâncias"}
          </Button>
        </div>
        {evoData?.error && <p className="text-xs text-destructive">{evoData.error}</p>}
        {instances.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {instances.length} instância(s) disponíveis na Evolution.
          </p>
        )}
      </Card>

      <Card className="p-6 bg-surface space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Phone className="size-4" /> Vincular instância a organização
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Organização</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher…" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instância Evolution</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger>
                <SelectValue
                  placeholder={instances.length ? "Escolher instância…" : "Nenhuma instância"}
                />
              </SelectTrigger>
              <SelectContent>
                {instances.map((i) => (
                  <SelectItem key={i.name} value={i.name}>
                    {i.name}
                    {i.ownerJid ? ` · ${i.ownerJid.replace(/@.*/, "")}` : ""}
                    {i.status ? ` · ${i.status}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rótulo (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gabinete Jundiaí"
            />
          </div>
          <Button
            onClick={() => assignMut.mutate()}
            disabled={!orgId || !selectedInstance || assignMut.isPending}
          >
            Vincular
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {numbers.map((n) => {
          const org = n.organizations as { id: string; name: string } | null;
          return (
            <Card key={n.id} className="p-3 bg-surface flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{n.label ?? n.phone_jid}</div>
                <div className="label-mono mt-1">
                  {n.phone_jid} → {org?.name ?? "?"}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => unassignMut.mutate(n.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </Card>
          );
        })}
        {numbers.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum número vinculado.</p>
        )}
      </div>
    </div>
  );
}
