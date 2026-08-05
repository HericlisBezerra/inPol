/**
 * Parser da transcrição de sessão da Câmara (YouTube + diarização AssemblyAI).
 *
 * MÓDULO PURO DE PROPÓSITO — nenhum import de Supabase, `createServerFn` ou env.
 * É o que permite `scripts/test-camara-parser.mjs` importar direto e rodar o parser
 * contra o arquivo real sem subir metade do app. `camara.functions.ts` reexporta
 * tudo daqui, então quem consome continua importando de um lugar só.
 *
 * A diarização já resolve a parte difícil (atribuir a fala a alguém). O trabalho aqui
 * é estrutural: transformar linhas de texto em registros e, sobretudo, NÃO PERDER NADA
 * em silêncio — toda linha que não encaixa vira `aviso`, nunca um `continue` mudo.
 */

export type SpeakerRole = "presidente" | "vereador" | "convidado" | "desconhecido";

export type ParsedSpeech = {
  /** Posição na sessão, 0-based e contígua (reatribuída depois dos descartes). */
  orderIndex: number;
  atSeconds: number;
  /** Identificador original, sem o timestamp — é o que permite auditar o parser depois. */
  speakerRaw: string;
  speakerName: string;
  /**
   * Variantes do nome. A transcrição traz casos como `Ver. Zé Dias / José Dias (REP)`:
   * o gabinete registrou as duas grafias porque não sabe qual está na ficha. Guardamos
   * ambas para tentar as duas no vínculo com `org_people`.
   */
  speakerNames: string[];
  speakerParty: string | null;
  speakerRole: SpeakerRole;
  content: string;
  wordCount: number;
};

export type ParseResult = { falas: ParsedSpeech[]; avisos: string[] };

/**
 * `[HH:MM:SS]` ou `[MM:SS]`, seguido do identificador e de `:`.
 *
 * O identificador é `[^:]+` — nome de vereador não contém dois-pontos, e isso garante
 * que o corte aconteça no PRIMEIRO `:`, sem que um `:` no meio da fala confunda o split.
 * Horas com até 3 dígitos: sessão de 4h+ é rotina, e uma transcrição concatenada pode
 * passar de 99h sem que isso seja motivo para rejeitar a linha.
 */
const LINHA_FALA = /^\[(\d{1,3}):(\d{2})(?::(\d{2}))?\]\s*([^:]+?)\s*:\s*(.*)$/;

/** Sufixo entre parênteses no fim do identificador: `(PSD)`, `(convidada)`, `(fechamento…)`. */
const SUFIXO_PARENTESES = /\s*\(([^()]{1,60})\)\s*$/;

/** `Pres.`, `Ver.`, `Vereador(a)`, `Presidente` — o que define o papel institucional. */
const PREFIXO_CARGO = /^(pres\.?|presidente|ver\.?|vereadora?)\s+/i;

const MARCA_CONVIDADO = /^convidad[oa]s?$/i;

/**
 * Sigla de partido vs. descrição livre.
 *
 * Os dois usos do parêntese final são visualmente idênticos:
 *   `Ver. Faouaz Taha (PSD)`  →  partido
 *   `Convidado — moção dos bancos (fechamento de agências)`  →  descrição do assunto
 * O que separa é a CAIXA: sigla partidária é toda maiúscula e curta. Testar a caixa
 * ANTES de normalizar é o que evita gravar "fechamento de agências" na coluna `party`.
 */
const SIGLA_PARTIDO = /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9.\-\s]{0,11}$/;

/** Separador de aposto no identificador: `Giovana Silva Fernandes — Colégio MOVA`. */
const TRAVESSAO = /\s+[—–]\s+/;

/** Marcas diacríticas soltas (após NFD), para remover acento sem perder a letra base. */
const DIACRITICOS = /[̀-ͯ]/g;

/**
 * Tokens que não identificam ninguém. Ficam de fora da interseção do fallback porque
 * "de"/"da"/"dr" em comum não é evidência de ser a mesma pessoa — sem isso, duas fichas
 * distintas empatariam por partícula e o vínculo sairia errado com cara de acerto.
 */
const TOKENS_VAZIOS = new Set([
  "de",
  "da",
  "do",
  "dos",
  "das",
  "e",
  "dr",
  "dra",
  "sr",
  "sra",
  "jr",
  "filho",
  "neto",
]);

/**
 * Forma canônica para comparar nomes: sem acento, sem pontuação, minúsculo.
 *
 * É o coração do vínculo. A transcrição escreve "Carla Basílio" e a ficha tem
 * "CARLA BASILIO"; "Dika Xique Xique" na transcrição é "Dika Xique-Xique" na ficha.
 * Pontuação vira ESPAÇO (não some) para que o hífen de "Xique-Xique" produza dois
 * tokens, iguais aos da versão sem hífen.
 */
