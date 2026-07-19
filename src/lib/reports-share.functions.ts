// Criação/revogação do link público de compartilhamento de relatório (rota /r/$token).
// Usa context.supabase (client do usuário, RLS aplica) em vez de supabaseAdmin: a policy
// "reports_admin_update" já restringe UPDATE em reports a org admin / platform admin, então
// a própria RLS garante que só quem administra o relatório pode criar ou revogar o link —
// sem precisar reimplementar essa checagem de permissão aqui.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateShareToken } from "@/lib/share-token";

const reportIdInput = (d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d);

/** Ativa o compartilhamento público do relatório. Reusa o token existente se já houver um
 *  (revogar/reativar não troca o link). Só gera um novo na primeira vez. */
export const createReportShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportIdInput)
  .handler(async ({ data, context }) => {
    const { data: report, error: findError } = await context.supabase
      .from("reports")
      .select("id, share_token")
      .eq("id", data.reportId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!report) throw new Error("Relatório não encontrado ou sem permissão.");

    // @ts-expect-error share_token entra na migração report_public_share (tipos regeneram no cutover)
    const token: string = report.share_token ?? generateShareToken();

    const { error: updateError } = await context.supabase
      .from("reports")
      // @ts-expect-error colunas share_* entram na migração report_public_share (tipos regeneram no cutover)
      .update({ share_token: token, share_enabled: true, shared_at: new Date().toISOString() })
      .eq("id", data.reportId);
    if (updateError) throw new Error(updateError.message);

    return { token, url: `/r/${token}` };
  });

/** Desativa o link público — o token continua salvo (não é regenerado se o compartilhamento
 *  for reativado depois), mas share_enabled=false faz a rota pública parar de servi-lo. */
export const revokeReportShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportIdInput)
  .handler(async ({ data, context }) => {
    const { data: report, error: findError } = await context.supabase
      .from("reports")
      .select("id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!report) throw new Error("Relatório não encontrado ou sem permissão.");

    const { error: updateError } = await context.supabase
      .from("reports")
      // @ts-expect-error share_enabled entra na migração report_public_share (tipos regeneram no cutover)
      .update({ share_enabled: false })
      .eq("id", data.reportId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });
