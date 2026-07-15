ALTER TABLE public.whatsapp_groups ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_tags ON public.whatsapp_groups USING gin (tags);