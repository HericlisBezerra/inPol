import { useCallback, useEffect, useState } from "react";

const KEY = "inpol.currentOrgId";
// Cross-instance sync within the same tab: localStorage's own "storage" event only
// fires in *other* tabs, so every screen calling useCurrentOrg() independently would
// otherwise keep stale org state until it happens to remount. Broadcasting this
// custom event lets all mounted instances (top-nav switcher, page bodies, etc.)
// pick up the change immediately.
const CHANGE_EVENT = "inpol:current-org-changed";

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function useCurrentOrg() {
  const [orgId, setOrgIdState] = useState<string | null>(() => read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setOrgIdState(e.newValue);
    };
    const onChange = () => setOrgIdState(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const setOrgId = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    setOrgIdState(id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { orgId, setOrgId };
}
