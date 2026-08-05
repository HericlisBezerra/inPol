import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listElected } from "@/lib/elected.functions";
import { listSessions } from "@/lib/camara.functions";
import {
  BLIND_DASH,
  BlindNote,
  BlindPanel,
  BlindTag,
  BlindValue,
} from "@/components/v2/empty-signal";
import { HeadlineAccent, ScreenHeadline } from "@/components/v2/screen-headline";
import { CamaraImportDialog } from "@/components/v2/camara-import";
import {
  fmtDuration,
  fmtSessionDate,
  sessionReport,
  sessionSubtitle,
  type CamaraSessionRow,
} from "@/components/v2/camara-shared";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/camara/")({
  head: () => ({ meta: [{ title: "Câmara — Inpol v2" }] }),
  component: Screen,
});

type ElectedRow = {
  id: string;
  nome: string;
  nome_urna: string | null;
  partido_sigla: string | null;
  numero: string;
  cargo_nome: string;
  cargo_codigo: string | null;
  uf: string;
  ano_eleicao: number;
  is_elected: boolean;
  alignment: string;
  imported_at: string;
};

type ElectedAlignment = "ally" | "opponent" | "neutral" | "management";

/** `neutral` é o DEFAULT da coluna no banco, não um julgamento: chamar de "independente" fazia a
 *  tela afirmar um posicionamento que ninguém classificou. O rótulo agora diz a verdade. */
const ALIGN_META: Record<
  ElectedAlignment,
  { label: string; avatarClass: string; metaClass: string }
> = {
  ally: {
    label: "base",
    avatarClass: "bg-v2-green-tint text-v2-green",
    metaClass: "text-v2-green",
  },
  opponent: {
    label: "oposição",
    avatarClass: "bg-v2-crit-bg text-v2-crit",
    metaClass: "text-v2-crit",
  },
  neutral: {
    label: "não classificado",
    avatarClass: "bg-v2-track text-v2-ink-3",
    metaClass: "text-v2-faint",
  },
  management: {
    label: "gestão",
    avatarClass: "bg-v2-warn-bg text-v2-warn",
    metaClass: "text-v2-warn",
  },
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.slice(0, 1) ?? "";
  const second = parts[1]?.slice(0, 1) ?? parts[0]?.slice(1, 2) ?? "";
  return (first + second).toUpperCase();
}

/**
 * S14 — Câmara Municipal.
 *
 * Duas fontes reais, e só elas: os eleitos do TSE (`listElected`) com o alinhamento que a própria
 * org classificou, e as sessões efetivamente importadas (`listSessions`). Esta tela já exibiu uma
 * sessão inteira fabricada — player, discursos atribuídos a vereadores nominados, placar "11/4/4".
 * Num painel de inteligência dado inventado é pior que dado ausente: o gabinete age em cima dele.
 * Por isso, sem sessão importada a tela continua declarando o vazio, e o que não é medido
 * (pauta, requerimentos, agenda) segue como `—` com o motivo.
 */
