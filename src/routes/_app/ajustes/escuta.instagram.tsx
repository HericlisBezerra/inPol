import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Consequence, FieldHint, PanelHeader } from "./-ui";

export const Route = createFileRoute("/_app/ajustes/escuta/instagram")({
  head: () => ({ meta: [{ title: "Instagram — Ajustes" }] }),
  component: Screen,
});

type IgTarget = {
  id: string;
  handle: string;
  label: string | null;
  kind: string;
  active: boolean | null;
  posts_per_scan: number | null;
  last_scanned_at: string | null;
  last_status: string | null;
};

const KIND_LABEL: Record<string, string> = {
  opponent: "Opositor",
  ally: "Aliado",
  press: "Imprensa",
  other: "Outro",
};

/**
 * Ajustes · O que eu escuto · Instagram (tela nova).
 *
 * Instagram era o buraco do grupo "o que eu escuto": a varredura existe
 * (org_instagram_targets + cron /api/public/hooks/scan-instagram), mas nada em Ajustes
 * a mencionava — ela é ligada pelo campo "@" da ficha de pessoa, na Rede. Foi
 * exatamente aí que o usuário achou que tinha ligado a varredura e não tinha.
 *
 * Esta tela NÃO duplica a escrita: mostra o inventário real do que está sendo varrido
 * (leitura direta, protegida por RLS, mesmo padrão de src/routes/_app/rede.tsx) e
 * manda editar onde o dado de fato mora. Um formulário paralelo aqui criaria duas
 * fontes de verdade para o mesmo handle.
 */
function Screen() {
  const { orgId } = useCurrentOrg();

  const {
    data: targets = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["ig-targets-ajustes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_instagram_targets")
        .select("id, handle, label, kind, active, posts_per_scan, last_scanned_at, last_status")
        .eq("org_id", orgId!)
        .order("active", { ascending: false })
        .order("handle");
      if (error) throw new Error(error.message);
      return (data ?? []) as IgTarget[];
    },
  });

  const ativos = targets.filter((t) => t.active).length;

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      <PanelHeader
        title="Instagram"
        description="Perfis públicos varridos automaticamente pelo inPol."
        effect={
          <>
            Cada perfil ativo tem os posts recentes coletados e analisados junto com o resto —
            entram em Sinais, contam para os alertas de viralização e são citados nos relatórios.
            Perfil inativo não é lido.
          </>
        }
      />

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os perfis monitorados. Tente novamente.
        </div>
      )}

      {/* Onde se liga de fato — primeiro, porque é a pergunta que traz alguém aqui. */}
      <div className="mt-4 rounded-[13px] border border-v2-green-border bg-v2-green-tint px-5 py-4">
        <div className="text-[13.5px] font-[650] text-v2-green-ink">
          A varredura se liga na ficha da pessoa
        </div>
        <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-normal text-v2-green-ink">
          Preencher o campo <b>@ do Instagram</b> na ficha de uma pessoa é o que{" "}
          <b>ativa a varredura</b> daquele perfil. Apagar o @ pausa. Não existe um segundo lugar
          para ligar isso — por isso esta tela é só a conferência do que está de pé.
        </p>
        <Link
          to="/rede"
          className="mt-2.5 inline-block rounded-lg bg-v2-green px-3.5 py-1.5 text-[12.5px] font-[650] text-white hover:bg-v2-green-hover"
        >
          Abrir a Rede →
        </Link>
      </div>

      {/* Inventário */}
      <div className="mt-3.5 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.6fr_0.8fr_0.7fr_1.1fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>PERFIL</span>
          <span>RELAÇÃO</span>
          <span>POSTS/VARREDURA</span>
          <span>ÚLTIMA VARREDURA</span>
        </div>

        {isLoading && (
          <div className="px-5 py-6 text-[12.5px] text-v2-ink-3">Carregando perfis…</div>
        )}

        {!isLoading && !isError && targets.length === 0 && (
          <div className="px-5 py-6 text-[12.5px] text-v2-faint">
            Nenhum perfil de Instagram está sendo varrido — nenhum post entra em Sinais hoje.
          </div>
        )}

        {targets.map((t, i) => (
          <div
            key={t.id}
            className={`grid grid-cols-[1.6fr_0.8fr_0.7fr_1.1fr] items-center gap-3 px-5 py-3 text-[13px] ${
              i < targets.length - 1 ? "border-b border-v2-track" : ""
            } ${t.active ? "" : "opacity-60"}`}
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-[13px] font-semibold text-v2-ink">
                @{t.handle}
              </div>
              <div className="truncate text-[11.5px] text-v2-ink-3">
                {t.label ?? "sem rótulo"} ·{" "}
                {t.active ? (
                  <span className="text-v2-green">varrendo</span>
                ) : (
                  <span className="text-v2-faint">pausado</span>
                )}
              </div>
            </div>
            <span className="text-[12px] text-v2-ink-2">{KIND_LABEL[t.kind] ?? t.kind}</span>
            <span className="font-mono text-[12px] text-v2-ink-3">{t.posts_per_scan ?? "—"}</span>
            <span className="font-mono text-[11px] text-v2-ink-3">
              {t.last_scanned_at
                ? new Date(t.last_scanned_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "nunca"}
              {t.last_status && t.last_status !== "ok" ? (
                <span className="ml-1 text-v2-crit">· {t.last_status}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <FieldHint>
        {ativos} de {targets.length} perfis estão ativos. "Nunca" em última varredura significa que
        o perfil foi cadastrado mas o cron ainda não passou por ele.
      </FieldHint>

      <Consequence icon="🛡">
        Só conteúdo público é coletado. Nada de mensagem direta, story privado ou perfil fechado —
        mesma política LGPD aplicada ao WhatsApp.
      </Consequence>
    </div>
  );
}
