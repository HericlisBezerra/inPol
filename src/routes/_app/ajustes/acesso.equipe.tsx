import { type ReactNode, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListUsers, adminCreateUser, adminSetOrgMembership } from "@/lib/admin.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Consequence, FieldHint, FieldLabel, PanelHeader } from "./-ui";

export const Route = createFileRoute("/_app/ajustes/acesso/equipe")({
  head: () => ({ meta: [{ title: "Equipe e papéis — Ajustes" }] }),
  component: Equipe,
});

/**
 * Ajustes · Quem acessa · Equipe e papéis (antes /ajustes/equipe).
 *
 * Backend real disponível (admin.functions.ts): adminListUsers / adminCreateUser /
 * adminSetOrgMembership — todas restritas a administrador da plataforma (assertPlatformAdmin),
 * não a "owner" da própria org. Para quem não é admin de plataforma, a tela mostra um aviso
 * discreto (é o erro real do backend, não um dado fabricado) em vez de dados falsos.
 *
 * Colunas removidas do mock original por falta de fonte real: 2FA (não existe tabela/coluna de
 * MFA no schema) e a linha de "convite pendente" (não existe tabela de convites — adminCreateUser
 * cria o usuário direto, sem estado de convite). "Último acesso" é o last_sign_in_at real.
 *
 * O papel é a escolha mais consequente da tela: ele decide quem pode abrir conteúdo bruto
 * de mensagem de cidadão. Isso agora está escrito no seletor, não só na legenda do rodapé.
 */

const GRID = "grid grid-cols-[1.8fr_1fr_1fr] items-center gap-3 px-5";

type Role = "owner" | "analyst" | "viewer";

const ROLE_LABEL: Record<Role, string> = { owner: "Dona", analyst: "Analista", viewer: "Leitura" };

// Consequência de cada papel, mostrada no ato da escolha.
const ROLE_EFFECT: Record<Role, string> = {
  owner:
    "Acesso total, incluindo conteúdo bruto de mensagens, Modo Eleição e as ações de LGPD (expurgo e exclusão de titular).",
  analyst:
    "Opera alertas, sinais e relatórios e vê conteúdo bruto de mensagens — cada abertura fica registrada na trilha LGPD.",
  viewer: "Só painéis e números agregados. Não abre conteúdo bruto de mensagem de cidadão.",
};

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
      <PanelHeader
        title="Equipe e papéis"
        description="Quem entra nesta organização e o que cada um enxerga."
        effect={
          <>
            O papel decide quem consegue abrir o{" "}
            <b className="text-v2-ink">conteúdo bruto das mensagens</b> de cidadãos. Toda abertura
            desse conteúdo é gravada na trilha de auditoria, com autor e horário.
          </>
        }
        action={
          <div className="relative">
            <button
              onClick={() => setInviteOpen((v) => !v)}
              className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-v2-card"
            >
              ＋ Convidar
            </button>
            {inviteOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
                <FieldLabel>Nome (opcional)</FieldLabel>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                  placeholder="ex.: Paula Lima"
                />
                <FieldLabel className="mt-2.5">E-mail</FieldLabel>
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitInvite()}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                  placeholder="paula@jundiai.sp.gov.br"
                />
                <FieldHint>
                  O acesso é criado na hora, sem etapa de convite pendente — a pessoa já passa a
                  contar como membro desta organização.
                </FieldHint>
                <FieldLabel className="mt-2.5">Papel</FieldLabel>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
                >
                  <option value="owner">Dona</option>
                  <option value="analyst">Analista</option>
                  <option value="viewer">Leitura</option>
                </select>
                {/* Consequência do papel selecionado, no momento da escolha. */}
                <FieldHint>{ROLE_EFFECT[inviteRole]}</FieldHint>
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
        }
      />

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
        <dl className="space-y-2 text-[12.5px] leading-normal text-v2-ink-2">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <div key={r}>
              <dt className="inline font-[650] text-v2-ink">{ROLE_LABEL[r]} — </dt>
              <dd className="inline">{ROLE_EFFECT[r]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Consequence icon="🛡" tone="neutral">
        Trocar o papel de alguém vale a partir do próximo carregamento de tela dela. Remover o
        acesso não apaga o que ela já viu — o histórico fica na trilha de auditoria.
      </Consequence>
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
