// L0 — camada matemática/determinística da micro-análise (PURA, sem I/O).
// Classifica por REGRA as mensagens de alta confiança para pular a IA (corte de custo) e dar um
// piso determinístico e consistente. É CONSERVADORA: só resolve quando o sinal é inequívoco;
// qualquer ambiguidade (adversário citado, sentimento misto, tema incerto, texto longo) → null,
// e o chamador manda pra IA (DeepSeek). Nunca inventa: só usa léxico + vocabulário já casado.

import type { AnalysisOutput } from "./analysis.server";

/** Saída do matchVocabulary (src/lib/ingest.server.ts). */
export type VocabMatches = {
  neighborhood: string[];
  opponent: string[];
  ally: string[];
  department: string[];
  facility: string[];
  sensitive_term: string[];
  focus_term: string[];
};

export type HeuristicResult = Omit<AnalysisOutput, "id">;

// Léxico PT-BR curado (pequeno e de alta precisão). Termos já normalizados (sem acento).
const NEG = [
  "descaso",
  "abandono",
  "abandonado",
  "pessimo",
  "horrivel",
  "vergonha",
  "vergonhoso",
  "absurdo",
  "revoltante",
  "revoltado",
  "indignado",
  "indignacao",
  "caos",
  "precario",
  "precaria",
  "sucateado",
  "sucateada",
  "alagou",
  "alagamento",
  "alagando",
  "enchente",
  "inundacao",
  "buraco",
  "buracos",
  "lixo",
  "entulho",
  "esgoto",
  "fedor",
  "fila",
  "filas",
  "demora",
  "demorou",
  "espera",
  "sem resposta",
  "nao aparece",
  "nao aparecem",
  "nao resolve",
  "nao resolvem",
  "nao adianta",
  "descarado",
  "roubo",
  "roubalheira",
  "corrupcao",
  "mentira",
  "mentiroso",
  "incompetente",
  "incompetencia",
  "lamentavel",
  "calamidade",
  "reclamacao",
  "reclamando",
  "protesto",
  "cade",
  "ninguem faz",
  "um horror",
  "que horror",
  "ta um caos",
  "nao aguento",
  "pessimo servico",
  "total descaso",
  "fechada",
  "fechou",
  "fechado",
  "cancelou",
  "cancelado",
  "atrasou",
  "atraso",
  "atrasado",
  "suspenso",
  "suspensa",
  "faltou",
  "interditado",
  "interditada",
  "quebrado",
  "quebrada",
  "acabou",
  "nao funciona",
  "nao tem",
  "sem luz",
  "sem agua",
];
const POS = [
  "otimo",
  "otima",
  "excelente",
  "excelentes",
  "parabens",
  "maravilha",
  "maravilhoso",
  "adorei",
  "gostei",
  "melhorou",
  "melhoria",
  "obrigado",
  "obrigada",
  "agradeco",
  "agradecemos",
  "elogio",
  "elogiar",
  "top",
  "show",
  "perfeito",
  "perfeita",
  "funcionou",
  "funcionando",
  "resolveu",
  "resolvido",
  "rapido",
  "eficiente",
  "eficiencia",
  "que bom",
  "muito bom",
  "muito boa",
  "ficou otimo",
  "ficou lindo",
  "sensacional",
  "impecavel",
  "nota dez",
];

