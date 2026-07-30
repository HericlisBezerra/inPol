-- Esfriamento de casos por inatividade.
--
-- PROBLEMA: a regra "nível não desce dentro de um ciclo aberto" é correta para um alerta
-- em movimento — o que já foi vermelho e não foi tratado não pode virar amarelo só porque
-- a janela de detecção esfriou. Mas sem contrapartida ela nunca solta: um caso fica aberto
-- e vermelho para sempre até alguém clicar em resolver.
-- Medição na org piloto depois da consolidação: 74 de 146 casos abertos estão marcados
-- CRÍTICO, e 74 não recebem sinal novo há mais de 7 dias (37 há mais de 14). Metade da
-- tela de triagem é histórico congelado — e uma tela onde tudo é crítico não tria nada.
--
-- REGRA: enquanto há sinal novo, o nível não desce (a regra antiga vale). Sem sinal novo,
-- o caso esfria um nível por vez e, persistindo o silêncio, encerra sozinho.
--
-- `closed_reason` existe porque "o gabinete resolveu" e "esfriou sozinho" são fatos
-- diferentes e não podem virar a mesma linha no histórico — principalmente num produto
-- que usa o passado ("resolvemos em 12/07, voltou em 25/07") como informação política.
alter table public.alerts
  add column if not exists closed_reason text
  check (closed_reason is null or closed_reason in ('inatividade', 'reaberto_ciclo'));

comment on column public.alerts.closed_reason is
  'Por que o alerta foi encerrado. NULL = ação humana (o gabinete resolveu). "inatividade" = esfriou sozinho por falta de sinal novo. Preenchido pelo esfriamento em alerts.server.ts.';

-- Suporta a varredura de esfriamento: abertos, ordenados por última atividade.
create index if not exists idx_alerts_open_last_seen
  on public.alerts (org_id, last_seen_at)
  where resolved_at is null;
