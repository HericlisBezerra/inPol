import { useQuery } from "@tanstack/react-query";
import { getMyOrgs } from "@/lib/orgs.functions";
import { useCurrentOrg } from "@/lib/use-current-org";

/** Shared org list + current-org state for v2 — same "my-orgs" query key as the
 *  legacy shell (_authenticated/route.tsx), so both share the react-query cache. */
export function useV2Orgs() {
  const { orgId, setOrgId } = useCurrentOrg();
  const { data: allOrgs = [], isFetched } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => getMyOrgs(),
  });
  // Esconde orgs DEMO ("... (DEMO)") do v2 — nunca aparecem no switcher nem viram default,
  // e uma sessão presa numa org DEMO é resetada para a primeira org real (ver V2AppShell).
  const orgs = allOrgs.filter((o) => !/\(demo\)/i.test(o.org?.name ?? ""));
  return { orgId, setOrgId, orgs, isFetched };
}
