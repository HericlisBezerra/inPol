// Agregação e relatório determinístico de uma sessão da Câmara — módulo PURO.
//
// Separado de `camara.server.ts` de propósito (mesmo motivo de `report-fallback.ts`): aqui está
// tudo que produz NÚMERO e CITAÇÃO, que é justamente o que precisa ser testável sem banco, sem
// rede e sem chave de IA. `camara.server.ts` fica só com I/O, prompt e fallback de modelo.
//
// Regra que o módulo inteiro serve: número nunca passa por IA, citação nunca é parafraseada.

/* ─────────────────────────── tipos das linhas lidas ─────────────────────────── */

export type SessaoRow = {
  id: string;
  org_id: string;
  session_date: string;
  numero: string | null;
  legislatura: string | null;
  tipo: string | null;
  title: string;
  video_url: string | null;
  video_id: string | null;
  duration_seconds: number | null;
};

export type FalaRow = {
  id: string;
  order_index: number;
  at_seconds: number;
  speaker_name: string;
  speaker_party: string | null;
  speaker_role: string;
  person_id: string | null;
  content: string;
  word_count: number;
  topic: string | null;
  sentiment: number | null;
  risk_score: number | null;
  summary: string | null;
};

export type PessoaRow = {
  id: string;
  display_name: string;
  stance: string | null;
  party: string | null;
  role: string | null;
};

/* ─────────────────────────── formato de `analysis` ─────────────────────────── */

export type OradorAgregado = {
  nome: string;
  partido: string | null;
  papel: string;
  person_id: string | null;
  /** Posicionamento da FICHA (`org_people.stance`), não julgamento da IA. */
  stance: string | null;
  falas: number;
  palavras: number;
  pct_palavras: number;
  primeira_at_seconds: number;
  ultima_at_seconds: number;
  /** Aproximado — ver `TEMPO_TRIBUNA_CAP_SECONDS` e o comentário em `agregar`. */
  tempo_tribuna_seconds_aprox: number;
};

export type MencaoAgregada = {
  de: string;
  para: string;
  ocorrencias: number;
  evidencias: Array<{ at_seconds: number; trecho: string }>;
};

export type SessionAnalysis = {
  versao: number;
  sessao: {
    id: string;
    data: string;
    numero: string | null;
    legislatura: string | null;
    tipo: string | null;
    title: string;
    video_id: string | null;
    video_url: string | null;
  };
  cobertura: {
    falas: number;
    palavras: number;
    oradores: number;
    primeiro_at_seconds: number | null;
    ultimo_at_seconds: number | null;
    span_seconds: number | null;
    duracao_registrada_seconds: number | null;
  };
  por_vereador: OradorAgregado[];
  por_partido: Array<{
    partido: string;
    oradores: number;
    falas: number;
    palavras: number;
    pct_palavras: number;
  }>;
  participacao: {
    dominaram: Array<{ nome: string; pct_palavras: number }>;
    concentracao_top3_pct: number;
    /** `null` = a org não tem cadastro de vereadores para comparar. Ausência de base NÃO vira
     *  lista vazia: dizer "todos falaram" sem saber quem são os vereadores seria inventar. */
    nao_falaram: Array<{ person_id: string; nome: string; partido: string | null }> | null;
    base_nao_falaram: string | null;
  };
  mencoes: MencaoAgregada[];
  mencoes_metodo: string;
  recorte: {
    aplicado: boolean;
    palavras_totais: number;
    palavras_enviadas: number;
    falas_integrais: number;
    falas_resumidas: number;
    teto_palavras: number;
  };
  modo: "ia" | "fallback";
  gerado_em: string;
};

export type SessionAnalysisResult = {
  sessionId: string;
  markdown: string;
  modelVersion: string;
  degraded: boolean;
  analysis: SessionAnalysis;
};

/* ─────────────────────────── constantes de recorte ─────────────────────────── */

