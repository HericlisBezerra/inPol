-- Deduplicação de mensagens encaminhadas (WhatsApp de bairro é máquina de forward).
--
-- Medição na org piloto antes desta migração: 30,2% do corpus era texto IDÊNTICO,
-- com uma única mensagem repetida 29 vezes. Isso inflava o custo de token dos
-- relatórios sem acrescentar informação — e, pior, escondia sinal: uma mensagem
-- encaminhada 29× em 6 grupos em poucas horas é indício de disparo coordenado,
-- que hoje se perdia no volume.
--
-- Coluna GERADA (não coluna comum preenchida por código): o Postgres calcula em
-- todo INSERT/UPDATE, então a dedup é automática por construção — nenhum caminho
-- de ingestão pode esquecer de preencher, nem o webhook, nem o backfill, nem um
-- import futuro. Também preenche as linhas existentes na própria migração.
--
-- Normalização: trim + colapso de espaços + lower. Mensagens curtas (<25 chars)
-- ficam NULL de propósito: "bom dia", "kkkk" e "👍" repetem o dia inteiro sem
-- serem encaminhamento — agrupá-las geraria cluster gigante e sem sentido.
-- Todas as funções usadas são IMMUTABLE, requisito de coluna gerada.
alter table public.raw_messages
  add column if not exists content_fingerprint text
  generated always as (
    case
      when content is null or length(btrim(content)) < 25 then null
      else md5(lower(regexp_replace(btrim(content), '\s+', ' ', 'g')))
    end
  ) stored;

-- Suporta o agrupamento por cluster dentro de uma janela (org + período).
-- Parcial: linha sem fingerprint não entra no índice.
create index if not exists idx_raw_messages_fingerprint
  on public.raw_messages (org_id, content_fingerprint, posted_at desc)
  where content_fingerprint is not null;

comment on column public.raw_messages.content_fingerprint is
  'Hash do conteúdo normalizado, para agrupar encaminhamentos idênticos. NULL em mensagens curtas (<25 chars). Gerada pelo banco — não preencher por código.';
