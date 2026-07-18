import { createFileRoute, Link } from "@tanstack/react-router";
import { V2Eyebrow } from "@/components/v2/shell";

export const Route = createFileRoute("/v2/")({
  head: () => ({ meta: [{ title: "Painel — Inpol v2" }] }),
  component: Painel,
});

/** S1 — Painel: single focus + zones. Demo data (real feed wired at cutover). */
function Painel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
          SEXTA-FEIRA, 18 DE JULHO · SINCRONIZADO HÁ 4 MIN
        </div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-v2-ink">
          Bom dia, Marina. <span className="text-v2-crit">1 assunto</span> precisa de você antes do
          meio-dia.
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* Critical focus card */}
        <div className="overflow-hidden rounded-2xl border border-v2-line bg-v2-card shadow-[0_1px_2px_rgba(33,31,28,0.04)]">
          <div className="h-1 bg-v2-crit" />
          <div className="p-6">
            <div className="flex items-center gap-2.5">
              <span className="rounded bg-v2-crit-bg px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] text-v2-crit">
                CRÍTICO
              </span>
              <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-v2-faint">
                JANELA: ATÉ 12:00
              </span>
            </div>
            <h2 className="mt-3 text-[21px] font-semibold tracking-tight text-v2-ink">
              Enchente na Vila Rami sem resposta da prefeitura
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-v2-ink-2">
              214 mensagens em 6 grupos citam abandono. Vídeo com 3,2 mil compartilhamentos
              circulando; imprensa local já procura moradores.
            </p>
            <div className="mt-3 flex items-center gap-4 font-mono text-[12px] text-v2-ink-3">
              <span>📍 Vila Rami</span>
              <span>💬 214 msgs</span>
              <span>📈 −0.55</span>
            </div>
            <div className="mt-4 flex gap-2.5">
              <Link
                to="/v2/alertas/$alertId"
                params={{ alertId: "vila-rami" }}
                className="rounded-lg bg-v2-ink px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                Abrir roteiro de ação
              </Link>
              <button className="rounded-lg border border-v2-line-strong bg-v2-card px-4 py-2.5 text-[14px] font-semibold text-v2-ink">
                Ver mensagens
              </button>
            </div>
          </div>
        </div>

        {/* Depois disso */}
        <div className="flex flex-col gap-2">
          <div className="mb-0.5 flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-v2-ink-3">Depois disso</span>
            <div className="h-px flex-1 bg-v2-line" />
          </div>
          <SecondaryRow level="ATENÇÃO" title="Fila de 5h na UBS do Retiro" window="12–48h" />
          <SecondaryRow level="OBSERVAR" title="Boato da creche no Anhangabaú" window="48–72h" />
          <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-3.5">
            <span className="text-[14px]">✦</span>
            <span className="flex-1 text-[12.5px] leading-snug text-v2-green-ink">
              <b>Briefing IA:</b> amplie o conteúdo da ciclovia hoje à tarde.
            </span>
            <button className="text-[12.5px] font-semibold text-v2-green">Ler →</button>
          </div>
        </div>
      </div>

      {/* Understand / follow grid */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="min-w-0">
          <V2Eyebrow dot="green" className="mb-2.5">
            ENTENDER · TEMAS 7D
          </V2Eyebrow>
          <div className="rounded-xl border border-v2-line bg-v2-card p-[18px]">
            <div className="flex flex-col gap-3">
              <ThemeBar label="Enchentes / drenagem" delta="▲210%" tone="crit" pct={92} />
              <ThemeBar label="Saúde / UBS" delta="▲44%" tone="warn" pct={58} />
              <ThemeBar label="Ciclovia nova" delta="▲61%" tone="green" pct={40} />
              <ThemeBar label="Transporte" delta="—2%" tone="flat" pct={26} />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-v2-green" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-v2-ink-3">
              ENTENDER · TERRITÓRIO
            </span>
            <Link to="/v2/territorio" className="ml-auto text-[12px] font-semibold text-v2-green">
              mapa →
            </Link>
          </div>
          <div className="rounded-xl border border-v2-line bg-v2-card p-[18px]">
            <div className="flex flex-col gap-2">
              <ZoneBar label="Centro" pct={71} tone="green" />
              <ZoneBar label="Eloy Chaves" pct={64} tone="green" />
              <ZoneBar label="Anhangabaú" pct={51} tone="flat" />
              <ZoneBar label="Retiro" pct={38} tone="warn" />
              <ZoneBar label="Vila Rami" pct={22} tone="crit" />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <V2Eyebrow dot="faint" className="mb-2.5">
            ACOMPANHAR · SINAIS
          </V2Eyebrow>
          <div className="rounded-xl border border-v2-line bg-v2-card px-[18px] py-2">
            <SignalRow
              src="WHATSAPP · 14:28"
              tone="crit"
              text={'"terceira vez que alaga e ninguém aparece"'}
            />
            <SignalRow
              src="TRIBUNA · 13:50"
              tone="warn"
              text="Retiro: espera de 5h em UBS"
              border
            />
            <SignalRow
              src="INSTAGRAM · 13:12"
              tone="green"
              text="Ciclovia: 1,8 mil curtidas, 94% positivo"
              last
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryRow({
  level,
  title,
  window,
}: {
  level: "ATENÇÃO" | "OBSERVAR";
  title: string;
  window: string;
}) {
  const styles = level === "ATENÇÃO" ? "text-v2-warn bg-v2-warn-bg" : "text-v2-obs bg-v2-obs-bg";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-v2-line bg-v2-card px-4 py-3">
      <span
        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] ${styles}`}
      >
        {level}
      </span>
      <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">{title}</span>
      <span className="font-mono text-[11px] text-v2-faint">{window}</span>
    </div>
  );
}

const BAR_TONE: Record<string, string> = {
  crit: "bg-v2-crit",
  warn: "bg-v2-warn-strong",
  green: "bg-v2-green",
  flat: "bg-v2-line-strong",
};
const DELTA_TONE: Record<string, string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  green: "text-v2-green",
  flat: "text-v2-faint",
};

function ThemeBar({
  label,
  delta,
  tone,
  pct,
}: {
  label: string;
  delta: string;
  tone: string;
  pct: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-[13px] text-v2-ink">
        <span>{label}</span>
        <span className={`font-mono text-[11px] ${DELTA_TONE[tone]}`}>{delta}</span>
      </div>
      <div className="mt-1.5 h-[5px] rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${BAR_TONE[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ZoneBar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px]">
      <span className="w-[86px] text-v2-ink">{label}</span>
      <div className="h-[5px] flex-1 rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${BAR_TONE[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-[30px] text-right font-mono text-[11px] ${DELTA_TONE[tone]}`}>
        {pct}%
      </span>
    </div>
  );
}

function SignalRow({
  src,
  text,
  tone,
  border,
  last,
}: {
  src: string;
  text: string;
  tone: string;
  border?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`py-2.5 ${!last ? "border-b border-v2-track" : ""}`}>
      <div className={`font-mono text-[10px] ${DELTA_TONE[tone]}`}>{src}</div>
      <div className="mt-1 text-[13px] leading-snug text-v2-ink">{text}</div>
    </div>
  );
}