// Teto de palavras enviadas à IA numa chamada. A sessão real medida tem ~29.500 palavras
// (~40 mil tokens) e cabe INTEIRA — não amostramos o caso normal. Este teto existe só para a
// sessão anômala (maratona de orçamento, duas sessões coladas num vídeo). 45.000 palavras
// ≈ 60 mil tokens de conteúdo, o que ainda deixa folga confortável na janela do PRO para
// prompt de sistema, agregados e as ~8 mil de saída.
const TETO_PALAVRAS_PROMPT = 45_000;
/** Do orçamento de recorte, quanto vai para falas INTEGRAIS (o resto vira resumo truncado). */
const FRACAO_INTEGRAIS = 0.75;
/** Tamanho do trecho preservado das falas que não couberam por inteiro. */
const RESUMO_CHARS = 500;

// Tempo de tribuna é DERIVADO: a transcrição só tem o instante em que cada fala começa, então a
// duração de uma fala é o intervalo até a próxima. Isso inclui pausas, apartes e intervalo de
// sessão. O cap impede que um intervalo de uma hora seja atribuído como "tempo de tribuna" de
// quem falou por último antes dele.
const TEMPO_TRIBUNA_CAP_SECONDS = 900;

/* ─────────────────────────── utilidades ─────────────────────────── */

export const hhmmss = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  const h = String(Math.floor(t / 3600)).padStart(2, "0");
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const seg = String(t % 60).padStart(2, "0");
  return `${h}:${m}:${seg}`;
};

const pct = (parte: number, total: number): number =>
  total > 0 ? +((parte * 100) / total).toFixed(1) : 0;

/** Normaliza para comparação de nomes: sem acento, minúsculo, só letras/números e espaço. */
export const normalizar = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acento: comparação de nome tem que ser insensível a isso
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escaparRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Tokens que NÃO identificam ninguém sozinhos: tratamento, patente, sobrenome corriqueiro e
// prenome comum. Sem esta lista, "o senhor presidente" viraria menção nominal e "Silva" apontaria
// para o vereador errado. Na dúvida a regra é não contar — menção falsa é pior que menção ausente.
const TOKENS_GENERICOS = new Set([
  "vereador",
  "vereadora",
  "vereadores",
  "presidente",
  "senhor",
  "senhora",
  "excelencia",
  "nobre",
  "colega",
  "doutor",
  "doutora",
  "professor",
  "professora",
  "pastor",
  "pastora",
  "padre",
  "irmao",
  "irma",
  "sargento",
  "cabo",
  "soldado",
  "delegado",
  "capitao",
  "tenente",
  "junior",
  "filho",
  "neto",
  "sobrinho",
  "silva",
  "santos",
  "souza",
  "sousa",
  "oliveira",
  "pereira",
  "lima",
  "costa",
  "ferreira",
  "alves",
  "rodrigues",
  "gomes",
  "ribeiro",
  "martins",
  "carvalho",
  "almeida",
  "araujo",
  "barbosa",
  "nunes",
  "moura",
  "cardoso",
  "jose",
  "joao",
  "maria",
  "ana",
  "paulo",
  "pedro",
  "luiz",
  "luis",
  "carlos",
  "antonio",
  "francisco",
  "marcos",
  "marcelo",
  "fernando",
  "roberto",
  "ricardo",
  "rafael",
  "bruno",
  "felipe",
  "andre",
  "eduardo",
  "sergio",
  "cesar",
]);

/* ─────────────────────────── agregação exata ─────────────────────────── */

export type Agregados = Pick<
  SessionAnalysis,
  "cobertura" | "por_vereador" | "por_partido" | "participacao" | "mencoes" | "mencoes_metodo"
>;

/**
 * Todos os números do relatório saem daqui — contados, nunca gerados.
 *
 * As falas chegam ordenadas por `order_index`, que a ingestão garante monotônico com o tempo;
 * ainda assim os deltas usam `at_seconds` (a fonte real do tempo) e ignoram delta negativo,
 * caso um parser futuro desalinhe os dois.
 */
