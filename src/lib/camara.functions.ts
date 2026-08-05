import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAllPages } from "@/lib/pg-paginate";
import {
  extrairVideoId,
  formatarTimestamp,
  parseTranscript,
  resolverPessoa,
  type CandidatoPessoa,
  type ParsedSpeech,
  type SpeakerRole,
} from "@/lib/camara-parser";

/**
 * Módulo Câmara — ingestão de sessões transcritas e vínculo com as fichas de `org_people`.
 *
 * O parser vive em `camara-parser.ts` (puro, sem Supabase) e é REEXPORTADO aqui: quem
 * consome importa de um lugar só, e o teste consegue importar o parser sem arrastar o
 * cliente do banco.
 */
export {
  parseTranscript,
  extrairVideoId,
  normalizarNome,
  resolverPessoa,
  type ParsedSpeech,
  type ParseResult,
  type SpeakerRole,
} from "@/lib/camara-parser";

// `camara_sessions` / `camara_speeches` são novas e ainda não estão no typegen — e
// `types.ts` é auto-gerado, não se edita. Este cast é o único ponto de escape do arquivo;
// a tipagem volta na saída via `.returns<T[]>()` e anotação explícita dos retornos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentário acima
type ClienteBruto = any;
type ClienteTipado = SupabaseClient<Database>;
const bruto = (supabase: ClienteTipado): ClienteBruto => supabase as ClienteBruto;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient<Database> tem tipo genérico complexo; o helper só usa .rpc
async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data: ok } = await supabase.rpc("is_org_admin", { _user_id: userId, _org_id: orgId });
  const { data: platAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (!ok && !platAdmin) throw new Error("Somente owner/analyst pode editar.");
}

/** Lote do insert das falas. Uma sessão real tem ~150 falas; 500 cabe numa requisição
 *  sem estourar o limite de payload do PostgREST e evita 150 round-trips. */
const LOTE_FALAS = 500;

/* ==========================================================================
 * Tipos de saída
 * ========================================================================== */

export type CamaraSpeechRow = {
  id: string;
  order_index: number;
  at_seconds: number;
  speaker_raw: string;
  speaker_name: string;
  speaker_party: string | null;
  speaker_role: SpeakerRole;
  person_id: string | null;
  content: string;
  word_count: number;
  topic: string | null;
  sentiment: number | null;
  risk_score: number | null;
  summary: string | null;
};

/**
 * Linha da lista de sessões.
 *
 * Espelha `CamaraSessionRow` de `@/components/v2/camara-shared` — as telas foram escritas
 * contra esse contrato e ele é a referência.
 */
export type CamaraSessionRow = {
  id: string;
  session_date: string;
  numero: string | null;
  legislatura: string | null;
  tipo: string | null;
  title: string;
  video_url: string | null;
  video_id: string | null;
  speech_count: number | null;
  duration_seconds: number | null;
  /** Falantes DISTINTOS (pessoas), não falas — é o denominador de "X de Y com ficha". */
  speaker_count: number;
  linked_count: number;
  analyzed_at: string | null;
  markdown: string | null;
};

/** `getSession().session` — a linha da lista mais os campos pesados (que só o detalhe usa). */
export type CamaraSessionFull = CamaraSessionRow & {
  // `Json` e não `unknown`/`Record<string, unknown>`: o TanStack valida o retorno da server fn
  // contra um tipo serializável, e `unknown` como valor derruba essa checagem. Quem interpreta
  // o conteúdo é `camara.server.ts`, dono do formato (`SessionAnalysis`).
  analysis: Json | null;
  transcript_raw: string | null;
};

/**
 * Colunas em `string` cru (não literal): com literal o typegen tenta resolver as colunas
 * na definição desatualizada e derruba a query inteira num SelectQueryError.
 *
 * A lista NÃO traz `markdown` nem `transcript_raw`: são o relatório inteiro e a transcrição
 * inteira (dezenas de KB CADA), e uma legislatura acumula centenas de sessões — carregá-los
 * para desenhar cartões seria trocar megabytes por nada. Quem responde "esta sessão já foi
 * analisada?" na lista é `analyzed_at`, que é justamente o que a tela consulta.
 */
const COLS_SESSAO_LISTA: string =
  "id, session_date, numero, legislatura, tipo, title, video_url, video_id, speech_count, duration_seconds, speaker_count, linked_count, analyzed_at";

const COLS_SESSAO_FULL: string = `${COLS_SESSAO_LISTA}, markdown, analysis, transcript_raw`;

const COLS_FALA: string =
  "id, order_index, at_seconds, speaker_raw, speaker_name, speaker_party, speaker_role, person_id, content, word_count, topic, sentiment, risk_score, summary";

/** O que `COLS_SESSAO_LISTA` de fato traz — tudo menos `markdown`. */
type SessaoDaLista = Omit<CamaraSessionRow, "markdown">;

