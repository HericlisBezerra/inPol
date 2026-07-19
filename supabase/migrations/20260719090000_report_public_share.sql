-- Compartilhamento público de relatório (link /r/$token).
--
-- IMPORTANTE sobre segurança: esta migração NÃO adiciona nenhuma policy de SELECT
-- para os roles `anon` ou `authenticated` em public.reports. A leitura pública do
-- relatório compartilhado é feita inteiramente pela server fn `getSharedReport`
-- (src/routes/r.$token.tsx), que usa `supabaseAdmin` (service role, ignora RLS)
-- filtrando explicitamente por `share_token = <token> AND share_enabled = true` e
-- retornando só um subconjunto de colunas (kind, title, period_start, period_end,
-- markdown). Nunca abrir RLS anônima nesta tabela: `reports` guarda dados internos
-- por org_id e o token é o único segredo que autoriza o acesso ao link.
--
-- share_token é gerado em src/lib/share-token.ts (generateShareToken(), 24 bytes de
-- entropia em base64url) e setado/revogado pelas server fns autenticadas em
-- src/lib/reports-share.functions.ts (createReportShare / revokeReportShare), que
-- usam o supabase do usuário (context.supabase) — a RLS existente de UPDATE em
-- reports (policy "reports_admin_update", só org admin ou platform admin) já
-- garante que só quem pode administrar o relatório pode criar/revogar o link.

ALTER TABLE public.reports
  ADD COLUMN share_token TEXT,
  ADD COLUMN share_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN shared_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_reports_share_token ON public.reports (share_token)
  WHERE share_token IS NOT NULL;