export function agregar(falas: FalaRow[], pessoasPorId: Map<string, PessoaRow>): Agregados {
  const totalPalavras = falas.reduce((acc, f) => acc + (f.word_count || 0), 0);

  type Acc = {
    nome: string;
    partido: string | null;
    papel: string;
    person_id: string | null;
    falas: number;
    palavras: number;
    primeira: number;
    ultima: number;
    tribuna: number;
  };
  // Chave por person_id quando existe (o mesmo vereador pode aparecer com grafias diferentes na
  // transcrição e o vínculo já resolveu isso); cai para o nome normalizado quando não há ficha.
  const porOrador = new Map<string, Acc>();

  for (let i = 0; i < falas.length; i++) {
    const f = falas[i];
    const chave = f.person_id ?? `nome:${normalizar(f.speaker_name)}`;
    const acc = porOrador.get(chave) ?? {
      nome: f.speaker_name,
      partido: f.speaker_party,
      papel: f.speaker_role,
      person_id: f.person_id,
      falas: 0,
      palavras: 0,
      primeira: f.at_seconds,
      ultima: f.at_seconds,
      tribuna: 0,
    };
    acc.falas += 1;
    acc.palavras += f.word_count || 0;
    acc.primeira = Math.min(acc.primeira, f.at_seconds);
    acc.ultima = Math.max(acc.ultima, f.at_seconds);
    // Papel "presidente" prevalece: quem presidiu a sessão aparece assim ao menos uma vez, e é a
    // informação relevante para o gabinete mesmo que outras falas venham marcadas como vereador.
    if (f.speaker_role === "presidente") acc.papel = "presidente";
    if (!acc.partido && f.speaker_party) acc.partido = f.speaker_party;

    const proxima = falas[i + 1];
    const delta = proxima ? proxima.at_seconds - f.at_seconds : 0;
    acc.tribuna += Math.min(Math.max(delta, 0), TEMPO_TRIBUNA_CAP_SECONDS);
    porOrador.set(chave, acc);
  }

  const por_vereador: OradorAgregado[] = [...porOrador.values()]
    .map((a) => ({
      nome: a.nome,
      partido: a.partido,
      papel: a.papel,
      person_id: a.person_id,
      stance: a.person_id ? (pessoasPorId.get(a.person_id)?.stance ?? null) : null,
      falas: a.falas,
      palavras: a.palavras,
      pct_palavras: pct(a.palavras, totalPalavras),
      primeira_at_seconds: a.primeira,
      ultima_at_seconds: a.ultima,
      tempo_tribuna_seconds_aprox: a.tribuna,
    }))
    .sort((x, y) => y.palavras - x.palavras);

  const porPartido = new Map<string, { oradores: number; falas: number; palavras: number }>();
  for (const o of por_vereador) {
    const p = o.partido ?? "sem partido";
    const acc = porPartido.get(p) ?? { oradores: 0, falas: 0, palavras: 0 };
    acc.oradores += 1;
    acc.falas += o.falas;
    acc.palavras += o.palavras;
    porPartido.set(p, acc);
  }
  const por_partido = [...porPartido.entries()]
    .map(([partido, v]) => ({ partido, ...v, pct_palavras: pct(v.palavras, totalPalavras) }))
    .sort((a, b) => b.palavras - a.palavras);

  const dominaram = por_vereador
    .slice(0, 3)
    .map((o) => ({ nome: o.nome, pct_palavras: o.pct_palavras }));
  const concentracao = +dominaram.reduce((acc, o) => acc + o.pct_palavras, 0).toFixed(1);

  const at = falas.map((f) => f.at_seconds);
  const primeiro = at.length ? Math.min(...at) : null;
  const ultimo = at.length ? Math.max(...at) : null;

  return {
    cobertura: {
      falas: falas.length,
      palavras: totalPalavras,
      oradores: por_vereador.length,
      primeiro_at_seconds: primeiro,
      ultimo_at_seconds: ultimo,
      span_seconds: primeiro !== null && ultimo !== null ? ultimo - primeiro : null,
      duracao_registrada_seconds: null, // preenchido pelo chamador com o campo da sessão
    },
    por_vereador,
    por_partido,
    participacao: {
      dominaram,
      concentracao_top3_pct: concentracao,
      nao_falaram: null, // preenchido pelo chamador quando há cadastro de vereadores
      base_nao_falaram: null,
    },
    ...detectarMencoes(falas, por_vereador),
  };
}

