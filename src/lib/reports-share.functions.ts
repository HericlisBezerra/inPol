// Criação/revogação do link público de compartilhamento de relatório (rota /r/$token).
// SEGURANÇA (adjudicado): a RLS de UPDATE (reports_admin_update) sozinha NÃO basta — um UPDATE
// bloqueado por RLS afeta 0 linhas e retorna SUCESSO. Então: (1) checa is_org_admin explicitamente,
// (2) o UPDATE usa .select() e exige linha afetada, (3) o token é SEMPRE rotacionado (nunca rearma
// um link revogado), (4) grava trilha em audit_log (LGPD art. 37).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateShareToken } from "@/lib/share-token";

const reportIdInput = (d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d);

/** Gera (ou regera) o snapshot SANITIZADO do relatório para exposição pública — SEM publicar.
 *  Grava reports.markdown_public + sanitized_at/by + sanitize_flags. Só admin da org. O admin
 *  revisa a prévia retornada e só então chama createReportShare para publicar. */
export const generateSanitizedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportIdInput)
  .handler(async ({ data, context }) => {
    const { data: report, error: findError } = await context.supabase
      .from("reports")
      .select("id, org_id, markdown")
      .eq("id", data.reportId)
      .maybeSingle();
    if (findError) {
      console.error("[share] erro ao buscar relatório para sanitizar:", findError);
      throw new Error("Não foi possível preparar o compartilhamento.");
    }
    if (!report) throw new Error("Relatório não encontrado ou sem permissão.");

    const { data: isAdmin } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: report.org_id,
    });
    if (!isAdmin) {
      throw new Error("Apenas administradores da organização podem compartilhar relatórios.");
    }

    const { sanitizeReportForPublic } = await import("@/lib/report-sanitize.server");
    const result = await sanitizeReportForPublic(report.org_id, report.markdown ?? "");

    const sanitizedAt = new Date().toISOString();
    const sanitizeUpdate = {
      markdown_public: result.markdown,
      sanitized_at: sanitizedAt,
      sanitized_by: context.userId,
      sanitize_flags: { counts: result.counts, degraded: result.degraded },
    };
    const { data: updated, error: updateError } = await context.supabase
      .from("reports")
      .update(sanitizeUpdate)
      .eq("id", data.reportId)
      .select("id");
    if (updateError) {
      console.error("[share] erro ao salvar snapshot sanitizado:", updateError);
      throw new Error("Não foi possível preparar o compartilhamento.");
    }
    if (!updated || updated.length === 0) {
      throw new Error("Sem permissão para compartilhar este relatório.");
    }

    // Auditoria da OPERAÇÃO DE TRATAMENTO (LGPD art. 37): quem sanitizou, quando, com que resultado.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      org_id: report.org_id,
      actor_id: context.userId,
      action: "report.share.sanitized",
      target_kind: "report",
      target_id: data.reportId,
      metadata: { counts: result.counts, degraded: result.degraded },
    });

    // sanitizedAt volta pro cliente: createReportShare exige esse mesmo valor para publicar
    // (garante que o que é publicado é EXATAMENTE o snapshot que o admin revisou — anti-TOCTOU).
    return {
      preview: result.markdown,
      counts: result.counts,
      degraded: result.degraded,
      sanitizedAt,
    };
  });

/** Ativa o compartilhamento público, sempre com um TOKEN NOVO (rotaciona) — um link revogado
 *  nunca é rearmado. Só admin da org. Exige o snapshot sanitizado que o admin revisou
 *  (sanitizedAt) e bloqueia publicação degradada sem override explícito. */
const createShareInput = (d: unknown) =>
  z
    .object({
      reportId: z.string().uuid(),
      /** sanitized_at do snapshot que o admin revisou — tem que bater com o do banco (anti-TOCTOU). */
      sanitizedAt: z.string().min(1),
      /** Override consciente para publicar snapshot degradado (LLM de nomes não rodou). */
      acceptDegraded: z.boolean().optional(),
    })
    .parse(d);

