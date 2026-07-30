import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTerritoryStats } from "@/lib/territory.functions";
import { listVocabulary } from "@/lib/vocabulary.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/use-current-org";
import { JundiaiMap, type MapBairro } from "@/components/v2/jundiai-map";
import {
  BLIND_ACTION_CLASS,
  BlindNote,
  BlindPanel,
  BlindValue,
} from "@/components/v2/empty-signal";
import { HeadlineAccent, ScreenHeadline } from "@/components/v2/screen-headline";

export const Route = createFileRoute("/_app/territorio")({
  head: () => ({ meta: [{ title: "Território — Inpol v2" }] }),
  component: Screen,
});

/** S5 — Território: mapa REAL de Jundiaí (Leaflet/OSM) por bairro + ranking com tendência.
 *  Dados reais via getTerritoryStats (org atual). Bairros que o mapa não reconhece entram
 *  no fluxo de vínculo manual (o vínculo é apenas de sessão — não há endpoint para persisti-lo). */

type Tone = "green" | "flat" | "warn" | "crit";

const APPROVAL_TONE: Record<Tone, string> = {
  green: "text-v2-green",
  flat: "text-v2-ink-3",
  warn: "text-v2-warn",
  crit: "text-v2-crit",
};

/** Coordenadas dos bairros de Jundiaí que o mapa reconhece (chave = nome exato como
 *  a IA classifica). As primeiras foram geocodificadas via OSM/Nominatim a partir dos
 *  bairros que realmente aparecem nas mensagens; as demais são pontos conhecidos da
 *  cidade. Um bairro classificado que não estiver aqui vira "desconhecido" e pode ser
 *  vinculado manualmente. */
const COORDS: Record<string, { lat: number; lng: number }> = {
  // Bairros presentes nos dados reais (geocodificados)
  Morada: { lat: -23.14188, lng: -46.92396 },
  Ivoturucaia: { lat: -23.18276, lng: -46.80879 },
  CECAP: { lat: -23.14108, lng: -46.92273 },
  "Vila Arens": { lat: -23.19898, lng: -46.87742 },
  "Ponte São João": { lat: -23.18447, lng: -46.87552 },
  "Vila Rami": { lat: -23.2138, lng: -46.88004 },
  Maringá: { lat: -23.227, lng: -46.88164 },
  Vianelo: { lat: -23.20639, lng: -46.87712 },
  "Jardim America": { lat: -23.18838, lng: -46.91346 },
  // Outros bairros conhecidos de Jundiaí (dados futuros / outras orgs)
  Centro: { lat: -23.1866, lng: -46.895 },
  "Eloy Chaves": { lat: -23.158, lng: -46.928 },
  Medeiros: { lat: -23.229, lng: -46.908 },
  Anhangabaú: { lat: -23.202, lng: -46.915 },
  Retiro: { lat: -23.215, lng: -46.87 },
};

/**
 * O vocabulário é digitado à mão e a IA devolve o bairro como apareceu na mensagem — "Vila Arens"
 * e "vila arens" são o mesmo lugar. Comparar sem normalizar faria bairro monitorado aparecer como
 * ponto cego, que é justamente a leitura errada que esta tela existe para evitar.
 */
function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toneForApproval(approval: number): Tone {
  if (approval >= 60) return "green";
  if (approval >= 40) return "flat";
  if (approval >= 25) return "warn";
  return "crit";
}

const RANGES = [
  { id: "7d", days: 7, label: "7 dias" },
  { id: "30d", days: 30, label: "30 dias" },
  { id: "90d", days: 90, label: "90 dias" },
] as const;

/**
 * Volume mínimo para um bairro entrar na manchete.
 *
 * `approval` é derivado da média de sentimento (ver `getTerritoryStats`), então um bairro com
 * DUAS mensagens ruins marca 10% e lideraria o "pior bairro" lido em voz alta na reunião. O
 * ranking na lateral pode mostrar tudo — a manchete, não: ela precisa de base. Abaixo do piso, a
 * tela diz que não há volume, em vez de apontar um bairro por acidente estatístico.
 */
