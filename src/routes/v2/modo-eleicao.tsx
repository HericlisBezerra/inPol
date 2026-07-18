import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/modo-eleicao")({
  head: () => ({ meta: [{ title: "Modo Eleição — Inpol v2" }] }),
  component: Screen,
});

/** S16 — Modo Eleição: sala de guerra D-79 — share of voice, termômetro por zona, radar de desinformação. Demo data. */
function Screen() {
  return (
    <div className="flex flex-col">
      {/* Gold mode bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-v2-panel-gold px-5 py-2.5 text-[12.5px] text-v2-gold-ink">
        <span className="rounded bg-v2-gold px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-v2-panel-gold">
          MODO ELEIÇÃO
        </span>
        <span>
          Faltam <b className="text-white">79 dias</b> para o 1º turno · Regras da Lei 9.504 ativas:
          publicidade institucional suspensa desde 05 jul
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[11px] opacity-80">
          voltar ao Modo Gestão exige perfil Dono
        </span>
      </div>

      {/* Header + Gestão/Eleição toggle */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
            SALA DE GUERRA · D-79
          </div>
          <div className="mt-1.5 text-[26px] font-[650] tracking-[-0.015em] text-v2-ink">
            Você lidera a conversa, mas <span className="text-v2-crit">perde a zona norte</span>.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-[9px] bg-v2-track p-[3px]">
            <Link
              to="/v2"
              className="px-3 py-[5px] text-[12px] font-semibold text-v2-ink-3 hover:text-v2-ink"
            >
              Gestão
            </Link>
            <span className="rounded-[7px] bg-v2-panel-gold px-3 py-[5px] text-[12px] font-[650] text-v2-gold-ink">
              Eleição
            </span>
          </div>
          <button className="rounded-lg bg-v2-ink px-4 py-[9px] text-[13px] font-[650] text-white">
            Briefing de campanha →
          </button>
        </div>
      </div>

      {/* Top row: share of voice / termômetro / desinfo+conformidade */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-v2-faint">
              SHARE OF VOICE · 7D
            </span>
            <span className="font-mono text-[10px] text-v2-ink-3">grupos + portais + redes</span>
          </div>
          <div className="mt-3 flex flex-col gap-[9px]">
            <VoiceBar
              label="Você (Marina)"
              strong
              pct={44}
              barClass="bg-v2-green"
              pctClass="text-v2-green"
            />
            <VoiceBar label="Parimoschi" pct={31} barClass="bg-v2-crit" pctClass="text-v2-crit" />
            <VoiceBar label="Bertolli" pct={18} barClass="bg-v2-warn" pctClass="text-v2-warn" />
          </div>
          <div className="mt-2.5 font-mono text-[11px] text-v2-crit">
            ⚠ Parimoschi ▲9pts na semana — puxado pela pauta das enchentes
          </div>
        </div>

        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
          <div className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-v2-faint">
            TERMÔMETRO POR ZONA ELEITORAL
          </div>
          <div className="mt-3 flex flex-col gap-[7px]">
            <ZoneRow
              label="Zona 146 · Sul"
              pct={64}
              barClass="bg-v2-green"
              status="favorável"
              statusClass="text-v2-green"
            />
            <ZoneRow
              label="Zona 147 · Centro"
              pct={58}
              barClass="bg-v2-green"
              status="favorável"
              statusClass="text-v2-green"
            />
            <ZoneRow
              label="Zona 148 · Leste"
              pct={49}
              barClass="bg-v2-warn-strong"
              status="disputa"
              statusClass="text-v2-warn"
            />
            <ZoneRow
              label="Zona 149 · Norte"
              pct={31}
              barClass="bg-v2-crit"
              status="crítica"
              statusClass="text-v2-crit"
            />
          </div>
          <div className="mt-2.5 font-mono text-[11px] text-v2-ink-3">
            sentimento das mensagens × seções de 2024 (TSE)
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-v2-crit/25 bg-v2-card px-[18px] py-3.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-v2-crit-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-crit">
                DESINFORMAÇÃO
              </span>
              <span className="font-mono text-[10.5px] text-v2-faint">detectada 11:40</span>
            </div>
            <div className="mt-[7px] text-[13px] font-semibold leading-[1.4] text-v2-ink">
              Áudio falso sobre "fechamento de UBSs após a eleição" em 4 grupos
            </div>
            <div className="mt-[9px] flex gap-2">
              <button className="rounded-[7px] bg-v2-ink px-[11px] py-1.5 text-[12px] font-[650] text-white">
                Kit resposta
              </button>
              <button className="px-1 py-1.5 text-[12px] font-[650] text-v2-ink-3">
                Rastrear origem
              </button>
            </div>
          </div>

          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-3.5">
            <span className="inline-block rounded bg-v2-warn-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-warn">
              CONFORMIDADE
            </span>
            <div className="mt-[7px] text-[13px] font-semibold leading-[1.4] text-v2-ink">
              Post da Secretaria de Obras agendado p/ amanhã viola o período vedado
            </div>
            <div className="mt-1 text-[11.5px] text-v2-ink-3">
              Lei 9.504 art. 73 VI-b · sugerido: cancelar
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
          <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            NARRATIVAS EM DISPUTA
          </div>
          <NarrativeRow
            text={'"Abandono da zona norte"'}
            owner="(deles)"
            status="ganhando · 412 menções"
            statusClass="text-v2-crit"
          />
          <NarrativeRow
            text={'"Cidade que cuida"'}
            owner="(sua)"
            status="estável · 268 menções"
            statusClass="text-v2-warn"
          />
          <NarrativeRow
            text={'"Obras que aparecem"'}
            owner="(sua)"
            status="crescendo · ciclovia ▲61%"
            statusClass="text-v2-green"
            last
          />
        </div>

        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
          <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
            O QUE MUDA NO MODO ELEIÇÃO
          </div>
          <div className="grid grid-cols-1 gap-x-[18px] gap-y-0.5 text-[12.5px] leading-[1.7] text-v2-ink-2 sm:grid-cols-2">
            <span>＋ Sala de Guerra vira o painel inicial</span>
            <span>＋ Share of voice e narrativas em disputa</span>
            <span>＋ Radar de desinformação com kit resposta</span>
            <span>＋ Termômetro por zona/seção eleitoral (TSE)</span>
            <span>＋ Conformidade Lei 9.504 automática</span>
            <span>＋ Briefing 2×/dia (7h e 19h) + D-day countdown</span>
            <span>− Câmara e entregas saem do foco</span>
            <span>− Publicidade institucional bloqueada no fluxo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoiceBar({
  label,
  strong,
  pct,
  barClass,
  pctClass,
}: {
  label: string;
  strong?: boolean;
  pct: number;
  barClass: string;
  pctClass: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-[110px] text-[13px] text-v2-ink ${strong ? "font-[650]" : ""}`}>
        {label}
      </span>
      <div className="h-3.5 flex-1 rounded bg-v2-track">
        <div className={`h-full rounded ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-[34px] text-right font-mono text-[12px] ${pctClass}`}>{pct}%</span>
    </div>
  );
}

function ZoneRow({
  label,
  pct,
  barClass,
  status,
  statusClass,
}: {
  label: string;
  pct: number;
  barClass: string;
  status: string;
  statusClass: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px]">
      <span className="w-[110px] text-v2-ink">{label}</span>
      <div className="h-[5px] flex-1 rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-[60px] text-right font-mono text-[11px] ${statusClass}`}>{status}</span>
    </div>
  );
}

function NarrativeRow({
  text,
  owner,
  status,
  statusClass,
  last,
}: {
  text: string;
  owner: string;
  status: string;
  statusClass: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 ${!last ? "border-b border-v2-track" : ""}`}>
      <span className="flex-1 text-[13px] text-v2-ink">
        {text} <span className="text-v2-ink-3">{owner}</span>
      </span>
      <span className={`font-mono text-[11px] ${statusClass}`}>{status}</span>
    </div>
  );
}
