// TEMP — banner de diagnóstico do fluxo auth/org (remover depois de resolver o bug de org vazio).
import { useEffect, useState } from "react";

export function AuthDebug() {
  const [info, setInfo] = useState("diagnóstico: carregando…");
  useEffect(() => {
    (async () => {
      const parts: string[] = [];
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          parts.push(`sessão=SIM user=${sess.session.user.id.slice(0, 8)} email=${sess.session.user.email ?? "?"}`);
        } else {
          parts.push("sessão=NENHUMA");
        }
      } catch (e) {
        parts.push(`sessão=ERRO ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        const { getMyOrgs } = await import("@/lib/orgs.functions");
        const orgs = await getMyOrgs();
        parts.push(
          `getMyOrgs=OK n=${orgs.length} [${orgs.map((o) => o?.org?.name ?? "??").join(", ")}]`,
        );
      } catch (e) {
        parts.push(`getMyOrgs=ERRO ${e instanceof Error ? e.message : String(e)}`);
      }
      setInfo("🔎 " + parts.join("  |  "));
    })();
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#0b0b0b",
        color: "#4ade80",
        font: "12px/1.4 ui-monospace, monospace",
        padding: "6px 12px",
        borderTop: "1px solid #333",
        wordBreak: "break-word",
      }}
    >
      {info}
    </div>
  );
}