/** Campo de formulário vazio é ausência, não string vazia — gravar "" em `numero` quebra
 *  a chave (org_id, session_date, numero) na reimportação seguinte. */
const nuloSeVazio = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/* ==========================================================================
 * importSession
 * ========================================================================== */

const importSessionSchema = z.object({
  orgId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD."),
  numero: z.string().trim().max(20).nullable().optional(),
  legislatura: z.string().trim().max(20).nullable().optional(),
  tipo: z.string().trim().max(40).nullable().optional(),
  videoUrl: z.string().trim().max(600).nullable().optional(),
  // Teto generoso e explícito: a sessão real tem ~180 KB. Sem teto, um arquivo colado
  // errado viraria um insert de vários MB numa coluna de texto.
  transcript: z.string().min(1).max(4_000_000),
});

export type ImportSessionResult = {
  sessionId: string;
  speeches: number;
  vinculadas: number;
  semVinculo: number;
  avisos: string[];
};

/**
 * Importa (ou reimporta) uma sessão transcrita.
 *
 * IDEMPOTÊNCIA — a tabela tem `unique (org_id, session_date, numero)`, mas no Postgres
 * NULL nunca colide com NULL: uma sessão sem `numero` importada duas vezes passaria pelo
 * UNIQUE e duplicaria. Por isso o caminho é localizar-e-atualizar explicitamente (com
 * `.is("numero", null)` quando for o caso) em vez de confiar num `upsert onConflict`.
 *
 * As falas são substituídas por completo (delete + insert) e não atualizadas em cima: uma
 * reimportação normalmente vem de uma transcrição corrigida, em que os `order_index`
 * mudam de dono. Fazer merge deixaria falas fantasmas da versão anterior.
 */
export const importSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importSessionSchema.parse(d))
  .handler(async ({ data, context }): Promise<ImportSessionResult> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const sb = bruto(context.supabase);

    const { falas, avisos } = parseTranscript(data.transcript);
    if (falas.length === 0) {
      throw new Error(
        "Nenhuma fala reconhecida na transcrição. Formato esperado: [HH:MM:SS] Ver. Nome (PARTIDO): texto",
      );
    }

    const numero = nuloSeVazio(data.numero);
    const videoUrl = nuloSeVazio(data.videoUrl);
    const videoId = extrairVideoId(videoUrl);
    if (videoUrl && !videoId) {
      // Não é erro fatal (a sessão vale mesmo sem vídeo), mas sem o id não há como linkar
      // o minuto exato da fala — e isso precisa ficar visível para quem importou.
      avisos.push(
        `não foi possível extrair o id do YouTube de "${videoUrl}" — os links por minuto ficarão indisponíveis.`,
      );
    }

    // ── Vínculo com as fichas ────────────────────────────────────────────────
    const pessoas = await carregarPessoas(context.supabase, data.orgId);
    const { porFala, vinculadas, semVinculo, falantes, falantesVinculados } = vincularFalantes(
      falas,
      pessoas,
      avisos,
    );

    // ── Sessão: localiza, atualiza ou cria ───────────────────────────────────
    const duracao = falas.reduce((max, f) => Math.max(max, f.atSeconds), 0);
    const payload = {
      org_id: data.orgId,
      session_date: data.sessionDate,
      numero,
      legislatura: nuloSeVazio(data.legislatura),
      tipo: nuloSeVazio(data.tipo),
      title: data.title.trim(),
      video_url: videoUrl,
      video_id: videoId,
      transcript_raw: data.transcript,
      speech_count: falas.length,
      duration_seconds: duracao,
      speaker_count: falantes,
      linked_count: falantesVinculados,
      // Reimportar INVALIDA a análise anterior. Ela foi escrita sobre outro conjunto de falas
      // (`analisarSessao` em camara.server.ts cita minuto e trecho literal); mantê-la deixaria
      // um relatório citando falas que a nova transcrição não contém mais — dado errado com
      // aparência de dado conferido. Quem reimporta reanalisa.
      analysis: null,
      markdown: null,
      model_version: null,
      analyzed_at: null,
      updated_at: new Date().toISOString(),
    };

    let q = sb
      .from("camara_sessions")
      .select("id")
      .eq("org_id", data.orgId)
      .eq("session_date", data.sessionDate);
    q = numero === null ? q.is("numero", null) : q.eq("numero", numero);
    const { data: existentes, error: erroBusca } = await q.limit(1);
    if (erroBusca) {
      console.error("[camara] erro ao procurar sessão existente:", erroBusca);
      throw new Error("Não foi possível importar a sessão.");
    }

    let sessionId = (existentes as { id: string }[] | null)?.[0]?.id ?? null;
    if (sessionId) {
      // `.select("id")` + checagem de linha afetada: UPDATE barrado por RLS afeta 0 linhas
      // e retorna SUCESSO — sem isso a importação "daria certo" sem gravar nada.
      const { data: atualizado, error } = await sb
        .from("camara_sessions")
        .update(payload)
        .eq("id", sessionId)
        .eq("org_id", data.orgId)
        .select("id");
      if (error) {
        console.error("[camara] erro ao atualizar sessão:", error);
        throw new Error("Não foi possível importar a sessão.");
      }
      if (!atualizado || (atualizado as { id: string }[]).length === 0) {
        throw new Error("Sem permissão para atualizar esta sessão.");
      }
    } else {
      const { data: criado, error } = await sb
        .from("camara_sessions")
        .insert({ ...payload, created_by: context.userId })
        .select("id");
      if (error) {
        console.error("[camara] erro ao criar sessão:", error);
        throw new Error("Não foi possível importar a sessão.");
      }
      sessionId = (criado as { id: string }[] | null)?.[0]?.id ?? null;
      if (!sessionId) throw new Error("Não foi possível importar a sessão.");
    }

    // ── Falas: substituição completa ─────────────────────────────────────────
    const { error: erroDelete } = await sb
      .from("camara_speeches")
      .delete()
      .eq("org_id", data.orgId)
      .eq("session_id", sessionId);
    if (erroDelete) {
      console.error("[camara] erro ao limpar falas da sessão:", erroDelete);
      throw new Error("Não foi possível importar a sessão.");
    }

    const linhas = falas.map((f) => ({
      org_id: data.orgId,
      session_id: sessionId,
      order_index: f.orderIndex,
      at_seconds: f.atSeconds,
      speaker_raw: f.speakerRaw,
      speaker_name: f.speakerName,
      speaker_party: f.speakerParty,
      speaker_role: f.speakerRole,
      person_id: porFala[f.orderIndex] ?? null,
      content: f.content,
      word_count: f.wordCount,
    }));

    for (let i = 0; i < linhas.length; i += LOTE_FALAS) {
      const { error } = await sb.from("camara_speeches").insert(linhas.slice(i, i + LOTE_FALAS));
      if (error) {
        console.error("[camara] erro ao inserir lote de falas:", error);
        // A sessão já existe mas ficou com falas parciais — dizer isso é melhor que um
        // "erro genérico", porque a correção é simplesmente reimportar.
        throw new Error(
          "A sessão foi salva, mas as falas não puderam ser gravadas por completo. Reimporte a sessão.",
        );
      }
    }

    return { sessionId, speeches: falas.length, vinculadas, semVinculo, avisos };
  });

