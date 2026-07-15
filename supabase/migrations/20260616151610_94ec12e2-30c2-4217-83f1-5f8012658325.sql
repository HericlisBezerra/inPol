
-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke execute from anon (helpers only used by authenticated RLS context)
REVOKE EXECUTE ON FUNCTION public.has_org_access(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.has_org_access(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated, service_role;
