-- Eleitos do TSE que nunca viraram ficha de pessoa.
--
-- O backfill de `org_people` (20260729180000) partiu de duas fontes: `org_adversaries` e
-- `org_vocabulary(opponent|ally)`. Quem foi eleito mas NÃO estava classificado como
-- adversário nem aliado ficou de fora — na org piloto, justamente os três da gestão,
-- incluindo o **presidente da Câmara**.
--
-- Isso apareceu ao vincular os falantes da primeira sessão transcrita: 15 dos 16
-- vereadores casaram com fichas existentes e só o presidente não tinha ficha nenhuma.
-- Alguém que preside a Casa é exatamente quem o gabinete precisa acompanhar.
--
-- `alignment` do TSE vira `stance` da pessoa: management/ally → aliado (compõem ou apoiam
-- o governo), opponent → adversario, neutral → neutro (é o DEFAULT da coluna, não um
-- julgamento — ver camara.index.tsx).
insert into public.org_people (org_id, display_name, stance, party, role, avatar_url, elected_official_id)
select
  e.org_id,
  coalesce(nullif(btrim(e.nome_urna), ''), e.nome),
  case e.alignment
    when 'opponent' then 'adversario'
    when 'ally' then 'aliado'
    when 'management' then 'aliado'
    else 'neutro'
  end,
  e.partido_sigla,
  e.cargo_nome,
  e.foto_url,
  e.id
from public.elected_officials e
where e.is_elected
  and not exists (
    select 1 from public.org_people p
    where p.org_id = e.org_id
      and (upper(btrim(p.display_name)) = upper(btrim(e.nome_urna))
        or upper(btrim(p.display_name)) = upper(btrim(e.nome)))
  );
