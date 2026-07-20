// Sanitização LGPD de relatório para exposição PÚBLICA (rota /r/$token). MÓDULO PURO, sem I/O.
//
// Os relatórios citam mensagens reais de cidadãos entre aspas. Antes de qualquer link público,
// removemos PII identificável do markdown: telefones, horários exatos e nomes de grupos (todos
// determinísticos aqui). Nomes de PESSOAS FÍSICAS ficam com o passe LLM (report-sanitize.server.ts),
// mas a saída dele volta a passar por AQUI (re-scan) como cinto-e-suspensório.
//
// PRESERVAR (allowlist): bairros, temas e adversários (termos públicos do org_vocabulary) — nunca
// são PII. Passados em `allowTerms` para evitar redigir, p.ex., um bairro cujo nome coincida com
// um nome de grupo.
//
// Garantias: idempotente (rodar 2× dá o mesmo texto — os marcadores não voltam a casar) e
// conservador (na dúvida, redige; falso-positivo é corrigido pelo revisor humano, falso-negativo
// vaza dado de cidadão).

export type RedactionKind = "phone" | "time" | "group" | "name";

export type Redaction = {
  kind: RedactionKind;
  original: string;
  replacement: string;
};

export type SanitizeOptions = {
  /** Nomes de grupos (whatsapp_groups + sources.label) a redigir por match case-insensitive. */
  groupNames?: string[];
  /** Termos públicos a PRESERVAR (bairros/temas/adversários do org_vocabulary). */
  allowTerms?: string[];
};

export type SanitizeResult = {
  text: string;
  redactions: Redaction[];
};

export const REDACTION_MARK: Record<RedactionKind, string> = {
  phone: "[contato removido]",
  time: "[horário removido]",
  group: "[grupo removido]",
  name: "[nome removido]",
};

/** Todos os marcadores, para o guard de idempotência e para o passe LLM não os tocar. */
export const ALL_REDACTION_MARKS: string[] = Object.values(REDACTION_MARK);

// ── Telefones BR ────────────────────────────────────────────────────────────
// Detecção por FORMA + separador tolerante (não por formato fixo): o vetor "hard" de PII é o
// telefone, e cidadãos escrevem em mil grafias no WhatsApp ("11 9 8765 4321", "+55 (11) 9 8765-4321",
// "11.9.8765.4321", "41,98765,4321", "11 98765—4321"). SEP aceita 1 separador de classe ampla
// (espaço, . , - – — /) entre grupos. O núcleo é DDI?+DDD?+9º?+ \d{4} SEP \d{4} (ou 0800). O
// filtro de dígitos (9–13) depois descarta faixas de ano "2021-2024" (8) e CEP/estatísticas.
const SEP = "[\\s.,\\-–—/]?";
const PHONE_RE = new RegExp(
  "(?<!\\d)(?:" +
    `(?:\\+?55${SEP})?(?:\\(?\\d{2}\\)?${SEP})?(?:9${SEP})?\\d{4}${SEP}\\d{4}` +
    `|0800${SEP}\\d{3}${SEP}\\d{4}` +
    ")(?!\\d)",
  "g",
);

// ── Horários exatos ─────────────────────────────────────────────────────────
// HH:MM e HHhMM/HHhMM (00:00–23:59), case-insensitive ("19H30" também). Coarsen para período do
// dia — remove o minuto exato, que é o vetor de identificação combinado a um grupo pequeno.
const TIME_RE = /(?<![\dhH:])([01]?\d|2[0-3])[:hH][0-5]\d(?![\d])/g;

function periodOf(hour: number): string {
  if (hour <= 5) return "de madrugada";
  if (hour <= 11) return "de manhã";
  if (hour <= 17) return "à tarde";
  return "à noite";
}

// ── Utilitários ─────────────────────────────────────────────────────────────
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Conta dígitos — usado para descartar "telefones" curtos demais (ruído). */
function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

// Classes de acento por letra base — casa "Jose" com "José", "Antonio" com "Antônio" etc.
const ACCENT_CLASS: Record<string, string> = {
  a: "aàáâãä",
  e: "eéêèë",
  i: "iíîìï",
  o: "oóôõòö",
  u: "uúûùü",
  c: "cç",
  n: "nñ",
};

/** Fonte de regex acento-insensível para um literal: cada vogal/ç/ñ vira classe (com flag `i`,
 *  cobre maiúsculas); o resto é escapado. Casa "José"↔"Jose", "Conceição"↔"Conceicao". */
function accentInsensitiveSource(s: string): string {
  return [...s]
    .map((ch) => {
      const cls = ACCENT_CLASS[ch.toLowerCase()];
      return cls ? `[${cls}]` : escapeRegExp(ch);
    })
    .join("");
}

