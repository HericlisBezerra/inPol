REVOKE EXECUTE ON FUNCTION public.enter_demo_mode() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enter_demo_mode() FROM anon;
GRANT EXECUTE ON FUNCTION public.enter_demo_mode() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;