/**
 * Menções nominais entre oradores da MESMA sessão.
 *
 * Detecção conservadora de propósito. Só conta como menção:
 *   (a) o nome completo do orador, ou
 *   (b) um token de 4+ letras que seja EXCLUSIVO de um orador dentro desta sessão e não esteja
 *       na lista de tokens genéricos.
 * Se nenhum apelido sobreviver a esse filtro, o orador simplesmente não é detectável e não
 * aparece — preferimos silêncio a atribuir a fala errada a alguém.
 */
export function detectarMencoes(
  falas: FalaRow[],
  oradores: OradorAgregado[],
): Pick<SessionAnalysis, "mencoes" | "mencoes_metodo"> {
  const metodo =
    "Contagem literal por nome completo ou por token exclusivo (4+ letras, fora da lista de " +
    "tratamentos/sobrenomes comuns) dentro do texto de outro orador. Conservador: nome não " +
    "discriminante é ignorado em vez de atribuído.";
  if (oradores.length < 2) return { mencoes: [], mencoes_metodo: metodo };

  // Quantos oradores contêm cada token — token compartilhado não discrimina ninguém.
  const donosPorToken = new Map<string, Set<string>>();
  for (const o of oradores) {
    for (const t of new Set(normalizar(o.nome).split(" "))) {
      if (t.length < 4 || TOKENS_GENERICOS.has(t)) continue;
      const s = donosPorToken.get(t) ?? new Set<string>();
      s.add(o.nome);
      donosPorToken.set(t, s);
    }
  }

  const padroes = oradores
    .map((o) => {
      const nomeNorm = normalizar(o.nome);
      const alvos = new Set<string>([nomeNorm]);
      for (const t of nomeNorm.split(" ")) {
        if (donosPorToken.get(t)?.size === 1) alvos.add(t);
      }
      const alternativas = [...alvos]
        .filter((a) => a.length >= 4)
        .sort((a, b) => b.length - a.length)
        .map(escaparRegex);
      if (alternativas.length === 0) return null;
      return { nome: o.nome, re: new RegExp(`\\b(?:${alternativas.join("|")})\\b`, "g") };
    })
    .filter((x): x is { nome: string; re: RegExp } => x !== null);

  const pares = new Map<string, MencaoAgregada>();
  for (const f of falas) {
    const texto = normalizar(f.content);
    const quemFala = normalizar(f.speaker_name);
    for (const p of padroes) {
      // Falar o próprio nome não é menção. Compara normalizado porque a transcrição pode grafar
      // o mesmo orador de formas diferentes (o agrupamento por `person_id` escolheu uma delas).
      if (normalizar(p.nome) === quemFala) continue;
      p.re.lastIndex = 0;
      const hits = texto.match(p.re);
      if (!hits?.length) continue;
      const chave = `${f.speaker_name}→${p.nome}`;
      const m = pares.get(chave) ?? {
        de: f.speaker_name,
        para: p.nome,
        ocorrencias: 0,
        evidencias: [],
      };
      m.ocorrencias += hits.length;
      // Evidência é trecho LITERAL da fala (não o texto normalizado) — citação nunca é parafraseada.
      if (m.evidencias.length < 2) {
        m.evidencias.push({
          at_seconds: f.at_seconds,
          trecho: f.content.replace(/\s+/g, " ").trim().slice(0, 200),
        });
      }
      pares.set(chave, m);
    }
  }

  return {
    mencoes: [...pares.values()].sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 30),
    mencoes_metodo: metodo,
  };
}

