
-- ============ FRENTE 1..4: schema foundations ============

-- 1) Alerts: add stage/dedupe/lifecycle
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'borbulhando',
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_sentiment numeric,
  ADD COLUMN IF NOT EXISTS max_risk integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS alerts_org_dedupe_uidx
  ON public.alerts(org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS alerts_org_created_idx ON public.alerts(org_id, created_at DESC);

-- 2) Territory (geojson por org/cidade)
CREATE TABLE IF NOT EXISTS public.org_territory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  city_slug text NOT NULL,
  geojson jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, city_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_territory TO authenticated;
GRANT ALL ON public.org_territory TO service_role;
ALTER TABLE public.org_territory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read territory" ON public.org_territory
  FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "org admins write territory" ON public.org_territory
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()));

-- 3) LGPD policy por org
CREATE TABLE IF NOT EXISTS public.org_lgpd_policy (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  retention_days integer NOT NULL DEFAULT 180,
  allow_export boolean NOT NULL DEFAULT true,
  dpo_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_lgpd_policy TO authenticated;
GRANT ALL ON public.org_lgpd_policy TO service_role;
ALTER TABLE public.org_lgpd_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read lgpd policy" ON public.org_lgpd_policy
  FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "org owners write lgpd policy" ON public.org_lgpd_policy
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner'::app_role) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner'::app_role) OR public.is_platform_admin(auth.uid()));

-- 4) Vínculo author_hash -> tracked_member (para Frente 3)
CREATE TABLE IF NOT EXISTS public.member_author_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.tracked_members(id) ON DELETE CASCADE,
  author_hash text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, author_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_author_links TO authenticated;
GRANT ALL ON public.member_author_links TO service_role;
ALTER TABLE public.member_author_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read links" ON public.member_author_links
  FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "org admins write links" ON public.member_author_links
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()));

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_org_territory_updated ON public.org_territory;
CREATE TRIGGER trg_org_territory_updated BEFORE UPDATE ON public.org_territory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_org_lgpd_policy_updated ON public.org_lgpd_policy;
CREATE TRIGGER trg_org_lgpd_policy_updated BEFORE UPDATE ON public.org_lgpd_policy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_alerts_updated ON public.alerts;
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
