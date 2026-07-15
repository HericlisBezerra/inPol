GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups TO authenticated;
GRANT ALL ON public.whatsapp_groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_messages TO authenticated;
GRANT ALL ON public.raw_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_analyses TO authenticated;
GRANT ALL ON public.message_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_vocabulary TO authenticated;
GRANT ALL ON public.org_vocabulary TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lgpd_events TO authenticated;
GRANT ALL ON public.lgpd_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elected_officials TO authenticated;
GRANT ALL ON public.elected_officials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_members TO authenticated;
GRANT ALL ON public.tracked_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_daily_stats TO authenticated;
GRANT ALL ON public.member_daily_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_aggregates TO authenticated;
GRANT ALL ON public.daily_aggregates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_adversaries TO authenticated;
GRANT ALL ON public.org_adversaries TO service_role;

GRANT EXECUTE ON FUNCTION public.enter_demo_mode() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;