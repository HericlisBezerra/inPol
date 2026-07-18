/** Shared v2 top navigation bar (see S1–S28 chrome). */
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
          onClick={onToggleNotif}
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
      <Link
        to="/v2/ajustes"
        className="grid h-8 w-8 place-items-center rounded-full bg-v2-green font-semibold text-white"
        style={{ fontSize: 12 }}
      >
        MC
      </Link>
    </div>
  );
}