/**
 * Sanitiza um markdown de relatório para exposição pública. Determinístico:
 * telefone, horário e nome de grupo. NÃO trata nome de pessoa (é do passe LLM),
 * mas é seguro rodar sobre a saída do LLM (re-scan/idempotência).
 */
export function sanitizeReportMarkdown(md: string, opts: SanitizeOptions = {}): SanitizeResult {
  const redactions: Redaction[] = [];
  const allow = new Set((opts.allowTerms ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean));
  let text = md;

  // 1) Telefones — 9 a 13 dígitos: celular sem DDD (9), fixo c/ DDD (10), celular c/ DDD (11),
  //    com DDI (12-13). Piso 9 (não 8) evita colidir com faixas de ano "2021-2024" (8 dígitos).
  text = text.replace(PHONE_RE, (match) => {
    const n = digitCount(match);
    if (n < 9 || n > 13) return match; // não é telefone — deixa passar
    redactions.push({ kind: "phone", original: match, replacement: REDACTION_MARK.phone });
    return REDACTION_MARK.phone;
  });

  // 2) Horários exatos → período do dia (case-insensitive: "06:12", "19h44", "19H30").
  text = text.replace(TIME_RE, (match) => {
    const hour = parseInt(match.split(/[:hH]/)[0], 10);
    const replacement = periodOf(hour);
    redactions.push({ kind: "time", original: match, replacement });
    return replacement;
  });

  // 3) Nomes de grupos (denylist), do mais longo pro mais curto pra não cortar substring.
  const names = [
    ...new Set((opts.groupNames ?? []).map((g) => g.trim()).filter((g) => g.length >= 4)),
  ]
    .filter((g) => !allow.has(g.toLowerCase())) // um bairro/tema público nunca é redigido
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(escapeRegExp(name), "gi");
    text = text.replace(re, (match) => {
      redactions.push({ kind: "group", original: match, replacement: REDACTION_MARK.group });
      return REDACTION_MARK.group;
    });
  }

  return { text, redactions };
}

/**
 * Aplica redação de NOMES DE PESSOAS FÍSICAS. As `names` vêm do passe LLM (NER), mas a
 * SUBSTITUIÇÃO é feita aqui, deterministicamente — o LLM nunca reescreve o documento (evita
 * truncar/mangling). Filtra a allowlist (figuras públicas nunca são redigidas) e nomes curtos.
 *
 * Robustez (P2-5): expande cada nome retornado nos seus tokens ≥4 chars ("João Silva" também
 * redige "João" e "Silva" soltos noutro parágrafo) e casa acento-insensível (NER devolve "Jose",
 * texto tem "José"). Fronteira por letra Unicode (`\p{L}`) para não cortar dentro de palavra.
 */
export function redactNames(
  text: string,
  names: string[],
  allowTerms: string[] = [],
): SanitizeResult {
  const allow = new Set(allowTerms.map((t) => t.trim().toLowerCase()).filter(Boolean));

  // Expande nome completo + tokens ≥4 chars; filtra allowlist e duplicatas; mais longo primeiro.
  const expanded = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name.length >= 3) expanded.add(name);
    for (const tok of name.split(/\s+/)) {
      if (tok.length >= 4) expanded.add(tok);
    }
  }
  const clean = [...expanded]
    .filter((n) => !allow.has(n.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  const redactions: Redaction[] = [];
  let out = text;
  for (const name of clean) {
    const re = new RegExp(`(?<!\\p{L})${accentInsensitiveSource(name)}(?!\\p{L})`, "giu");
    out = out.replace(re, () => {
      redactions.push({ kind: "name", original: name, replacement: REDACTION_MARK.name });
      return REDACTION_MARK.name;
    });
  }
  return { text: out, redactions };
}

/** Resumo por tipo, para a UI de revisão ("8 nomes · 3 telefones · …"). */
export function summarizeRedactions(redactions: Redaction[]): Record<RedactionKind, number> {
  const acc: Record<RedactionKind, number> = { phone: 0, time: 0, group: 0, name: 0 };
  for (const r of redactions) acc[r.kind] += 1;
  return acc;
}

/**
 * Guard de runtime: existe telefone remanescente no texto? A rota pública usa isto como
 * última linha de defesa (nunca deveria disparar se o pipeline rodou). Barato e sem estado.
 */
export function hasResidualPhone(text: string): boolean {
  const matches = text.match(PHONE_RE) ?? [];
  return matches.some((m) => {
    const n = digitCount(m);
    return n >= 10 && n <= 13;
  });
}
