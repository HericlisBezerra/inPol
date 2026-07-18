-- Extensões base que o projeto Lovable Cloud original já tinha habilitadas
-- fora do controle de versão (mesma classe do gap de pg_cron já documentado
-- em vault/07-Migracao-Lovable/Plano-Desacoplar-Lovable.md).
--
-- gen_random_bytes/gen_random_uuid são usados sem qualificação de schema em
-- 20260616151530 (author_hash_salt) — precisa estar no search_path.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ALTER DATABASE só vale pra sessões futuras; `db push` reusa a mesma sessão
-- entre arquivos de migração, então precisamos também do SET imediato abaixo
-- para as migrações seguintes (mesma sessão) enxergarem gen_random_bytes()
-- sem qualificar o schema.
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;
SET search_path TO "$user", public, extensions;
