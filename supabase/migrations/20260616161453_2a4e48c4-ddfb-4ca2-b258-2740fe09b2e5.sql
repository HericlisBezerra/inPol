CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.elected_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ano_eleicao int NOT NULL,
  cod_municipio_tse text NOT NULL,
  uf text NOT NULL,
  cargo_codigo text,
  cargo_nome text NOT NULL,
  numero text NOT NULL,
  nome text NOT NULL,
  nome_urna text,
  partido_sigla text,
  partido_nome text,
  situacao_turno text,
  is_elected boolean NOT NULL DEFAULT false,
  foto_url text,
  alignment text NOT NULL DEFAULT 'neutral' CHECK (alignment IN ('ally','opponent','neutral')),
  notes text,
  tse_candidate_id text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, ano_eleicao, cod_municipio_tse, cargo_codigo, numero)
);

CREATE INDEX idx_elected_officials_org ON public.elected_officials(org_id);
CREATE INDEX idx_elected_officials_alignment ON public.elected_officials(org_id, alignment) WHERE alignment <> 'neutral';
CREATE INDEX idx_elected_officials_nome_trgm ON public.elected_officials USING gin (nome gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elected_officials TO authenticated;
GRANT ALL ON public.elected_officials TO service_role;

ALTER TABLE public.elected_officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view elected officials"
ON public.elected_officials FOR SELECT TO authenticated
USING (public.has_org_access(auth.uid(), org_id));

CREATE POLICY "admins can insert elected officials"
ON public.elected_officials FOR INSERT TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "admins can update elected officials"
ON public.elected_officials FOR UPDATE TO authenticated
USING (public.is_org_admin(auth.uid(), org_id))
WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "admins can delete elected officials"
ON public.elected_officials FOR DELETE TO authenticated
USING (public.is_org_admin(auth.uid(), org_id));

CREATE TRIGGER trg_elected_officials_updated_at
BEFORE UPDATE ON public.elected_officials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();