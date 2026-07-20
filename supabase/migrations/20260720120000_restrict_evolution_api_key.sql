-- Fecha a regressão de segurança A1: a migração 20260622170740 concedeu a `authenticated`
-- GRANT SELECT/INSERT/UPDATE em TODAS as colunas de whatsapp_instances, revertendo a restrição
-- de coluna anterior (20260616164824) e reexpondo `evolution_api_key` (a chave da API do WhatsApp,
-- em texto puro) a qualquer admin de org via a API REST.
--
-- Correção: re-escopo os grants POR COLUNA, excluindo `evolution_api_key`. O segredo passa a ser
-- lido/escrito SOMENTE pelo servidor (service_role, que ignora GRANT). Nenhuma server function é
-- afetada — todas as leituras da chave usam `supabaseAdmin` (ver whatsapp.functions.ts,
-- backfill.server.ts, evolution.server.ts). `listInstances` (client) já não seleciona a coluna.

REVOKE SELECT, INSERT, UPDATE ON public.whatsapp_instances FROM authenticated;

GRANT SELECT (
  id, org_id, source_id, evolution_base_url, instance_name, connected_phone,
  webhook_token, connection_status, last_seen_at, created_at, updated_at
) ON public.whatsapp_instances TO authenticated;

GRANT INSERT (
  id, org_id, source_id, evolution_base_url, instance_name, connected_phone,
  webhook_token, connection_status, last_seen_at, created_at, updated_at
) ON public.whatsapp_instances TO authenticated;

GRANT UPDATE (
  id, org_id, source_id, evolution_base_url, instance_name, connected_phone,
  webhook_token, connection_status, last_seen_at, created_at, updated_at
) ON public.whatsapp_instances TO authenticated;
