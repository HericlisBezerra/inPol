import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listElected,
  setElectedAlignment,
  deleteElected,
  importElected,
  tseListMunicipios,
} from "@/lib/elected.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/ajustes/eleitos")({
  head: () => ({ meta: [{ title: "Eleitos (TSE) — Ajustes" }] }),
  component: Screen,
});

type Alinhamento = "base" | "indep" | "oposicao";
type ElectedAlignment = "ally" | "opponent" | "neutral" | "management";

// O design v2 tem 3 pílulas (Base/Indep./Oposição); o backend tem 4 valores
// possíveis de alignment (ally/opponent/neutral/management). "management" não
// tem pílula própria no design — tratamos como "Indep." (mesmo grupo visual de
// "neutral"), sem perder o valor real ao clicar (só sobrescreve pra "neutral").
const ALIGN_TO_UI: Record<ElectedAlignment, Alinhamento> = {
  ally: "base",
  opponent: "oposicao",
  neutral: "indep",
  management: "indep",
};
const UI_TO_ALIGN: Record<Alinhamento, ElectedAlignment> = {
  base: "ally",
  indep: "neutral",
  oposicao: "opponent",
};

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

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const ELECTION_YEARS = [2024, 2020, 2016, 2012];
const PAGE_SIZE = 25;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** S26 — Ajustes · Eleitos (TSE): importa vereadores e define alinhamento inicial. Dados reais via elected.functions.ts. */
function Screen() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [importOpen, setImportOpen] = useState(false);
  const [uf, setUf] = useState("SP");
  const [ano, setAno] = useState(2024);
  const [muniCode, setMuniCode] = useState("");

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["elected", orgId],
    queryFn: () => listElected({ data: { orgId: orgId as string, onlyElected: true } }),
    enabled: !!orgId,
  });

  const muniQuery = useQuery({
    queryKey: ["tse-municipios", uf, ano],
    queryFn: () => tseListMunicipios({ data: { uf, ano } }),
    enabled: importOpen && !!uf,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const importMut = useMutation({
    mutationFn: () =>
      importElected({ data: { orgId: orgId as string, uf, codMunicipioTse: muniCode, ano } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      setImportOpen(false);
      setMuniCode("");
    },
  });

  const alignMut = useMutation({
    mutationFn: (vars: { id: string; alignment: ElectedAlignment }) =>
      setElectedAlignment({
        data: { orgId: orgId as string, id: vars.id, alignment: vars.alignment },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteElected({ data: { orgId: orgId as string, id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elected", orgId] });
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
    },
  });

  // Design é "Eleitos (TSE)" com cabeçalho VEREADOR — recorta para o cargo de
  // vereador (cargo 13 na nomenclatura TSE); mantém fallback por nome do cargo
  // caso cargo_codigo não venha preenchido.
  const vereadores = useMemo(
    () =>
      (items as ElectedRow[]).filter(
        (r) => r.cargo_codigo === "13" || /vereador/i.test(r.cargo_nome),
      ),
    [items],
  );
  const visible = vereadores.slice(0, visibleCount);
  const remaining = vereadores.length - visible.length;

  const lastSync = useMemo(() => {
    const dates = (items as ElectedRow[])
      .map((r) => r.imported_at)
      .filter(Boolean)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [items]);
  const ufLabel = (items as ElectedRow[])[0]?.uf;

  const municipios = muniQuery.data ?? [];

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Eleitos (TSE)</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Vereadores importados dos dados abertos do TSE. Alinhamento vira automático após 10
            votações.
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="rounded-[9px] border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink"
          >
            ⇩ Importar TSE {ano}
          </button>
          {importOpen && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                    UF
                  </label>
                  <select
                    value={uf}
                    onChange={(e) => {
                      setUf(e.target.value);
                      setMuniCode("");
                    }}
                    className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
                  >
                    {UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                    Eleição
                  </label>
                  <select
                    value={ano}
                    onChange={(e) => {
                      setAno(Number(e.target.value));
                      setMuniCode("");
                    }}
                    className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
                  >
                    {ELECTION_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="mt-2.5 block text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Município
              </label>
              <select
                value={muniCode}
                onChange={(e) => setMuniCode(e.target.value)}
                disabled={muniQuery.isLoading}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
              >
                <option value="">{muniQuery.isLoading ? "Carregando…" : "Selecione…"}</option>
                {municipios.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </select>
              {importMut.isError && (
                <div className="mt-2 text-[11.5px] text-v2-crit">
                  {importMut.error instanceof Error ? importMut.error.message : "Erro ao importar."}
                </div>
              )}
              <button
                onClick={() => importMut.mutate()}
                disabled={!muniCode || importMut.isPending}
                className="mt-2.5 w-full rounded-lg bg-v2-green px-3 py-1.5 text-[12.5px] font-[650] text-white disabled:opacity-50"
              >
                {importMut.isPending ? "Importando…" : "Importar candidatos"}
              </button>
            </div>
          )}
        </div>
      </div>

      {isError ? (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os eleitos. Tente novamente.
        </div>
      ) : (
        <div className="mt-3 font-mono text-[11px] text-v2-green">
          {isLoading
            ? "Carregando…"
            : `✓ ${vereadores.length} vereadores importados${ufLabel ? ` · ${ufLabel}` : ""}${
                lastSync ? ` · última sincronização ${formatDate(lastSync)}` : ""
              }`}
        </div>
      )}

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.7fr_0.8fr_0.9fr_1.1fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>VEREADOR</span>
          <span>PARTIDO</span>
          <span>VOTOS 2024</span>
          <span>ALINHAMENTO INICIAL</span>
        </div>
        {isLoading && <div className="px-5 py-4 text-[12.5px] text-v2-ink-3">Carregando…</div>}
        {!isLoading && vereadores.length === 0 && (
          <div className="px-5 py-4 text-[12.5px] text-v2-faint">
            Nenhum vereador importado ainda.
          </div>
        )}
        {visible.map((v, i) => (
          <VereadorRow
            key={v.id}
            name={v.nome_urna ?? v.nome}
            party={v.partido_sigla ?? "—"}
            alignment={ALIGN_TO_UI[(v.alignment as ElectedAlignment) ?? "neutral"]}
            onAlign={(a) => alignMut.mutate({ id: v.id, alignment: UI_TO_ALIGN[a] })}
            onRemove={() => delMut.mutate(v.id)}
            removing={delMut.isPending && delMut.variables === v.id}
            last={i === visible.length - 1}
          />
        ))}
      </div>

      {remaining > 0 && (
        <div className="pb-0.5 pt-4 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-[13px] font-[650] text-v2-ink-3"
          >
            Carregar mais {remaining} vereadores
          </button>
        </div>
      )}

      {/* AI note */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          Todos os nomes entram no Vocabulário automaticamente — menções nos grupos e na imprensa já
          são rastreadas.
        </span>
      </div>
    </div>
  );
}

const PILL_ACTIVE: Record<Alinhamento, string> = {
  base: "border-v2-green bg-v2-green-tint font-[650] text-v2-green",
  indep: "border-v2-warn-strong bg-v2-warn-bg font-[650] text-v2-warn",
  oposicao: "border-v2-crit bg-v2-crit-bg font-[650] text-v2-crit",
};

function VereadorRow({
  name,
  party,
  alignment,
  onAlign,
  onRemove,
  removing,
  last,
}: {
  name: string;
  party: string;
  alignment: Alinhamento;
  onAlign: (a: Alinhamento) => void;
  onRemove: () => void;
  removing?: boolean;
  last?: boolean;
}) {
  const options: { key: Alinhamento; label: string }[] = [
    { key: "base", label: "Base" },
    { key: "indep", label: "Indep." },
    { key: "oposicao", label: "Oposição" },
  ];
  return (
    <div
      className={`grid grid-cols-[1.7fr_0.8fr_0.9fr_1.1fr] items-center gap-3 px-5 py-3 text-[13px] ${
        !last ? "border-b border-v2-track" : ""
      }`}
    >
      <span className="font-semibold text-v2-ink">{name}</span>
      <span className="text-v2-ink-2">{party}</span>
      {/* TSE não expõe contagem de votos no dataset de candidatura consumido por
          elected.functions.ts (só situação/eleito) — sem correspondência real. */}
      <span className="font-mono text-[12px] text-v2-faint">—</span>
      <div className="flex items-center gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onAlign(o.key)}
            className={`rounded-full border px-2.5 py-[3px] text-[11px] ${
              alignment === o.key ? PILL_ACTIVE[o.key] : "border-v2-line text-v2-ink-3"
            }`}
          >
            {o.label}
          </button>
        ))}
        <button
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remover ${name}`}
          className="ml-1 text-v2-faint hover:text-v2-crit disabled:opacity-50"
        >
          ×
        </button>
      </div>
    </div>
  );
}
