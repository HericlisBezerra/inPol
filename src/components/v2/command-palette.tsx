/** S11 — Global ⌘K search. Replaces the standalone Busca page. Demo results. */
import { useEffect, useState } from "react";

const TABS = ["Tudo", "Mensagens", "Imprensa", "Pessoas"];

export function V2CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("ubs retiro");
  const [tab, setTab] = useState(0);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-v2-line bg-v2-surface shadow-[0_24px_64px_rgba(33,31,28,0.24)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-v2-line px-5 py-4">
          <span className="text-lg text-v2-faint">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar mensagens, imprensa, pessoas, ações…"
            className="flex-1 bg-transparent text-[15px] text-v2-ink outline-none placeholder:text-v2-faint"
          />
          <kbd className="rounded border border-v2-line-strong px-1.5 py-0.5 font-mono text-[10px] text-v2-faint">
            esc
          </kbd>
        </div>
        <div className="flex gap-1 border-b border-v2-line px-4 py-2 text-xs">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={
                i === tab
                  ? "rounded-full bg-v2-ink px-3 py-1 font-semibold text-white"
                  : "rounded-full px-3 py-1 font-medium text-v2-ink-2 hover:bg-v2-track"
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className="max-h-[420px] overflow-y-auto px-2 py-2">
          <div className="px-3 pb-1 pt-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            AÇÕES
          </div>
          <button className="flex w-full items-center gap-3 rounded-lg bg-v2-green-tint px-3 py-2.5 text-left">
            <span className="text-v2-green">▲</span>
            <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">
              Abrir alerta "Fila na <Highlight text="UBS do Retiro" q={q} />"
            </span>
            <kbd className="font-mono text-[11px] text-v2-faint">↵</kbd>
          </button>

          <div className="px-3 pb-1 pt-3 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            MENSAGENS · 87 RESULTADOS
          </div>
          {[
            {
              risk: 71,
              text: '"esperei 5 horas com minha mãe na UBS do Retiro, um descaso"',
              src: "Retiro Comunidade · qui 16:40",
            },
            {
              risk: 54,
              text: '"o agendamento da ubs tá fora do ar de novo, alguém sabe?"',
              src: "Retiro Comunidade · qua 09:12",
            },
          ].map((m, i) => (
            <button
              key={i}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-v2-track/60"
            >
              <span
                className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${riskClass(m.risk)}`}
              >
                risco {m.risk}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-snug text-v2-ink">
                  <Highlight text={m.text} q={q} />
                </span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-v2-faint">{m.src}</span>
              </span>
            </button>
          ))}

          <div className="px-3 pb-1 pt-3 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            IMPRENSA
          </div>
          <button className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-v2-track/60">
            <span className="mt-0.5 rounded bg-v2-track px-1.5 py-0.5 font-mono text-[10px] font-bold text-v2-ink-3">
              portal
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] leading-snug text-v2-ink">
                <Highlight text="Moradores do Retiro relatam espera de 5h em UBS" q={q} /> ↗
              </span>
              <span className="mt-0.5 block font-mono text-[10.5px] text-v2-faint">
                Tribuna de Jundiaí · hoje 13:50
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function riskClass(r: number) {
  if (r >= 70) return "bg-v2-crit-bg text-v2-crit";
  if (r >= 40) return "bg-v2-warn-bg text-v2-warn";
  return "bg-v2-obs-bg text-v2-obs";
}

/** Highlights the searched terms inside a result string, like the design (amber marks). */
function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (!terms.length) return <>{text}</>;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  const lower = new Set(terms.map((t) => t.toLowerCase()));
  return (
    <>
      {parts.map((p, i) =>
        lower.has(p.toLowerCase()) ? (
          <mark key={i} className="rounded bg-v2-warn-bg px-0.5 text-v2-warn">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
