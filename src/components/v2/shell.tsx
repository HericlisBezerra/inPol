/** V2AppShell — warm cream app frame: top nav + centered content + ⌘K + notifications.
 *  Wrap every authenticated v2 screen in this. The `.v2-root` class opts the whole
 *  subtree into the v2 palette without affecting the legacy app. */
import { useEffect, useState, type ReactNode } from "react";
import { V2TopNav } from "./top-nav";
import { V2CommandPalette } from "./command-palette";

export function V2AppShell({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  return (
    <div className="v2-root min-h-screen">
      <V2TopNav
        notifOpen={notifOpen}
        onToggleNotif={() => setNotifOpen((v) => !v)}
        onCloseNotif={() => setNotifOpen(false)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <main className="mx-auto w-full max-w-[1120px] px-6 py-8 md:px-10">{children}</main>
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
