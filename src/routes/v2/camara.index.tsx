import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/camara/")({
  head: () => ({ meta: [{ title: "Câmara — Inpol v2" }] }),
  component: Screen,
});

/** S14 — Câmara Municipal: sessões, pautas com recomendação de foco, quem falou o quê. Demo data. */
function Screen() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[24px] font-[650] tracking-[-0.01em] text-v2-ink">
            Câmara Municipal
          </div>
          <div className="mt-1 text-[13.5px] text-v2-ink-3">
            Sessões monitoradas, pautas classificadas e o placar de alinhamento dos 19 vereadores.
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="font-mono text-[11px] text-v2-ink-3">
            próxima sessão: <b className="font-bold text-v2-ink">ter 22 jul · 18h</b>
          </span>
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink">
            Todas as sessões
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Base aliada" value="11" valueClass="text-v2-green" suffix="vereadores" />
        <StatCard label="Independentes" value="4" valueClass="text-v2-warn" suffix="em disputa" />
        <StatCard label="Oposição" value="4" valueClass="text-v2-crit" suffix="vereadores" />
        <div className="rounded-xl border border-v2-line bg-v2-card px-[18px] py-3.5">
          <div className="text-[12px] text-v2-ink-3">Cobranças abertas ao governo</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-[650] text-v2-ink">7</span>
            <span className="font-mono text-[11px] text-v2-crit">2 vencem esta semana</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Última sessão + quem falou o quê */}
        <div className="overflow-hidden rounded-[13px] border border-v2-line bg-v2-card self-start">
          <div className="flex gap-4 border-b border-v2-track p-[18px] px-[22px]">
            <div className="relative grid h-[92px] w-[150px] flex-none place-items-center rounded-[9px] bg-gradient-to-br from-v2-ink to-v2-panel">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/90 pl-0.5 text-[13px] text-v2-ink">
                ▶
              </span>
              <span className="absolute bottom-1.5 right-2 rounded px-1.5 py-px font-mono text-[9.5px] text-white bg-v2-ink/60">
                2:47:12
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-v2-green-tint px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.08em] text-v2-green">
                  ÚLTIMA SESSÃO
                </span>
                <span className="font-mono text-[11px] text-v2-faint">
                  32ª ORDINÁRIA · QUI 17 JUL
                </span>
              </div>
              <div className="mt-2 text-[16px] font-[650] text-v2-ink">
                Sessão dominada pela drenagem da zona norte
              </div>
              <div className="mt-1 text-[13px] leading-[1.55] text-v2-ink-2">
                <b>Resumo IA:</b> 4 dos 8 discursos citaram enchentes. Oposição conectou Vila Rami à
                pauta de galerias parada desde 2024. Base defendeu cronograma, mas sem data — ponto
                fraco explorado.
              </div>
            </div>
          </div>
          <div className="px-[22px] pb-1.5 pt-3.5">
            <div className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              QUEM FALOU O QUÊ
            </div>
          </div>
          <div className="px-[22px] pb-2">
            <SpeechRow
              ts="▶ 00:14"
              name="João Parimoschi"
              vereadorId="joao-parimoschi"
              badge="OPOSIÇÃO"
              badgeClass="bg-v2-crit-bg text-v2-crit"
              text="cobrou a galeria da Vila Rami e citou o vídeo viral"
              meta="tom: ataque · tema: enchentes · risco de repercussão alto"
            />
            <SpeechRow
              ts="▶ 00:41"
              name="Rosana Lima"
              vereadorId="rosana-lima"
              badge="BASE"
              badgeClass="bg-v2-green-tint text-v2-green"
              text="defendeu o cronograma de obras, sem citar prazos"
              meta="tom: defesa · fragilidade: faltou data — municiar com cronograma"
            />
            <SpeechRow
              ts="▶ 01:22"
              name="Edson Prado"
              vereadorId="edson-prado"
              badge="INDEP."
              badgeClass="bg-v2-warn-bg text-v2-warn"
              text="pediu audiência pública sobre drenagem"
              meta="tom: neutro · oportunidade: apoiar a audiência aproxima o independente"
              last
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              PAUTA DE TERÇA · O QUE FOCAR
            </div>
            <PautaRow
              tag="FOCAR"
              tagClass="bg-v2-green-tint text-v2-green"
              title="PL 214/26 — Plano de drenagem urbana"
              note="chance de virar resposta pública à Vila Rami"
            />
            <PautaRow
              tag="FOCAR"
              tagClass="bg-v2-green-tint text-v2-green"
              title="Requerimento — reforço na UBS Retiro"
              note="antecipar resposta antes da sessão"
            />
            <PautaRow
              tag="EVITAR"
              tagClass="bg-v2-obs-bg text-v2-faint"
              title="Moção sobre reajuste do IPTU"
              note="pauta-armadilha: sem ganho, alto desgaste"
              last
            />
          </div>

          <div className="flex-1 rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
                VEREADORES EM MOVIMENTO
              </span>
              <button className="text-[12px] font-[650] text-v2-green">todos os 19 →</button>
            </div>
            <VereadorRow
              initials="JP"
              avatarClass="bg-v2-crit-bg text-v2-crit"
              name="João Parimoschi"
              vereadorId="joao-parimoschi"
              meta="alinhamento 23% · risco ALTO"
              metaClass="text-v2-crit"
            />
            <VereadorRow
              initials="EP"
              avatarClass="bg-v2-warn-bg text-v2-warn"
              name="Edson Prado"
              vereadorId="edson-prado"
              meta="alinhamento 58% ▼ · risco MÉDIO"
              metaClass="text-v2-warn"
            />
            <VereadorRow
              initials="RL"
              avatarClass="bg-v2-green-tint text-v2-green"
              name="Rosana Lima"
              vereadorId="rosana-lima"
              meta="alinhamento 91% · risco BAIXO"
              metaClass="text-v2-green"
              last
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
            <span className="text-[14px]">✦</span>
            <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
              Edson Prado caiu 14pts de alinhamento em 30d e pediu audiência sobre drenagem — vale
              aproximação antes de terça.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  suffix,
}: {
  label: string;
  value: string;
  valueClass: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-v2-line bg-v2-card px-[18px] py-3.5">
      <div className="text-[12px] text-v2-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-[22px] font-[650] ${valueClass}`}>{value}</span>
        <span className="text-[12px] text-v2-ink-3">{suffix}</span>
      </div>
    </div>
  );
}

