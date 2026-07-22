import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listElected } from "@/lib/elected.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/camara/$vereadorId")({
  head: () => ({ meta: [{ title: "Vereador — Inpol v2" }] }),
  component: Screen,
});

const TABS = [
  { id: "falas", label: "🎙 Falas", count: 0 },
  { id: "cobrancas", label: "📌 Cobranças", count: 0 },
  { id: "justificativas", label: "📄 Justificativas", count: 0 },
  { id: "entregas", label: "✅ Entregas", count: 0 },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

const ALIGN_META: Record<
  ElectedAlignment,
  { label: string; badgeClass: string; textClass: string }
> = {
  ally: { label: "BASE", badgeClass: "bg-v2-green-tint text-v2-green", textClass: "text-v2-green" },
  opponent: {
    label: "OPOSIÇÃO",
    badgeClass: "bg-v2-crit-bg text-v2-crit",
    textClass: "text-v2-crit",
  },
  neutral: {
    label: "INDEPENDENTE",
    badgeClass: "bg-v2-warn-bg text-v2-warn",
    textClass: "text-v2-warn",
  },
  management: {
    label: "INDEPENDENTE",
    badgeClass: "bg-v2-warn-bg text-v2-warn",
    textClass: "text-v2-warn",
  },
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.slice(0, 1) ?? "";
  const second = parts[1]?.slice(0, 1) ?? parts[0]?.slice(1, 2) ?? "";
  return (first + second).toUpperCase();
}

/** S15 — Câmara · Perfil do vereador: identidade e alinhamento vêm de `listElected` (filtrado pelo
 * id da rota, mesmo padrão de alertas.$alertId — não há `getElected` dedicado). Falas, cobranças,
 * justificativas, entregas e padrão de atuação não têm backend — estados vazios honestos. */
function Screen() {
  const { vereadorId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const [tab, setTab] = useState<TabId>("falas");

  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["elected", orgId],
    queryFn: () => listElected({ data: { orgId: orgId as string, onlyElected: true } }),
    enabled: !!orgId,
  });

  const vereador = useMemo(
    () => (items as ElectedRow[] | undefined)?.find((r) => r.id === vereadorId),
    [items, vereadorId],
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[980px] flex-col">
        <BackLink />
        <div className="mt-6 text-[13.5px] text-v2-ink-3">Carregando vereador…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-[980px] flex-col">
        <BackLink />
        <div className="mt-6 text-[13.5px] text-v2-crit">
          Não foi possível carregar este vereador. Tente novamente.
        </div>
      </div>
    );
  }

  if (!vereador) {
    return (
      <div className="mx-auto flex w-full max-w-[980px] flex-col">
        <BackLink />
        <div className="mt-10 flex flex-col items-center gap-2 rounded-[13px] border border-v2-line bg-v2-card px-6 py-12 text-center">
          <span className="text-[28px]">🔍</span>
          <h1 className="text-[17px] font-[650] text-v2-ink">Vereador não encontrado</h1>
          <p className="max-w-sm text-[13px] text-v2-ink-3">
            Este vereador pode ter sido removido ou o link está incorreto.
          </p>
          <Link
            to="/camara"
            className="mt-2 rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink"
          >
            Voltar para a Câmara
          </Link>
        </div>
      </div>
    );
  }

  const name = vereador.nome_urna ?? vereador.nome;
  const align = ALIGN_META[(vereador.alignment as ElectedAlignment) ?? "neutral"];

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col">
      <BackLink />

      {/* Identity header */}
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start">
        <span
          className={`grid h-16 w-16 flex-none place-items-center rounded-full text-[20px] font-semibold ${align.badgeClass}`}
        >
          {initialsFor(name)}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-[23px] font-[650] text-v2-ink">{name}</span>
            <span
              className={`rounded px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.06em] ${align.badgeClass}`}
            >
              {align.label}
            </span>
          </div>
          <div className="mt-1 text-[13px] text-v2-ink-3">
            Vereador · {vereador.partido_sigla ?? "—"} · {vereador.ano_eleicao}
          </div>
        </div>
        <div className="flex flex-none gap-3">
          <div className="w-[118px] rounded-xl border border-v2-line bg-v2-card px-[18px] py-[13px] text-center">
            <div className="font-mono text-[9.5px] font-semibold tracking-[0.1em] text-v2-faint">
              ALINHAMENTO
            </div>
            <div className={`mt-1 text-[16px] font-[650] ${align.textClass}`}>{align.label}</div>
            <div className="mt-[5px] font-mono text-[10px] text-v2-ink-3">
              automático após 10 votações
            </div>
          </div>
          <div className="w-[118px] rounded-xl border border-v2-line bg-v2-card px-[18px] py-[13px] text-center">
            <div className="font-mono text-[9.5px] font-semibold tracking-[0.1em] text-v2-faint">
              Nº DE URNA
            </div>
            <div className="mt-1 text-[20px] font-[650] text-v2-ink">{vereador.numero}</div>
            <div className="mt-[9px] font-mono text-[10px] text-v2-ink-3">
              eleição {vereador.ano_eleicao}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 mt-[22px] flex gap-1.5 overflow-x-auto border-b border-v2-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3.5 pb-2.5 pt-2 text-[13.5px] ${
              tab === t.id
                ? "-mb-px border-b-2 border-v2-green font-[650] text-v2-ink"
                : "font-semibold text-v2-ink-3 hover:text-v2-ink"
            }`}
          >
            {t.label} <span className="text-v2-faint">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: repositório — sem backend de falas/cobranças/justificativas/entregas ainda. */}
        <div className="self-start overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
            <div className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-v2-faint">
              0 ITENS INDEXADOS
            </div>
            <div className="text-[13.5px] text-v2-ink-2">
              Repositório de{" "}
              {TABS.find((t) => t.id === tab)
                ?.label.replace(/^\S+\s/, "")
                .toLowerCase()}{" "}
              em consolidação — dados completos na próxima sincronização.
            </div>
          </div>
        </div>

        {/* Right column — sem backend de cobranças/padrão de atuação ainda. */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              COBRANÇAS AO GOVERNO
            </div>
            <div className="py-2 text-[12.5px] text-v2-ink-3">Sem dados suficientes ainda.</div>
          </div>

          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              PADRÃO DE ATUAÇÃO
            </div>
            <div className="text-[12.5px] leading-[1.6] text-v2-ink-3">
              Sem dados suficientes ainda.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/camara" className="text-[13px] text-v2-ink-3 hover:text-v2-ink">
      ← Câmara Municipal
    </Link>
  );
}
