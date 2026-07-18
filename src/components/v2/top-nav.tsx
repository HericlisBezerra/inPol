/** Shared v2 top navigation bar (see S1–S28 chrome). */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { V2Logo } from "./logo";
import { V2_NAV } from "./nav-items";
import { V2Notifications } from "./notifications";

export function V2TopNav({
  notifOpen,
  onToggleNotif,
  onOpenPalette,
  onCloseNotif,
}: {
  notifOpen: boolean;
  onToggleNotif: () => void;
  onOpenPalette: () => void;
  onCloseNotif: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex items-center gap-6 border-b border-v2-line bg-v2-surface/90 px-6 py-3.5 backdrop-blur md:px-10">
      <Link to="/v2" className="flex-none">
        <V2Logo />
      </Link>
      <nav className="hidden items-center gap-5 text-[13.5px] lg:flex">
        {V2_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/v2" }}
            className="text-v2-ink-3 transition-colors hover:text-v2-ink"
            activeProps={{ className: "font-semibold text-v2-ink" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      <button
        onClick={onOpenPalette}
        className="hidden w-[200px] items-center gap-2 rounded-lg bg-v2-track px-3 py-2 text-[12.5px] text-v2-ink-3 hover:bg-v2-line md:flex"
      >
        ⌕ Buscar
        <span className="ml-auto font-mono text-[11px] text-v2-faint">⌘K</span>
      </button>
      <div className="relative">
        <button
          // mousedown + stopPropagation so the panel's outside-click listener doesn't
          // fire first and reopen the panel on the same click.
          onMouseDown={(e) => {
            e.stopPropagation();
            onToggleNotif();
          }}
          className="relative grid h-[34px] w-[34px] place-items-center rounded-lg border border-v2-line bg-v2-card"
          aria-label="Notificações"
        >
          🔔
          <span className="absolute -right-1.5 -top-1.5 rounded-lg bg-v2-crit px-1.5 font-mono text-[9px] font-bold text-white">
            3
          </span>
        </button>
        {notifOpen && <V2Notifications onClose={onCloseNotif} />}
      </div>
      <AvatarMenu />
    </div>
  );
}

/** Mobile bottom tab bar (s13) — primary nav below `lg`, where the top nav links are hidden. */
const BOTTOM_NAV = [
  { to: "/v2", label: "Painel", icon: "◈", exact: true },
  { to: "/v2/alertas", label: "Alertas", icon: "▲" },
  { to: "/v2/territorio", label: "Território", icon: "▦" },
  { to: "/v2/sinais", label: "Sinais", icon: "◎" },
] as const;

export function V2BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-v2-line bg-v2-surface/95 backdrop-blur lg:hidden"
    >
      {BOTTOM_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact ?? false }}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] text-v2-ink-3"
          activeProps={{ className: "text-v2-green" }}
        >
          <span className="text-[17px] leading-none">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Avatar dropdown — also the entry point for screens without a top-nav slot
 *  (Modo Eleição, Admin, Sair), which otherwise would only be reachable by URL. */
function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const items = [
    { to: "/v2/ajustes", label: "Ajustes" },
    { to: "/v2/modo-eleicao", label: "Modo Eleição" },
    { to: "/v2-admin", label: "Admin da plataforma" },
  ] as const;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full bg-v2-green text-[12px] font-semibold text-white"
        aria-label="Menu da conta"
      >
        MC
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-v2-line bg-v2-surface py-1 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
          <div className="border-b border-v2-line px-3.5 py-2.5">
            <div className="text-[13px] font-semibold text-v2-ink">Marina Costa</div>
            <div className="font-mono text-[11px] text-v2-faint">
              marina@jundiai.sp.gov.br · Dona
            </div>
          </div>
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-[13.5px] text-v2-ink-2 hover:bg-v2-track hover:text-v2-ink"
            >
              {it.label}
            </Link>
          ))}
          <Link
            to="/sair"
            onClick={() => setOpen(false)}
            className="block border-t border-v2-line px-3.5 py-2 text-[13.5px] font-medium text-v2-crit hover:bg-v2-crit-bg"
          >
            Sair
          </Link>
        </div>
      )}
    </div>
  );
}
