/** S2 — Notifications panel anchored to the bell. Demo data (cutover wires real feed). */
import { useEffect, useRef } from "react";

type Group = { day: string; items: Notif[] };
type Notif = {
  level: "crit" | "warn" | "info";
  title: string;
  body: string;
  time: string;
  actions?: string[];
};

const GROUPS: Group[] = [
  {
    day: "HOJE",
    items: [
      {
        level: "crit",
        title: "Alerta crítico: Enchente na Vila Rami",
        body: "Escalou de ATENÇÃO para CRÍTICO. Janela de ação: até 12:00.",
        time: "09:12",
        actions: ["Abrir roteiro", "Silenciar 1h"],
      },
      {
        level: "warn",
        title: "UBS do Retiro subiu 44% em menções",
        body: "Oposição repostando prints. Sugerida nota da Saúde.",
        time: "08:40",
      },
      {
        level: "info",
        title: "Briefing diário pronto",
        body: "3 prioridades identificadas para hoje. Também enviado no seu WhatsApp.",
        time: "08:00",
      },
    ],
  },
  {
    day: "ONTEM",
    items: [
      {
        level: "info",
        title: '@parimoschi citou "abandono da zona norte"',
        body: "320 reposts em 4h · adversário monitorado",
        time: "17:22",
      },
      {
        level: "warn",
        title: 'Grupo "Moradores Vila Rami 2" sem bairro vinculado',
        body: "Vincule para o território contabilizar as mensagens.",
        time: "15:03",
      },
    ],
  },
];

const DOT: Record<Notif["level"], string> = {
  crit: "bg-v2-crit",
  warn: "bg-v2-warn-strong",
  info: "bg-v2-green",
};

export function V2Notifications({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-50 w-[380px] overflow-hidden rounded-2xl border border-v2-line bg-v2-surface shadow-[0_16px_48px_rgba(33,31,28,0.16)]"
    >
      <div className="flex items-center gap-2 border-b border-v2-line px-4 py-3">
        <span className="text-sm font-semibold text-v2-ink">Notificações</span>
        <span className="rounded-full bg-v2-crit px-2 py-0.5 font-mono text-[10px] font-bold text-white">
          3 novas
        </span>
        <div className="flex-1" />
        <button className="text-xs font-medium text-v2-green hover:text-v2-green-hover">
          Marcar todas como lidas
        </button>
      </div>
      <div className="flex gap-1 border-b border-v2-line px-3 py-2 text-xs">
        {["Tudo", "Críticas", "Relatórios", "Rede"].map((t, i) => (
          <button
            key={t}
            className={
              i === 0
                ? "rounded-full bg-v2-ink px-3 py-1 font-semibold text-white"
                : "rounded-full px-3 py-1 font-medium text-v2-ink-2 hover:bg-v2-track"
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.day}>
            <div className="px-4 pb-1 pt-3 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
              {g.day}
            </div>
            {g.items.map((n, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 hover:bg-v2-track/60">
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${DOT[n.level]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-[13.5px] font-semibold leading-snug text-v2-ink">
                      {n.title}
                    </span>
                    <span className="font-mono text-[10px] text-v2-faint">{n.time}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] leading-snug text-v2-ink-2">{n.body}</div>
                  {n.actions && (
                    <div className="mt-2 flex gap-2">
                      {n.actions.map((a, j) => (
                        <button
                          key={a}
                          className={
                            j === 0
                              ? "rounded-lg bg-v2-ink px-3 py-1.5 text-xs font-semibold text-white"
                              : "rounded-lg border border-v2-line-strong px-3 py-1.5 text-xs font-semibold text-v2-ink"
                          }
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-v2-line px-4 py-2.5 text-xs">
        <button className="font-medium text-v2-green hover:text-v2-green-hover">
          Ver histórico completo
        </button>
        <button className="font-medium text-v2-ink-3">⚙ Preferências de aviso</button>
      </div>
    </div>
  );
}