function Screen() {
  const { orgId } = useCurrentOrg();
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["elected", orgId],
    queryFn: () => listElected({ data: { orgId: orgId as string, onlyElected: true } }),
    enabled: !!orgId,
  });

  const {
    data: sessionsRaw,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useQuery({
    queryKey: ["camara-sessions", orgId],
    queryFn: () => listSessions({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });
  const sessions = sessionsRaw ?? [];
  // A lista chega ordenada por data desc no servidor; o "última" é o topo.
  const ultima = sessions[0] ?? null;

  const vereadores = useMemo(
    () =>
      (items as ElectedRow[]).filter(
        (r) => r.cargo_codigo === "13" || /vereador/i.test(r.cargo_nome),
      ),
    [items],
  );
  const preview = vereadores.slice(0, 3);

  /** Placar contado das linhas reais. Sem importação, é `null` — não zero: "0 aliados" leria
   *  como "a câmara toda é contra", que é uma afirmação que não temos. */
  const placar = useMemo(() => {
    if (vereadores.length === 0) return null;
    const by: Record<ElectedAlignment, number> = {
      ally: 0,
      opponent: 0,
      neutral: 0,
      management: 0,
    };
    for (const v of vereadores) {
      const a = (v.alignment as ElectedAlignment) ?? "neutral";
      by[a in by ? a : "neutral"]++;
    }
    return by;
  }, [vereadores]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {/* A manchete fala do que existe. Com sessão importada, a resposta a "o que a Câmara fez?"
            passa a ter uma leitura real (a última sessão e quantas falas ela rendeu). Sem sessão,
            a manchete volta a declarar a cegueira — nunca sugerir atividade legislativa que
            ninguém coletou. Pauta, votação e requerimento continuam fora do produto nos dois
            casos, e é isso que a microlinha diz. */}
        <ScreenHeadline
          eyebrow="CÂMARA MUNICIPAL"
          loading={isLoading || sessionsLoading}
          loadingLabel="Carregando a Câmara…"
          blind={sessions.length === 0}
          note={
            sessions.length > 0
              ? "Sessões vêm da transcrição importada pela equipe — não há coleta automática. Pauta, votações e requerimentos continuam fora do produto."
              : vereadores.length > 0
                ? "O que esta tela tem de real: os eleitos do TSE e o alinhamento classificado pela equipe. Sessões só existem se alguém importar a transcrição; pauta, votações e requerimentos não são coletados."
                : "Sem eleitos importados, nem o placar de alinhamento existe. Nenhuma sessão foi importada, e pauta, votações e requerimentos não são coletados."
          }
        >
          {isError && sessionsError ? (
            <>Não foi possível carregar a Câmara agora.</>
          ) : ultima ? (
            <>
              Última sessão:{" "}
              <HeadlineAccent tone="flat">{sessionSubtitle(ultima) || ultima.title}</HeadlineAccent>
              , em {fmtSessionDate(ultima.session_date, { day: "2-digit", month: "long" })}
              {ultima.speech_count != null ? ` — ${ultima.speech_count} falas transcritas` : ""}.
            </>
          ) : vereadores.length > 0 ? (
            <>
              Nenhuma sessão importada — só dá para dizer quem a Câmara é:{" "}
              <HeadlineAccent tone="flat">{vereadores.length} vereadores</HeadlineAccent> eleitos.
            </>
          ) : (
            <>Não há como dizer o que a Câmara fez, nem quem ela é: nenhum eleito importado.</>
          )}
        </ScreenHeadline>
        <div className="flex flex-wrap items-center gap-3.5">
          {/* A agenda da Câmara não é integrada — anunciar "próxima sessão: ter 22 jul" era
              inventar compromisso de gabinete. */}
          <span className="font-mono text-[11px] text-v2-ink-3">
            próxima sessão: <BlindValue why="agenda da Câmara não integrada" />
          </span>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={!orgId}
            className="rounded-lg bg-v2-green px-3.5 py-2 text-[12.5px] font-[650] text-white hover:bg-v2-green-hover disabled:opacity-50"
          >
            + Importar sessão
          </button>
        </div>
      </div>

      {/* Placar — contado das linhas reais de `elected_officials`. */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* `management` (gestão) é uma CLASSIFICAÇÃO — vereador que compõe o governo —, não a
            ausência de uma. Somá-lo a `neutral` fazia a tela declarar "2 sem posicionamento
            definido" enquanto a lista ao lado rotulava os mesmos dois como "gestão". Base é
            quem vota com o governo: aliados + gestão. Não classificado é só o default do banco. */}
        <StatCard
          label="Base aliada"
          value={placar ? String(placar.ally + placar.management) : null}
          why="nenhum eleito importado"
          valueClass="text-v2-green"
          suffix={
            placar && placar.management > 0 ? `inclui ${placar.management} da gestão` : "vereadores"
          }
        />
        <StatCard
          label="Não classificados"
          value={placar ? String(placar.neutral) : null}
          why="nenhum eleito importado"
          valueClass="text-v2-ink-3"
          suffix="sem posicionamento definido"
        />
        <StatCard
          label="Oposição"
          value={placar ? String(placar.opponent) : null}
          why="nenhum eleito importado"
          valueClass="text-v2-crit"
          suffix="vereadores"
        />
        <StatCard
          label="Cobranças abertas ao governo"
          value={null}
          why="sem base de requerimentos"
          valueClass="text-v2-ink"
          suffix="requerimentos da Câmara não são coletados"
        />
      </div>

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Sessões: só as que foram de fato importadas. Sem nenhuma, o bloco declara o vazio em
            vez de encená-lo com player, timestamps e resumo de IA — foi exatamente isso que esta
            tela fazia antes. */}
        <div className="self-start overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          {sessionsLoading ? (
            <div className="px-[18px] py-12 text-center text-[12.5px] text-v2-ink-3">
              Carregando sessões…
            </div>
          ) : sessionsError ? (
            <div className="px-[18px] py-12 text-center text-[12.5px] text-v2-crit">
              Não foi possível carregar as sessões.
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <BlindTag>nenhuma sessão importada</BlindTag>
              <div className="text-[15px] font-[650] text-v2-ink">
                Não há sessão para ler nesta Câmara
              </div>
              <p className="max-w-[440px] text-[12.5px] leading-normal text-v2-ink-2">
                Não existe coleta automática de sessões: cada uma entra pela transcrição do vídeo,
                importada pela equipe. Enquanto nenhuma for importada, nada nesta tela mede a
                atuação em plenário — o que aparece abaixo vem do TSE e da classificação feita pela
                própria equipe.
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                disabled={!orgId}
                className="mt-1 rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[12.5px] font-[650] text-v2-ink disabled:opacity-50"
              >
                Importar a primeira sessão
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between border-b border-v2-line px-[18px] py-3">
                <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
                  SESSÕES IMPORTADAS
                </span>
                <span className="font-mono text-[10.5px] text-v2-faint">
                  {sessions.length} {sessions.length === 1 ? "sessão" : "sessões"}
                </span>
              </div>
              {sessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
              <div className="px-[18px] py-3">
                <BlindNote>
                  Só aparece o que foi importado. A Câmara pode ter sessões que ninguém transcreveu
                  — a lista não é a agenda oficial.
                </BlindNote>
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          <BlindPanel tone="flat" title="Pauta da próxima sessão">
            A ordem do dia da Câmara não é integrada, então não há como recomendar o que focar ou
            evitar. Qualquer priorização de pauta hoje é feita fora do sistema.
          </BlindPanel>

          <div className="flex-1 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
                VEREADORES ELEITOS
              </span>
              <Link to="/camara" className="text-[12px] font-[650] text-v2-green">
                {vereadores.length > 0 ? `todos os ${vereadores.length} →` : "ver todos →"}
              </Link>
            </div>
            {isError && (
              <div className="py-2 text-[12.5px] text-v2-crit">Não foi possível carregar.</div>
            )}
            {!isError && isLoading && (
              <div className="py-2 text-[12.5px] text-v2-ink-3">Carregando…</div>
            )}
            {!isError && !isLoading && preview.length === 0 && (
              <div className="py-2 text-[12.5px] text-v2-faint">Nenhum vereador importado.</div>
            )}
            {preview.map((v, i) => {
              const meta = ALIGN_META[(v.alignment as ElectedAlignment) ?? "neutral"];
              const name = v.nome_urna ?? v.nome;
              return (
                <VereadorRow
                  key={v.id}
                  initials={initialsFor(name)}
                  avatarClass={meta.avatarClass}
                  name={name}
                  vereadorId={v.id}
                  meta={meta.label}
                  metaClass={meta.metaClass}
                  last={i === preview.length - 1}
                />
              );
            })}
            {/* "Em movimento" prometia variação de alinhamento no tempo; não há histórico de
                votação, então o recorte honesto é a lista dos eleitos. */}
            <BlindNote className="mt-2.5">
              Ordem de importação do TSE. Não há histórico de votação para ranquear por movimento.
            </BlindNote>
          </div>
        </div>
      </div>

      {importOpen && orgId && (
        <CamaraImportDialog orgId={orgId} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

/** Uma sessão na lista: o suficiente para escolher qual abrir numa reunião. */
function SessionRow({ s }: { s: CamaraSessionRow }) {
  const sub = sessionSubtitle(s);
  // Hoje nenhuma sessão tem relatório (não existe geração por sessão no backend); o acessor
  // tolerante faz a etiqueta virar "analisada" sozinha quando a coluna passar a vir na API.
  const { analyzedAt } = sessionReport(s);
  return (
    <Link
      to="/camara/sessao/$sessionId"
      params={{ sessionId: s.id }}
      className="flex items-center gap-3 border-b border-v2-track px-[18px] py-3 last:border-b-0"
    >
      <span className="w-[74px] flex-none font-mono text-[11.5px] text-v2-ink-3">
        {fmtSessionDate(s.session_date, { day: "2-digit", month: "short" })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-[650] text-v2-ink">{s.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-v2-faint">
          {sub && <span>{sub}</span>}
          {/* `0 falas` aqui é uma afirmação legítima: houve importação e o parser não reconheceu
              nada — sinal de que o formato da transcrição precisa de conferência. */}
          {s.speech_count == null ? (
            <BlindValue why="falas não contadas" />
          ) : (
            <span className={s.speech_count === 0 ? "text-v2-warn" : undefined}>
              {s.speech_count} falas
            </span>
          )}
          {s.duration_seconds != null && <span>{fmtDuration(s.duration_seconds)}</span>}
        </span>
      </span>
      {/* Analisada ou não é a diferença entre "tem relatório para ler" e "só tem a transcrição". */}
      {analyzedAt ? (
        <span className="flex-none rounded bg-v2-green-tint px-1.5 py-[2px] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-v2-green">
          analisada
        </span>
      ) : (
        <span className="flex-none rounded bg-v2-track px-1.5 py-[2px] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-v2-ink-3">
          sem relatório
        </span>
      )}
      <span className="flex-none text-v2-faint">›</span>
    </Link>
  );
}

function StatCard({
  label,
  value,
  why,
  valueClass,
  suffix,
}: {
  label: string;
  /** `null` = o número não existe (sem importação, sem base). Nunca substituir por zero. */
  value: string | null;
  why: string;
  valueClass: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-v2-line bg-v2-card px-[18px] py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className={`text-[22px] font-[650] ${value == null ? "text-v2-faint" : valueClass}`}>
          {value ?? BLIND_DASH}
        </span>
        <span className="text-[12px] text-v2-ink-3">{value == null ? why : suffix}</span>
      </div>
    </div>
  );
}

function VereadorRow({
  initials,
  avatarClass,
  name,
  vereadorId,
  meta,
  metaClass,
  last,
}: {
  initials: string;
  avatarClass: string;
  name: string;
  vereadorId: string;
  meta: string;
  metaClass: string;
  last?: boolean;
}) {
  return (
    <Link
      to="/camara/$vereadorId"
      params={{ vereadorId }}
      className={`flex items-center gap-2.5 py-2 ${!last ? "border-b border-v2-track" : ""}`}
    >
      <span
        className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[10.5px] font-semibold ${avatarClass}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-v2-ink">{name}</div>
        <div className={`font-mono text-[10.5px] ${metaClass}`}>{meta}</div>
      </div>
      <span className="text-v2-faint">›</span>
    </Link>
  );
}
