-- Módulo Câmara: sessões e falas.
--
-- Até aqui a tela da Câmara não tinha backend nenhum (ver Wiring-v2-Backend). O insumo
-- chegou: o gabinete transcreve as sessões do YouTube com diarização, e o arquivo já vem
-- com timestamp, nome e partido de quem fala:
--   [00:21:40] Ver. Henrique do Cardume (PSOL): texto…
-- Ou seja, a parte difícil (atribuir fala a vereador) vem resolvida da origem — o módulo
-- é ingestão + vínculo, não NLP.
--
-- REGRA DE ARQUITETURA: vereador que fala numa sessão é a MESMA pessoa que aparece no
-- WhatsApp e no TSE. `person_id` aponta para `org_people`; nunca criar cadastro paralelo
-- de vereadores — seria repetir a fragmentação que a migração `org_people` resolveu.
-- Validado na primeira sessão real: 15 dos 16 falantes casaram com fichas existentes.

create table if not exists public.camara_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  session_date date not null,
  numero text,        -- "62ª"
  legislatura text,   -- "19ª"
  tipo text,          -- ordinária | extraordinária | solene
  title text not null,
  video_url text,
  -- Id do YouTube guardado à parte: é ele que permite montar o link para o MINUTO exato
  -- de cada fala (?v=<id>&t=<segundos>) — o "quem falou o quê, com o minuto do vídeo".
  video_id text,
  -- Fonte preservada: permite reprocessar a sessão (novo prompt, novo parser) sem depender
  -- do arquivo original na máquina de quem importou.
  transcript_raw text,
  speech_count integer not null default 0,
  duration_seconds integer,
  -- Agregados EXATOS (contados, nunca gerados por IA) + narrativa da sessão.
  analysis jsonb,
  markdown text,
  model_version text,
  analyzed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mesma sessão importada duas vezes atualiza, não duplica.
  unique (org_id, session_date, numero)
);

create table if not exists public.camara_speeches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references public.camara_sessions (id) on delete cascade,
  order_index integer not null,
  -- Segundos desde o início do vídeo (o `[00:21:40]` da transcrição).
  at_seconds integer not null,
  speaker_raw text not null,   -- linha original, para auditar o parser
  speaker_name text not null,
  speaker_party text,
  speaker_role text not null default 'vereador'
    check (speaker_role in ('presidente', 'vereador', 'convidado', 'desconhecido')),
  -- O vínculo com a ficha única. NULL quando é convidado ou quando o nome não casou —
  -- e `speaker_name` continua lá, então a fala nunca se perde por falta de vínculo.
  person_id uuid references public.org_people (id) on delete set null,
  content text not null,
  word_count integer not null default 0,
  -- Análise por fala (preenchida depois da ingestão; nula não impede nada).
  topic text,
  sentiment numeric,
  risk_score integer,
  summary text,
  created_at timestamptz not null default now(),
  unique (session_id, order_index)
);

create index if not exists idx_camara_sessions_org on public.camara_sessions (org_id, session_date desc);
create index if not exists idx_camara_speeches_session on public.camara_speeches (session_id, order_index);
create index if not exists idx_camara_speeches_person on public.camara_speeches (org_id, person_id) where person_id is not null;

-- ── RLS + GRANT (regra 4 do CLAUDE.md: na mesma migração) ────────────────────
grant select, insert, update, delete on public.camara_sessions to authenticated;
grant select, insert, update, delete on public.camara_speeches to authenticated;
alter table public.camara_sessions enable row level security;
alter table public.camara_speeches enable row level security;

drop policy if exists "camara_sessions_select" on public.camara_sessions;
drop policy if exists "camara_sessions_write" on public.camara_sessions;
drop policy if exists "camara_speeches_select" on public.camara_speeches;
drop policy if exists "camara_speeches_write" on public.camara_speeches;

create policy "camara_sessions_select" on public.camara_sessions
  for select to authenticated using (public.has_org_access(auth.uid(), org_id));
create policy "camara_sessions_write" on public.camara_sessions
  for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

create policy "camara_speeches_select" on public.camara_speeches
  for select to authenticated using (public.has_org_access(auth.uid(), org_id));
create policy "camara_speeches_write" on public.camara_speeches
  for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

comment on table public.camara_sessions is
  'Sessão da Câmara transcrita (YouTube + diarização). `transcript_raw` guarda a fonte para reprocessar.';
comment on column public.camara_speeches.person_id is
  'Ficha em org_people. Vereador que fala é a MESMA pessoa do WhatsApp e do TSE — nunca criar cadastro paralelo.';
