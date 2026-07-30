import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrg } from "@/lib/orgs.functions";
import { useV2Orgs } from "@/lib/use-v2-orgs";
import { Consequence, FieldHint, FieldLabel, PanelHeader } from "./-ui";

export const Route = createFileRoute("/_app/ajustes/acesso/organizacoes")({
  head: () => ({ meta: [{ title: "Organizações — Ajustes" }] }),
  component: Screen,
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Dona",
  admin: "Admin",
  member: "Membro",
};

/**
 * Ajustes · Quem acessa · Organizações (antes /ajustes/organizacoes).
 * Dados reais via getMyOrgs (useV2Orgs) + createOrg.
 *
 * "Entrar" é a ação mais consequente e menos explicada do app inteiro: troca o
 * contexto de TODAS as telas de uma vez. Agora isso está dito no botão e no cabeçalho.
 */
function Screen() {
  const { orgId, setOrgId, orgs, isFetched } = useV2Orgs();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createOrg({ data: { name: name.trim(), city: city.trim(), state: state.trim() } }),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: ["my-orgs"] });
      setOrgId(org.id);
      setName("");
      setCity("");
      setState("");
      setFormOpen(false);
    },
  });

  const canCreate = name.trim().length >= 2 && city.trim().length >= 2 && state.trim().length >= 2;

  return (
    <div>
      <PanelHeader
        title="Organizações"
        description={
          isFetched
            ? `Você participa de ${orgs.length} organizaç${orgs.length === 1 ? "ão" : "ões"}.`
            : "Carregando…"
        }
        effect={
          <>
            A organização <b className="text-v2-ink">atual</b> define o que todas as outras telas
            mostram — sinais, alertas, relatórios, vocabulário. Nada é compartilhado entre
            organizações, nem por engano.
          </>
        }
        action={
          <div className="relative">
            <button
              onClick={() => setFormOpen((v) => !v)}
              className="rounded-[9px] bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-v2-card"
            >
              ＋ Criar organização
            </button>
            {formOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-v2-line bg-v2-surface p-3.5 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
                <FieldLabel>Nome</FieldLabel>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                  placeholder="ex.: Prefeitura de Sorocaba"
                />
                <FieldLabel className="mt-2.5">Cidade</FieldLabel>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                  placeholder="ex.: Sorocaba"
                />
                <FieldLabel className="mt-2.5">Estado</FieldLabel>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canCreate && create.mutate()}
                  className="mt-1 w-full rounded-lg border border-v2-line bg-v2-card px-2.5 py-1.5 text-[13px] text-v2-ink outline-none focus:border-v2-green"
                  placeholder="ex.: SP"
                />
                <FieldHint>
                  A nova organização nasce vazia — sem vocabulário, sem fontes e sem grupos — e vira
                  a organização atual assim que é criada.
                </FieldHint>
                {create.isError && (
                  <div className="mt-2 text-[12px] text-v2-crit">
                    Não foi possível criar a organização. Tente novamente.
                  </div>
                )}
                <button
                  onClick={() => create.mutate()}
                  disabled={!canCreate || create.isPending}
                  className="mt-2.5 w-full rounded-lg bg-v2-green px-3 py-1.5 text-[12.5px] font-[650] text-white disabled:opacity-50"
                >
                  {create.isPending ? "Criando…" : "Criar"}
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="mt-4 flex flex-col gap-3">
        {!isFetched && <div className="text-[13px] text-v2-ink-3">Carregando organizações…</div>}

        {isFetched && orgs.length === 0 && (
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px] text-[13px] text-v2-ink-3">
            Nenhuma organização ainda.
          </div>
        )}

        {orgs.map(({ org, role }) => {
          const isCurrent = org.id === orgId;
          const initial = org.name.trim().charAt(0).toUpperCase() || "?";
          const location = [org.city, org.state].filter(Boolean).join(" · ");
          return (
            <div
              key={org.id}
              className={`flex items-center gap-3.5 rounded-[13px] border-[1.5px] bg-v2-card px-5 py-[18px] ${
                isCurrent ? "border-v2-green" : "border-v2-line !border-[1px]"
              }`}
            >
              <span
                className={`grid h-11 w-11 flex-none place-items-center rounded-[11px] text-[15px] font-semibold ${
                  isCurrent ? "bg-v2-green text-white" : "bg-v2-panel/10 text-v2-panel"
                }`}
              >
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-[650] text-v2-ink">{org.name}</span>
                  {isCurrent && (
                    <span className="rounded bg-v2-green-tint px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-green">
                      ATUAL
                    </span>
                  )}
                  {role && (
                    <span className="rounded bg-v2-track px-[7px] py-0.5 font-mono text-[9.5px] font-bold text-v2-ink-3">
                      {ROLE_LABEL[role] ?? role}
                    </span>
                  )}
                </div>
                {location && <div className="mt-[3px] text-[12.5px] text-v2-ink-3">{location}</div>}
              </div>
              {!isCurrent && (
                <button
                  onClick={() => setOrgId(org.id)}
                  // O rótulo diz o que acontece: não é "abrir", é trocar o contexto do app.
                  title="Troca o contexto de todas as telas para esta organização"
                  className="px-2.5 py-[7px] text-[13px] font-[650] text-v2-green hover:text-v2-green-hover"
                >
                  Trocar para esta →
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Consequence icon="🛡" tone="neutral">
        Trocar de organização recarrega todos os dados do app com o contexto novo. Nada do que você
        estiver vendo agora é levado junto.
      </Consequence>
    </div>
  );
}
