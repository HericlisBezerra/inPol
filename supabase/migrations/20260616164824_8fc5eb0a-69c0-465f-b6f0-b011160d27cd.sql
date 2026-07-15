
-- 1. Remove self-insert escalation on org_members
DROP POLICY IF EXISTS members_self_insert ON public.org_members;

-- 2. Restrict sensitive columns via column-level GRANTs
REVOKE SELECT ON public.whatsapp_instances FROM authenticated;
GRANT SELECT (id, source_id, org_id, instance_name, evolution_base_url, connected_phone, webhook_token, connection_status, last_seen_at, created_at, updated_at) ON public.whatsapp_instances TO authenticated;

REVOKE SELECT ON public.organizations FROM authenticated;
GRANT SELECT (id, name, slug, city, state, created_by, created_at, updated_at) ON public.organizations TO authenticated;

-- 3. Restrict alerts UPDATE to ack columns only for non-admins
REVOKE UPDATE ON public.alerts FROM authenticated;
GRANT UPDATE (acknowledged_by, acknowledged_at) ON public.alerts TO authenticated;
-- Admin policy for full updates (resolved_at, summary, etc.) via service role / admin path
DROP POLICY IF EXISTS alerts_admin_write ON public.alerts;
CREATE POLICY alerts_admin_write ON public.alerts
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));
-- Re-grant full UPDATE only to service_role (already had ALL via service_role grants typically)
GRANT UPDATE ON public.alerts TO service_role;

-- 4. Harden SECURITY DEFINER helpers: ignore caller-supplied _user_id, always use auth.uid()
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id
      AND user_id = COALESCE(auth.uid(), _user_id)
      AND (auth.uid() IS NULL OR user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id
      AND role IN ('owner','analyst')
      AND user_id = COALESCE(auth.uid(), _user_id)
      AND (auth.uid() IS NULL OR user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id
      AND role = _role
      AND user_id = COALESCE(auth.uid(), _user_id)
      AND (auth.uid() IS NULL OR user_id = auth.uid())
  );
$$;

-- 5. Move pg_trgm out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
