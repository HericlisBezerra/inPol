/** V2AppShell — warm cream app frame: top nav + centered content + ⌘K + notifications.
 *  Wrap every authenticated v2 screen in this. The `.v2-root` class opts the whole
 *  subtree into the v2 palette without affecting the legacy app. */
import { useEffect, useState, type ReactNode } from "react";
import { V2TopNav, V2BottomNav } from "./top-nav";
import { V2CommandPalette } from "./command-palette";
import { useV2Orgs } from "@/lib/use-v2-orgs";

export function V2AppShell({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { orgId, setOrgId, orgs } = useV2Orgs();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Nunca deixar o app sem org válida: default para a primeira org do usuário
  // quando não há org selecionada, ou a selecionada não pertence mais à lista.
  useEffect(() => {
    if (orgs.length === 0) return;
    if (!orgId || !orgs.some((o) => o.org.id === orgId)) {
      setOrgId(orgs[0].org.id);
    }
  }, [orgs, orgId, setOrgId]);

  return (
    <div className="v2-root min-h-screen">
      <V2TopNav
        notifOpen={notifOpen}
        onToggleNotif={() => setNotifOpen((v) => !v)}
        onCloseNotif={() => setNotifOpen(false)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <main className="mx-auto w-full max-w-[1120px] px-6 pb-24 pt-8 md:px-10 lg:pb-8">
        {children}
      </main>
      <V2BottomNav />
      {paletteOpen && <V2CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

/** Section eyebrow label used across v2 screens (mono, tracked, uppercase). */
export function V2Eyebrow({
  children,
  dot,
  className = "",
}: {
  children: ReactNode;
  dot?: "green" | "faint";
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {dot && (
        <span
          className={`h-2 w-2 rounded-full ${dot === "green" ? "bg-v2-green" : "bg-v2-faint"}`}
        />
      )}
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-v2-ink-3">
        {children}
      </span>
    </div>
  );
}
