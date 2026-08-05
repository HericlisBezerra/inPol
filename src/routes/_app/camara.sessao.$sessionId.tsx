import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyzeSessionNow, getSession, type GetSessionResult } from "@/lib/camara.functions";
import { BlindNote, BlindTag, BlindValue } from "@/components/v2/empty-signal";
import { PersonSheet } from "@/components/v2/person-sheet";
import { PROSE } from "@/components/v2/prose";
import {
  fmtClock,
  fmtDuration,
  fmtSessionDate,
  initialsOf,
  sessionReport,
  sessionSubtitle,
  speakerKey,
  speakerStats,
  youtubeAt,
  type CamaraSessionRow,
  type CamaraSpeechRow,
} from "@/components/v2/camara-shared";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/camara/sessao/$sessionId")({
  head: () => ({ meta: [{ title: "Sessão da Câmara — Inpol v2" }] }),
  component: Screen,
});

/**
 * S14b — Sessão da Câmara.
 *
 * É aqui que "cada sessão vira inteligência" acontece ou não acontece. Três camadas, na ordem em
 * que a reunião precisa delas: o relatório (o que aconteceu), quem falou (quanto cada um ocupou o
 * plenário) e a transcrição navegável (a prova — com o minuto do vídeo em cada fala).
 *
 * Tudo nesta tela sai de `camara_sessions` / `camara_speeches`. Nada é ilustrativo: o histórico
 * desta tela é justamente ter exibido uma sessão inteira fabricada, e a lição foi que num painel
 * de inteligência o dado inventado é pior que o dado ausente.
 */
