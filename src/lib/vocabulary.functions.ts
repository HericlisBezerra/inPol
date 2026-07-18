import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const vocabKinds = [
  "neighborhood",
  "opponent",
  "ally",
  "department",
  "facility",
  "sensitive_term",
  "news_domain",
  "focus_term",
] as const;

export const listVocabulary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("org_vocabulary")
      .select("id, kind, value, aliases, metadata, created_at")
      .eq("org_id", data.orgId)
      .order("kind")
      .order("value");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addVocabulary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        kind: z.enum(vocabKinds),
        value: z.string().min(1).max(120),
        aliases: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("org_vocabulary").insert({
      org_id: data.orgId,
      kind: data.kind,
      value: data.value.trim(),
      aliases: data.aliases,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeVocabulary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("org_vocabulary")
      .delete()
      .eq("org_id", data.orgId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
