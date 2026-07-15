CREATE TABLE IF NOT EXISTS public.org_instagram_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  handle text NOT NULL,
  label text,
  kind text NOT NULL DEFAULT 'opponent' CHECK (kind IN ('opponent','ally','press','other')),
  active boolean NOT NULL DEFAULT true,
  posts_per_scan int NOT NULL DEFAULT 10,
  last_scanned_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (org_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_ig_targets_org_active ON public.org_instagram_targets (org_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_instagram_targets TO authenticated;
GRANT ALL ON public.org_instagram_targets TO service_role;

ALTER TABLE public.org_instagram_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ig_targets_select_members" ON public.org_instagram_targets
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), org_id));

CREATE POLICY "ig_targets_write_admins" ON public.org_instagram_targets
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_ig_targets_updated_at
  BEFORE UPDATE ON public.org_instagram_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();