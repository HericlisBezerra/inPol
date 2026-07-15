import { useQuery } from "@tanstack/react-query";
import { getMyOrgs } from "@/lib/orgs.functions";
import { usePlatformAdmin } from "@/lib/use-platform-admin";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Gates a page so that only master admins or owners of the currently
 * selected organization can see it.
 */
export function RestrictedGate({ children }: { children: ReactNode }) {
  const { orgId } = useCurrentOrg();
  const { isAdmin, isLoading: adminLoading } = usePlatformAdmin();
  const { data: orgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => getMyOrgs(),
  });

  if (adminLoading || orgsLoading) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }

  const isOwner = orgs.find((o) => o.org.id === orgId)?.role === "owner";
  if (isAdmin || isOwner) return <>{children}</>;

  return (
    <div className="p-8 max-w-xl">
      <Card className="p-6 bg-surface">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-6 text-destructive" />
          <div>
            <h1 className="font-display text-xl">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Esta seção só é acessível ao dono da organização ou ao administrador da plataforma.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
