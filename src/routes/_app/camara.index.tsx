import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listElected } from "@/lib/elected.functions";
import {
  BLIND_DASH,
  BlindNote,
  BlindPanel,
  BlindTag,
  BlindValue,
} from "@/components/v2/empty-signal";
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
 * O ÚNICO dado real desta tela é a lista de eleitos do TSE (`listElected`) e o alinhamento que a
 * própria org classificou. Sessões, pautas, falas, cobranças e agenda NÃO têm backend algum.
 * Antes, esta tela exibia uma sessão inteira com resumo de IA, três discursos e um placar
 * "11/4/4" — números e frases fabricados, indistinguíveis do resto do produto. Num painel de
 * inteligência, dado inventado é pior que dado ausente: o gabinete age em cima dele. Tudo que não
 * existe agora aparece como `—` com o motivo, e o placar é contado das linhas reais.
 */
function Screen() {
  const { orgId } = useCurrentOrg();

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["elected", orgId],
    queryFn: () => listElected({ data: { orgId: orgId as string, onlyElected: true } }),
    enabled: !!orgId,
  });

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
        <div>
          <div className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">
            Câmara Municipal
          </div>
          <div className="mt-1 text-[13.5px] text-v2-ink-3">
            {isLoading
              ? "Carregando eleitos…"
              : vereadores.length > 0
                ? `Placar de alinhamento de ${vereadores.length} vereadores eleitos (dados do TSE).`
                : "Nenhum vereador importado do TSE nesta organização."}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          {/* A agenda da Câmara não é integrada — anunciar "próxima sessão: ter 22 jul" era
              inventar compromisso de gabinete. */}
          <span className="font-mono text-[11px] text-v2-ink-3">
            próxima sessão: <BlindValue why="agenda da Câmara não integrada" />
          </span>
        </div>
      </div>

      {/* Placar — contado das linhas reais de `elected_officials`. */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          label="Base aliada"
          value={placar ? String(placar.ally) : null}
          why="nenhum eleito importado"
          valueClass="text-v2-green"
          suffix="vereadores"
        />
        <StatCard
          label="Não classificados"
          value={placar ? String(placar.neutral + placar.management) : null}
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
        {/* Sessões e falas: nenhuma linha disso existe no banco. O bloco declara o vazio em vez
            de encená-lo com player, timestamps e resumo de IA. */}
        <div className="self-start overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <BlindTag>sem integração com a câmara</BlindTag>
            <div className="text-[15px] font-[650] text-v2-ink">
              Sessões e discursos não são monitorados
            </div>
            <p className="max-w-[420px] text-[12.5px] leading-normal text-v2-ink-2">
              O InPol não coleta as sessões da Câmara: não há gravação, transcrição, resumo de IA
              nem “quem falou o quê”. Nada nesta tela mede a atuação em plenário — o que aparece
              abaixo vem do TSE e da classificação feita pela própria equipe.
            </p>
          </div>
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
    </div>
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
