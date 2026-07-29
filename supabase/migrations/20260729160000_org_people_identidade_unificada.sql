-- Identidade unificada de pessoas.
--
-- PROBLEMA: hoje a MESMA pessoa vive em quatro cadastros que não se conversam —
--   org_adversaries      (nome, handle, cargo, partido)   editado em Rede → Adversários
--   org_instagram_targets(handle varrido, cadência)       editado em Rede → outra seção
--   tracked_members      (presença no WhatsApp)           editado em Rede → Pessoas
--   org_vocabulary       (o nome que a IA RECONHECE)      editado em Ajustes → Vocabulário
-- Consequências reais: preencher o handle do adversário NÃO faz o sistema varrer o
-- Instagram dele; cadastrar adversário NÃO o torna reconhecível pela análise; e não
-- existe caminho para vincular um WhatsApp a um adversário (só a "pessoa monitorada").
--
-- SOLUÇÃO: `org_people` vira a entidade central. As tabelas de canal continuam existindo
-- — elas têm cadência e estado próprios, e isso é bom — mas passam a apontar para a pessoa.
-- Migração ADITIVA: nada é dropado, nenhuma tela quebra durante a transição.

create table if not exists public.org_people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null,

  -- Posicionamento político. `stance` substitui a separação por TABELA (adversaries vs
  -- members): a mesma pessoa pode mudar de lado sem trocar de cadastro nem perder histórico.
  stance text not null default 'neutro'
    check (stance in ('adversario', 'aliado', 'neutro', 'interno')),
  party text,
  role text, -- cargo: vereador, secretário, prefeito, liderança comunitária…

  -- Vínculos (todos opcionais: uma pessoa pode existir só com nome)
  -- Secretaria = termo de vocabulário kind='department'. Reusa o cadastro que já existe
  -- em vez de criar uma tabela paralela de secretarias.
  department_id uuid references public.org_vocabulary (id) on delete set null,
  -- Nome que a IA reconhece nas mensagens. Mantido em sincronia pela aplicação.
  vocabulary_id uuid references public.org_vocabulary (id) on delete set null,
  -- Ficha do TSE (partido/cargo/foto oficiais)
  elected_official_id uuid references public.elected_officials (id) on delete set null,

  avatar_url text,
  neighborhood text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_people_org on public.org_people (org_id, stance, display_name);
create index if not exists idx_org_people_dept on public.org_people (department_id) where department_id is not null;

-- Canais apontam para a pessoa. Nullable: canal pode existir sem dono identificado
-- (um @ que se monitora sem saber ainda de quem é).
alter table public.org_instagram_targets
  add column if not exists person_id uuid references public.org_people (id) on delete set null;
alter table public.tracked_members
  add column if not exists person_id uuid references public.org_people (id) on delete set null;
alter table public.member_author_links
  add column if not exists person_id uuid references public.org_people (id) on delete set null;
-- Ponte durante a transição: adversário existente aponta para a pessoa criada a partir dele.
alter table public.org_adversaries
  add column if not exists person_id uuid references public.org_people (id) on delete set null;

create index if not exists idx_ig_targets_person on public.org_instagram_targets (person_id) where person_id is not null;
create index if not exists idx_tracked_members_person on public.tracked_members (person_id) where person_id is not null;
create index if not exists idx_author_links_person on public.member_author_links (person_id) where person_id is not null;

-- ── Backfill: ninguém recadastra nada ────────────────────────────────────────
-- Adversários viram pessoas com stance='adversario', preservando id de origem no vínculo.
insert into public.org_people (org_id, display_name, stance, party, role, avatar_url)
select a.org_id, a.display_name, 'adversario', a.party, a.role, a.avatar_url
from public.org_adversaries a
where a.person_id is null
  and not exists (
    select 1 from public.org_people p
    where p.org_id = a.org_id and lower(p.display_name) = lower(a.display_name)
  );

update public.org_adversaries a
set person_id = p.id
from public.org_people p
where a.person_id is null
  and p.org_id = a.org_id
  and lower(p.display_name) = lower(a.display_name);

-- Pessoas monitoradas do WhatsApp que ainda não têm ficha.
insert into public.org_people (org_id, display_name, stance, role, neighborhood, tags)
select m.org_id, m.display_name, 'neutro', m.role, m.neighborhood, coalesce(m.tags, '{}')
from public.tracked_members m
where m.person_id is null
  and m.display_name is not null
  and not exists (
    select 1 from public.org_people p
    where p.org_id = m.org_id and lower(p.display_name) = lower(m.display_name)
  );

update public.tracked_members m
set person_id = p.id
from public.org_people p
where m.person_id is null
  and p.org_id = m.org_id
  and lower(p.display_name) = lower(m.display_name);

-- Alvos de Instagram cujo handle bate com o handle de um adversário: o vínculo que
-- faltava. É justamente o caso em que o usuário preenchia o handle achando que tinha
-- ativado o monitoramento.
update public.org_instagram_targets t
set person_id = a.person_id
from public.org_adversaries a
where t.person_id is null
  and a.person_id is not null
  and a.org_id = t.org_id
  and a.handle is not null
  and lower(replace(a.handle, '@', '')) = lower(replace(t.handle, '@', ''));

-- ── RLS + GRANT (regra 4 do CLAUDE.md: na mesma migração) ────────────────────
grant select, insert, update, delete on public.org_people to authenticated;
grant select on public.org_people to anon;
alter table public.org_people enable row level security;

drop policy if exists "org_people_select" on public.org_people;
drop policy if exists "org_people_write" on public.org_people;

-- Leitura: qualquer membro da org. Escrita: só admin (mesmo critério do cadastro de
-- adversários hoje, via assertOrgAdmin).
create policy "org_people_select" on public.org_people
  for select to authenticated
  using (public.has_org_access(auth.uid(), org_id));

create policy "org_people_write" on public.org_people
  for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

comment on table public.org_people is
  'Ficha única da pessoa (adversário, aliado, servidor, liderança). Canais — Instagram, WhatsApp, vocabulário, TSE, secretaria — penduram nela. Ver Sugestoes-Abertas no Brain.';
