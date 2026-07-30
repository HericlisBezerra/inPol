import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { countExact, fetchAllPages } from "@/lib/pg-paginate";
import { z } from "zod";

/**
 * CASO = (tema × bairro).
 *
 * O "caso" já existia implicitamente no banco desde sempre: `alerts.dedupe_key` é
 * exatamente `tema::bairro` (ver `dedupeKey()` em `src/lib/alerts.server.ts`). O que
 * nunca existiu foi uma PÁGINA para ele — o mesmo acontecimento aparecia partido em
 * cinco telas sem fio condutor. Este módulo remonta o fio a partir da chave que já
 * estava lá, sem exigir tabela nova nem migração.
 *
 * A página é lida em conjunto, projetada numa reunião. Por isso tudo aqui é narrativa
 * e evidência (quando esquentou, quem falou, o que foi dito, onde já foi analisado) —
 * nada de estado de tarefa ou workflow.
 */

/* ------------------------------------------------------------------ */
/* Identidade do caso na URL                                           */
/* ------------------------------------------------------------------ */

/**
 * `dedupe_key` é texto livre em minúsculas: contém `::`, espaços, acentos e pode
 * conter `/` (nome de bairro tipo "Jardim A/B"). Nada disso sobrevive intacto a um
 * path param — `%2F` é o caso clássico que proxies e routers decodificam cedo demais
 * e quebram a rota. Por isso a URL carrega base64url do dedupe_key: feio de ler, mas
 * é o único formato que volta byte a byte igual ao que foi gravado no banco.
 * (URL de caso não é lida em voz alta numa reunião — a legibilidade não paga o risco.)
 */
