/** Shared v2 top navigation bar (see S1–S28 chrome). */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { V2Logo } from "./logo";
import { V2_NAV } from "./nav-items";
import { V2Notifications } from "./notifications";
import { useV2Orgs } from "@/lib/use-v2-orgs";
import { getMyProfile } from "@/lib/profile.functions";

const ROLE_LABEL: Record<string, string> = {
  owner: "Admin",
  analyst: "Analista",
  viewer: "Leitor",
};

function initialsFrom(nameOrEmail: string) {
  return (
    nameOrEmail
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

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
      <Link to="/painel" className="flex-none">
        <V2Logo />
      </Link>
      <nav className="hidden items-center gap-5 text-[13.5px] lg:flex">
        {V2_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/painel" }}
            className="text-v2-ink-3 transition-colors hover:text-v2-ink"
            activeProps={{ className: "font-semibold text-v2-ink" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      <OrgSwitcher />
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
  { to: "/painel", label: "Painel", icon: "◈", exact: true },
  { to: "/alertas", label: "Alertas", icon: "▲", exact: false },
  { to: "/territorio", label: "Território", icon: "▦", exact: false },
  { to: "/sinais", label: "Sinais", icon: "◎", exact: false },
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

/** Org switcher — shows the current org and, when the user belongs to more than
 *  one, a dropdown to switch. Hidden entirely for single-org users to stay discreet. */
function OrgSwitcher() {
  const { orgId, setOrgId, orgs } = useV2Orgs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = orgs.find((o) => o.org.id === orgId)?.org;
  if (!current) return null;
  if (orgs.length < 2) {
    return (
      <span className="hidden truncate text-[12.5px] text-v2-ink-3 md:inline">{current.name}</span>
    );
  }

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-v2-ink-3 transition-colors hover:bg-v2-track hover:text-v2-ink"
      >
        <span className="max-w-[160px] truncate">{current.name}</span>
        <span className="text-[10px] text-v2-faint">⌄</span>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-v2-line bg-v2-surface py-1 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
          {orgs.map((o) => (
            <button
              key={o.org.id}
              onClick={() => {
                setOrgId(o.org.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] hover:bg-v2-track ${
                o.org.id === orgId ? "font-semibold text-v2-ink" : "text-v2-ink-2"
              }`}
            >
              <span className="truncate">{o.org.name}</span>
              {o.org.id === orgId && <span className="text-v2-green">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Avatar dropdown — also the entry point for screens without a top-nav slot
 *  (Modo Eleição, Admin, Sair), which otherwise would only be reachable by URL. */
function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { orgId, orgs } = useV2Orgs();
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const items = [
    { to: "/ajustes/perfil", label: "Meu perfil" },
    { to: "/ajustes", label: "Ajustes" },
    { to: "/eleicao", label: "Modo Eleição" },
    { to: "/admin", label: "Admin da plataforma" },
  ] as const;

  const displayName = profile?.full_name || profile?.email || "Minha conta";
  const roleRaw = orgs.find((o) => o.org.id === orgId)?.role;
  const roleLabel = roleRaw ? (ROLE_LABEL[roleRaw] ?? roleRaw) : null;
  const initials = initialsFrom(profile?.full_name || profile?.email || "?");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-v2-green text-[12px] font-semibold text-white"
        aria-label="Menu da conta"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-v2-line bg-v2-surface py-1 shadow-[0_16px_48px_rgba(33,31,28,0.16)]">
          <Link
            to="/ajustes/perfil"
            onClick={() => setOpen(false)}
            className="block border-b border-v2-line px-3.5 py-2.5 hover:bg-v2-track"
          >
            <div className="truncate text-[13px] font-semibold text-v2-ink">{displayName}</div>
            <div className="truncate font-mono text-[11px] text-v2-faint">
              {profile?.email ?? ""}
              {roleLabel ? ` · ${roleLabel}` : ""}
            </div>
          </Link>
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
