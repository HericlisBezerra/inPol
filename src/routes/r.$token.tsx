import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PublicReport, type PublicReportData } from "@/components/v2/public-report";
import { isValidTokenFormat } from "@/lib/share-token";

/** Relatório demo (token "demo") — permite ver/imprimir a página pública sem tocar no banco. */
const DEMO_REPORT: PublicReportData = {
  title: "Sexta, 18 de julho — dia de agir na Vila Rami",
  kind: "daily",
  periodStart: "2026-07-17T08:00:00Z",
  periodEnd: "2026-07-18T08:00:00Z",
  markdown: `## 🎯 Resumo executivo
O clima do dia é dominado por **um risco urgente**: a enchente na **Vila Rami** sem resposta da prefeitura, que já escalou para crítico com janela de ação até o meio-dia. Em paralelo, a **UBS do Retiro** sobe em menções (fila de 5h) e a **ciclovia nova** segue como o melhor conteúdo positivo da semana.

## 📊 Panorama quantitativo
Foram **18,4 mil mensagens** analisadas nas últimas 24h — 1 alerta vermelho, 2 laranjas e 3 amarelos. 60% dos sinais vieram do WhatsApp e o restante de imprensa e Instagram, indicando que a pauta ainda está mais **nas ruas** do que na mídia.

## 🔥 O que esquentou — análise por tema
**Enchentes / drenagem** — 214 menções, sentimento −0.55, risco máximo 92. Bairro dominante: **Vila Rami**. Citação real: *"terceira vez que alaga e ninguém aparece"*. Politicamente é o tema mais perigoso do ciclo: vídeo com 3,2 mil compartilhamentos e imprensa local já sondando moradores.

**Saúde / UBS** — 87 reclamações em 48h, sentimento −0.61, no **Retiro**. Oposição repostando prints da fila. *"esperei 5 horas com minha mãe na UBS do Retiro, um descaso"*.

## 🗺️ Mapa por bairro
- **Vila Rami** — pior sentimento do território, concentrando as enchentes.
- **Retiro** — em queda, puxado pela saúde.
- **Centro** e **Eloy Chaves** — estáveis e positivos.

## 🎯 Recomendações acionáveis
- **Próximas 24h:** resolver a Vila Rami até 12h; publicar pronunciamento reconhecendo o problema.
- **Próximos 3-7 dias:** ampliar o conteúdo da ciclovia (melhor ativo positivo); nota da Saúde sobre o Retiro.
- **Monitorar:** o boato da creche no Anhangabaú (fraco, mas pode crescer).`,
};

/** Busca pública por token — SÓ campos públicos, SÓ se share_enabled. Nunca abre RLS anônima:
 *  usa service role filtrando por token + enabled. Sem auth (o token É a credencial). */
const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }): Promise<PublicReportData | null> => {
    if (data.token === "demo") return DEMO_REPORT;
    if (!isValidTokenFormat(data.token)) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Expõe SÓ o snapshot SANITIZADO (markdown_public), NUNCA o markdown cru nem org_id/id/data/model.
    // markdown_public entra na migração report_public_sanitize; string de select como variável
    // `string` evita o SelectQueryError do typegen até a regen dos tipos no cutover.
    const publicCols = "kind, title, period_start, period_end, markdown_public";
    const { data: r, error } = await supabaseAdmin
      .from("reports")
      .select(publicCols)
      // .match aceita share_token/share_enabled (migração report_public_share) e o filtro chega ao PostgREST.
      .match({ share_token: data.token, share_enabled: true })
      .maybeSingle<{
        kind: string;
        title: string;
        period_start: string;
        period_end: string;
        markdown_public: string | null;
      }>();
    if (error) console.error("[share] erro ao buscar relatório público:", error);
    if (!r) return null;
    // markdown_public NULL = nunca sanitizado → não expõe (defesa: publicar já exige NOT NULL).
    const publicMd = r.markdown_public;
    if (!publicMd) return null;
    // Guard de runtime (cinto-e-suspensório): reaplica o determinístico (telefone/horário) sobre o
    // snapshot e o título. Se ISSO redigir algo, é sinal de que o pipeline falhou — logar/alertar.
    const { sanitizeReportMarkdown } = await import("@/lib/report-sanitize");
    const guarded = sanitizeReportMarkdown(publicMd).text;
    const guardedTitle = sanitizeReportMarkdown(r.title).text;
    if (guarded !== publicMd || guardedTitle !== r.title) {
      console.error("[share] GUARD disparou: PII residual num snapshot já publicado — investigar", {
        token: data.token,
      });
    }
    return {
      title: guardedTitle,
      kind: r.kind as PublicReportData["kind"],
      periodStart: r.period_start,
      periodEnd: r.period_end,
      markdown: guarded,
    };
  });

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Relatório — Inpol" },
      { name: "robots", content: "noindex, nofollow" }, // link não deve ser indexado
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap",
      },
    ],
  }),
  loader: async ({ params }) => {
    const report = await getSharedReport({ data: { token: params.token } });
    if (!report) throw notFound();
    return { report, isDemo: params.token === "demo" };
  },
  component: PublicPage,
  notFoundComponent: PublicNotFound,
});

function PublicPage() {
  const { report, isDemo } = Route.useLoaderData();
  return <PublicReport report={report} isDemo={isDemo} />;
}

function PublicNotFound() {
  return (
    <div className="v2-site flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
        LINK INDISPONÍVEL
      </div>
      <h1 className="mt-3 font-display text-[26px] font-semibold text-v2-ink">
        Este relatório não está disponível
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-v2-ink-2">
        O link pode ter expirado, sido revogado, ou não existir.
      </p>
      <Link
        to="/site"
        className="mt-6 rounded-lg bg-v2-green px-4 py-2.5 text-[14px] font-semibold text-white"
      >
        Conhecer o inPol
      </Link>
    </div>
  );
}