function SpeechRow({
  ts,
  name,
  vereadorId,
  badge,
  badgeClass,
  text,
  meta,
  last,
}: {
  ts: string;
  name: string;
  vereadorId: string;
  badge: string;
  badgeClass: string;
  text: string;
  meta: string;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-3 py-[11px] ${!last ? "border-b border-v2-track" : ""}`}>
      <span className="w-[52px] flex-none font-mono text-[10.5px] text-v2-green">{ts}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-v2-ink">
          <Link
            to="/v2/camara/$vereadorId"
            params={{ vereadorId }}
            className="font-bold text-v2-ink hover:text-v2-green"
          >
            {name}
          </Link>{" "}
          <span className={`rounded px-1.5 py-px font-mono text-[10px] ${badgeClass}`}>
            {badge}
          </span>{" "}
          {text}
        </div>
        <div className="mt-0.5 text-[12px] text-v2-ink-3">{meta}</div>
      </div>
    </div>
  );
}

function PautaRow({
  tag,
  tagClass,
  title,
  note,
  last,
}: {
  tag: string;
  tagClass: string;
  title: string;
  note: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5 py-[9px] ${!last ? "border-b border-v2-track" : ""}`}>
      <span
        className={`flex-none rounded px-[7px] py-[3px] font-mono text-[9.5px] font-bold ${tagClass}`}
      >
        {tag}
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-v2-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-v2-ink-3">{note}</div>
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
      to="/v2/camara/$vereadorId"
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
