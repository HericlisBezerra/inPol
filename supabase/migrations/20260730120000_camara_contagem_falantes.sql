-- Câmara: contagem de FALANTES na sessão (distinta da contagem de falas).
--
-- A tela mostra "16 de 19 falantes com ficha vinculada" — quantas PESSOAS falaram e quantas
-- delas o sistema conseguiu casar com `org_people`. É o indicador de saúde do vínculo: se cair,
-- ou entrou vereador novo sem ficha, ou o nome mudou de grafia na transcrição.
--
-- Denormalizado em coluna, seguindo o precedente do `speech_count` que já existe aqui. A
-- alternativa era derivar na leitura, o que obrigaria a varrer `camara_speeches` da org inteira
-- só para desenhar a lista — uma legislatura acumula centenas de sessões, e o custo cresceria
-- sem teto para um número que a ingestão já sabe no momento em que grava as falas.
--
-- `analysis` não serve para guardar isto: aquele campo pertence a `analisarSessao`, que o
-- sobrescreve inteiro a cada reanálise.

alter table public.camara_sessions
  add column if not exists speaker_count integer not null default 0,
  add column if not exists linked_count integer not null default 0;

comment on column public.camara_sessions.speaker_count is
  'Falantes DISTINTOS na sessão (não falas). Contado na ingestão.';
comment on column public.camara_sessions.linked_count is
  'Quantos desses falantes casaram com uma ficha em org_people. speaker_count - linked_count = convidados e nomes não reconhecidos.';

-- Sem GRANT/RLS novos: colunas adicionadas a uma tabela existente herdam as policies
-- (`camara_sessions_select` / `camara_sessions_write`) e os grants já concedidos.
