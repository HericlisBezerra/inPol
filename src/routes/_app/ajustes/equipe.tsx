import { type ReactNode, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListUsers, adminCreateUser, adminSetOrgMembership } from "@/lib/admin.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/ajustes/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Ajustes" }] }),
  component: Equipe,
});

/**
 * S17 — Ajustes · Equipe e usuários.
 *
 * Backend real disponível (admin.functions.ts): adminListUsers / adminCreateUser /
 * adminSetOrgMembership — todas restritas a administrador da plataforma (assertPlatformAdmin),
 * não a "owner" da própria org. Para quem não é admin de plataforma, a tela mostra um aviso
 * discreto (é o erro real do backend, não um dado fabricado) em vez de dados falsos.
 *
 * Colunas removidas do mock original por falta de fonte real: 2FA (não existe tabela/coluna de
 * MFA no schema) e a linha de "convite pendente" (não existe tabela de convites — adminCreateUser
 * cria o usuário direto, sem estado de convite). "Último acesso" agora é o last_sign_in_at real.
 */

const GRID = "grid grid-cols-[1.8fr_1fr_1fr] items-center gap-3 px-5";

type Role = "owner" | "analyst" | "viewer";

const ROLE_LABEL: Record<Role, string> = { owner: "Dona", analyst: "Analista", viewer: "Leitura" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR");
}

function Equipe() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");

  const listUsersFn = useServerFn(adminListUsers);
  const createUserFn = useServerFn(adminCreateUser);
  const setMembershipFn = useServerFn(adminSetOrgMembership);

  const {
    data: users,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-users-for-org", orgId],
    queryFn: () => listUsersFn(),
    enabled: !!orgId,
    retry: false,
  });

  const rows = (users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.full_name || u.email,
      lastSignIn: u.last_sign_in_at,
      role: u.memberships.find((m) => m.org_id === orgId)?.role as Role | undefined,
    }))
    .filter((u) => !!u.role);

  const invite = useMutation({
    mutationFn: async () => {
      const email = inviteEmail.trim();
      if (!email || !orgId) throw new Error("Informe um e-mail válido.");
      const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const created = await createUserFn({
        data: { email, password: tempPassword, fullName: inviteName.trim() || undefined },
      });
      if (!created.id) throw new Error("Falha ao criar usuário.");
      await setMembershipFn({ data: { userId: created.id, orgId, role: inviteRole } });
      return { email };
    },
    onSuccess: ({ email }) => {
      toast.success(`${email} adicionado(a) à equipe.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
      qc.invalidateQueries({ queryKey: ["admin-users-for-org", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao convidar."),
  });

  const submitInvite = () => {
    if (!inviteEmail.trim()) return;
    if (!confirm(`Criar acesso para ${inviteEmail.trim()} como "${ROLE_LABEL[inviteRole]}"?`))
      return;
    invite.mutate();
  };

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  const permissionDenied =
    isError && error instanceof Error && /platform|plataforma/i.test(error.message);

  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Equipe e acesso</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Quem vê o quê. Todo acesso a mensagens fica registrado na trilha LGPD.
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white"
          >
            ＋ Convidar
          </button>
          {inviteOpen && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
              <label className="text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Nome (opcional)
              </label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                placeholder="ex.: Paula Lima"
              />
              <label className="mt-2.5 block text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                E-mail
              </label>
              <input
                autoFocus
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitInvite()}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                placeholder="paula@jundiai.sp.gov.br"
              />
              <label className="mt-2.5 block text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Papel
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
              >
                <option value="owner">Dona</option>
                <option value="analyst">Analista</option>
                <option value="viewer">Leitura</option>
              </select>
              <button
                onClick={submitInvite}
                disabled={!inviteEmail.trim() || invite.isPending}
                className="mt-2.5 w-full rounded-lg bg-v2-green px-3 py-1.5 text-[12.5px] font-[650] text-white disabled:opacity-50"
              >
                {invite.isPending ? "Criando…" : "Confirmar convite"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div
          className={`${GRID} border-b border-v2-line py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint`}
        >
          <span>USUÁRIO</span>
          <span>PAPEL</span>
          <span>ÚLTIMO ACESSO</span>
        </div>

        {isLoading && <div className="px-5 py-6 text-[13px] text-v2-ink-3">Carregando equipe…</div>}

        {isError && permissionDenied && (
          <div className="px-5 py-6 text-[13px] text-v2-ink-3">
            Só administradores da plataforma podem ver a equipe por aqui, por enquanto.
          </div>
        )}
        {isError && !permissionDenied && (
          <div className="px-5 py-6 text-[13px] text-v2-crit">
            Não foi possível carregar a equipe. Tente novamente.
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="px-5 py-6 text-[13px] text-v2-ink-3">
            Nenhum usuário nesta organização ainda.
          </div>
        )}

        {!isLoading &&
          !isError &&
          rows.map((u, i) => (
            <div
              key={u.id}
              className={`${GRID} py-[13px] ${i < rows.length - 1 ? "border-b border-v2-track" : ""}`}
            >
              <UserCell
                avatar={
                  <Avatar
                    initials={initials(u.name)}
                    className={
                      u.role === "owner" ? "bg-v2-green text-white" : "bg-v2-track text-v2-ink-3"
                    }
                  />
                }
                name={u.name}
                meta={u.email}
              />
              <RoleBadge tone={u.role === "owner" ? "green" : undefined}>
                {ROLE_LABEL[u.role as Role]}
              </RoleBadge>
              <span className="font-mono text-[11px] text-v2-ink-3">
                {formatLastSeen(u.lastSignIn ?? null)}
              </span>
            </div>
          ))}
      </div>

      {/* Legenda de papéis */}
      <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-5 py-3.5">
        <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          O QUE CADA PAPEL PODE
        </div>
        <div className="text-[12.5px] leading-[1.7] text-v2-ink-2">
          <b className="text-v2-ink">Dona</b> tudo + Modo Eleição + LGPD ·{" "}
          <b className="text-v2-ink">Analista</b> opera alertas, sinais e relatórios ·{" "}
          <b className="text-v2-ink">Leitura</b> só vê painéis (sem conteúdo bruto de mensagens).
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, className }: { initials: string; className: string }) {
  return (
    <span
      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}

function UserCell({ avatar, name, meta }: { avatar: ReactNode; name: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {avatar}
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-v2-ink">{name}</div>
        <div className="truncate font-mono text-[10.5px] text-v2-faint">{meta}</div>
      </div>
    </div>
  );
}

function RoleBadge({ children, tone }: { children: ReactNode; tone?: "green" }) {
  const styles = tone === "green" ? "bg-v2-green-tint text-v2-green" : "bg-v2-track text-v2-ink-2";
  return (
    <span className={`w-fit rounded-full px-2.5 py-[3px] text-[12px] font-[650] ${styles}`}>
      {children}
    </span>
  );
}
