
-- 1. Platform admins (super admin global)
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = COALESCE(_user_id, auth.uid())
  );
$$;

CREATE POLICY "Platform admins see admins" ON public.platform_admins
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- 2. Platform settings — a single row (id = fixed uuid) with the shared Evolution instance
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  evolution_base_url text,
  evolution_api_key text,
  evolution_instance_name text,
  evolution_connection_status text NOT NULL DEFAULT 'unknown',
  evolution_connected_phone text,
  evolution_last_seen_at timestamptz,
  webhook_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_settings_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins see settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.is_platform_admin());

INSERT INTO public.platform_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;

-- 3. WhatsApp numbers allocated to organizations (many numbers -> one instance)
CREATE TABLE public.org_whatsapp_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_jid text NOT NULL UNIQUE,
  label text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX org_whatsapp_numbers_org_idx ON public.org_whatsapp_numbers(org_id);

GRANT SELECT ON public.org_whatsapp_numbers TO authenticated;
GRANT ALL ON public.org_whatsapp_numbers TO service_role;
ALTER TABLE public.org_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own org numbers" ON public.org_whatsapp_numbers
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), org_id) OR public.is_platform_admin());

CREATE POLICY "Platform admins manage numbers" ON public.org_whatsapp_numbers
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- 4. Seed master admin (existing user hericlis@hebe.digital, if present)
INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'seed: master admin' FROM auth.users WHERE lower(email) = 'hericlis@hebe.digital'
ON CONFLICT DO NOTHING;

-- 5. Auto-grant master admin on signup for that verified email
CREATE OR REPLACE FUNCTION public.grant_master_admin_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'hericlis@hebe.digital' THEN
    INSERT INTO public.platform_admins (user_id, note)
    VALUES (NEW.id, 'auto: verified master email')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_master
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_master_admin_on_signup();

CREATE TRIGGER on_auth_user_confirmed_grant_master
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_master_admin_on_signup();

-- 6. Widen policies on org_members / whatsapp_instances so platform admins can manage
CREATE POLICY "Platform admins manage org_members" ON public.org_members
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins manage organizations" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins manage whatsapp_instances" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
