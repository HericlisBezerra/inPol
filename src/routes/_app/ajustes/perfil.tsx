import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_app/ajustes/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Ajustes" }] }),
  component: Screen,
});

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Ajustes · Meu perfil: nome e foto do usuário logado. Dados reais (profiles + storage `avatars`). */
function Screen() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });

  // Sincroniza o input quando o perfil carrega (sem sobrescrever a digitação depois).
  useEffect(() => {
    if (profile) setName(profile.full_name ?? "");
  }, [profile]);

  const saveName = useMutation({
    mutationFn: (full_name: string) => updateMyProfile({ data: { full_name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Nome atualizado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file || !profile) return;
    if (!OK_TYPES.includes(file.type)) {
      toast.error("Formato inválido — use PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem grande demais (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateMyProfile({ data: { avatar_url: pub.publicUrl } });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const nameChanged =
    !!profile && name.trim() !== (profile.full_name ?? "") && name.trim().length > 0;
  const initials = (name || profile?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div>
      <div>
        <div className="text-[16px] font-[650] text-v2-ink">Meu perfil</div>
        <div className="mt-[3px] text-[13px] text-v2-ink-3">
          Como você aparece para a equipe. Só você edita seu nome e sua foto.
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 text-[13px] text-v2-ink-3">Carregando…</div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4 rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
            <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full bg-v2-green text-[20px] font-semibold text-white">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-[650] text-v2-ink">Foto de perfil</div>
              <div className="mt-0.5 text-[12px] text-v2-ink-3">
                PNG, JPG, WEBP ou GIF · até 5 MB
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 rounded-lg bg-v2-green px-3.5 py-1.5 text-[12.5px] font-[650] text-white transition-colors hover:bg-v2-green-hover disabled:opacity-60"
              >
                {uploading ? "Enviando…" : profile?.avatar_url ? "Trocar foto" : "Enviar foto"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={OK_TYPES.join(",")}
                onChange={onPickFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Nome + e-mail */}
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
            <label className="block text-[12px] font-semibold uppercase tracking-wide text-v2-faint">
              Nome
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Seu nome"
              className="mt-1.5 w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-[14px] text-v2-ink outline-none focus:border-v2-green"
            />

            <label className="mt-4 block text-[12px] font-semibold uppercase tracking-wide text-v2-faint">
              E-mail
            </label>
            <div className="mt-1.5 rounded-lg border border-v2-line bg-v2-track px-3 py-2 text-[14px] text-v2-ink-2">
              {profile?.email ?? "—"}
            </div>
            <div className="mt-1 text-[11.5px] text-v2-faint">
              O e-mail de acesso não muda por aqui.
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => saveName.mutate(name.trim())}
                disabled={!nameChanged || saveName.isPending}
                className="rounded-lg bg-v2-green px-4 py-2 text-[13px] font-[650] text-white transition-colors hover:bg-v2-green-hover disabled:opacity-50"
              >
                {saveName.isPending ? "Salvando…" : "Salvar nome"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