/* ─────────────────────────── payload das falas para a IA ─────────────────────────── */

export type FalaPrompt = {
  i: number;
  t: string;
  at_seconds: number;
  quem: string;
  partido: string | null;
  papel: string;
  texto: string;
  integral: boolean;
};

/**
 * Monta as falas que vão no prompt. Caso normal: TODAS, na íntegra e em ordem cronológica.
 *
 * Se a sessão estourar `TETO_PALAVRAS_PROMPT`, mantém integrais as falas mais longas (é onde
 * está o debate: aparte de dez palavras não sustenta análise) até consumir a fração reservada,
 * e trunca o restante — mas devolve a ordem cronológica intacta e registra o recorte em
 * `analysis.recorte`, que aparece como aviso no topo do relatório. Nunca silencioso.
 */
export function montarFalasPrompt(falas: FalaRow[]): {
  itens: FalaPrompt[];
  recorte: SessionAnalysis["recorte"];
} {
  const totalPalavras = falas.reduce((acc, f) => acc + (f.word_count || 0), 0);
  const base = (f: FalaRow, i: number) => ({
    i,
    t: hhmmss(f.at_seconds),
    at_seconds: f.at_seconds,
    quem: f.speaker_name,
    partido: f.speaker_party,
    papel: f.speaker_role,
  });

  if (totalPalavras <= TETO_PALAVRAS_PROMPT) {
    return {
      itens: falas.map((f, i) => ({ ...base(f, i), texto: f.content, integral: true })),
      recorte: {
        aplicado: false,
        palavras_totais: totalPalavras,
        palavras_enviadas: totalPalavras,
        falas_integrais: falas.length,
        falas_resumidas: 0,
        teto_palavras: TETO_PALAVRAS_PROMPT,
      },
    };
  }

  const orcamentoIntegrais = Math.floor(TETO_PALAVRAS_PROMPT * FRACAO_INTEGRAIS);
  const integrais = new Set<number>();
  let usado = 0;
  for (const f of [...falas].sort((a, b) => (b.word_count || 0) - (a.word_count || 0))) {
    const w = f.word_count || 0;
    if (usado + w > orcamentoIntegrais) continue;
    integrais.add(f.order_index);
    usado += w;
  }

  let palavrasEnviadas = usado;
  const itens = falas.map((f, i) => {
    const integral = integrais.has(f.order_index);
    if (integral) return { ...base(f, i), texto: f.content, integral: true };
    const texto = f.content.slice(0, RESUMO_CHARS);
    palavrasEnviadas += Math.ceil(texto.length / 6); // estimativa só para o relato do recorte
    return { ...base(f, i), texto: `${texto}… [fala truncada]`, integral: false };
  });

  return {
    itens,
    recorte: {
      aplicado: true,
      palavras_totais: totalPalavras,
      palavras_enviadas: palavrasEnviadas,
      falas_integrais: integrais.size,
      falas_resumidas: falas.length - integrais.size,
      teto_palavras: TETO_PALAVRAS_PROMPT,
    },
  };
}

/* ─────────────────────────── fallback determinístico ─────────────────────────── */

/**
 * Relatório de contingência montado só dos agregados e de citações literais.
 *
 * Uma sessão NUNCA pode ficar sem relatório: o gabinete precisa saber quem falou o quê mesmo
 * quando a narrativa por IA cai. Aqui não há interpretação — números contados, falas reais e o
 * minuto de cada uma. O que falta é a análise, e o texto diz isso na primeira linha.
 */
