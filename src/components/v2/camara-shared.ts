/**
 * Formatadores e agregações do módulo Câmara, compartilhados entre a lista de sessões e a sessão.
 *
 * Os TIPOS não moram aqui: vêm de `@/lib/camara.functions`, que é o contrato de verdade. Uma
 * cópia local dos tipos daria a ilusão de campos que o servidor não devolve — que é a versão
 * silenciosa do mesmo erro que já derrubou esta tela (exibir o que não existe).
 */
import type { CamaraSessionFull, CamaraSessionRow, CamaraSpeechRow } from "@/lib/camara.functions";

/** Relógio do vídeo: `1:04:12` / `07:41`. É o que o usuário procura no YouTube. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duração legível para o cabeçalho ("2h47" / "48min"). */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

/**
 * O link para o MINUTO exato da fala. É a promessa central do módulo — por isso o `video_id` é
 * guardado à parte no banco: sem ele existe transcrição, mas não existe "vá ver a cena".
 * Retorna `null` quando não há vídeo vinculado, e quem chama mostra o horário sem link.
 */
export function youtubeAt(videoId: string | null, atSeconds: number): string | null {
  if (!videoId) return null;
  const t = Math.max(0, Math.floor(atSeconds));
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${t}s`;
}

/** `session_date` é `date` (YYYY-MM-DD): parsear como local evita o clássico "um dia antes". */
export function fmtSessionDate(
  date: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date);
  return d.toLocaleDateString("pt-BR", opts);
}

/** "62ª ordinária · 19ª legislatura" — só com o que a sessão de fato tem. */
export function sessionSubtitle(s: {
  numero: string | null;
  tipo: string | null;
  legislatura: string | null;
}): string {
  const head = [s.numero, s.tipo].filter(Boolean).join(" ");
  const leg = s.legislatura ? `${s.legislatura} legislatura` : null;
  return [head || null, leg].filter(Boolean).join(" · ");
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.slice(0, 1) ?? "";
  const second = parts[1]?.slice(0, 1) ?? parts[0]?.slice(1, 2) ?? "";
  return (first + second).toUpperCase();
}

/**
 * O relatório narrativo, normalizado.
 *
 * `markdown` só vem no detalhe (`getSession`) — a lista não o carrega de propósito, para não
 * trazer dezenas de KB por sessão. Por isso quem responde "já foi analisada?" na lista é
 * `analyzed_at`. Markdown em branco (string vazia, só espaços) conta como ausência: renderizar um
 * bloco "relatório da sessão" vazio sugeriria que a análise rodou e não achou nada a dizer.
 */
export function sessionReport(session: Partial<CamaraSessionFull> | null | undefined): {
  markdown: string | null;
  analyzedAt: string | null;
} {
  const md = session?.markdown?.trim() ? session.markdown : null;
  return { markdown: md, analyzedAt: session?.analyzed_at ?? null };
}

/** Participação de um falante na sessão — sempre contável, nunca estimada. */
export type SpeakerStat = {
  key: string;
  name: string;
  party: string | null;
  role: string | null;
  personId: string | null;
  speeches: number;
  words: number;
};

/**
 * Quem falou, e quanto.
 *
 * A fonte é a lista de falas — linhas contadas, não texto gerado. O servidor guarda o mesmo
 * agregado em `analysis.speakers` (também contado), mas ele não vem no contrato de leitura, e
 * mesmo que viesse esta contagem é a que o usuário confere rolando a transcrição logo abaixo.
 * Número que a tela ao lado desmente é pior que número ausente.
 */
export function speakerStats(speeches: CamaraSpeechRow[]): SpeakerStat[] {
  const by = new Map<string, SpeakerStat>();
  for (const sp of speeches) {
    const key = speakerKey(sp);
    const cur = by.get(key);
    if (cur) {
      cur.speeches += 1;
      cur.words += sp.word_count;
      cur.party = cur.party ?? sp.speaker_party;
    } else {
      by.set(key, {
        key,
        name: sp.speaker_name,
        party: sp.speaker_party,
        role: sp.speaker_role,
        personId: sp.person_id,
        speeches: 1,
        words: sp.word_count,
      });
    }
  }
  return [...by.values()].sort((a, b) => b.words - a.words || b.speeches - a.speeches);
}

/**
 * Chave de agrupamento de uma fala — a mesma em `speakerStats` e no filtro da transcrição, senão
 * clicar num nome no painel de participação não selecionaria as falas correspondentes.
 *
 * Agrupa por vínculo quando existe: o mesmo vereador transcrito com grafias diferentes
 * ("Ver. Fulano" / "Fulano de Tal") é uma pessoa só se as duas falas apontam a mesma ficha.
 */
export function speakerKey(sp: CamaraSpeechRow): string {
  return sp.person_id ?? `nome:${sp.speaker_name.trim().toLowerCase()}`;
}

export type { CamaraSessionFull, CamaraSessionRow, CamaraSpeechRow };
