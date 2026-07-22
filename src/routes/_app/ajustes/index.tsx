import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listVocabulary, addVocabulary, removeVocabulary } from "@/lib/vocabulary.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/ajustes/")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol v2" }] }),
  component: VisaoGeral,
});

/** S12 — Ajustes · visão geral (Vocabulário). Dados reais via listVocabulary/addVocabulary/removeVocabulary. */

type VocabKind =
  | "neighborhood"
  | "opponent"
  | "ally"
  | "department"
  | "facility"
  | "sensitive_term"
  | "news_domain"
  | "focus_term";

type VocabItem = { id: string; kind: string; value: string };

// Seções fixas do design (sempre visíveis) + seções extra que só aparecem se a org
// tiver termos desses tipos (ally/facility/focus_term/news_domain não fazem parte
// do mock original, mas o enum vocab_kind os inclui — agrupamos coerentemente).
const CORE_SECTIONS: { id: VocabKind; icon: string; label: string }[] = [
  { id: "neighborhood", icon: "📍", label: "Bairros" },
  { id: "opponent", icon: "⚔", label: "Opositores" },
  { id: "department", icon: "🏛", label: "Secretarias" },
  { id: "sensitive_term", icon: "⚠", label: "Termos sensíveis" },
];
const EXTRA_SECTIONS: { id: VocabKind; icon: string; label: string }[] = [
  { id: "ally", icon: "🤝", label: "Aliados" },
  { id: "facility", icon: "🏢", label: "Equipamentos públicos" },
  { id: "focus_term", icon: "🔎", label: "Palavras de foco" },
  { id: "news_domain", icon: "📰", label: "Domínios de notícia" },
];

function VisaoGeral() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({ neighborhood: true });
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [sectionValue, setSectionValue] = useState("");
  const [newTermOpen, setNewTermOpen] = useState(false);
  const [newTermKind, setNewTermKind] = useState<VocabKind>("neighborhood");
  const [newTermValue, setNewTermValue] = useState("");

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["vocab", orgId],
    queryFn: () => listVocabulary({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  const add = useMutation({
    mutationFn: (vars: { kind: VocabKind; value: string }) =>
      addVocabulary({
        data: { orgId: orgId as string, kind: vars.kind, value: vars.value, aliases: [] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", orgId] }),
  });
  const rm = useMutation({
    mutationFn: (id: string) => removeVocabulary({ data: { orgId: orgId as string, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", orgId] }),
  });

  const grouped = items.reduce<Record<string, VocabItem[]>>((acc, it) => {
    (acc[it.kind] ??= []).push(it as VocabItem);
    return acc;
  }, {});

  const sections = [
    ...CORE_SECTIONS,
    ...EXTRA_SECTIONS.filter((s) => (grouped[s.id]?.length ?? 0) > 0),
  ];

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const submitSectionAdd = (kind: VocabKind) => {
    const value = sectionValue.trim();
    if (!value) {
      setAddingSection(null);
      return;
    }
    add.mutate(
      { kind, value },
      {
        onSuccess: () => {
          setSectionValue("");
          setAddingSection(null);
        },
      },
    );
  };

  const submitNewTerm = () => {
    const value = newTermValue.trim();
    if (!value) return;
    add.mutate(
      { kind: newTermKind, value },
      {
        onSuccess: () => {
          setNewTermValue("");
          setNewTermOpen(false);
        },
      },
    );
  };

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Vocabulário</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            É isso que a IA procura nas mensagens — bairros, temas, nomes e termos sensíveis.
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setNewTermOpen((v) => !v)}
            className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white"
          >
            ＋ Novo termo
          </button>
          {newTermOpen && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
              <label className="text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Tipo
              </label>
              <select
                value={newTermKind}
                onChange={(e) => setNewTermKind(e.target.value as VocabKind)}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
              >
                {[...CORE_SECTIONS, ...EXTRA_SECTIONS].map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="mt-2.5 block text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Valor
              </label>
              <input
                autoFocus
                value={newTermValue}
                onChange={(e) => setNewTermValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNewTerm()}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                placeholder="ex.: Vila Rami"
              />
              <button
                onClick={submitNewTerm}
                disabled={!newTermValue.trim() || add.isPending}
                className="mt-2.5 w-full rounded-lg bg-v2-green px-3 py-1.5 text-[12.5px] font-[650] text-white disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          )}
        </div>
      </div>

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar o vocabulário. Tente novamente.
        </div>
      )}

      {/* Acordeão de categorias */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        {sections.map((s, i) => {
          const sectionItems = grouped[s.id] ?? [];
          return (
            <div key={s.id}>
              <button
                onClick={() => toggle(s.id)}
                aria-expanded={!!open[s.id]}
                className={`flex w-full items-center justify-between px-5 py-[13px] text-left transition-colors hover:bg-v2-surface ${
                  i > 0 ? "border-t border-v2-track" : ""
                }`}
              >
                <span className="whitespace-nowrap text-[13.5px] font-[650] text-v2-ink">
                  {s.icon} {s.label}{" "}
                  <span className="font-mono text-[11px] font-normal text-v2-faint">
                    {isLoading ? "…" : sectionItems.length}
                  </span>
                </span>
                <span className="text-[12px] text-v2-ink-3">
                  {open[s.id] ? "recolher ⌃" : "expandir ⌄"}
                </span>
              </button>
              {open[s.id] && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-v2-track px-5 py-3.5">
                  {isLoading && <span className="text-[12px] text-v2-ink-3">Carregando…</span>}
                  {!isLoading && sectionItems.length === 0 && (
                    <span className="text-[12px] text-v2-faint">Nenhum termo ainda.</span>
                  )}
                  {sectionItems.map((it) => (
                    <span
                      key={it.id}
                      className="rounded-full bg-v2-track px-[11px] py-1 text-[12px] text-v2-ink"
                    >
                      {it.value}{" "}
                      <button
                        onClick={() => rm.mutate(it.id)}
                        disabled={rm.isPending}
                        className="text-v2-faint hover:text-v2-crit"
                        aria-label={`Remover ${it.value}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {addingSection === s.id ? (
                    <input
                      autoFocus
                      value={sectionValue}
                      onChange={(e) => setSectionValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitSectionAdd(s.id)}
                      onBlur={() => submitSectionAdd(s.id)}
                      placeholder="novo termo…"
                      className="rounded-full border border-v2-line bg-v2-surface px-[11px] py-1 text-[12px] text-v2-ink outline-none focus:border-v2-green"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setAddingSection(s.id);
                        setSectionValue("");
                      }}
                      className="px-1.5 py-1 text-[12px] font-[650] text-v2-green"
                    >
                      ＋ adicionar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sugestões da IA */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span className="text-[14px]">✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          A IA sugeriu 3 termos novos com base nas mensagens: <b>"galeria pluvial"</b>,{" "}
          <b>"CEI Anhangabaú"</b>, <b>"linha 653"</b>.{" "}
          <button className="font-semibold text-v2-green hover:underline">
            Revisar sugestões →
          </button>
        </span>
      </div>
    </div>
  );
}
