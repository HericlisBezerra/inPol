
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner', 'analyst', 'viewer');
CREATE TYPE public.source_kind AS ENUM ('whatsapp', 'instagram', 'facebook', 'x', 'news', 'web_search');
CREATE TYPE public.alert_level AS ENUM ('amarelo', 'laranja', 'vermelho');
CREATE TYPE public.report_kind AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE public.vocab_kind AS ENUM ('neighborhood', 'opponent', 'ally', 'department', 'facility', 'sensitive_term', 'news_domain');

-- ============ HELPER: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  slug TEXT UNIQUE,
  author_hash_salt TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORG MEMBERS ============
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS (security definer, no recursion) ============
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id AND role IN ('owner','analyst'));
$$;

-- Policies for orgs/members (defined AFTER helpers exist)
CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), id));
CREATE POLICY "orgs_owner_update" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), id, 'owner'));
CREATE POLICY "orgs_insert_any" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "orgs_owner_delete" ON public.organizations FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), id, 'owner'));

CREATE POLICY "members_select_same_org" ON public.org_members FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "members_owner_manage" ON public.org_members FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner'));
-- Self-insert on org creation (the creator becomes owner via server fn using service_role; but allow self-insert as safety)
CREATE POLICY "members_self_insert" ON public.org_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ VOCABULARY ============
CREATE TABLE public.org_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.vocab_kind NOT NULL,
  value TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind, value)
);
CREATE INDEX idx_vocab_org_kind ON public.org_vocabulary(org_id, kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_vocabulary TO authenticated;
GRANT ALL ON public.org_vocabulary TO service_role;
ALTER TABLE public.org_vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vocab_member_select" ON public.org_vocabulary FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "vocab_admin_write" ON public.org_vocabulary FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- ============ SOURCES ============
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.source_kind NOT NULL,
  label TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sources_org ON public.sources(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "sources_member_select" ON public.sources FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "sources_admin_write" ON public.sources FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- ============ WHATSAPP INSTANCES ============
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE UNIQUE,
  evolution_base_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  connected_phone TEXT,
  webhook_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  connection_status TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wa_instances_updated BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "wa_inst_member_select" ON public.whatsapp_instances FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "wa_inst_admin_write" ON public.whatsapp_instances FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- ============ WHATSAPP GROUPS ============
CREATE TABLE public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  subject TEXT,
  participant_count INTEGER,
  is_monitored BOOLEAN NOT NULL DEFAULT false,
  neighborhood_tag TEXT,
  notes TEXT,
  monitored_at TIMESTAMPTZ,
  monitored_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, remote_jid)
);
CREATE INDEX idx_wa_groups_org_mon ON public.whatsapp_groups(org_id, is_monitored);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups TO authenticated;
GRANT ALL ON public.whatsapp_groups TO service_role;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wa_groups_updated BEFORE UPDATE ON public.whatsapp_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "wa_groups_member_select" ON public.whatsapp_groups FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "wa_groups_admin_write" ON public.whatsapp_groups FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- ============ RAW MESSAGES (no PII) ============
CREATE TABLE public.raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  external_id TEXT,
  author_hash TEXT,
  content TEXT,
  media_kind TEXT,
  media_mime TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (source_id, external_id)
);
CREATE INDEX idx_raw_org_posted ON public.raw_messages(org_id, posted_at DESC);
CREATE INDEX idx_raw_org_status ON public.raw_messages(org_id, analysis_status) WHERE analysis_status = 'pending';
CREATE INDEX idx_raw_group_posted ON public.raw_messages(group_id, posted_at DESC);
CREATE INDEX idx_raw_content_fts ON public.raw_messages USING gin (to_tsvector('portuguese', coalesce(content, '')));
GRANT SELECT ON public.raw_messages TO authenticated;
GRANT ALL ON public.raw_messages TO service_role;
ALTER TABLE public.raw_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_member_select" ON public.raw_messages FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));

-- ============ MESSAGE ANALYSES ============
CREATE TABLE public.message_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.raw_messages(id) ON DELETE CASCADE UNIQUE,
  sentiment NUMERIC(4,3),
  intensity NUMERIC(4,3),
  topic TEXT,
  subtopic TEXT,
  neighborhood TEXT,
  mentioned_opponents TEXT[] NOT NULL DEFAULT '{}',
  mentioned_entities TEXT[] NOT NULL DEFAULT '{}',
  mentioned_allies TEXT[] NOT NULL DEFAULT '{}',
  is_actionable BOOLEAN NOT NULL DEFAULT false,
  risk_score INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  model_version TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ma_org_risk ON public.message_analyses(org_id, risk_score DESC);
CREATE INDEX idx_ma_org_topic ON public.message_analyses(org_id, topic);
CREATE INDEX idx_ma_org_neighborhood ON public.message_analyses(org_id, neighborhood);
GRANT SELECT ON public.message_analyses TO authenticated;
GRANT ALL ON public.message_analyses TO service_role;
ALTER TABLE public.message_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma_member_select" ON public.message_analyses FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));

-- ============ TOPICS (rolling daily aggregates) ============
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket_date DATE NOT NULL,
  label TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  avg_sentiment NUMERIC(4,3),
  max_risk INTEGER NOT NULL DEFAULT 0,
  top_neighborhoods JSONB NOT NULL DEFAULT '[]',
  sample_message_ids UUID[] NOT NULL DEFAULT '{}',
  trend TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, bucket_date, label)
);
CREATE INDEX idx_topics_org_date ON public.topics(org_id, bucket_date DESC);
GRANT SELECT ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_topics_updated BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "topics_member_select" ON public.topics FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));

-- ============ ALERTS ============
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  level public.alert_level NOT NULL,
  topic TEXT NOT NULL,
  neighborhood TEXT,
  summary TEXT NOT NULL,
  recommended_action TEXT,
  evidence_message_ids UUID[] NOT NULL DEFAULT '{}',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_org_open ON public.alerts(org_id, created_at DESC) WHERE acknowledged_at IS NULL;
GRANT SELECT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_member_select" ON public.alerts FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
CREATE POLICY "alerts_member_ack" ON public.alerts FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), org_id))
  WITH CHECK (public.has_org_access(auth.uid(), org_id));

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.report_kind NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  model_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_org_kind ON public.reports(org_id, kind, period_start DESC);
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_member_select" ON public.reports FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_log(org_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_member_select" ON public.audit_log FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));

-- ============ LGPD EVENTS ============
CREATE TABLE public.lgpd_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  subject_kind TEXT,
  subject_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lgpd_org_created ON public.lgpd_events(org_id, created_at DESC);
GRANT SELECT ON public.lgpd_events TO authenticated;
GRANT ALL ON public.lgpd_events TO service_role;
ALTER TABLE public.lgpd_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgpd_member_select" ON public.lgpd_events FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), org_id));