export function encodeCasoId(dedupeKey: string): string {
  const bytes = new TextEncoder().encode(dedupeKey);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCasoId(casoId: string): string | null {
  try {
    const b64 = casoId.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const out = new TextDecoder().decode(bytes);
    return out.includes("::") ? out : null;
  } catch {
    return null;
  }
}

/**
 * Reconstrói o `dedupe_key` a partir de tema + bairro.
 *
 * Duplica de propósito a fórmula de `dedupeKey()` em `alerts.server.ts`: aquele
 * arquivo é server-only (importa `supabaseAdmin`) e as telas de alerta precisam
 * montar o link do caso no client. `listAlerts` também não expõe a coluna
 * `dedupe_key`, e alertas antigos podem tê-la nula — derivar do par é o caminho que
 * funciona nos dois casos. Se a fórmula lá mudar, muda aqui junto.
 */
export function casoIdFor(topic: string, neighborhood: string | null): string {
  return encodeCasoId(`${topic}::${neighborhood ?? "-"}`.toLowerCase().slice(0, 200));
}

/** Separa o dedupe_key em tema e bairro. Bairro `-` é o sentinela de "sem bairro". */
function partesDoCaso(dedupeKey: string): { tema: string; bairro: string | null } {
  const i = dedupeKey.lastIndexOf("::");
  const tema = i >= 0 ? dedupeKey.slice(0, i) : dedupeKey;
  const bairroRaw = i >= 0 ? dedupeKey.slice(i + 2) : "-";
  return { tema, bairro: bairroRaw === "-" || bairroRaw === "" ? null : bairroRaw };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** `_` e `%` são curinga em ILIKE — e todo tema aqui é slug com `_` ("limpeza_urbana").
 *  Sem escapar, "limpeza_urbana" casaria com "limpezaXurbana". */
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** O PostgREST corta o valor de um filtro na primeira vírgula e nas aspas — o mesmo
 *  cuidado que `news.functions.ts` toma ao montar `or=(...)`. */
function sanitizeFilterValue(v: string): string {
  return v.replace(/["\\(),%_]/g, " ").trim();
}

type Embed<T> = T | T[] | null;
function one<T>(e: Embed<T>): T | null {
  return (Array.isArray(e) ? (e[0] ?? null) : e) ?? null;
}

const DIA_MS = 86_400_000;
const diaDe = (iso: string) => iso.slice(0, 10);

/* ------------------------------------------------------------------ */
/* listCasos                                                           */
/* ------------------------------------------------------------------ */

export type CasoResumo = {
  casoId: string;
  dedupeKey: string;
  tema: string;
  bairro: string | null;
  level: string;
  stage: string;
  resumo: string | null;
  mensagens: number;
  riscoMax: number | null;
  sentimentoMedio: number | null;
  primeiroSinal: string;
  ultimoSinal: string;
  alertas: number;
  aberto: boolean;
};

const SEVERIDADE: Record<string, number> = { vermelho: 3, laranja: 2, amarelo: 1 };

/**
 * Lista os casos da org agrupando `alerts` por `dedupe_key`.
 *
 * Agrupa em memória (e não com um `group by` no banco) porque o mesmo caso pode ter
 * vários alertas ao longo do tempo — abertos e resolvidos — e o que interessa é a
 * síntese: severidade de pico, janela total, se ainda está aberto.
 */
export const listCasos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        days: z.number().int().min(7).max(365).default(90),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CasoResumo[]> => {
    const since = new Date(Date.now() - data.days * DIA_MS).toISOString();

    // Paginado: "todos os casos do período" tem que ser todos mesmo. Um `.limit()` alto
    // aqui devolveria 1.000 linhas em silêncio e sumiria com casos inteiros da lista.
    const rows = await fetchAllPages<{
      id: string;
      dedupe_key: string | null;
      topic: string;
      neighborhood: string | null;
      level: string;
      stage: string;
      summary: string;
      message_count: number;
      max_risk: number | null;
      avg_sentiment: number | null;
      first_seen_at: string;
      last_seen_at: string;
      resolved_at: string | null;
    }>((from, to) =>
      context.supabase
        .from("alerts")
        .select(
          "id, dedupe_key, topic, neighborhood, level, stage, summary, message_count, max_risk, avg_sentiment, first_seen_at, last_seen_at, resolved_at",
        )
        .eq("org_id", data.orgId)
        .gte("last_seen_at", since)
        .order("id", { ascending: true })
        .range(from, to),
    );

    const mapa = new Map<string, CasoResumo>();
    for (const r of rows) {
      const key = r.dedupe_key ?? `${r.topic}::${r.neighborhood ?? "-"}`.toLowerCase();
      const atual = mapa.get(key);
      if (!atual) {
        mapa.set(key, {
          casoId: encodeCasoId(key),
          dedupeKey: key,
          tema: r.topic,
          bairro: r.neighborhood,
          level: r.level,
          stage: r.stage,
          resumo: r.summary,
          mensagens: r.message_count ?? 0,
          riscoMax: r.max_risk,
          sentimentoMedio: r.avg_sentiment,
          primeiroSinal: r.first_seen_at,
          ultimoSinal: r.last_seen_at,
          alertas: 1,
          aberto: !r.resolved_at,
        });
        continue;
      }
      atual.alertas += 1;
      atual.aberto = atual.aberto || !r.resolved_at;
      // Severidade do caso = o pior que ele já foi. Um caso que chegou a vermelho e
      // recuou não vira "amarelo" na lista — ele é um caso vermelho que arrefeceu.
      if ((SEVERIDADE[r.level] ?? 0) > (SEVERIDADE[atual.level] ?? 0)) {
        atual.level = r.level;
        atual.stage = r.stage;
      }
      atual.mensagens = Math.max(atual.mensagens, r.message_count ?? 0);
      atual.riscoMax = Math.max(atual.riscoMax ?? 0, r.max_risk ?? 0);
      if (r.first_seen_at < atual.primeiroSinal) atual.primeiroSinal = r.first_seen_at;
      if (r.last_seen_at > atual.ultimoSinal) {
        atual.ultimoSinal = r.last_seen_at;
        atual.resumo = r.summary;
        atual.sentimentoMedio = r.avg_sentiment;
      }
    }

    return [...mapa.values()].sort((a, b) => {
      const s = (SEVERIDADE[b.level] ?? 0) - (SEVERIDADE[a.level] ?? 0);
      return s !== 0 ? s : b.ultimoSinal.localeCompare(a.ultimoSinal);
    });
  });

/* ------------------------------------------------------------------ */
/* getCaso                                                             */
/* ------------------------------------------------------------------ */

export type CasoDossie = Awaited<ReturnType<typeof getCasoImpl>>;

type LinhaAnalise = {
  id: string;
  message_id: string;
  topic: string | null;
  subtopic: string | null;
  neighborhood: string | null;
  sentiment: number | null;
  risk_score: number;
  summary: string | null;
  mentioned_opponents: string[];
  mentioned_allies: string[];
  mentioned_entities: string[];
  created_at: string;
};

type LinhaBruta = {
  id: string;
  content: string | null;
  posted_at: string;
  author_hash: string | null;
  group_id: string | null;
  content_fingerprint: string | null;
  raw_payload: { url?: string; title?: string } | null;
  sources: Embed<{ kind: string; label: string | null }>;
  whatsapp_groups: Embed<{ subject: string | null; neighborhood_tag: string | null }>;
};

/** Lote do `.in("id", …)`: bem abaixo do teto de 1.000 do PostgREST, e curto o
 *  bastante para a URL do GET não estourar limite de tamanho de header. */
const LOTE_IDS = 250;
/** Teto de mensagens carregadas para montar o dossiê. Acima disso a página avisa que
 *  truncou — mentir sobre cobertura é pior do que mostrar menos. */
const MAX_MENSAGENS = 6000;
/** Ranking de bairros é caro (varre a org inteira). Fixo em 30d, e a UI rotula assim. */
const DIAS_RANKING = 30;

async function getCasoImpl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient<Database> tem genérico pesado; aqui só encadeamos queries
  supabase: any,
  orgId: string,
  dedupeKey: string,
  days: number,
) {
  const { tema: temaKey, bairro: bairroKey } = partesDoCaso(dedupeKey);

  /* --- 1. Âncora: os alertas deste caso ------------------------------ */

  let alertas = await fetchAllPages<{
    id: string;
    topic: string;
    neighborhood: string | null;
    level: string;
    stage: string;
    summary: string;
    recommended_action: string | null;
    message_count: number;
    max_risk: number | null;
    avg_sentiment: number | null;
    first_seen_at: string;
    last_seen_at: string;
    created_at: string;
    resolved_at: string | null;
    acknowledged_at: string | null;
  }>((from, to) =>
    supabase
      .from("alerts")
      .select(
        "id, topic, neighborhood, level, stage, summary, recommended_action, message_count, max_risk, avg_sentiment, first_seen_at, last_seen_at, created_at, resolved_at, acknowledged_at",
      )
      .eq("org_id", orgId)
      .eq("dedupe_key", dedupeKey)
      .order("id", { ascending: true })
      .range(from, to),
  );

  if (alertas.length === 0) {
    // Alertas gravados antes da coluna `dedupe_key` existir têm a chave nula. Cair para
    // o par (tema, bairro) recupera o histórico desses casos em vez de mostrar página vazia.
    const q = supabase
      .from("alerts")
      .select(
        "id, topic, neighborhood, level, stage, summary, recommended_action, message_count, max_risk, avg_sentiment, first_seen_at, last_seen_at, created_at, resolved_at, acknowledged_at",
      )
      .eq("org_id", orgId)
      .ilike("topic", escapeLike(temaKey));
    const { data: legado } = await (
      bairroKey ? q.ilike("neighborhood", escapeLike(bairroKey)) : q.is("neighborhood", null)
    )
      .order("created_at", { ascending: true })
      .limit(200);
    alertas = legado ?? [];
  }

  const maisRecente = alertas.length ? alertas[alertas.length - 1] : null;
  // Rótulo exibido: o do alerta (grafia original do banco). A chave é minúscula.
  const tema = maisRecente?.topic ?? temaKey;
  const bairro = maisRecente?.neighborhood ?? bairroKey;

  /* --- 2. Janela ----------------------------------------------------- */

  // Um caso não cabe numa janela fixa: se ele começou antes dos `days` pedidos, a linha
  // do tempo mente ao cortar o começo. Estende até a primeira aparição, com teto de 1 ano.
  const padrao = Date.now() - days * DIA_MS;
  const tetoAbsoluto = Date.now() - 365 * DIA_MS;
  const maisAntigo = alertas.reduce<number>(
    (acc, a) => Math.min(acc, Date.parse(a.first_seen_at)),
    Number.POSITIVE_INFINITY,
  );
  const inicioMs = Number.isFinite(maisAntigo)
    ? Math.max(Math.min(padrao, maisAntigo), tetoAbsoluto)
    : padrao;
  const since = new Date(inicioMs).toISOString();
  const janelaEstendida = inicioMs < padrao;

  /* --- 3. Análises do caso ------------------------------------------- */

  // ILIKE (e não `.eq`) em tema e bairro porque a chave do bucket é minúscula: duas
  // grafias ("Vila Rami" / "vila rami") formaram o MESMO caso lá na detecção, e um
  // `.eq` na grafia do último alerta deixaria a outra metade da evidência de fora.
  const analises = await fetchAllPages<LinhaAnalise>((from, to) => {
    const q = supabase
      .from("message_analyses")
      .select(
        "id, message_id, topic, subtopic, neighborhood, sentiment, risk_score, summary, mentioned_opponents, mentioned_allies, mentioned_entities, created_at",
      )
      .eq("org_id", orgId)
      .gte("created_at", since)
      .ilike("topic", escapeLike(tema));
    return (bairro ? q.ilike("neighborhood", escapeLike(bairro)) : q.is("neighborhood", null))
      .order("id", { ascending: true }) // ordem estável: sem isso a paginação repete/pula linhas
      .range(from, to);
  }, MAX_MENSAGENS);

  const truncado = analises.length >= MAX_MENSAGENS;
  const idsMensagens = [...new Set(analises.map((a) => a.message_id))];

  /* --- 4. Mensagens brutas (conteúdo, grupo, fonte, fingerprint) ------ */

  // `content_fingerprint` é coluna gerada que o typegen ainda não conhece; com literal
  // o TS resolveria o select contra a definição velha e derrubaria a query inteira.
  const colsBrutas: string =
    "id, content, posted_at, author_hash, group_id, content_fingerprint, raw_payload," +
    " sources(kind, label), whatsapp_groups(subject, neighborhood_tag)";

  const lotes: string[][] = [];
  for (let i = 0; i < idsMensagens.length; i += LOTE_IDS) {
    lotes.push(idsMensagens.slice(i, i + LOTE_IDS));
  }
  const brutasPorLote = await Promise.all(
    lotes.map(async (lote) => {
      const { data, error } = await supabase
        .from("raw_messages")
        .select(colsBrutas)
        .eq("org_id", orgId)
        .in("id", lote);
      if (error) throw new Error((error as { message?: string }).message ?? String(error));
      // Tipagem à mão em vez de `.returns<T>()`: o cliente chega aqui como `any` (o
      // genérico de `SupabaseClient<Database>` é pesado demais para atravessar o helper),
      // e `.returns` num valor não tipado é erro de compilação.
      return (data ?? []) as LinhaBruta[];
    }),
  );
  const brutas = brutasPorLote.flat();
  const brutaPorId = new Map(brutas.map((b) => [b.id, b]));

  /* --- 5. Linha do tempo --------------------------------------------- */

  const porDia = new Map<string, { total: number; risco: number; soma: number; n: number }>();
  for (const a of analises) {
    const b = brutaPorId.get(a.message_id);
    const dia = diaDe(b?.posted_at ?? a.created_at);
    const d = porDia.get(dia) ?? { total: 0, risco: 0, soma: 0, n: 0 };
    d.total += 1;
    if ((a.risk_score ?? 0) >= 70) d.risco += 1;
    if (typeof a.sentiment === "number") {
      d.soma += a.sentiment;
      d.n += 1;
    }
    porDia.set(dia, d);
  }

  // Preenche os dias vazios: um gráfico que pula os dias sem sinal transforma silêncio
  // em continuidade e faz um caso intermitente parecer contínuo.
  const dias: Array<{ dia: string; total: number; risco: number; sentimento: number | null }> = [];
  for (let t = inicioMs; t <= Date.now(); t += DIA_MS) {
    const dia = new Date(t).toISOString().slice(0, 10);
    const d = porDia.get(dia);
    dias.push({
      dia,
      total: d?.total ?? 0,
      risco: d?.risco ?? 0,
      sentimento: d && d.n > 0 ? Number((d.soma / d.n).toFixed(3)) : null,
    });
  }

  const pico = dias.reduce((acc, d) => (d.total > acc.total ? d : acc), {
    dia: "",
    total: 0,
    risco: 0,
    sentimento: null as number | null,
  });

  // "Quando esquentou": primeiro dia em que a soma móvel de 3 dias passou de metade do
  // pico dessa mesma soma. Média móvel e não dia isolado — um pico de um dia só é ruído;
  // três dias seguidos acima da metade é o caso saindo do chão.
  const movel3 = dias.map((_, i) =>
    dias.slice(Math.max(0, i - 2), i + 1).reduce((s, d) => s + d.total, 0),
  );
  const picoMovel = Math.max(0, ...movel3);
  const idxEsquentou = picoMovel > 0 ? movel3.findIndex((v) => v >= picoMovel * 0.5) : -1;
  const esquentouEm = idxEsquentou >= 0 ? dias[idxEsquentou].dia : null;

  const marcos = alertas
    .map((a) => ({
      id: a.id,
      dia: diaDe(a.created_at),
      level: a.level,
      stage: a.stage,
      resumo: a.summary,
      resolvido: !!a.resolved_at,
    }))
    .sort((x, y) => x.dia.localeCompare(y.dia));

  /* --- 6. Evidência --------------------------------------------------- */

  const copiasPorFp = new Map<string, number>();
  for (const b of brutas) {
    if (b.content_fingerprint) {
      copiasPorFp.set(b.content_fingerprint, (copiasPorFp.get(b.content_fingerprint) ?? 0) + 1);
    }
  }

  type Citacao = {
    id: string;
    texto: string;
    risco: number;
    sentimento: number | null;
    resumo: string | null;
    quando: string;
    origem: string;
    canal: string;
    url: string | null;
    copias: number;
  };

  const comTexto = analises
    .map((a) => {
      const b = brutaPorId.get(a.message_id);
      if (!b) return null;
      const src = one(b.sources);
      const grp = one(b.whatsapp_groups);
      const payload = b.raw_payload ?? null;
      const texto = (payload?.title ?? b.content ?? "").trim();
      if (texto.length < 25) return null; // fragmento não é citação; é ruído numa reunião
      return {
        id: b.id,
        texto: texto.slice(0, 600),
        risco: a.risk_score ?? 0,
        sentimento: a.sentiment,
        resumo: a.summary,
        quando: b.posted_at,
        origem: grp?.subject ?? src?.label ?? "Fonte não identificada",
        canal: src?.kind ?? "desconhecido",
        url: payload?.url ?? null,
        copias: b.content_fingerprint ? (copiasPorFp.get(b.content_fingerprint) ?? 1) : 1,
        fp: b.content_fingerprint,
      };
    })
    .filter((x): x is Citacao & { fp: string | null } => x !== null);

  // Dedup por fingerprint na vitrine: 12 cópias do mesmo encaminhamento ocupariam a
  // seção inteira. A contagem de cópias vira atributo da citação (`copias`), que é
  // informação melhor que doze linhas repetidas.
  const vistos = new Set<string>();
  const unicas = comTexto.filter((c) => {
    const k = c.fp ?? c.id;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  const citacoesRisco = [...unicas].sort((a, b) => b.risco - a.risco).slice(0, 8);
  const idsRisco = new Set(citacoesRisco.map((c) => c.id));
  const citacoesRecentes = [...unicas]
    .filter((c) => !idsRisco.has(c.id))
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 5);

  const semConteudo = brutas.length > 0 && comTexto.length === 0;

  /* --- 7. Território --------------------------------------------------- */

  type Territorio =
    | { status: "sem_bairro" }
    | {
        status: "ok";
        bairro: string;
        mensagensNoCaso: number;
        mensagensNoBairro: number;
        participacaoDoCaso: number;
        sentimentoDoCaso: number | null;
        sentimentoDoBairro: number | null;
        sentimentoDaCidade: number | null;
        posicaoPorVolume: number | null;
        posicaoPorSentimento: number | null;
        totalBairros: number;
        outrosTemas: Array<{ tema: string; mensagens: number }>;
        diasRanking: number;
      };

  const sentDoCaso = (() => {
    const vals = analises.map((a) => a.sentiment).filter((v): v is number => typeof v === "number");
    return vals.length ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)) : null;
  })();

  let territorio: Territorio = { status: "sem_bairro" };

  if (bairro) {
    const sinceRanking = new Date(Date.now() - DIAS_RANKING * DIA_MS).toISOString();

    // Duas passadas: (1) o bairro inteiro na janela do caso, para participação e temas
    // concorrentes; (2) todos os bairros em 30d, para posição relativa. A segunda é a
    // cara — por isso janela curta e fixa, igual à tela de Território.
    const [linhasBairro, linhasCidade] = await Promise.all([
      fetchAllPages<{ id: string; topic: string | null; sentiment: number | null }>((from, to) =>
        supabase
          .from("message_analyses")
          .select("id, topic, sentiment")
          .eq("org_id", orgId)
          .gte("created_at", since)
          .ilike("neighborhood", escapeLike(bairro))
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllPages<{ id: string; neighborhood: string | null; sentiment: number | null }>(
        (from, to) =>
          supabase
            .from("message_analyses")
            .select("id, neighborhood, sentiment")
            .eq("org_id", orgId)
            .gte("created_at", sinceRanking)
            .not("neighborhood", "is", null)
            .order("id", { ascending: true })
            .range(from, to),
      ),
    ]);

    const temasNoBairro = new Map<string, number>();
    let somaBairro = 0;
    let nBairro = 0;
    for (const l of linhasBairro) {
      const t = (l.topic ?? "").trim();
      if (t) temasNoBairro.set(t, (temasNoBairro.get(t) ?? 0) + 1);
      if (typeof l.sentiment === "number") {
        somaBairro += l.sentiment;
        nBairro += 1;
      }
    }

    const agg = new Map<string, { n: number; soma: number; comSent: number }>();
    let somaCidade = 0;
    let nCidade = 0;
    for (const l of linhasCidade) {
      const k = (l.neighborhood ?? "").trim().toLowerCase();
      if (!k) continue;
      const a = agg.get(k) ?? { n: 0, soma: 0, comSent: 0 };
      a.n += 1;
      if (typeof l.sentiment === "number") {
        a.soma += l.sentiment;
        a.comSent += 1;
        somaCidade += l.sentiment;
        nCidade += 1;
      }
      agg.set(k, a);
    }

    const chave = bairro.trim().toLowerCase();
    const porVolume = [...agg.entries()].sort((a, b) => b[1].n - a[1].n);
    const porSentimento = [...agg.entries()]
      .filter(([, v]) => v.comSent > 0)
      .sort((a, b) => a[1].soma / a[1].comSent - b[1].soma / b[1].comSent); // pior primeiro
    const iVol = porVolume.findIndex(([k]) => k === chave);
    const iSent = porSentimento.findIndex(([k]) => k === chave);

    territorio = {
      status: "ok",
      bairro,
      mensagensNoCaso: analises.length,
      mensagensNoBairro: linhasBairro.length,
      participacaoDoCaso: linhasBairro.length
        ? Number((analises.length / linhasBairro.length).toFixed(3))
        : 0,
      sentimentoDoCaso: sentDoCaso,
      sentimentoDoBairro: nBairro ? Number((somaBairro / nBairro).toFixed(3)) : null,
      sentimentoDaCidade: nCidade ? Number((somaCidade / nCidade).toFixed(3)) : null,
      posicaoPorVolume: iVol >= 0 ? iVol + 1 : null,
      posicaoPorSentimento: iSent >= 0 ? iSent + 1 : null,
      totalBairros: agg.size,
      outrosTemas: [...temasNoBairro.entries()]
        .filter(([t]) => t.toLowerCase() !== tema.toLowerCase())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t, n]) => ({ tema: t, mensagens: n })),
      diasRanking: DIAS_RANKING,
    };
  }

  /* --- 8. Quem aparece -------------------------------------------------- */

  const contar = (listas: Array<string[] | null | undefined>) => {
    const m = new Map<string, { nome: string; n: number }>();
    for (const lista of listas) {
      for (const raw of lista ?? []) {
        const nome = String(raw ?? "").trim();
        if (nome.length < 2) continue;
        const k = nome.toLowerCase();
        const cur = m.get(k) ?? { nome, n: 0 };
        cur.n += 1;
        m.set(k, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  };

  const opositores = contar(analises.map((a) => a.mentioned_opponents)).slice(0, 10);
  const aliados = contar(analises.map((a) => a.mentioned_allies)).slice(0, 10);
  const entidades = contar(analises.map((a) => a.mentioned_entities)).slice(0, 12);

  const [{ data: adversarios }, { data: membros }] = await Promise.all([
    supabase.from("org_adversaries").select("id, display_name, role, party").eq("org_id", orgId),
    supabase
      .from("tracked_members")
      .select("id, display_name, role, author_hash, neighborhood")
      .eq("org_id", orgId),
  ]);

  type Adv = { id: string; display_name: string; role: string | null; party: string | null };
  type Mem = {
    id: string;
    display_name: string;
    role: string;
    author_hash: string | null;
    neighborhood: string | null;
  };

  const advPorNome = new Map<string, Adv>(
    ((adversarios ?? []) as Adv[]).map((a) => [a.display_name.trim().toLowerCase(), a]),
  );

  // Autores monitorados que efetivamente FALARAM no caso — informação distinta de
  // "foi citado". Ambas importam numa reunião, e confundir as duas engana.
  const porAutor = new Map<string, number>();
  for (const b of brutas) {
    if (b.author_hash) porAutor.set(b.author_hash, (porAutor.get(b.author_hash) ?? 0) + 1);
  }
  const vozes = ((membros ?? []) as Mem[])
    .filter((m) => m.author_hash && porAutor.has(m.author_hash))
    .map((m) => ({
      id: m.id,
      nome: m.display_name,
      papel: m.role,
      bairro: m.neighborhood,
      mensagens: porAutor.get(m.author_hash as string) ?? 0,
    }))
    .sort((a, b) => b.mensagens - a.mensagens)
    .slice(0, 10);

  const pessoas = {
    // `cadastrado` marca quem já é adversário monitorado da org — o resto é nome solto
    // que a IA extraiu do texto e ainda não virou entidade acompanhada.
    opositores: opositores.map((o) => ({
      ...o,
      cadastrado: advPorNome.get(o.nome.toLowerCase()) ?? null,
    })),
    aliados,
    entidades,
    vozes,
    autoresDistintos: porAutor.size,
    temAnalise: analises.length > 0,
  };

  /* --- 9. Menções em relatórios ------------------------------------------ */

  // O tema é slug ("limpeza_urbana"); no texto do relatório ele aparece por extenso.
  // Buscar as duas formas, mais o bairro, cobre as citações reais sem falso positivo caro.
  const termos = [
    sanitizeFilterValue(tema.replace(/_/g, " ")),
    bairro ? sanitizeFilterValue(bairro) : "",
  ].filter((t) => t.length >= 4);

  const totalRelatorios = await countExact(
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("generated_at", since),
  );

  type RelatorioLinha = {
    id: string;
    kind: string;
    title: string;
    period_start: string;
    period_end: string;
    generated_at: string;
    markdown: string;
  };

  let relatoriosLinhas: RelatorioLinha[] = [];
  if (termos.length > 0 && totalRelatorios > 0) {
    const { data: rel } = await supabase
      .from("reports")
      .select("id, kind, title, period_start, period_end, generated_at, markdown")
      .eq("org_id", orgId)
      .gte("generated_at", since)
      .or(termos.map((t) => `markdown.ilike.%${t}%`).join(","))
      .order("generated_at", { ascending: false })
      .limit(12);
    relatoriosLinhas = (rel ?? []) as RelatorioLinha[];
  }

  const relatorios = relatoriosLinhas.map((r) => {
    const md = r.markdown ?? "";
    const alvo = termos.find((t) => md.toLowerCase().includes(t.toLowerCase())) ?? "";
    const i = alvo ? md.toLowerCase().indexOf(alvo.toLowerCase()) : -1;
    // Recorte ao redor da primeira menção: numa reunião, o valor é ver O QUE o relatório
    // disse sobre este caso, não abrir o documento inteiro e procurar.
    const trecho =
      i >= 0
        ? (i > 0 ? "…" : "") +
          md.slice(Math.max(0, i - 180), Math.min(md.length, i + 320)).trim() +
          (i + 320 < md.length ? "…" : "")
        : "";
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      periodo: { inicio: r.period_start, fim: r.period_end },
      geradoEm: r.generated_at,
      trecho,
    };
  });

  /* --- 10. Propagação ----------------------------------------------------- */

  type Propagacao =
    | { status: "sem_grupos" }
    | { status: "sem_fingerprint" }
    | { status: "nenhum_cluster"; mensagensDeGrupo: number; gruposDistintos: number }
    | {
        status: "ok";
        mensagensDeGrupo: number;
        gruposDistintos: number;
        clusters: Array<{
          texto: string;
          repeticoes: number;
          gruposDistintos: number;
          janelaHoras: number;
          primeira: string;
          ultima: string;
        }>;
      };

  const deGrupo = brutas.filter((b) => b.group_id);
  const gruposDistintos = new Set(deGrupo.map((b) => b.group_id as string)).size;
  const comFp = deGrupo.filter((b) => b.content_fingerprint);

  let propagacao: Propagacao;
  if (deGrupo.length === 0) {
    // Caso 100% de imprensa/Instagram: propagação entre grupos não é "zero", é
    // inaplicável — não há grupo onde um encaminhamento pudesse acontecer.
    propagacao = { status: "sem_grupos" };
  } else if (comFp.length === 0) {
    // Mensagens antigas, anteriores à coluna gerada: não dá para afirmar nada.
    propagacao = { status: "sem_fingerprint" };
  } else {
    const clusters = new Map<string, { total: number; grupos: Set<string>; ts: number[] }>();
    for (const b of comFp) {
      const fp = b.content_fingerprint as string;
      const c = clusters.get(fp) ?? { total: 0, grupos: new Set<string>(), ts: [] };
      c.total += 1;
      if (b.group_id) c.grupos.add(b.group_id);
      const t = Date.parse(b.posted_at);
      if (Number.isFinite(t)) c.ts.push(t);
      clusters.set(fp, c);
    }

    // Mesmos cortes de `levantarSinaisCoordenados` (reports.server.ts): o que separa
    // disparo de rotina não é repetição, é DENSIDADE — muitos grupos em poucas horas.
    const candidatos = [...clusters.entries()]
      .map(([fp, c]) => {
        const primeira = Math.min(...c.ts);
        const ultima = Math.max(...c.ts);
        const janela = c.ts.length ? (ultima - primeira) / 3_600_000 : 0;
        return { fp, c, janela, primeira, ultima };
      })
      .filter((x) => x.c.total >= 3 && x.c.grupos.size >= 2 && x.janela <= 24)
      .map((x) => ({ ...x, densidade: x.c.grupos.size / Math.max(x.janela, 0.5) }))
      .sort((a, b) => b.densidade - a.densidade)
      .slice(0, 5);

    if (candidatos.length === 0) {
      propagacao = {
        status: "nenhum_cluster",
        mensagensDeGrupo: deGrupo.length,
        gruposDistintos,
      };
    } else {
      const textoPorFp = new Map<string, string>();
      for (const b of comFp) {
        const fp = b.content_fingerprint as string;
        if (!textoPorFp.has(fp) && b.content) textoPorFp.set(fp, b.content);
      }
      propagacao = {
        status: "ok",
        mensagensDeGrupo: deGrupo.length,
        gruposDistintos,
        clusters: candidatos.map((x) => ({
          texto: (textoPorFp.get(x.fp) ?? "").slice(0, 400),
          repeticoes: x.c.total,
          gruposDistintos: x.c.grupos.size,
          janelaHoras: Number(x.janela.toFixed(1)),
          primeira: new Date(x.primeira).toISOString(),
          ultima: new Date(x.ultima).toISOString(),
        })),
      };
    }
  }

  /* --- 11. Canais ---------------------------------------------------------- */

  const porCanal = new Map<string, number>();
  for (const b of brutas) {
    const k = one(b.sources)?.kind ?? "desconhecido";
    porCanal.set(k, (porCanal.get(k) ?? 0) + 1);
  }

  /* --- resposta ------------------------------------------------------------ */

  return {
    casoId: encodeCasoId(dedupeKey),
    dedupeKey,
    tema,
    bairro,
    /** `true` quando o caso é de tema puro: os sinais que o formaram não citaram bairro. */
    semBairro: !bairro,
    existe: alertas.length > 0 || analises.length > 0,
    janela: { inicio: since, fim: new Date().toISOString(), estendida: janelaEstendida },
    truncado,
    cabecalho: maisRecente
      ? {
          level: maisRecente.level,
          stage: maisRecente.stage,
          resumo: maisRecente.summary,
          acao: maisRecente.recommended_action,
          alertaId: maisRecente.id,
          aberto: !maisRecente.resolved_at,
          reconhecido: !!maisRecente.acknowledged_at,
          riscoMax: maisRecente.max_risk,
        }
      : null,
    numeros: {
      mensagens: analises.length,
      autoresDistintos: porAutor.size,
      gruposDistintos,
      alertas: alertas.length,
      riscoMax: analises.reduce((m, a) => Math.max(m, a.risk_score ?? 0), 0),
      sentimentoMedio: sentDoCaso,
      canais: [...porCanal.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })),
    },
    linhaDoTempo: { dias, pico: pico.total > 0 ? pico : null, esquentouEm, marcos },
    evidencia: {
      status: semConteudo ? ("sem_conteudo" as const) : ("ok" as const),
      citacoes: citacoesRisco.map(({ fp: _fp, ...c }) => c),
      recentes: citacoesRecentes.map(({ fp: _fp, ...c }) => c),
    },
    territorio,
    pessoas,
    relatorios: { total: totalRelatorios, itens: relatorios },
    propagacao,
  };
}

export const getCaso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        casoId: z.string().min(1).max(400),
        days: z.number().int().min(7).max(365).default(90),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso a esta organização.");

    const dedupeKey = decodeCasoId(data.casoId);
    if (!dedupeKey) throw new Error("Identificador de caso inválido.");

    return getCasoImpl(context.supabase, data.orgId, dedupeKey, data.days);
  });
