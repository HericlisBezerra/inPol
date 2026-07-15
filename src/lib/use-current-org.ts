import { useCallback, useEffect, useState } from "react";

const KEY = "inpol.currentOrgId";

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
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setOrgId = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    setOrgIdState(id);
  }, []);

  return { orgId, setOrgId };
}