/**
 * Todas as fichas da org, paginadas.
 *
 * `fetchAllPages` e não `.limit()`: o PostgREST corta em 1.000 linhas e IGNORA em silêncio
 * um limite maior — uma org com muitas pessoas perderia candidatos ao vínculo sem nenhum
 * erro, e o sintoma apareceria como "vereador não casou", que é indistinguível de um nome
 * mal escrito.
 */
async function carregarPessoas(supabase: ClienteTipado, orgId: string): Promise<CandidatoPessoa[]> {
  const cols: string = "id, display_name";
  const sb = bruto(supabase);
  return fetchAllPages<CandidatoPessoa>((from, to) =>
    sb
      .from("org_people")
      .select(cols)
      .eq("org_id", orgId)
      .order("id", { ascending: true }) // ordem estável — sem isso a paginação repete/pula
      .range(from, to),
  );
}

/**
 * Resolve o `person_id` de cada fala.
 *
 * Resolve UMA VEZ por falante distinto (não por fala): são ~150 falas para ~16 pessoas, e
 * a comparação por tokens é O(nomes × fichas). A chave do cache é a lista de variantes,
 * porque é ela que entra na resolução.
 */
function vincularFalantes(
  falas: ParsedSpeech[],
  pessoas: CandidatoPessoa[],
  avisos: string[],
): {
  porFala: (string | null)[];
  /** Contagens por FALA — é o que a tela de importação reporta ("147 falas, 139 vinculadas"). */
  vinculadas: number;
  semVinculo: number;
  /** Contagens por FALANTE distinto — é o que a lista de sessões exibe ("16 de 19 com ficha"). */
  falantes: number;
  falantesVinculados: number;
} {
  const cache = new Map<string, string | null>();
  const porFala: (string | null)[] = [];
  let vinculadas = 0;

  for (const f of falas) {
    const chave = f.speakerNames.join(" / ");
    let personId: string | null;

    if (cache.has(chave)) {
      personId = cache.get(chave) ?? null;
    } else {
      const r = resolverPessoa(f.speakerNames, pessoas);
      personId = r.personId;
      cache.set(chave, personId);
      if (!personId) {
        // Convidado sem ficha é o esperado, não um problema — avisar sobre ele afogaria o
        // aviso que importa: um VEREADOR que não casou (é ele que deveria estar cadastrado).
        if (f.speakerRole !== "convidado") {
          const detalhe =
            r.motivo === "ambiguo"
              ? "mais de uma ficha empatou — vínculo não feito para não chutar"
              : "nenhuma ficha correspondente em Pessoas";
          avisos.push(
            `"${f.speakerName}" (${f.speakerRole}, primeira fala em ${formatarTimestamp(f.atSeconds)}): ${detalhe}.`,
          );
        }
      }
    }

    porFala[f.orderIndex] = personId;
    if (personId) vinculadas += 1;
  }

  // O `cache` já é, por construção, o conjunto dos falantes distintos da sessão.
  const valores = [...cache.values()];
  return {
    porFala,
    vinculadas,
    semVinculo: falas.length - vinculadas,
    falantes: valores.length,
    falantesVinculados: valores.filter((v) => v !== null).length,
  };
}