export const createReportShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createShareInput)
  .handler(async ({ data, context }) => {
    // markdown_public/sanitize_flags/sanitized_at ainda não estão nos tipos gerados (migração
    // report_public_sanitize aplicada no cutover); string de select como variável `string` evita
    // o SelectQueryError do typegen.
    const shareCols = "id, org_id, markdown_public, sanitized_at, sanitize_flags";
    const { data: report, error: findError } = await context.supabase
      .from("reports")
      .select(shareCols)
      .eq("id", data.reportId)
      .maybeSingle<{
        id: string;
        org_id: string;
        markdown_public: string | null;
        sanitized_at: string | null;
        sanitize_flags: { degraded?: boolean } | null;
      }>();
    if (findError) {
      console.error("[share] erro ao buscar relatório:", findError);
      throw new Error("Não foi possível processar o compartilhamento.");
    }
    if (!report) throw new Error("Relatório não encontrado ou sem permissão.");

    const { data: isAdmin } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: report.org_id,
    });
    if (!isAdmin) {
      throw new Error("Apenas administradores da organização podem compartilhar relatórios.");
    }

    // GATE LGPD 1: só publica sobre o snapshot sanitizado (gerado por generateSanitizedReport).
    if (!report.markdown_public) {
      throw new Error("Gere e revise a versão sanitizada antes de publicar o link.");
    }
    // GATE LGPD 2 (anti-TOCTOU): o snapshot no banco tem que ser EXATAMENTE o que o admin revisou.
    // Se alguém re-sanitizou nesse meio-tempo (LLM não-determinístico), o sanitized_at muda e a
    // publicação é barrada — força revisar a nova versão.
    if (report.sanitized_at !== data.sanitizedAt) {
      throw new Error(
        "A versão sanitizada mudou desde a revisão. Revise novamente antes de publicar.",
      );
    }
    // GATE LGPD 3: snapshot degradado (LLM de nomes não rodou → nomes podem não ter sido redigidos)
    // só publica com override consciente, e o override fica auditado.
    if (report.sanitize_flags?.degraded && !data.acceptDegraded) {
      throw new Error(
        "A sanitização automática de nomes não completou. Revise manualmente e confirme para publicar.",
      );
    }

    const token = generateShareToken(); // sempre novo — não rearma link revogado
    const { data: updated, error: updateError } = await context.supabase
      .from("reports")
      // @ts-expect-error colunas share_* entram na migração report_public_share (tipos regeneram no cutover)
      .update({ share_token: token, share_enabled: true, shared_at: new Date().toISOString() })
      .eq("id", data.reportId)
      .select("id"); // exige linha afetada — RLS bloqueada retorna [] sem erro
    if (updateError) {
      console.error("[share] erro ao ativar compartilhamento:", updateError);
      throw new Error("Não foi possível compartilhar o relatório.");
    }
    if (!updated || updated.length === 0) {
      throw new Error("Sem permissão para compartilhar este relatório.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      org_id: report.org_id,
      actor_id: context.userId,
      action: "report.share.enabled",
      target_kind: "report",
      target_id: data.reportId,
      metadata: {
        public: true,
        degraded: !!report.sanitize_flags?.degraded,
        acceptedDegraded: !!data.acceptDegraded,
      },
    });

    return { token, url: `/r/${token}` };
  });

/** Revoga o link público: share_enabled=false. Confirma que afetou a linha (RLS bloqueada não
 *  gera erro — não podemos reportar "revogado" sem ter revogado). Só admin da org. */
export const revokeReportShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportIdInput)
  .handler(async ({ data, context }) => {
    const { data: report, error: findError } = await context.supabase
      .from("reports")
      .select("id, org_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (findError) {
      console.error("[share] erro ao buscar relatório:", findError);
      throw new Error("Não foi possível processar a revogação.");
    }
    if (!report) throw new Error("Relatório não encontrado ou sem permissão.");

    const { data: isAdmin } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: report.org_id,
    });
    if (!isAdmin) {
      throw new Error("Apenas administradores da organização podem revogar o compartilhamento.");
    }

    const { data: updated, error: updateError } = await context.supabase
      .from("reports")
      // @ts-expect-error share_enabled entra na migração report_public_share (tipos regeneram no cutover)
      .update({ share_enabled: false })
      .eq("id", data.reportId)
      .select("id");
    if (updateError) {
      console.error("[share] erro ao revogar compartilhamento:", updateError);
      throw new Error("Não foi possível revogar o compartilhamento.");
    }
    if (!updated || updated.length === 0) {
      throw new Error("Sem permissão para revogar este compartilhamento.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      org_id: report.org_id,
      actor_id: context.userId,
      action: "report.share.revoked",
      target_kind: "report",
      target_id: data.reportId,
    });

    return { ok: true };
  });