export function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tokens significativos do nome normalizado — base da comparação por interseção. */
export function tokensDoNome(valor: string): string[] {
  return normalizarNome(valor)
    .split(" ")
    .filter((t) => t.length > 1 && !TOKENS_VAZIOS.has(t));
}

/** `[HH:MM:SS]` → segundos. Aceita a forma curta `[MM:SS]`. */
function paraSegundos(a: string, b: string, c: string | undefined): number {
  return c === undefined
    ? Number(a) * 60 + Number(b)
    : Number(a) * 3600 + Number(b) * 60 + Number(c);
}

function contarPalavras(texto: string): number {
  const t = texto.trim();
  return t.length === 0 ? 0 : t.split(/\s+/).length;
}

function recorte(texto: string, max = 80): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Segundos → `H:MM:SS`, para avisos legíveis por quem vai conferir no vídeo. */
export function formatarTimestamp(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Identificacao = {
  nome: string;
  nomes: string[];
  partido: string | null;
  papel: SpeakerRole;
  aviso: string | null;
};

/**
 * Quebra o identificador em nome / partido / papel.
 *
 * A ordem importa: primeiro sai o parêntese do fim (senão ele entra no nome), depois o
 * prefixo de cargo (senão "Ver." vira token do nome e polui a comparação com a ficha).
 */
function interpretarIdentificacao(raw: string, linha: number): Identificacao {
  let texto = raw.trim();
  let partido: string | null = null;
  let papelSugerido: SpeakerRole | null = null;

  const sufixo = texto.match(SUFIXO_PARENTESES);
  if (sufixo && sufixo.index !== undefined) {
    const conteudo = sufixo[1].trim();
    if (MARCA_CONVIDADO.test(conteudo)) {
      papelSugerido = "convidado";
    } else if (SIGLA_PARTIDO.test(conteudo)) {
      partido = conteudo.toUpperCase();
    }
    // Terceiro caso — descrição livre em caixa baixa: não é partido nem papel. Sai do
    // nome, mas continua preservada em `speakerRaw`.
    texto = texto.slice(0, sufixo.index).trim();
  }

  let papel: SpeakerRole;
  const prefixo = texto.match(PREFIXO_CARGO);
  if (prefixo) {
    papel = /^pres/i.test(prefixo[1]) ? "presidente" : "vereador";
    texto = texto.slice(prefixo[0].length).trim();
  } else if (papelSugerido) {
    papel = papelSugerido;
  } else if (MARCA_CONVIDADO.test(texto.split(TRAVESSAO)[0].trim())) {
    // `Convidado — moção dos bancos`: o papel ocupa o lugar do nome.
    papel = "convidado";
  } else {
    // Sem prefixo e sem marca de convidado, o papel seria adivinhação — e adivinhar aqui
    // contamina qualquer estatística por cargo. Marca desconhecido e avisa.
    papel = "desconhecido";
  }

  const partes = texto.split(TRAVESSAO);
  const antesDoTravessao = partes[0].trim();

  // Quando o "nome" é só a palavra "Convidado", o aposto É a identificação útil
  // ("Convidado — moção dos bancos"): jogar o aposto fora deixaria falas de convidados
  // diferentes indistinguíveis entre si na tela.
  const base =
    MARCA_CONVIDADO.test(antesDoTravessao) && partes.length > 1 ? texto : antesDoTravessao;

  // `Zé Dias / José Dias`: duas grafias do mesmo falante. A primeira vira o nome exibido;
  // as duas seguem para a tentativa de vínculo.
  const variantes = base
    .split("/")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const nome = variantes[0] ?? "";
  let aviso: string | null = null;
  if (nome.length === 0) {
    aviso = `linha ${linha}: não foi possível extrair o nome de "${recorte(raw)}".`;
  } else if (papel === "desconhecido") {
    aviso =
      `linha ${linha}: "${nome}" sem prefixo de cargo (Pres./Ver.) nem marca de convidado — ` +
      `papel gravado como desconhecido.`;
  }

  return { nome, nomes: variantes, partido, papel, aviso };
}

/**
 * Converte a transcrição inteira em falas.
 *
 * Três classes de linha:
 *  1. bate em `LINHA_FALA` → nova fala;
 *  2. não bate, começa sem `[` e existe fala anterior → CONTINUAÇÃO (o texto quebrou em
 *     várias linhas); anexar em vez de criar fala nova preserva a contagem real;
 *  3. qualquer outra coisa → `aviso`. Nunca um descarte mudo: `transcript_raw` fica
 *     guardado no banco justamente para reprocessar quando um aviso revelar padrão novo.
 */
export function parseTranscript(raw: string): ParseResult {
  const avisos: string[] = [];
  const falas: ParsedSpeech[] = [];

  const linhas = raw.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const numero = i + 1;
    if (linha.trim().length === 0) continue;

    const m = linha.match(LINHA_FALA);
    if (m) {
      const ident = interpretarIdentificacao(m[4], numero);
      if (ident.aviso) avisos.push(ident.aviso);
      const conteudo = m[5].trim();
      falas.push({
        orderIndex: falas.length,
        atSeconds: paraSegundos(m[1], m[2], m[3]),
        speakerRaw: m[4].trim(),
        speakerName: ident.nome,
        speakerNames: ident.nomes,
        speakerParty: ident.partido,
        speakerRole: ident.papel,
        content: conteudo,
        wordCount: contarPalavras(conteudo),
      });
      continue;
    }

    // Começa com `[` mas não casou: é um cabeçalho deformado, não continuação de texto.
    // Tratar como continuação colaria essa fala na anterior e falsearia a atribuição.
    if (linha.trimStart().startsWith("[")) {
      avisos.push(
        `linha ${numero}: parece uma fala mas o cabeçalho não casou — "${recorte(linha)}".`,
      );
      continue;
    }

    const anterior = falas[falas.length - 1];
    if (!anterior) {
      avisos.push(
        `linha ${numero}: texto antes da primeira fala identificada — "${recorte(linha)}".`,
      );
      continue;
    }
    anterior.content = `${anterior.content} ${linha.trim()}`.trim();
    anterior.wordCount = contarPalavras(anterior.content);
  }

  // Fala sem texto é ruído (o falante foi anunciado, nada foi transcrito). Sai da lista —
  // com aviso e com o timestamp, para que dê para conferir no vídeo o que houve ali.
  const comTexto = falas.filter((f) => {
    if (f.content.length > 0) return true;
    avisos.push(
      `fala em ${formatarTimestamp(f.atSeconds)} de "${f.speakerRaw}" ficou sem conteúdo — descartada.`,
    );
    return false;
  });
  comTexto.forEach((f, idx) => {
    f.orderIndex = idx;
  });

  return { falas: comTexto, avisos };
}