function Screen() {
  const { sessionId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [sheetId, setSheetId] = useState<string | null | undefined>(undefined);

  const qc = useQueryClient();

  // Gera o relatório sob demanda. É explícito (botão) e não automático na abertura: a análise
  // custa uma chamada de IA sobre a sessão inteira, e abrir a transcrição para consultar um
  // minuto não deveria disparar isso.
  const analisar = useMutation({
    mutationFn: () => analyzeSessionNow({ data: { orgId: orgId as string, sessionId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["camara-session", orgId, sessionId] });
      qc.invalidateQueries({ queryKey: ["camara-sessions", orgId] });
      // `degraded` = a IA falhou e o relatório saiu do fallback determinístico. O usuário
      // precisa saber que está lendo números sem narrativa, não um relatório completo.
      if (r?.degraded) toast.warning("Relatório gerado sem narrativa da IA (modo contingência).");
      else toast.success("Relatório da sessão gerado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao analisar a sessão"),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["camara-session", orgId, sessionId],
    // O cast existe porque `camara_sessions.analysis` é `unknown` no contrato, e o validador de
    // serialização do server fn colapsa o retorno inteiro para `{}` por causa dele. `GetSessionResult`
    // é o tipo que o próprio módulo declara — some quando `analysis` ganhar um tipo concreto.
    queryFn: async () =>
      (await getSession({ data: { orgId: orgId as string, sessionId } })) as GetSessionResult,
    enabled: !!orgId,
  });

  const session = data?.session ?? null;
  const speeches = useMemo(() => data?.speeches ?? [], [data]);
  const report = sessionReport(session);

  /**
   * Participação contada das falas, não lida de `analysis`. As duas são contagens exatas (o banco
   * guarda `analysis` como agregado contado, nunca gerado por IA), mas só esta traz o `person_id`
   * de cada falante — que é o que liga a linha à ficha — e só ela é conferível rolando a
   * transcrição logo abaixo. Número que a tela ao lado desmente é pior que número ausente.
   */
  const stats = useMemo(() => speakerStats(speeches), [speeches]);
  const totalWords = useMemo(() => stats.reduce((s, x) => s + x.words, 0), [stats]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return speeches.filter((sp) => {
      if (speakerFilter && speakerKey(sp) !== speakerFilter) return false;
      if (q && !sp.content.toLowerCase().includes(q) && !sp.speaker_name.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [speeches, speakerFilter, term]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/camara" className="text-[13px] text-v2-ink-3 hover:text-v2-ink">
          ← Câmara
        </Link>
      </div>

      {!orgId && <div className="mt-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>}
      {orgId && isLoading && (
        <div className="mt-6 text-[13px] text-v2-ink-3">Carregando a sessão…</div>
      )}
      {orgId && isError && (
        <div className="mt-6 text-[13px] text-v2-crit">
          Não foi possível carregar a sessão. Tente novamente.
        </div>
      )}
      {orgId && !isLoading && !isError && !session && (
        <div className="mt-6 text-[13px] text-v2-ink-3">
          Sessão não encontrada.{" "}
          <Link to="/camara" className="font-semibold text-v2-green">
            Voltar
          </Link>
        </div>
      )}

      {session && (
        <>
          <SessionHeader
            session={session}
            speechCount={speeches.length}
            totalSpeakers={stats.length}
            linkedSpeakers={stats.filter((s) => s.personId).length}
          />

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* Relatório da sessão — texto real da IA, tipografia de leitura. */}
            <div className="self-start rounded-[13px] border border-v2-line bg-v2-card px-[26px] py-[22px]">
              {report.markdown ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded bg-v2-green-tint px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-v2-green">
                      relatório da sessão
                    </span>
                    {report.analyzedAt && (
                      <span className="font-mono text-[10.5px] text-v2-faint">
                        analisada em{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(report.analyzedAt))}
                      </span>
                    )}
                  </div>
                  <article className={PROSE}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
                  </article>
                </>
              ) : (
                <div className="flex flex-col items-start gap-2 py-6">
                  <BlindTag>sessão ainda não analisada</BlindTag>
                  <div className="text-[15px] font-[650] text-v2-ink">
                    A transcrição está importada; o relatório não foi gerado
                  </div>
                  <p className="max-w-[460px] text-[12.5px] leading-normal text-v2-ink-2">
                    Nenhum texto de análise foi produzido para esta sessão até agora — o que existe
                    é a transcrição abaixo, com as falas e os minutos. Nada aqui é resumido
                    automaticamente para preencher o espaço.
                  </p>
                  <button
                    type="button"
                    onClick={() => analisar.mutate()}
                    disabled={analisar.isPending}
                    className="mt-1 rounded-lg bg-v2-green px-3.5 py-2 text-[12.5px] font-[650] text-white transition-colors hover:bg-v2-green-hover disabled:opacity-50"
                  >
                    {analisar.isPending ? "Analisando a sessão…" : "Gerar relatório da sessão"}
                  </button>
                </div>
              )}
            </div>

            {/* Quem falou — ocupação real do plenário. */}
            <div className="self-start rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
                  QUEM FALOU
                </span>
                <span className="font-mono text-[10.5px] text-v2-faint">
                  {stats.length} {stats.length === 1 ? "voz" : "vozes"}
                </span>
              </div>

              {stats.length === 0 ? (
                <p className="mt-3 text-[12.5px] leading-normal text-v2-ink-2">
                  Nenhuma fala foi reconhecida nesta sessão — não há como medir participação.
                </p>
              ) : (
                <div className="mt-3 flex flex-col">
                  {stats.map((s) => {
                    const pct = totalWords > 0 ? Math.round((s.words / totalWords) * 100) : 0;
                    const active = speakerFilter === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        // A participação também é o filtro da transcrição: clicar num nome é a
                        // pergunta que a sala faz ("o que ele falou?"), e a resposta está logo
                        // abaixo.
                        onClick={() => setSpeakerFilter(active ? null : s.key)}
                        className={`flex items-center gap-2.5 border-b border-v2-track py-2 text-left last:border-b-0 ${
                          active ? "bg-v2-green-tint/40" : ""
                        }`}
                      >
                        <span className="grid h-[28px] w-[28px] flex-none place-items-center rounded-full bg-v2-track text-[10px] font-semibold text-v2-ink-3">
                          {initialsOf(s.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-v2-ink">
                            {s.name}
                            {s.party && (
                              <span className="ml-1.5 font-mono text-[10.5px] text-v2-ink-3">
                                {s.party}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-v2-track">
                            <span
                              className="block h-full rounded-full bg-v2-green"
                              style={{ width: `${Math.max(3, pct)}%` }}
                            />
                          </span>
                        </span>
                        <span className="w-[92px] flex-none text-right font-mono text-[10.5px] text-v2-ink-3">
                          {s.speeches} {s.speeches === 1 ? "fala" : "falas"}
                          <br />
                          {s.words.toLocaleString("pt-BR")} palavras
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <BlindNote className="mt-2.5">
                Falas e palavras são contadas da transcrição. Tempo de tribuna por vereador não é
                medido — a transcrição marca quando a fala começa, não quando termina.
              </BlindNote>
            </div>
          </div>

          {/* Transcrição navegável */}
          <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-v2-line px-[18px] py-3">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
                  TRANSCRIÇÃO
                </span>
                <span className="font-mono text-[10.5px] text-v2-faint">
                  {filtered.length === speeches.length
                    ? `${speeches.length} falas`
                    : `${filtered.length} de ${speeches.length} falas`}
                </span>
                {speakerFilter && (
                  <button
                    type="button"
                    onClick={() => setSpeakerFilter(null)}
                    className="text-[12px] font-[650] text-v2-green"
                  >
                    limpar filtro ×
                  </button>
                )}
              </div>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="buscar na transcrição…"
                className="w-[220px] rounded-lg border border-v2-line bg-v2-bg px-3 py-1.5 text-[12.5px] text-v2-ink placeholder:text-v2-faint focus:border-v2-green focus:outline-none"
              />
            </div>

            {speeches.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <BlindTag>sem falas reconhecidas</BlindTag>
                <p className="max-w-[420px] text-[12.5px] leading-normal text-v2-ink-2">
                  A sessão foi importada, mas o parser não reconheceu nenhuma fala no texto. Reveja
                  o formato da transcrição (cada fala precisa de horário e nome de quem fala) e
                  importe de novo.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-[18px] py-10 text-center text-[12.5px] text-v2-ink-2">
                Nenhuma fala corresponde ao filtro.
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((sp) => (
                  <SpeechRow
                    key={sp.id}
                    speech={sp}
                    videoId={session.video_id}
                    onOpenPerson={setSheetId}
                  />
                ))}
              </div>
            )}
          </div>

          {orgId && sheetId !== undefined && (
            <PersonSheet orgId={orgId} personId={sheetId} onClose={() => setSheetId(undefined)} />
          )}
        </>
      )}
    </div>
  );
}

/* ── cabeçalho ───────────────────────────────────────────────── */

function SessionHeader({
  session,
  speechCount,
  totalSpeakers,
  linkedSpeakers,
}: {
  session: CamaraSessionRow;
  speechCount: number;
  /** Contados das falas (mesma fonte do bloco "quem falou"), não de agregado do servidor. */
  totalSpeakers: number;
  linkedSpeakers: number;
}) {
  const sub = sessionSubtitle(session);
  return (
    <div className="mt-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-v2-obs-bg px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-v2-faint">
          sessão da câmara
        </span>
        <span className="font-mono text-[11.5px] text-v2-ink-3">
          {fmtSessionDate(session.session_date, {
            weekday: "short",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          {sub ? ` · ${sub}` : ""}
        </span>
      </div>
      <h1 className="mt-2 max-w-[820px] text-[28px] font-semibold leading-[1.2] tracking-tight text-v2-ink">
        {session.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        <span className="text-v2-ink-2">
          <strong className="font-[650] text-v2-ink">{speechCount}</strong>{" "}
          {speechCount === 1 ? "fala" : "falas"} transcritas
        </span>
        <span className="text-v2-ink-2">
          <strong className="font-[650] text-v2-ink">{linkedSpeakers}</strong> de {totalSpeakers}{" "}
          falantes com ficha vinculada
        </span>
        <span className="text-v2-ink-2">
          duração:{" "}
          {session.duration_seconds != null ? (
            <strong className="font-[650] text-v2-ink">
              {fmtDuration(session.duration_seconds)}
            </strong>
          ) : (
            <BlindValue why="não informada na importação" />
          )}
        </span>
        {session.video_url ? (
          <a
            href={session.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-[650] text-v2-green hover:text-v2-green-hover"
          >
            ▶ abrir o vídeo no YouTube
          </a>
        ) : (
          // Sem vídeo, o produto perde o "vá ver a cena" — a tela diz isso em vez de esconder.
          <span className="text-v2-ink-2">
            vídeo: <BlindValue why="sessão importada sem URL do vídeo" />
          </span>
        )}
      </div>
    </div>
  );
}

/* ── fala ────────────────────────────────────────────────────── */

function SpeechRow({
  speech,
  videoId,
  onOpenPerson,
}: {
  speech: CamaraSpeechRow;
  videoId: string | null;
  onOpenPerson: (personId: string) => void;
}) {
  const href = youtubeAt(videoId, speech.at_seconds);
  const clock = fmtClock(speech.at_seconds);
  return (
    <div className="flex gap-3.5 border-b border-v2-track px-[18px] py-3.5 last:border-b-0">
      {/* O minuto clicável: abre o vídeo no segundo exato da fala. Sem `video_id` o horário
          continua visível (é informação da transcrição), só não vira link. */}
      <div className="w-[62px] flex-none pt-0.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="abrir o vídeo neste minuto"
            className="font-mono text-[12px] font-[650] text-v2-green hover:text-v2-green-hover"
          >
            ▶ {clock}
          </a>
        ) : (
          <span
            className="font-mono text-[12px] text-v2-ink-3"
            title="sem vídeo vinculado a esta sessão"
          >
            {clock}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {speech.person_id ? (
            // Com vínculo, o nome leva à ficha única (org_people) — a mesma pessoa do WhatsApp
            // e do TSE, nunca um cadastro paralelo de vereadores.
            <button
              type="button"
              onClick={() => onOpenPerson(speech.person_id as string)}
              className="text-[13.5px] font-[650] text-v2-ink hover:text-v2-green"
            >
              {speech.speaker_name}
            </button>
          ) : (
            <span className="text-[13.5px] font-[650] text-v2-ink">{speech.speaker_name}</span>
          )}
          {speech.speaker_party && (
            <span className="rounded bg-v2-track px-1.5 py-[1px] font-mono text-[10px] text-v2-ink-3">
              {speech.speaker_party}
            </span>
          )}
          {speech.speaker_role && speech.speaker_role !== "vereador" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-v2-faint">
              {speech.speaker_role}
            </span>
          )}
          {!speech.person_id && (
            // Falta de vínculo é estado normal (convidado), não falha: dito baixo, sem alarme.
            <span className="font-mono text-[10px] text-v2-faint" title="sem ficha vinculada">
              sem ficha
            </span>
          )}
          {speech.topic && (
            <span className="rounded bg-v2-obs-bg px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-[0.06em] text-v2-obs">
              {speech.topic}
            </span>
          )}
          {speech.risk_score != null && speech.risk_score >= 50 && (
            <span
              className={`font-mono text-[10px] font-semibold ${
                speech.risk_score >= 80 ? "text-v2-crit" : "text-v2-warn"
              }`}
            >
              RISCO {speech.risk_score}
            </span>
          )}
        </div>

        {speech.summary && (
          <div className="mt-1 text-[12.5px] leading-normal text-v2-ink-3">{speech.summary}</div>
        )}
        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[1.6] text-v2-ink-2">
          {speech.content}
        </p>
      </div>
    </div>
  );
}
