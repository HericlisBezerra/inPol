
-- 1) whatsapp_instances: restrict SELECT of credentials to org admins + platform admins
DROP POLICY IF EXISTS "wa_inst_member_select" ON public.whatsapp_instances;
CREATE POLICY "wa_inst_admin_select"
  ON public.whatsapp_instances
  FOR SELECT
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id) OR is_platform_admin());

-- 2) org_whatsapp_numbers: restrict SELECT to org admins + platform admins
DROP POLICY IF EXISTS "Members read own org numbers" ON public.org_whatsapp_numbers;
CREATE POLICY "org_wa_numbers_admin_select"
  ON public.org_whatsapp_numbers
  FOR SELECT
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id) OR is_platform_admin());

-- 3) reports: add explicit admin write policies (backend uses service_role which bypasses RLS)
CREATE POLICY "reports_admin_insert"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), org_id) OR is_platform_admin());

CREATE POLICY "reports_admin_update"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id) OR is_platform_admin())
  WITH CHECK (is_org_admin(auth.uid(), org_id) OR is_platform_admin());

CREATE POLICY "reports_admin_delete"
  ON public.reports
  FOR DELETE
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id) OR is_platform_admin());

-- 4) Revoke EXECUTE from anon on SECURITY DEFINER functions that shouldn't be publicly callable
REVOKE EXECUTE ON FUNCTION public.grant_master_admin_on_signup() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