const HEADLINE_MIN_MSGS = 5;

/** 50% é o ponto neutro da escala de aprovação — acima disso não há "perdendo" a declarar. */
const NEUTRAL_APPROVAL = 50;

type Item = { name: string; msgs: number; sentiment: number; approval: number };

function Screen() {
  const { orgId } = useCurrentOrg();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30d");
  const days = RANGES.find((r) => r.id === range)?.days ?? 30;
  /** unknownName -> known bairro name it was linked to (vínculo só de sessão) */
  const [links, setLinks] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["territory", orgId, days],
    queryFn: () => getTerritoryStats({ data: { orgId: orgId as string, days } }),
    enabled: !!orgId,
  });

  // O ranking só enxerga bairro que APARECEU em mensagem. Sem saber quais bairros a org
  // declarou monitorar (vocabulário) e onde existe grupo de WhatsApp escutando, a tela não
  // consegue distinguir "esse bairro está quieto" de "esse bairro nunca foi escutado" — que é
  // exatamente o erro que faz um gabinete achar que uma região está tranquila.
  const { data: vocab = [] } = useQuery({
    queryKey: ["vocab", orgId],
    enabled: !!orgId,
    queryFn: () => listVocabulary({ data: { orgId: orgId as string } }),
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["territorio-grupos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("whatsapp_groups")
        .select("id, subject, neighborhood_tag, is_monitored")
        .eq("org_id", orgId!);
      return rows ?? [];
    },
  });

  // Memoizado porque alimenta o cálculo de cobertura: recriar o array a cada render refazia a
  // varredura de bairros sem necessidade.
  const items: Item[] = useMemo(() => data?.items ?? [], [data]);
  const known = items.filter((it) => COORDS[it.name]);
  const unknown = items.filter((it) => !COORDS[it.name]);
  const unlinked = unknown.filter((u) => !links[u.name]);

  /**
   * Cobertura da escuta. O universo de bairros é o vocabulário da org (o que ela declarou querer
   * monitorar) somado aos bairros que o mapa conhece — se um deles não aparece no ranking, isso
   * tem DOIS significados opostos e a tela precisa separá-los:
   *   • tem grupo monitorado vinculado → `0` mensagens no período (silêncio observado, é notícia)
   *   • não tem grupo nenhum          → `—` não escutamos (o sistema é cego ali)
   */
  const coverage = useMemo(() => {
    const monitoredByPlace = new Map<string, number>();
    for (const g of groups) {
      if (!g.is_monitored || !g.neighborhood_tag) continue;
      const key = normalizePlace(g.neighborhood_tag);
      if (!key) continue;
      monitoredByPlace.set(key, (monitoredByPlace.get(key) ?? 0) + 1);
    }

    const heard = new Set(items.map((it) => normalizePlace(it.name)));
    const universe = new Map<string, string>(); // normalizado -> nome exibível
    for (const v of vocab) {
      if (v.kind !== "neighborhood") continue;
      const name = (v.value ?? "").trim();
      if (name) universe.set(normalizePlace(name), name);
    }
    for (const name of Object.keys(COORDS)) universe.set(normalizePlace(name), name);

    const silentMonitored: string[] = [];
    const blind: string[] = [];
    for (const [key, name] of universe) {
      if (heard.has(key)) continue;
      if (monitoredByPlace.has(key)) silentMonitored.push(name);
      else blind.push(name);
    }
    const collate = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    return {
      heardCount: items.length,
      silentMonitored: silentMonitored.sort(collate),
      blind: blind.sort(collate),
      // Grupo monitorado sem bairro vinculado escuta mensagem mas não sabe DE ONDE ela veio:
      // o volume entra nos temas e some do mapa. É um ponto cego que ninguém vê acontecer.
      groupsWithoutPlace: groups.filter((g) => g.is_monitored && !g.neighborhood_tag).length,
      monitoredGroups: groups.filter((g) => g.is_monitored).length,
    };
  }, [groups, items, vocab]);

  const mapBairros = useMemo<MapBairro[]>(() => {
    const base: MapBairro[] = known.map((b) => ({
      name: b.name,
      approval: b.approval,
      sentiment: b.sentiment,
      msgs: b.msgs,
      tone: toneForApproval(b.approval),
      lat: COORDS[b.name].lat,
      lng: COORDS[b.name].lng,
    }));
    for (const u of unknown) {
      const target = links[u.name];
      if (!target) continue;
      const k = COORDS[target];
      if (!k) continue;
      base.push({
        name: u.name,
        approval: u.approval,
        sentiment: u.sentiment,
        msgs: u.msgs,
        tone: toneForApproval(u.approval),
        lat: k.lat,
        lng: k.lng,
        linked: true,
      });
    }
    return base;
  }, [known, unknown, links]);

  const best = known.length > 0 ? known[0] : undefined; // items já vêm ordenados por approval desc
  const worst = known.length > 0 ? known[known.length - 1] : undefined;

  const totalMsgs = items.reduce((s, it) => s + it.msgs, 0);

  /**
   * A manchete: "onde estou perdendo?".
   *
   * Toda afirmação aqui tem que sobreviver a ser lida em voz alta. Por isso a ordem dos testes é
   * do menos para o mais afirmativo: primeiro checamos se temos direito de falar da cidade
   * (escuta ativa, mensagem classificada, volume mínimo), e só no fim apontamos bairro.
   * Não há período anterior nesta query (`getTerritoryStats` agrega uma janela só), então a
   * manchete NUNCA diz "piorou" — diz onde está pior, que é o que os dados sustentam.
   */
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range;
  const rankable = items.filter((it) => it.msgs >= HEADLINE_MIN_MSGS);
  // Ficam de fora do ranking, mas não somem: bairro com 1 mensagem existe e a pessoa
  // precisa saber que ele apareceu — só não pode disputar posição com quem tem 600.
  const thinVolume = items
    .filter((it) => it.msgs < HEADLINE_MIN_MSGS)
    .sort((a, b) => b.msgs - a.msgs);
  // O insight de rodapé usa o MESMO piso da manchete. Antes olhava `items` inteiro e
  // elegia os dois piores por aprovação — que eram bairros de 1 e 2 mensagens, gerando
  // "Jundiaí e Várzea Paulista concentram 0% das mensagens", uma frase sem informação.
  const negatives = [...rankable]
    .filter((it) => it.approval < NEUTRAL_APPROVAL)
    .sort((a, b) => a.approval - b.approval)
    .slice(0, 2);
  const negativeShare =
    totalMsgs > 0 ? Math.round((negatives.reduce((s, it) => s + it.msgs, 0) / totalMsgs) * 100) : 0;
  const worstRanked = [...rankable].sort((a, b) => a.approval - b.approval);
  const losing = worstRanked.filter((it) => it.approval < NEUTRAL_APPROVAL).slice(0, 2);
  const losingMsgs = losing.reduce((s, it) => s + it.msgs, 0);

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  const headline = (() => {
    if (isError) return { blind: true, text: <>Não foi possível ler o território agora.</> };
    if (coverage.monitoredGroups === 0) {
      return {
        blind: true,
        text: <>Não há como dizer onde você está perdendo: nenhum bairro tem escuta ativa.</>,
      };
    }
    if (items.length === 0) {
      return {
        blind: true,
        text: (
          <>
            Nenhuma mensagem classificada por bairro em {rangeLabel}, com {coverage.monitoredGroups}{" "}
            grupo{coverage.monitoredGroups > 1 ? "s" : ""} escutando.
          </>
        ),
      };
    }
    if (losing.length === 0 && rankable.length === 0) {
      return {
        blind: true,
        text: (
          <>
            Nenhum bairro chega a {HEADLINE_MIN_MSGS} mensagens em {rangeLabel} — volume baixo
            demais para apontar onde você está perdendo.
          </>
        ),
      };
    }
    if (losing.length === 0) {
      const best = worstRanked[worstRanked.length - 1];
      return {
        blind: false,
        text: (
          <>
            Nenhum bairro em terreno negativo em {rangeLabel} — o mais baixo é{" "}
            <HeadlineAccent tone="green">{worstRanked[0].name}</HeadlineAccent>, com{" "}
            {worstRanked[0].approval}% de aprovação
            {best && best.name !== worstRanked[0].name
              ? ` (o melhor, ${best.name}, tem ${best.approval}%)`
              : ""}
            .
          </>
        ),
      };
    }
    return {
      blind: false,
      text: (
        <>
          <HeadlineAccent>{losing.map((it) => it.name).join(" e ")}</HeadlineAccent>{" "}
          {losing.length > 1 ? "são os bairros mais negativos" : "é o bairro mais negativo"} em{" "}
          {rangeLabel} — {losing.map((it) => `${it.approval}%`).join(" e ")} de aprovação em{" "}
          {losingMsgs.toLocaleString("pt-BR")} mensagens.
        </>
      ),
    };
  })();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScreenHeadline
          eyebrow={`TERRITÓRIO · ${rangeLabel.toUpperCase()}`}
          // A cobertura vem de outra query: sem ela, "nenhum bairro tem escuta ativa" seria dito
          // só porque a lista de grupos ainda não chegou.
          loading={isLoading || groupsLoading}
          loadingLabel="Apurando o território…"
          blind={headline.blind}
          note={
            // O recorte da manchete: ela fala dos bairros com escuta, nunca da cidade inteira.
            <>
              {coverage.heardCount} bairro(s) com sinal no período
              {coverage.blind.length > 0 && ` · ${coverage.blind.length} sem escuta nenhuma`}
              {coverage.groupsWithoutPlace > 0 &&
                ` · ${coverage.groupsWithoutPlace} grupo(s) monitorado(s) sem bairro vinculado`}
              .
            </>
          }
        >
          {headline.text}
        </ScreenHeadline>
        <div className="flex gap-0.5 rounded-lg bg-v2-track p-[3px]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={
                r.id === range
                  ? "rounded-[7px] bg-v2-card px-3.5 py-1.5 text-[12.5px] font-[650] text-v2-ink shadow-[0_1px_2px_rgba(33,31,28,0.08)]"
                  : "px-3.5 py-1.5 text-[12.5px] font-semibold text-v2-ink-3"
              }
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="mt-3 text-[12.5px] text-v2-crit">
          Não foi possível carregar os dados de território. Tente novamente.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 ? (
        // Nenhum bairro no ranking tem duas causas opostas. Com grupo monitorado, o período
        // realmente foi vazio; sem grupo, não houve escuta nenhuma — e prometer "aguarde novas
        // análises" nesse caso é mandar o gabinete esperar por algo que nunca vai chegar.
        <div className="mt-[22px] rounded-[13px] border border-v2-line bg-v2-card px-6 py-10 text-center">
          <div className="text-[13.5px] font-[650] text-v2-ink">
            {coverage.monitoredGroups === 0
              ? "Nenhum bairro está sendo escutado"
              : "Nenhuma mensagem com bairro classificado no período"}
          </div>
          <p className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-normal text-v2-ink-3">
            {coverage.monitoredGroups === 0
              ? "Não há grupo de WhatsApp monitorado nesta organização, então o mapa não tem o que mostrar — isto não significa que o território esteja calmo."
              : `${coverage.monitoredGroups} grupo(s) monitorado(s) e nenhuma mensagem classificada por bairro em ${range}. Cadastre bairros no Vocabulário (Ajustes) para a IA reconhecê-los.`}
          </p>
          <Link to="/rede" className={`${BLIND_ACTION_CLASS} mt-3`}>
            Ver grupos monitorados
          </Link>
        </div>
      ) : (
        <div className="mt-[22px] grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* Real Jundiaí map */}
          <div className="relative overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
            <JundiaiMap
              bairros={mapBairros}
              caption={`MAPA DE JUNDIAÍ · APROVAÇÃO ${range.toUpperCase()}`}
            />
            <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[1000] flex gap-3 rounded-lg bg-white/90 px-3 py-[7px] text-[11px] text-v2-ink-2">
              <LegendSwatch className="bg-v2-green" label={">60%"} />
              <LegendSwatch className="bg-v2-faint" label="40–60%" />
              <LegendSwatch className="bg-v2-warn-strong" label="25–40%" />
              <LegendSwatch className="bg-v2-crit" label={"<25%"} />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {/* "Melhor/Pior bairro" sem valor não é empate: é ausência de bairro localizável.
                  O motivo evita a leitura de que a cidade está uniforme. */}
              <StatCard
                label="Melhor bairro"
                value={best ? `${best.name} · ${best.approval}%` : null}
                why="nenhum bairro localizado no mapa"
                tone="green"
              />
              <StatCard
                label="Pior bairro"
                value={worst ? `${worst.name} · ${worst.approval}%` : null}
                why="nenhum bairro localizado no mapa"
                tone="crit"
              />
            </div>

            {/* Ranking */}
            <div className="flex-1 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[14px] font-[650] text-v2-ink">Ranking</span>
                <span className="font-mono text-[10.5px] text-v2-faint">APROVAÇÃO · MSGS</span>
              </div>
              {/* Recorte explícito: o ranking é uma lista de quem falou, não da cidade inteira.
                  Sem isso, um bairro ausente lê como "sem problema" em vez de "sem escuta". */}
              <BlindNote className="mb-2.5">
                Só bairros com mensagem classificada no período. Os demais estão em “Cobertura da
                escuta”, abaixo.
              </BlindNote>
              {/* Duas listas, não uma. A manchete exige piso de volume para não deixar um bairro
                  de 1 mensagem liderar — mas o ranking mostrava TODOS misturados, então o topo
                  vinha com 74%/78% de bairros com 1 mensagem cada, desmentindo a manchete logo
                  acima. Abaixo do piso a aprovação não é medida de nada: é uma ou duas frases. */}
              <div className="flex flex-col">
                {isLoading && <span className="py-2 text-[12px] text-v2-ink-3">Carregando…</span>}
                {!isLoading &&
                  rankable.map((row, i) => (
                    <RankRow
                      key={row.name}
                      row={row}
                      pos={i + 1}
                      last={i === rankable.length - 1}
                    />
                  ))}
                {!isLoading && rankable.length === 0 && (
                  <span className="py-2 text-[12px] text-v2-ink-3">
                    Nenhum bairro com volume suficiente para comparar.
                  </span>
                )}
              </div>
              {!isLoading && thinVolume.length > 0 && (
                <div className="mt-3 border-t border-v2-track pt-3">
                  <BlindNote className="mb-1.5">
                    Menos de {HEADLINE_MIN_MSGS} mensagens no período — volume baixo demais para a
                    aprovação significar alguma coisa. Listados para você saber que existem.
                  </BlindNote>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {thinVolume.map((row) => (
                      <span key={row.name} className="font-mono text-[11px] text-v2-faint">
                        {row.name} <span className="text-v2-line-strong">·</span> {row.msgs}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI insight */}
            {negatives.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
                <span>✦</span>
                <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
                  {negatives.map((n) => n.name).join(" e ")} concentram {negativeShare}% das
                  mensagens do período — percentual calculado só sobre bairros com escuta.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cobertura da escuta — a resposta para "o que este mapa NÃO está me mostrando". */}
      {!isLoading && !isError && (
        <CoveragePanel
          heardCount={coverage.heardCount}
          silentMonitored={coverage.silentMonitored}
          blind={coverage.blind}
          groupsWithoutPlace={coverage.groupsWithoutPlace}
          range={range}
        />
      )}

      {/* Unknown-to-Maps bairros — link to a known one so they count on the map */}
      {unlinked.length > 0 && (
        <UnknownPanel
          unknown={unlinked}
          known={known}
          onLink={(name, target) => setLinks((prev) => ({ ...prev, [name]: target }))}
        />
      )}
      {Object.keys(links).length > 0 && (
        <p className="mt-3 font-mono text-[11px] text-v2-green">
          ✓{" "}
          {Object.entries(links)
            .map(([u, k]) => `${u} → ${k}`)
            .join(" · ")}{" "}
          — agora no mapa.
        </p>
      )}
    </div>
  );
}

/**
 * Cobertura da escuta: o painel que responde "quais bairros este mapa não me mostra, e por quê".
 * Três estados, propositalmente separados — juntá-los é o bug original:
 *   • com sinal          → o mapa fala por eles
 *   • monitorado, `0`    → escutamos e o período foi mudo (informação de verdade)
 *   • sem escuta, `—`    → ponto cego; o número que falta não existe em lugar nenhum
 */
function CoveragePanel({
  heardCount,
  silentMonitored,
  blind,
  groupsWithoutPlace,
  range,
}: {
  heardCount: number;
  silentMonitored: string[];
  blind: string[];
  groupsWithoutPlace: number;
  range: string;
}) {
  if (heardCount === 0 && silentMonitored.length === 0 && blind.length === 0) return null;
  return (
    <div className="mt-4 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-[650] text-v2-ink">Cobertura da escuta</span>
        <span className="font-mono text-[10.5px] text-v2-faint">
          BAIRROS DO VOCABULÁRIO + BAIRROS DO MAPA
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CoverageCell
          value={`${heardCount}`}
          valueClass="text-v2-green"
          label="com sinal no período"
          hint={`bairros com pelo menos uma mensagem classificada em ${range}`}
        />
        <CoverageCell
          value="0"
          valueClass="text-v2-ink"
          label={`${silentMonitored.length} monitorados, sem mensagem`}
          hint="há grupo escutando: o silêncio aqui é informação real"
          names={silentMonitored}
        />
        <CoverageCell
          value="—"
          valueClass="text-v2-faint"
          label={`${blind.length} sem escuta`}
          hint="nenhum grupo vinculado: o sistema é cego nestes bairros"
          names={blind}
        />
      </div>

      {blind.length > 0 && (
        <BlindPanel
          className="mt-3.5"
          title={`${blind.length} bairro(s) fora do monitoramento`}
          action={
            <Link to="/rede" className={BLIND_ACTION_CLASS}>
              Vincular grupos a bairros
            </Link>
          }
        >
          Estes bairros nunca aparecem no mapa nem no ranking porque não há grupo de WhatsApp
          monitorado vinculado a eles. Qualquer conclusão sobre a cidade inteira — média de
          aprovação, “bairro mais crítico”, tema regional — exclui esta lista.
        </BlindPanel>
      )}

      {groupsWithoutPlace > 0 && (
        <BlindPanel
          className="mt-3"
          title={`${groupsWithoutPlace} grupo(s) monitorado(s) sem bairro vinculado`}
          action={
            <Link to="/rede" className={BLIND_ACTION_CLASS}>
              Vincular bairro aos grupos
            </Link>
          }
        >
          As mensagens desses grupos entram nos temas e nos alertas, mas não têm origem territorial
          — some do mapa sem deixar rastro. É volume real que o Território não conta.
        </BlindPanel>
      )}
    </div>
  );
}

function CoverageCell({
  value,
  valueClass,
  label,
  hint,
  names,
}: {
  value: string;
  valueClass: string;
  label: string;
  hint: string;
  names?: string[];
}) {
  return (
    <div className="rounded-xl border border-v2-line bg-v2-bg/40 px-3.5 py-3">
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[18px] font-[650] ${valueClass}`}>{value}</span>
        <span className="text-[12.5px] font-semibold text-v2-ink-2">{label}</span>
      </div>
      <BlindNote className="mt-1">{hint}</BlindNote>
      {names && names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {names.slice(0, 8).map((n) => (
            <span
              key={n}
              className="rounded-full bg-v2-track px-[9px] py-[3px] text-[11px] text-v2-ink-2"
            >
              {n}
            </span>
          ))}
          {names.length > 8 && (
            <span className="px-1 py-[3px] font-mono text-[11px] text-v2-faint">
              +{names.length - 8}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function UnknownPanel({
  unknown,
  known,
  onLink,
}: {
  unknown: Item[];
  known: Item[];
  onLink: (name: string, target: string) => void;
}) {
  return (
    <div className="mt-4 rounded-[13px] border border-v2-warn-strong/40 bg-v2-warn-bg/50 px-[18px] py-4">
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <span className="text-[13.5px] font-[650] text-v2-ink">
          Bairros não localizados no mapa ({unknown.length})
        </span>
      </div>
      <p className="mt-1 max-w-[640px] text-[12.5px] leading-normal text-v2-ink-2">
        Estes bairros foram identificados nas mensagens mas o mapa de Jundiaí não os reconhece (nome
        informal, loteamento novo ou grafia diferente). Vincule cada um a um bairro conhecido para
        as mensagens contarem no território.
        {known.length === 0 && (
          <>
            {" "}
            <b>
              Nenhum bairro do período tem coordenada, então o mapa está vazio e não há alvo para
              vincular — o volume abaixo existe, mas nenhum ponto do mapa o representa.
            </b>
          </>
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {/* Antes este painel inteiro sumia quando `known` era vazio — o pior caso possível: 100%
            das mensagens fora do mapa e nenhuma tela dizendo isso. Agora ele lista mesmo sem
            destino de vínculo. */}
        {unknown.map((u) => (
          <UnknownRow key={u.name} u={u} known={known} onLink={onLink} />
        ))}
      </div>
    </div>
  );
}

function UnknownRow({
  u,
  known,
  onLink,
}: {
  u: Item;
  known: Item[];
  onLink: (name: string, target: string) => void;
}) {
  const [target, setTarget] = useState<string>(known[0]?.name ?? "");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-v2-line bg-v2-card px-3.5 py-2.5">
      <span className="rounded bg-v2-warn-bg px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] text-v2-warn">
        SEM COORDENADA
      </span>
      <span className="text-[13.5px] font-semibold text-v2-ink">{u.name}</span>
      <span className="font-mono text-[11px] text-v2-faint">
        {u.msgs} msgs · {u.approval}%
      </span>
      <div className="flex-1" />
      {known.length === 0 ? (
        <BlindValue why="sem bairro de destino no período" />
      ) : (
        <>
          <span className="text-[12px] text-v2-ink-3">Vincular a</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-lg border border-v2-line-strong bg-v2-card px-2.5 py-1.5 text-[12.5px] text-v2-ink outline-none focus:border-v2-green"
          >
            {known.map((k) => (
              <option key={k.name} value={k.name}>
                {k.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => onLink(u.name, target)}
            className="rounded-lg bg-v2-ink px-3.5 py-1.5 text-[12.5px] font-[650] text-white"
          >
            Vincular
          </button>
        </>
      )}
    </div>
  );
}

function RankRow({ row, pos, last }: { row: Item; pos: number; last: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-[9px] ${last ? "" : "border-b border-v2-track"}`}>
      <span className="w-[18px] font-mono text-[11px] text-v2-faint">{pos}</span>
      <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">{row.name}</span>
      <span
        className={`w-[38px] text-right font-mono text-[12px] ${APPROVAL_TONE[toneForApproval(row.approval)]}`}
      >
        {row.approval}%
      </span>
      <span className="w-[60px] text-right font-mono text-[11px] text-v2-faint">{row.msgs}</span>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px]">
      <span className={`inline-block h-[9px] w-[9px] rounded-[2px] ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  why,
  tone,
}: {
  label: string;
  /** `null` = não há como saber (sem bairro localizado), nunca "empate". */
  value: string | null;
  why: string;
  tone: "green" | "crit";
}) {
  const color = tone === "green" ? "text-v2-green" : "text-v2-crit";
  return (
    <div className="flex-1 rounded-xl border border-v2-line bg-v2-card px-4 py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      {value == null ? (
        <div className="mt-1 text-[17px] font-[650]">
          <BlindValue why={why} showWhy={false} />
          <span className="ml-2 text-[11.5px] font-normal text-v2-faint">{why}</span>
        </div>
      ) : (
        <div className={`mt-1 text-[17px] font-[650] ${color}`}>{value}</div>
      )}
    </div>
  );
}
