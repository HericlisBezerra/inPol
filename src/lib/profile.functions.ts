import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Perfil do usuário logado (nome, e-mail, foto). RLS: profiles_self_select. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { id: context.userId, email: null, full_name: null, avatar_url: null };
    return data as MyProfile;
  });

/** Atualiza nome e/ou foto do próprio perfil. RLS: profiles_self_update. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120).optional(),
        avatar_url: z.string().url().max(2048).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MyProfile> => {
    const patch: { full_name?: string; avatar_url?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId)
      .select("id, email, full_name, avatar_url")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Perfil não encontrado");
    return row as MyProfile;
  });