// Palavra→tema (slug compatível com o prompt da IA). Ordem = prioridade.
const TOPICS: Array<{ topic: string; words: string[] }> = [
  {
    topic: "enchentes",
    words: ["enchente", "alag", "inunda", "drenagem", "boca de lobo", "chuva forte", "transbord"],
  },
  {
    topic: "saude",
    words: [
      "ubs",
      "posto de saude",
      "hospital",
      "upa",
      "saude",
      "remedio",
      "medico",
      "medica",
      "consulta",
      "vacina",
      "agendamento",
      "samu",
    ],
  },
  {
    topic: "educacao",
    words: [
      "escola",
      "creche",
      "educacao",
      "professor",
      "professora",
      "merenda",
      "matricula",
      "vaga na creche",
    ],
  },
  {
    topic: "seguranca",
    words: [
      "seguranca",
      "assalto",
      "roubo",
      "furto",
      "tiroteio",
      "violencia",
      "policia",
      "trafico",
    ],
  },
  {
    topic: "transito",
    words: ["transito", "semaforo", "acidente", "batida", "engarrafamento", "sinalizacao"],
  },
  {
    topic: "transporte",
    words: ["onibus", "transporte", "tarifa", "ponto de onibus", "linha de onibus", "terminal"],
  },
  {
    topic: "mobilidade",
    words: ["ciclovia", "bicicleta", "calcada", "mobilidade", "faixa de pedestre"],
  },
  {
    topic: "limpeza_urbana",
    words: ["lixo", "limpeza", "entulho", "varricao", "coleta", "capina", "mato alto"],
  },
  {
    topic: "obras",
    words: [
      "obra",
      "obras",
      "asfalto",
      "recape",
      "calcamento",
      "pavimenta",
      "buraco na rua",
      "tapa buraco",
    ],
  },
  {
    topic: "iluminacao",
    words: ["iluminacao", "poste", "lampada", "luz apagada", "sem luz na rua"],
  },
  { topic: "tributos", words: ["iptu", "imposto", "taxa", "tributo", "carne do iptu"] },
  { topic: "habitacao", words: ["habitacao", "moradia", "despejo", "aluguel social", "ocupacao"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Fronteira de palavra (como matchVocabulary) — evita casar "top" dentro de "utopico".
function termHit(norm: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`).test(norm);
}
function countHits(norm: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (termHit(norm, w)) n++;
  return n;
}
function uniq<T>(a: T[]): T[] {
  return [...new Set(a)];
}
function detectTopic(norm: string, matches: VocabMatches): string | null {
  // Substring aqui de propósito: TOPICS usa prefixos ("alag"→alagou/alagamento, "inunda", "transbord").
  for (const t of TOPICS) if (t.words.some((w) => norm.includes(w))) return t.topic;
  // Sem palavra-chave direta, um equipamento/depto do vocabulário dá uma pista fraca de tema:
  if (matches.facility.length > 0 || matches.department.length > 0) return "servicos_publicos";
  return null;
}
function firstSentence(text: string): string {
  const m = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

/**
 * Classifica por regra ou devolve null (= precisa de IA). CONSERVADORA por construção:
 * exige sentimento unilateral e forte + tema claro + sem adversário citado + tamanho razoável.
 */
export function preClassify(
  content: string,
  matches: VocabMatches,
  sourceKind: string | null,
): HeuristicResult | null {
  const text = (content ?? "").trim();
  if (text.length < 8 || text.length > 600) return null; // curto demais / provável artigo → IA
  if (matches.opponent.length > 0) return null; // narrativa de adversário → precisa de nuance

  const norm = normalize(text);
  const neg = countHits(norm, NEG);
  const pos = countHits(norm, POS);

  let sentiment: number;
  if (neg >= 2 && pos === 0) sentiment = neg >= 4 ? -0.85 : -0.65;
  else if (pos >= 2 && neg === 0) sentiment = pos >= 4 ? 0.8 : 0.6;
  else return null; // sentimento misto/fraco → IA

  const topic = detectTopic(norm, matches);
  if (!topic) return null; // sem tema claro → IA

  const isExternal = ["news", "instagram", "facebook", "x"].includes(sourceKind ?? "");
  const hasSensitive = matches.sensitive_term.length > 0;
  const hasFocus = matches.focus_term.length > 0;

  // Risco BASE apenas. Os boosts (sensitive/focus/external) são aplicados UMA vez em
  // buildAnalysisRow (ingest.server.ts), igual ao caminho de IA — não reaplicar aqui (senão
  // as linhas L0 inflariam o risco e cruzariam o limiar de alerta indevidamente).
  const risk = Math.max(0, Math.min(100, sentiment < 0 ? 45 + (neg >= 4 ? 20 : 0) : 5));

  const intensity = Math.min(
    1,
    Math.round(
      (Math.abs(sentiment) + (/!/.test(text) ? 0.1 : 0) + (neg + pos >= 5 ? 0.1 : 0)) * 100,
    ) / 100,
  );

  return {
    sentiment,
    intensity,
    topic,
    subtopic: matches.facility[0] ?? null,
    neighborhood: matches.neighborhood[0] ?? null,
    mentioned_opponents: [], // caminho com adversário já foi deferido à IA acima
    mentioned_allies: uniq(matches.ally),
    mentioned_entities: uniq([
      ...matches.focus_term,
      ...matches.facility,
      ...matches.department,
      ...matches.sensitive_term,
    ]),
    is_actionable: sentiment < 0 || hasFocus || hasSensitive || isExternal,
    risk_score: risk,
    summary: firstSentence(text).slice(0, 140),
  };
}
