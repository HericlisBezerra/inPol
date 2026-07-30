import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCaso, type CasoDossie } from "@/lib/casos.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_app/casos/$casoId")({
  head: () => ({ meta: [{ title: "Caso — Inpol v2" }] }),
  component: CasoPage,
});

/**
 * Página do caso — o dossiê de um acontecimento (tema × bairro).
 *
 * Feita para leitura CONJUNTA, projetada numa tela de reunião: abre respondendo
 * "o que é este caso e por que importa" em duas linhas, e só então desce para
 * linha do tempo, evidência, território, pessoas, propagação e relatórios.
 * Sem checkbox, sem workflow — a decisão é da reunião, não do software.
 */

const JANELAS = [
  { dias: 30, label: "30d" },
  { dias: 90, label: "90d" },
  { dias: 180, label: "180d" },
];

const NIVEL: Record<string, { label: string; badge: string; tinta: string; barra: string }> = {
  vermelho: {
    label: "CRÍTICO",
    badge: "bg-v2-crit-bg text-v2-crit",
    tinta: "text-v2-crit",
    barra: "bg-v2-crit",
  },
  laranja: {
    label: "ATENÇÃO",
    badge: "bg-v2-warn-bg text-v2-warn",
    tinta: "text-v2-warn",
    barra: "bg-v2-warn-strong",
  },
  amarelo: {
    label: "OBSERVAÇÃO",
    badge: "bg-v2-obs-bg text-v2-obs",
    tinta: "text-v2-obs",
    barra: "bg-v2-faint",
  },
};

const CANAL: Record<string, string> = {
  whatsapp: "grupos",
  news: "portais",
  instagram: "instagram",
  facebook: "facebook",
  x: "X",
  web_search: "busca web",
};

const temaLegivel = (t: string) => t.replace(/_/g, " ");