export function montarRelatorioFallback(
  a: SessionAnalysis,
  falas: FalaRow[],
  linkMinuto: (s: number) => string | null,
): string {
  const L: string[] = [];
  const q = (s: string) => `"${s.replace(/\s+/g, " ").trim().slice(0, 320)}"`;
  const marca = (s: number) => {
    const url = linkMinuto(s);
    return url ? `[${hhmmss(s)}](${url})` : hhmmss(s);
  };

  L.push(`# ${a.sessao.title}`);
  L.push(
    `> ⚙️ **Modo contingência.** A narrativa por IA ficou indisponível para esta sessão. Os números e as citações abaixo são reais e completos — o que falta é a leitura analítica, que volta ao reprocessar.`,
  );
  if (a.recorte.aplicado) {
    L.push(
      `> ✂️ **Recorte aplicado:** a sessão tem ${a.recorte.palavras_totais} palavras; ${a.recorte.falas_resumidas} falas curtas entraram truncadas.`,
    );
  }

  L.push(`\n## 📊 A sessão em números`);
  const cob = a.cobertura;
  L.push(
    `- **${cob.falas}** falas de **${cob.oradores}** oradores · **${cob.palavras}** palavras transcritas.`,
  );
  if (cob.primeiro_at_seconds !== null && cob.ultimo_at_seconds !== null) {
    L.push(
      `- Trecho coberto: de ${hhmmss(cob.primeiro_at_seconds)} a ${hhmmss(cob.ultimo_at_seconds)} de vídeo.`,
    );
  }
  L.push(
    `- Concentração: os 3 oradores mais longos somam **${a.participacao.concentracao_top3_pct}%** das palavras.`,
  );

  L.push(`\n## 🎙️ Tribuna por vereador`);
  for (const o of a.por_vereador) {
    const partido = o.partido ? ` (${o.partido})` : "";
    L.push(
      `- **${o.nome}**${partido} — ${o.falas} falas · ${o.palavras} palavras (${o.pct_palavras}%) · ~${Math.round(o.tempo_tribuna_seconds_aprox / 60)} min · primeira em ${marca(o.primeira_at_seconds)}.`,
    );
  }

  if (a.por_partido.length) {
    L.push(`\n## 🏛️ Por partido`);
    for (const p of a.por_partido) {
      L.push(
        `- **${p.partido}** — ${p.oradores} orador(es) · ${p.falas} falas · ${p.pct_palavras}% das palavras.`,
      );
    }
  }

  if (a.participacao.nao_falaram === null) {
    L.push(
      `\n> ℹ️ Sem cadastro de vereadores em Pessoas para comparar — não é possível dizer quem deixou de falar.`,
    );
  } else if (a.participacao.nao_falaram.length) {
    L.push(`\n## 🔇 Não falaram nesta sessão`);
    L.push(
      a.participacao.nao_falaram
        .map((p) => `- ${p.nome}${p.partido ? ` (${p.partido})` : ""}`)
        .join("\n"),
    );
  }

  // Uma citação literal por orador: a fala mais longa dele, que é a que carrega posição.
  L.push(`\n## 🗣️ Falas mais extensas (citação literal)`);
  const maiorPorOrador = new Map<string, FalaRow>();
  for (const f of falas) {
    const atual = maiorPorOrador.get(f.speaker_name);
    if (!atual || (f.word_count || 0) > (atual.word_count || 0))
      maiorPorOrador.set(f.speaker_name, f);
  }
  for (const o of a.por_vereador.slice(0, 10)) {
    const f = maiorPorOrador.get(o.nome);
    if (!f) continue;
    L.push(`\n**${o.nome}** — ${marca(f.at_seconds)}`);
    L.push(`> ${q(f.content)}`);
  }

  if (a.mencoes.length) {
    L.push(`\n## 🔗 Quem citou quem`);
    for (const m of a.mencoes.slice(0, 12)) {
      L.push(`- **${m.de}** citou **${m.para}** ${m.ocorrencias}×.`);
    }
  }

  L.push(`\n## ⚠️ Limite deste documento`);
  L.push(
    `A transcrição registra **falas**, não a ata: nada aqui afirma votação, resultado ou encaminhamento. Para o desfecho de cada matéria, conferir a ata oficial da sessão.`,
  );
  return L.join("\n");
}
