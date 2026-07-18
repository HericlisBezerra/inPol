import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — Ajustes" }] }),
  component: WhatsApp,
});

/** S18 — Ajustes · WhatsApp: instâncias conectadas + pareamento por QR. */

function WhatsApp() {
  return (
    <div>
      {/* Cabeçalho do painel */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[16px] font-[650] text-v2-ink">Instâncias WhatsApp</div>
          <div className="mt-[3px] text-[13px] text-v2-ink-3">
            Cada instância é um número que participa dos grupos monitorados.
          </div>
        </div>
        <button className="rounded-lg bg-v2-ink px-3.5 py-2 text-[13px] font-[650] text-white">
          ＋ Nova instância
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* Instância conectada */}
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-v2-green-tint text-[16px] text-v2-green">
              ✆
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-[650] text-v2-ink">Gabinete</div>
              <div className="font-mono text-[10.5px] text-v2-faint">+55 11 9••••-4412</div>
            </div>
            <span className="rounded bg-v2-green-tint px-2 py-[3px] font-mono text-[9.5px] font-bold text-v2-green">
              ● CONECTADA
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-v2-track pt-3 text-[12.5px] text-v2-ink-2">
            <span>
              <b className="text-v2-ink">128</b> grupos
            </span>
            <span>
              <b className="text-v2-ink">14,2 mil</b> msgs/24h
            </span>
            <span>
              uptime <b className="text-v2-green">99,2%</b>
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <button className="rounded-lg border border-v2-line-strong bg-v2-card px-3 py-1.5 text-[12px] font-[650] text-v2-ink">
              Ver grupos
            </button>
            <button className="px-1 py-1.5 text-[12px] font-[650] text-v2-crit">Desconectar</button>
          </div>
        </div>

        {/* Instância pareando (QR) */}
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-v2-warn-bg text-[16px] text-v2-warn">
              ✆
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-[650] text-v2-ink">Campo — Zona Norte</div>
              <div className="font-mono text-[10.5px] text-v2-faint">+55 11 9••••-8830</div>
            </div>
            <span className="rounded bg-v2-warn-bg px-2 py-[3px] font-mono text-[9.5px] font-bold text-v2-warn">
              ⚠ PAREANDO
            </span>
          </div>
          <PairingBlock />
        </div>
      </div>

      {/* Nota LGPD */}
      <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
        <span>🛡</span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
          O inPol só lê grupos dos quais o número participa legitimamente. Mensagens privadas nunca
          são coletadas — política LGPD aplicada na ingestão.
        </span>
      </div>
    </div>
  );
}

/** QR + contagem regressiva de expiração (demo: reinicia ao gerar novo código). */
function PairingBlock() {
  const [seconds, setSeconds] = useState(48);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="mt-3.5 flex items-center gap-4 border-t border-v2-track pt-3">
      <div
        className={`grid h-24 w-24 flex-none place-items-center rounded-[10px] border border-v2-line bg-v2-card ${
          seconds === 0 ? "opacity-30" : ""
        }`}
      >
        <QrGraphic />
      </div>
      <div className="text-[12.5px] leading-[1.6] text-v2-ink-2">
        Abra o WhatsApp no celular de campo → <b className="text-v2-ink">Aparelhos conectados</b> →
        escaneie o código.{" "}
        {seconds > 0 ? (
          <>
            Expira em <b className="text-v2-warn">{mmss}</b>.
          </>
        ) : (
          <b className="text-v2-crit">Código expirado.</b>
        )}
        <button
          onClick={() => setSeconds(59)}
          className="mt-1.5 block text-[12px] font-[650] text-v2-green"
        >
          ↻ Gerar novo código
        </button>
      </div>
    </div>
  );
}

function QrGraphic() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      {/* Marcadores de canto */}
      <rect x="0" y="0" width="20" height="20" className="fill-v2-ink" />
      <rect x="4" y="4" width="12" height="12" className="fill-v2-card" />
      <rect x="7" y="7" width="6" height="6" className="fill-v2-ink" />
      <rect x="52" y="0" width="20" height="20" className="fill-v2-ink" />
      <rect x="56" y="4" width="12" height="12" className="fill-v2-card" />
      <rect x="59" y="7" width="6" height="6" className="fill-v2-ink" />
      <rect x="0" y="52" width="20" height="20" className="fill-v2-ink" />
      <rect x="4" y="56" width="12" height="12" className="fill-v2-card" />
      <rect x="7" y="59" width="6" height="6" className="fill-v2-ink" />
      {/* Módulos */}
      <rect x="28" y="4" width="6" height="6" className="fill-v2-ink" />
      <rect x="38" y="10" width="6" height="6" className="fill-v2-ink" />
      <rect x="28" y="22" width="6" height="6" className="fill-v2-ink" />
      <rect x="44" y="26" width="6" height="6" className="fill-v2-ink" />
      <rect x="10" y="28" width="6" height="6" className="fill-v2-ink" />
      <rect x="22" y="34" width="6" height="6" className="fill-v2-ink" />
      <rect x="34" y="34" width="6" height="6" className="fill-v2-ink" />
      <rect x="56" y="34" width="6" height="6" className="fill-v2-ink" />
      <rect x="64" y="44" width="6" height="6" className="fill-v2-ink" />
      <rect x="28" y="46" width="6" height="6" className="fill-v2-ink" />
      <rect x="40" y="52" width="6" height="6" className="fill-v2-ink" />
      <rect x="52" y="58" width="6" height="6" className="fill-v2-ink" />
      <rect x="30" y="62" width="6" height="6" className="fill-v2-ink" />
    </svg>
  );
}
