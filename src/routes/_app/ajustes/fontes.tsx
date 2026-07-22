import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listVocabulary, addVocabulary, removeVocabulary } from "@/lib/vocabulary.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/ajustes/fontes")({
  head: () => ({ meta: [{ title: "Fontes locais — Ajustes" }] }),
  component: Screen,
});

type VocabItem = { id: string; kind: string; value: string };

/**
 * S19 — Ajustes · Fontes locais. Dados reais via listVocabulary/addVocabulary/removeVocabulary
 * (org_vocabulary, kind="news_domain") — o mesmo vocabulário que alimenta as buscas de notícia
 * em src/lib/scanners.server.ts. O backend não guarda tipo (Portal/Blog/Rádio), contagem de
 * matérias 7d nem status de saúde por domínio — esses campos do mock foram neutralizados em vez
 * de inventados (ver relatório de implementação).
 */
function Screen() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

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
    mutationFn: (v: string) =>
      addVocabulary({
        data: { orgId: orgId as string, kind: "news_domain", value: v, aliases: [] },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vocab", orgId] });
      setValue("");
      setAdding(false);
    },
  });
  const rm = useMutation({
    mutationFn: (id: string) => removeVocabulary({ data: { orgId: orgId as string, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", orgId] }),
  });

  const domains = (items as VocabItem[]).filter((it) => it.kind === "news_domain");

  const submitAdd = () => {
    const v = value.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    add.mutate(v);
  };

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Fontes locais</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Domínios de portais, blogs e rádios da cidade. Matérias entram em Sinais já analisadas.
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => {
              setAdding((v) => !v);
              setValue("");
            }}
            className="rounded-[9px] bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white"
          >
            ＋ Adicionar fonte
          </button>
          {adding && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
              <label className="text-[11px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3">
                Domínio
              </label>
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                placeholder="ex.: tribunadejundiai.com.br"
              />
              <button
                onClick={submitAdd}
                disabled={!value.trim() || add.isPending}
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
          Não foi possível carregar as fontes. Tente novamente.
        </div>
      )}

      {/* Sources table */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
        <div className="grid grid-cols-[1.9fr_1fr_0.9fr_0.9fr] gap-3 border-b border-v2-line px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
          <span>FONTE</span>
          <span>TIPO</span>
          <span>MATÉRIAS 7D</span>
          <span>STATUS</span>
        </div>
        {isLoading && (
          <div className="px-5 py-[13px] text-[12.5px] text-v2-ink-3">Carregando fontes…</div>
        )}
        {!isLoading && domains.length === 0 && (
          <div className="px-5 py-[13px] text-[12.5px] text-v2-faint">
            Nenhuma fonte cadastrada ainda.
          </div>
        )}
        {domains.map((d, i) => (
          <SourceRow
            key={d.id}
            url={d.value}
            last={i === domains.length - 1}
            onRemove={() => rm.mutate(d.id)}
            removing={rm.isPending}
          />
        ))}
      </div>

      {/* AI suggestion — sem detector de domínios novos no backend hoje; nota estática */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>✦</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          A sugestão automática de novos domínios ainda não está disponível — adicione fontes
          manualmente acima.
        </span>
      </div>
    </div>
  );
}

function SourceRow({
  url,
  last,
  onRemove,
  removing,
}: {
  url: string;
  last?: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.9fr_1fr_0.9fr_0.9fr] items-center gap-3 px-5 py-[13px] ${
        !last ? "border-b border-v2-track" : ""
      }`}
    >
      <div>
        <div className="font-mono text-[13.5px] font-semibold text-v2-ink">{url}</div>
      </div>
      <span className="text-[12px] text-v2-ink-2">Domínio de notícia</span>
      <span className="font-mono text-[12px] text-v2-ink-3">—</span>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-v2-green">● monitorando</span>
        <button
          onClick={onRemove}
          disabled={removing}
          className="text-[11px] text-v2-faint hover:text-v2-crit disabled:opacity-50"
          aria-label={`Remover ${url}`}
        >
          remover
        </button>
      </div>
    </div>
  );
}