/**
 * Extrai o id do vídeo do YouTube.
 *
 * O id (11 caracteres) é o que permite montar o link do MINUTO exato de cada fala
 * (`?v=<id>&t=<segundos>`) — sem ele a sessão vira texto solto, sem prova em vídeo.
 * Cobre `watch?v=`, `youtu.be/`, `embed/`, `live/` e `shorts/`, com querystring extra
 * antes ou depois.
 */
export function extrairVideoId(url: string | null | undefined): string | null {
  const padrao =
    /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|live\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const m = (url ?? "").match(padrao);
  return m ? m[1] : null;
}

export type CandidatoPessoa = { id: string; display_name: string };

export type ResolucaoNome = {
  personId: string | null;
  motivo: "exato" | "tokens" | "sem-candidato" | "ambiguo";
};

/**
 * Casa um nome da transcrição com uma ficha de `org_people`.
 *
 * Duas passadas, nessa ordem:
 *  1. igualdade da forma canônica (resolve acento, caixa e hífen — o caso comum);
 *  2. interseção de ≥2 tokens significativos, para grafias parciais ("Delegado Paulo
 *     Sérgio" na transcrição vs. "Paulo Sérgio" na ficha).
 *
 * Empate no fallback devolve `ambiguo` com `personId: null`. Chutar entre duas fichas
 * produziria um vínculo errado indistinguível de um certo — pior que não vincular, já que
 * `speaker_name` continua gravado e o vínculo dá para fazer à mão depois.
 */
export function resolverPessoa(nomes: string[], candidatos: CandidatoPessoa[]): ResolucaoNome {
  const indexado = candidatos.map((p) => ({
    id: p.id,
    canonico: normalizarNome(p.display_name),
    tokens: new Set(tokensDoNome(p.display_name)),
  }));

  for (const nome of nomes) {
    const canonico = normalizarNome(nome);
    if (canonico.length === 0) continue;
    const exatos = indexado.filter((p) => p.canonico === canonico);
    if (exatos.length === 1) return { personId: exatos[0].id, motivo: "exato" };
    if (exatos.length > 1) return { personId: null, motivo: "ambiguo" };
  }

  let melhor: { id: string; score: number } | null = null;
  let empatado = false;
  for (const nome of nomes) {
    const tokens = tokensDoNome(nome);
    if (tokens.length === 0) continue;
    for (const p of indexado) {
      const score = tokens.filter((t) => p.tokens.has(t)).length;
      if (score < 2) continue;
      if (!melhor || score > melhor.score) {
        melhor = { id: p.id, score };
        empatado = false;
      } else if (score === melhor.score && p.id !== melhor.id) {
        empatado = true;
      }
    }
  }

  if (!melhor) return { personId: null, motivo: "sem-candidato" };
  if (empatado) return { personId: null, motivo: "ambiguo" };
  return { personId: melhor.id, motivo: "tokens" };
}
