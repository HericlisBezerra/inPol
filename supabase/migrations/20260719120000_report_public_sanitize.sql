-- Camada de sanitização LGPD do compartilhamento público de relatório.
--
-- Os relatórios citam mensagens reais de cidadãos entre aspas. O link público NUNCA expõe o
-- `markdown` cru: expõe um SNAPSHOT SANITIZADO separado (`markdown_public`), gerado por
-- `sanitizeReportForPublic` (src/lib/report-sanitize.server.ts) — determinístico (telefone,
-- horário, nome de grupo) + passe LLM de NER para nomes de pessoas físicas — e APROVADO por um
-- admin antes de publicar (human-in-the-loop, LGPD art. 37/46).
--
-- Regras de fluxo (aplicadas nas server fns, não em RLS):
--   * generateSanitizedReport(reportId): grava markdown_public + sanitized_at/by + sanitize_flags.
--   * createReportShare exige markdown_public IS NOT NULL (não publica sem snapshot sanitizado).
--   * a rota /r/$token passa a ler `markdown_public` (NUNCA `markdown`).
--
-- Não adiciona policy anônima: a leitura pública continua via supabaseAdmin filtrando por
-- share_token + share_enabled (ver 20260719090000_report_public_share.sql).

ALTER TABLE public.reports
  ADD COLUMN markdown_public TEXT,
  ADD COLUMN sanitized_at TIMESTAMPTZ,
  ADD COLUMN sanitized_by UUID REFERENCES auth.users(id),
  ADD COLUMN sanitize_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.reports.markdown_public IS
  'Snapshot sanitizado (LGPD) exposto no link público /r/$token. NULL = nunca sanitizado; publicar exige NOT NULL.';
COMMENT ON COLUMN public.reports.sanitize_flags IS
  'Metadados da sanitização: { counts: {phone,time,group,name}, degraded: bool }.';

-- DEFESA NO BANCO (não só na aplicação): impossível ter share_enabled=true sem um snapshot
-- sanitizado. Barra até um UPDATE direto via PostgREST por um org admin (a policy
-- reports_admin_update permite escrita em qualquer coluna) de publicar o markdown cru.
ALTER TABLE public.reports
  ADD CONSTRAINT reports_share_requires_sanitized
  CHECK (NOT share_enabled OR markdown_public IS NOT NULL);