function dataCurta(iso: string) {
  try {
    return format(new Date(iso), "d MMM", { locale: ptBR });
  } catch {
    return "—";
  }
}
function dataHora(iso: string) {
  try {
    return format(new Date(iso), "d MMM, HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function CasoPage() {
  const { casoId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const [days, setDays] = useState(90);

  const q = useQuery({
    queryKey: ["caso", orgId, casoId, days],
    queryFn: () => getCaso({ data: { orgId: orgId as string, casoId, days } }),
    enabled: !!orgId,
  });

  if (!orgId) {
    return (
      <Moldura>
        <p className="text-[13.5px] text-v2-ink-3">Selecione uma organização.</p>
      </Moldura>
    );
  }

  if (q.isLoading) {
    return (
      <Moldura>
        <p className="text-[13.5px] text-v2-ink-3">Remontando o caso…</p>
      </Moldura>
    );
  }

  if (q.isError) {
    return (
      <Moldura>
        <div className="rounded-xl border border-v2-crit/30 bg-v2-crit-bg px-4 py-3 text-[13px] text-v2-crit">
          Não foi possível montar este caso. O link pode estar quebrado — volte pela lista de casos.
        </div>
      </Moldura>
    );
  }

  const caso = q.data as CasoDossie;

  if (!caso.existe) {
    return (
      <Moldura>
        <div className="mt-8 flex flex-col items-center gap-2 rounded-[13px] border border-v2-line bg-v2-card px-6 py-12 text-center">
          <span className="text-[26px]">🗂️</span>
          <h1 className="text-[17px] font-[650] text-v2-ink">Caso sem histórico</h1>
          <p className="max-w-md text-[13px] leading-[1.55] text-v2-ink-3">
            Não há alerta nem sinal analisado para{" "}
            <b className="capitalize text-v2-ink-2">{temaLegivel(caso.tema)}</b>
            {caso.bairro ? ` em ${caso.bairro}` : " (sem bairro)"} nos últimos {days} dias. Isso não
            significa que nada aconteceu — significa que o sistema não escutou nada com esse recorte
            no período.
          </p>
          <Link
            to="/casos"
            className="mt-2 rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink"
          >
            Ver todos os casos
          </Link>
        </div>
      </Moldura>
    );
  }

  const nivel = NIVEL[caso.cabecalho?.level ?? "amarelo"] ?? NIVEL.amarelo;

  return (
    <Moldura>
      {/* ---------- Abertura: o que é e por que importa ---------- */}
      <div className="mt-4 flex flex-col items-start justify-between gap-5 lg:flex-row">
        <div className="max-w-[660px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`rounded px-[9px] py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] ${nivel.badge}`}
            >
              {nivel.label}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-v2-ink-3">
              {caso.cabecalho?.stage ?? "caso"}
            </span>
            {caso.cabecalho && !caso.cabecalho.aberto && (
              <span className="font-mono text-[11px] font-semibold text-v2-green">
                ✓ alerta resolvido
              </span>
            )}
          </div>
          <h1 className="mt-2.5 text-[28px] font-[650] capitalize leading-[1.2] tracking-[-0.015em] text-v2-ink">
            {temaLegivel(caso.tema)}
            {caso.bairro && <span className="text-v2-ink-3"> · {caso.bairro}</span>}
          </h1>
          {caso.semBairro && (
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-v2-ink-3">
              Caso de tema puro: nenhum dos sinais que o formaram citou bairro identificável. As
              seções de território ficam indisponíveis por ausência de âncora geográfica — não por
              falta de movimento.
            </p>
          )}
          {caso.cabecalho?.resumo && (
            <p className="mt-2.5 text-[14.5px] leading-[1.6] text-v2-ink-2">
              {caso.cabecalho.resumo}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 whitespace-nowrap font-mono text-[11.5px] text-v2-ink-3">
            <span>
              {dataCurta(caso.janela.inicio)} → hoje
              {caso.janela.estendida && " (janela estendida até o 1º sinal)"}
            </span>
            {caso.linhaDoTempo.esquentouEm && (
              <span className={nivel.tinta}>
                esquentou em {dataCurta(caso.linhaDoTempo.esquentouEm)}
              </span>
            )}
            {caso.linhaDoTempo.pico && (
              <span>
                pico {dataCurta(caso.linhaDoTempo.pico.dia)} · {caso.linhaDoTempo.pico.total} sinais
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full flex-none flex-col gap-2.5 lg:w-[280px]">
          <div className="flex overflow-hidden rounded-lg border border-v2-line">
            {JANELAS.map((j) => (
              <button
                key={j.dias}
                onClick={() => setDays(j.dias)}
                className={
                  j.dias === days
                    ? "flex-1 bg-v2-ink px-3 py-[7px] text-[12.5px] font-[650] text-v2-card"
                    : "flex-1 bg-v2-card px-3 py-[7px] text-[12.5px] font-semibold text-v2-ink-2"
                }
              >
                {j.label}
              </button>
            ))}
          </div>
          {caso.cabecalho?.acao && (
            <div className="rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-3.5">
              <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-v2-green">
                AÇÃO RECOMENDADA
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-v2-green-ink">
                {caso.cabecalho.acao}
              </p>
            </div>
          )}
          {caso.cabecalho?.alertaId && (
            <Link
              to="/alertas/$alertId"
              params={{ alertId: caso.cabecalho.alertaId }}
              className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-center text-[13px] font-[650] text-v2-ink"
            >
              Abrir alerta mais recente
            </Link>
          )}
        </div>
      </div>

      {caso.truncado && (
        <div className="mt-4 rounded-lg border border-v2-warn/30 bg-v2-warn-bg px-3.5 py-2.5 text-[12.5px] text-v2-warn">
          Este caso ultrapassou o teto de mensagens carregadas de uma vez. Os números abaixo são um
          piso, não o total — reduza a janela para uma leitura exata.
        </div>
      )}

      {/* ---------- Números ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <Numero valor={caso.numeros.mensagens} rotulo="sinais" />
        <Numero valor={caso.numeros.autoresDistintos} rotulo="autores distintos" />
        <Numero valor={caso.numeros.gruposDistintos} rotulo="grupos alcançados" />
        <Numero valor={caso.numeros.alertas} rotulo="alertas disparados" />
        <Numero
          valor={caso.numeros.riscoMax}
          rotulo="risco máximo"
          tinta={caso.numeros.riscoMax >= 70 ? "text-v2-crit" : undefined}
        />
      </div>
      {caso.numeros.canais.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-v2-ink-3">
          {caso.numeros.canais.map((c) => (
            <span key={c.k}>
              {CANAL[c.k] ?? c.k}: {c.n}
            </span>
          ))}
          {typeof caso.numeros.sentimentoMedio === "number" && (
            <span className={caso.numeros.sentimentoMedio < 0 ? "text-v2-crit" : "text-v2-green"}>
              sentimento médio {caso.numeros.sentimentoMedio.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* ---------- Linha do tempo ---------- */}
      <Secao
        titulo="LINHA DO TEMPO"
        nota="volume diário de sinais; barras escuras são sinais de risco alto"
      >
        <LinhaDoTempo caso={caso} />
      </Secao>

      {/* ---------- Evidência ---------- */}
      <Secao
        titulo="EVIDÊNCIA"
        nota="citações reais, na íntegra do que foi dito — não paráfrase da IA"
      >
        <Evidencia caso={caso} />
      </Secao>

      {/* ---------- Território + Pessoas ---------- */}
      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <Rotulo>TERRITÓRIO</Rotulo>
          <Territorio caso={caso} />
        </div>
        <div>
          <Rotulo>QUEM APARECE</Rotulo>
          <Pessoas caso={caso} />
        </div>
      </div>

      {/* ---------- Propagação ---------- */}
      <Secao
        titulo="PROPAGAÇÃO"
        nota="texto idêntico circulando em vários grupos em poucas horas indica disparo organizado — mostra propagação, nunca autoria"
      >
        <Propagacao caso={caso} />
      </Secao>

      {/* ---------- Relatórios ---------- */}
      <Secao titulo="ONDE JÁ FOI ANALISADO" nota="menções deste caso nos relatórios do período">
        <Relatorios caso={caso} />
      </Secao>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ */
/* Blocos                                                              */
/* ------------------------------------------------------------------ */

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div>
      <Link to="/casos" className="text-[13px] text-v2-ink-3 hover:text-v2-green">
        ← Voltar para casos
      </Link>
      {children}
    </div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
      {children}
    </div>
  );
}

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-2 flex flex-wrap items-baseline gap-2.5">
        <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          {titulo}
        </span>
        {nota && <span className="text-[11.5px] text-v2-faint">{nota}</span>}
      </div>
      {children}
    </div>
  );
}

function Numero({ valor, rotulo, tinta }: { valor: number; rotulo: string; tinta?: string }) {
  return (
    <div className="rounded-xl border border-v2-line bg-v2-card px-4 py-3">
      <div className={`text-[22px] font-[650] leading-none ${tinta ?? "text-v2-ink"}`}>{valor}</div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-v2-faint">
        {rotulo}
      </div>
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[13px] border border-dashed border-v2-line-strong bg-v2-surface px-[18px] py-4 text-[12.5px] leading-[1.55] text-v2-ink-3">
      {children}
    </div>
  );
}

/* ---------- Linha do tempo ---------- */

function LinhaDoTempo({ caso }: { caso: CasoDossie }) {
  const { dias, marcos } = caso.linhaDoTempo;
  const max = useMemo(() => Math.max(1, ...dias.map((d) => d.total)), [dias]);
  // Só interessa SE houve alerta naquele dia (marca o ponto vermelho na barra); a lista
  // detalhada dos alertas vem logo abaixo do gráfico.
  const diasComAlerta = useMemo(() => new Set(marcos.map((m) => m.dia)), [marcos]);

  if (dias.every((d) => d.total === 0)) {
    return (
      <Vazio>
        Nenhum sinal analisado caiu neste caso na janela escolhida. O caso existe porque houve
        alerta, mas as mensagens que o originaram estão fora do período — amplie a janela.
      </Vazio>
    );
  }

  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
      <div className="flex h-[120px] items-end gap-[2px]">
        {dias.map((d) => {
          const alt = Math.max(d.total > 0 ? 3 : 1, Math.round((d.total / max) * 110));
          const temMarco = diasComAlerta.has(d.dia);
          return (
            <div
              key={d.dia}
              className="group relative flex-1"
              title={`${d.dia} · ${d.total} sinais${d.risco ? ` · ${d.risco} de risco alto` : ""}${
                temMarco ? " · alerta disparado" : ""
              }`}
            >
              {temMarco && (
                <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-v2-crit" />
              )}
              <div
                className={`w-full rounded-t-[2px] ${d.total === 0 ? "bg-v2-track" : "bg-v2-green/35"}`}
                style={{ height: `${alt}px` }}
              >
                {d.risco > 0 && (
                  <div
                    className="w-full rounded-t-[2px] bg-v2-crit"
                    style={{ height: `${Math.round((d.risco / Math.max(1, d.total)) * alt)}px` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-v2-faint">
        <span>{dataCurta(dias[0]?.dia ?? caso.janela.inicio)}</span>
        <span>● alerta disparado</span>
        <span>{dataCurta(dias[dias.length - 1]?.dia ?? caso.janela.fim)}</span>
      </div>

      {marcos.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2 border-t border-v2-track pt-3.5">
          {marcos.map((m) => {
            const n = NIVEL[m.level] ?? NIVEL.amarelo;
            return (
              <div key={m.id} className="flex gap-3">
                <span className="w-[54px] flex-none font-mono text-[11px] text-v2-ink-3">
                  {dataCurta(m.dia)}
                </span>
                <span className={`mt-[5px] h-2 w-2 flex-none rounded-full ${n.barra}`} />
                <p className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-v2-ink-2">
                  <b className={n.tinta}>{n.label.toLowerCase()}</b> · {m.resumo}
                  {m.resolvido && <span className="text-v2-green"> · resolvido</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Evidência ---------- */

type Citacao = CasoDossie["evidencia"]["citacoes"][number];

function Evidencia({ caso }: { caso: CasoDossie }) {
  const { citacoes, recentes, status } = caso.evidencia;

  if (status === "sem_conteudo") {
    return (
      <Vazio>
        Este caso foi formado só por mensagens sem texto legível (áudio, imagem ou vídeo sem
        transcrição). Há sinal, mas não há citação para ler em voz alta.
      </Vazio>
    );
  }
  if (citacoes.length === 0 && recentes.length === 0) {
    return <Vazio>Nenhuma mensagem com texto suficiente foi encontrada para este caso.</Vazio>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {citacoes.map((c) => (
        <Citacao key={c.id} c={c} />
      ))}
      {recentes.length > 0 && (
        <>
          <div className="mt-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            MAIS RECENTES
          </div>
          {recentes.map((c) => (
            <Citacao key={c.id} c={c} compacta />
          ))}
        </>
      )}
    </div>
  );
}

function Citacao({ c, compacta = false }: { c: Citacao; compacta?: boolean }) {
  const tom = c.risco >= 70 ? "text-v2-crit" : c.risco >= 45 ? "text-v2-warn" : "text-v2-ink-3";
  return (
    <div className="flex gap-4 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-3.5">
      <div className="w-9 flex-none text-center">
        <div className={`text-[19px] font-[650] leading-none ${tom}`}>{c.risco}</div>
        <div className="mt-1 font-mono text-[9px] tracking-[0.08em] text-v2-faint">RISCO</div>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-v2-ink ${compacta ? "text-[13px] leading-[1.55]" : "text-[14px] leading-[1.6]"}`}
        >
          “{c.texto}”
        </p>
        <div className="mt-2 flex flex-wrap gap-3 whitespace-nowrap font-mono text-[10.5px] text-v2-ink-3">
          <span>{CANAL[c.canal] ?? c.canal}</span>
          <span className="truncate">{c.origem}</span>
          <span>{dataHora(c.quando)}</span>
          {c.copias > 1 && (
            <span className="text-v2-warn">↻ {c.copias} cópias idênticas no caso</span>
          )}
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-v2-green hover:underline"
            >
              abrir ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Território ---------- */

function Territorio({ caso }: { caso: CasoDossie }) {
  const t = caso.territorio;

  if (t.status === "sem_bairro") {
    return (
      <Vazio>
        Este caso não tem bairro. Os sinais que o formaram falam do tema sem ancorar num local —
        pode ser assunto de cidade inteira, ou pode ser que a IA não tenha conseguido identificar o
        bairro no texto. Sem âncora não há comparação territorial honesta a fazer.
      </Vazio>
    );
  }

  const diffCidade =
    typeof t.sentimentoDoBairro === "number" && typeof t.sentimentoDaCidade === "number"
      ? t.sentimentoDoBairro - t.sentimentoDaCidade
      : null;

  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
      <p className="text-[14px] leading-[1.6] text-v2-ink">
        <b>{t.bairro}</b> — este caso responde por{" "}
        <b className={t.participacaoDoCaso >= 0.25 ? "text-v2-crit" : "text-v2-ink"}>
          {pct(t.participacaoDoCaso)}
        </b>{" "}
        de tudo que o bairro produziu na janela ({t.mensagensNoCaso} de {t.mensagensNoBairro}{" "}
        sinais).
      </p>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-v2-track pt-3 font-mono text-[11.5px] text-v2-ink-2">
        {t.posicaoPorVolume && (
          <span>
            {t.posicaoPorVolume}º bairro em volume entre {t.totalBairros} · últimos {t.diasRanking}{" "}
            dias
          </span>
        )}
        {t.posicaoPorSentimento && (
          <span>
            {t.posicaoPorSentimento}º bairro mais negativo entre {t.totalBairros}
          </span>
        )}
        {typeof t.sentimentoDoCaso === "number" && (
          <span className={t.sentimentoDoCaso < 0 ? "text-v2-crit" : "text-v2-green"}>
            sentimento do caso {t.sentimentoDoCaso.toFixed(2)}
            {typeof t.sentimentoDoBairro === "number" &&
              ` · do bairro ${t.sentimentoDoBairro.toFixed(2)}`}
          </span>
        )}
        {diffCidade !== null && (
          <span className="text-v2-ink-3">
            o bairro está {Math.abs(diffCidade).toFixed(2)} {diffCidade < 0 ? "abaixo" : "acima"} da
            média da cidade
          </span>
        )}
      </div>

      {t.outrosTemas.length > 0 && (
        <div className="mt-3 border-t border-v2-track pt-3">
          <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-v2-faint">
            O QUE MAIS SE FALA NESSE BAIRRO
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.outrosTemas.map((o) => (
              <span
                key={o.tema}
                className="rounded-full bg-v2-track px-2.5 py-1 text-[11.5px] capitalize text-v2-ink-2"
              >
                {temaLegivel(o.tema)} · {o.mensagens}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/territorio"
        className="mt-3.5 inline-block text-[12.5px] font-[650] text-v2-green hover:underline"
      >
        Ver o mapa completo →
      </Link>
    </div>
  );
}

/* ---------- Pessoas ---------- */

function Pessoas({ caso }: { caso: CasoDossie }) {
  const p = caso.pessoas;
  const vazio =
    p.opositores.length === 0 &&
    p.aliados.length === 0 &&
    p.entidades.length === 0 &&
    p.vozes.length === 0;

  if (!p.temAnalise) {
    return (
      <Vazio>
        Nenhuma mensagem deste caso foi analisada na janela — sem análise não há extração de nomes.
      </Vazio>
    );
  }
  if (vazio) {
    return (
      <Vazio>
        A IA leu {caso.numeros.mensagens} sinais deste caso e não encontrou nenhuma pessoa ou
        entidade citada nominalmente. É um caso sobre o problema, não sobre gente.
      </Vazio>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {p.opositores.length > 0 && (
        <GrupoNomes
          titulo="OPOSITORES CITADOS"
          itens={p.opositores.map((o) => ({
            nome: o.nome,
            n: o.n,
            nota: o.cadastrado ? (o.cadastrado.party ?? o.cadastrado.role ?? "monitorado") : null,
          }))}
          tinta="text-v2-crit"
        />
      )}
      {p.aliados.length > 0 && (
        <GrupoNomes
          titulo="ALIADOS CITADOS"
          itens={p.aliados.map((a) => ({ nome: a.nome, n: a.n, nota: null }))}
          tinta="text-v2-green"
        />
      )}
      {p.entidades.length > 0 && (
        <GrupoNomes
          titulo="ENTIDADES E ÓRGÃOS"
          itens={p.entidades.map((e) => ({ nome: e.nome, n: e.n, nota: null }))}
          tinta="text-v2-ink-2"
        />
      )}
      {p.vozes.length > 0 && (
        <GrupoNomes
          titulo="MONITORADOS QUE FALARAM"
          itens={p.vozes.map((v) => ({
            nome: v.nome,
            n: v.mensagens,
            nota: v.bairro ?? v.papel,
          }))}
          tinta="text-v2-blue"
        />
      )}
    </div>
  );
}

function GrupoNomes({
  titulo,
  itens,
  tinta,
}: {
  titulo: string;
  itens: Array<{ nome: string; n: number; nota: string | null }>;
  tinta: string;
}) {
  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-3.5">
      <div className={`font-mono text-[10px] font-bold tracking-[0.08em] ${tinta}`}>{titulo}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {itens.map((i) => (
          <div key={i.nome} className="flex items-baseline gap-2 text-[13px]">
            <span className="flex-1 truncate text-v2-ink">{i.nome}</span>
            {i.nota && <span className="font-mono text-[10.5px] text-v2-faint">{i.nota}</span>}
            <span className="font-mono text-[11.5px] text-v2-ink-3">{i.n}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Propagação ---------- */

function Propagacao({ caso }: { caso: CasoDossie }) {
  const p = caso.propagacao;

  if (p.status === "sem_grupos") {
    return (
      <Vazio>
        Este caso não passou por grupos de WhatsApp — nasceu na imprensa e nas redes. Propagação
        entre grupos não é zero aqui: é inaplicável, porque não existe grupo onde um encaminhamento
        pudesse acontecer.
      </Vazio>
    );
  }
  if (p.status === "sem_fingerprint") {
    return (
      <Vazio>
        As mensagens deste caso são anteriores à impressão digital de conteúdo, então não é possível
        saber se houve texto repetido. Não é ausência de propagação — é ausência de medição.
      </Vazio>
    );
  }
  if (p.status === "nenhum_cluster") {
    return (
      <Vazio>
        Medimos: {p.mensagensDeGrupo} mensagens em {p.gruposDistintos} grupos, e nenhum texto se
        repetiu o bastante em grupos distintos e em pouco tempo para caracterizar disparo. O caso
        cresceu por conversa espontânea, não por encaminhamento organizado.
      </Vazio>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] leading-[1.55] text-v2-ink-2">
        {p.mensagensDeGrupo} mensagens deste caso vieram de {p.gruposDistintos} grupos.{" "}
        {p.clusters.length} {p.clusters.length === 1 ? "texto atingiu" : "textos atingiram"} o
        padrão de propagação organizada.
      </p>
      {p.clusters.map((c, i) => (
        <div
          key={i}
          className="rounded-[13px] border border-v2-warn/30 bg-v2-warn-bg px-[18px] py-3.5"
        >
          <p className="text-[13.5px] leading-[1.6] text-v2-ink">“{c.texto}”</p>
          <div className="mt-2 flex flex-wrap gap-3.5 whitespace-nowrap font-mono text-[11px] text-v2-warn">
            <span>{c.repeticoes}× repetido</span>
            <span>{c.gruposDistintos} grupos distintos</span>
            <span>em {c.janelaHoras}h</span>
            <span className="text-v2-ink-3">
              {dataHora(c.primeira)} → {dataHora(c.ultima)}
            </span>
          </div>
        </div>
      ))}
      <p className="text-[11.5px] leading-[1.5] text-v2-faint">
        O dado mostra que o conteúdo se espalhou de forma organizada. Ele não mostra quem organizou,
        nem com que intenção — qualquer hipótese de origem precisa ser verificada fora daqui.
      </p>
    </div>
  );
}

/* ---------- Relatórios ---------- */

function Relatorios({ caso }: { caso: CasoDossie }) {
  const r = caso.relatorios;

  if (r.total === 0) {
    return (
      <Vazio>
        Nenhum relatório foi gerado nesta janela, então não há onde este caso pudesse ter sido
        analisado. Ausência de relatório, não ausência de menção.
      </Vazio>
    );
  }
  if (r.itens.length === 0) {
    return (
      <Vazio>
        {r.total} {r.total === 1 ? "relatório foi gerado" : "relatórios foram gerados"} na janela e
        nenhum menciona este tema ou bairro pelo nome. O caso ainda não entrou na análise executiva.
      </Vazio>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {r.itens.map((it) => (
        <Link
          key={it.id}
          to="/relatorios/$reportId"
          params={{ reportId: it.id }}
          className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-3.5 transition-colors hover:border-v2-line-strong"
        >
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-v2-ink-3">
              {it.kind}
            </span>
            <span className="text-[14px] font-[650] text-v2-ink">{it.title}</span>
            <span className="font-mono text-[11px] text-v2-faint">
              {dataCurta(it.periodo.inicio)} → {dataCurta(it.periodo.fim)}
            </span>
          </div>
          {it.trecho && (
            <p className="mt-1.5 border-l-2 border-v2-track pl-3 text-[12.5px] leading-[1.55] text-v2-ink-2">
              {it.trecho}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
