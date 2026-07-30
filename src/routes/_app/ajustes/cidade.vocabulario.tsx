import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listVocabulary, addVocabulary, removeVocabulary } from "@/lib/vocabulary.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Consequence, FieldHint, FieldLabel, PanelHeader } from "./-ui";

export const Route = createFileRoute("/_app/ajustes/cidade/vocabulario")({
  head: () => ({ meta: [{ title: "Vocabulário — Ajustes" }] }),
  component: Vocabulario,
});

/**
 * Ajustes · Como a IA entende minha cidade · Vocabulário (antes a rota /ajustes).
 * Dados reais via listVocabulary/addVocabulary/removeVocabulary.
 *
 * Esta é a tela onde a distância entre "eu cadastrei" e "o app mudou de comportamento"
 * era maior: cada tipo de termo tem um efeito diferente e nenhum estava escrito.
 * Bairro alimenta o Território, termo sensível empurra a classificação de risco,
 * opositor faz a IA reconhecer e citar a pessoa. Agora cada seção declara o seu.
 */

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

type Section = { id: VocabKind; icon: string; label: string; effect: string };

// Seções fixas do design (sempre visíveis) + seções extra que só aparecem se a org
// tiver termos desses tipos. `effect` é a consequência downstream real de cada tipo —
// é o que responde "por que eu cadastraria isso?".
const CORE_SECTIONS: Section[] = [
  {
    id: "neighborhood",
    icon: "📍",
    label: "Bairros",
    effect:
      "É o cadastro do bairro que faz a IA reconhecê-lo nas mensagens. Sem ele, a menção passa batida e o bairro não acende no Território nem aparece nos recortes por região.",
  },
  {
    id: "opponent",
    icon: "⚔",
    label: "Opositores",
    effect:
      "A IA passa a identificar essas pessoas nas mensagens e na imprensa, e a citá-las nas análises. Alimenta a tela de Rede e os alertas de adversário viralizando.",
  },
  {
    id: "department",
    icon: "🏛",
    label: "Secretarias",
    effect:
      "Cruza reclamações com a pasta responsável — é assim que o relatório consegue dizer 'obras concentrou 40% das queixas' em vez de só listar assuntos.",
  },
  {
    id: "sensitive_term",
    icon: "⚠",
    label: "Termos sensíveis",
    effect:
      "Muda a classificação de risco: mensagens com esses termos são pontuadas mais alto e têm chance muito maior de virar alerta. Cadastre com parcimônia — excesso vira ruído.",
  },
];
const EXTRA_SECTIONS: Section[] = [
  {
    id: "ally",
    icon: "🤝",
    label: "Aliados",
    effect: "Mesmo efeito de reconhecimento dos opositores, com o sinal político invertido.",
  },
  {
    id: "facility",
    icon: "🏢",
    label: "Equipamentos públicos",
    effect:
      "UBS, escolas, praças. Menções ao equipamento passam a ser vinculadas ao bairro dele no Território.",
  },
  {
    id: "focus_term",
    icon: "🔎",
    label: "Palavras de foco",
    effect:
      "Entram nas buscas ativas da varredura de imprensa — o inPol vai atrás de matérias com esses termos.",
  },
  {
    id: "news_domain",
    icon: "📰",
    label: "Domínios de notícia",
    effect:
      "São as fontes da varredura de imprensa. Editáveis com mais contexto em O que eu escuto · Imprensa local.",
  },
];

function Vocabulario() {
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

  const selectableSections = [...CORE_SECTIONS, ...EXTRA_SECTIONS];
  const newTermEffect = selectableSections.find((s) => s.id === newTermKind)?.effect;

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
      <PanelHeader
        title="Vocabulário"
        description="Bairros, temas, nomes e termos sensíveis da sua cidade."
        effect={
          <>
            É exatamente esta lista que a IA procura em cada mensagem e matéria. O que não estiver
            aqui <b className="text-v2-ink">não é reconhecido</b> — a menção existe no texto, mas
            não vira bairro no Território, nem tema no relatório, nem peso de risco no alerta.
          </>
        }
        action={
          <div className="relative">
            <button
              onClick={() => setNewTermOpen((v) => !v)}
              className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-v2-card"
            >
              ＋ Novo termo
            </button>
            {newTermOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
                <FieldLabel>Tipo</FieldLabel>
                <select
                  value={newTermKind}
                  onChange={(e) => setNewTermKind(e.target.value as VocabKind)}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink"
                >
                  {selectableSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {/* O tipo é a escolha consequente aqui: o mesmo texto vira coisa
                    diferente conforme o tipo. Mostrar o efeito do tipo selecionado. */}
                {newTermEffect && <FieldHint>{newTermEffect}</FieldHint>}
                <FieldLabel className="mt-2.5">Valor</FieldLabel>
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
        }
      />

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
                className={`flex w-full items-center justify-between gap-3 px-5 py-[13px] text-left transition-colors hover:bg-v2-surface ${
                  i > 0 ? "border-t border-v2-track" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[13.5px] font-[650] text-v2-ink">
                    {s.icon} {s.label}{" "}
                    <span className="font-mono text-[11px] font-normal text-v2-faint">
                      {isLoading ? "…" : sectionItems.length}
                    </span>
                  </span>
                  {/* Efeito sempre visível, mesmo com a seção recolhida: quem está
                      decidindo ONDE cadastrar precisa ler isso antes de expandir. */}
                  <span className="mt-1 block max-w-[62ch] text-[11.5px] leading-snug text-v2-ink-3">
                    {s.effect}
                  </span>
                </span>
                <span className="flex-none text-[12px] text-v2-ink-3">
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
                        aria-label={`Remover ${it.value} — a IA deixa de reconhecer este termo`}
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

      <FieldHint>
        Mudanças valem para as análises seguintes. Mensagens já analisadas não são reclassificadas
        automaticamente.
      </FieldHint>

      {/* Sugestões da IA */}
      <Consequence>
        A IA sugeriu 3 termos novos com base nas mensagens: <b>"galeria pluvial"</b>,{" "}
        <b>"CEI Anhangabaú"</b>, <b>"linha 653"</b>.{" "}
        <button className="font-semibold text-v2-green hover:underline">Revisar sugestões →</button>
      </Consequence>
    </div>
  );
}