/* ==========================================================================
 * Leitura
 * ========================================================================== */

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CamaraSessionRow[]> => {
    const { data: linhas, error } = await bruto(context.supabase)
      .from("camara_sessions")
      .select(COLS_SESSAO_LISTA)
      .eq("org_id", data.orgId)
      .order("session_date", { ascending: false });
    if (error) {
      console.error("[camara] erro ao listar sessões:", error);
      throw new Error("Não foi possível carregar as sessões.");
    }
    // `markdown` explícito em null: a lista não o carrega (ver COLS_SESSAO_LISTA). O que
    // responde "já foi analisada?" é `analyzed_at`, e é ele que as telas consultam.
    return ((linhas ?? []) as SessaoDaLista[]).map(
      (s): CamaraSessionRow => ({ ...s, markdown: null }),
    );
  });

export type GetSessionResult = { session: CamaraSessionFull; speeches: CamaraSpeechRow[] } | null;

/**
 * Sessão + falas. As falas vêm paginadas: uma sessão longa passa das 1.000 linhas que o
 * PostgREST devolve por padrão, e o corte seria silencioso — a tela mostraria a sessão
 * "terminando" no meio sem nenhum sinal de erro.
 */
export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<GetSessionResult> => {
    const sb = bruto(context.supabase);

    const { data: sessoes, error } = await sb
      .from("camara_sessions")
      .select(COLS_SESSAO_FULL)
      .eq("id", data.sessionId)
      .eq("org_id", data.orgId)
      .limit(1);
    if (error) {
      console.error("[camara] erro ao carregar sessão:", error);
      throw new Error("Não foi possível carregar a sessão.");
    }
    const sessao = (sessoes as CamaraSessionFull[] | null)?.[0];
    if (!sessao) return null;

    const falas = await fetchAllPages<CamaraSpeechRow>((from, to) =>
      sb
        .from("camara_speeches")
        .select(COLS_FALA)
        .eq("org_id", data.orgId)
        .eq("session_id", data.sessionId)
        .order("order_index", { ascending: true }) // único por sessão: ordem estável
        .range(from, to),
    );

    return { session: sessao, speeches: falas };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    // As falas caem por `on delete cascade` da FK — não precisam de delete próprio.
    const { data: removido, error } = await bruto(context.supabase)
      .from("camara_sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("org_id", data.orgId)
      .select("id");
    if (error) {
      console.error("[camara] erro ao excluir sessão:", error);
      throw new Error("Não foi possível excluir a sessão.");
    }
    // DELETE barrado por RLS remove 0 linhas e retorna sucesso — o mesmo cuidado do update.
    if (!removido || (removido as { id: string }[]).length === 0) {
      throw new Error("Sessão não encontrada ou sem permissão para excluir.");
    }
    return { ok: true };
  });

/**
 * Dispara a análise da sessão (relatório + agregados).
 *
 * Ponte entre a tela e `analyzeSession` de `camara.server.ts`: aquele módulo é server-only
 * (usa `supabaseAdmin` e o gateway de IA) e não pode ser importado do cliente. Sem esta fn,
 * a sessão importada ficava para sempre como transcrição navegável — `markdown` nunca era
 * preenchido e a tela mostrava "sessão ainda não analisada" sem caminho para sair disso.
 *
 * Import dinâmico dentro do handler pelo mesmo motivo que `reports.functions.ts` faz:
 * mantém o código server-only fora do bundle do cliente.
 */
export const analyzeSessionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { analyzeSession } = await import("@/lib/camara.server");
    const r = await analyzeSession(data.orgId, data.sessionId);
    // `analysis` não volta para o cliente: é objeto grande e a tela recarrega a sessão
    // depois. Só o que a UI precisa para decidir o que mostrar.
    return { sessionId: r.sessionId, degraded: r.degraded, modelVersion: r.modelVersion };
  });
