import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enterDemoMode, getMyOrgs } from "@/lib/orgs.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { usePlatformAdmin } from "@/lib/use-platform-admin";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Search,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  PlusCircle,
  Users,
  Sun,
  Moon,
  Map,
  Swords,
  ShieldCheck,
  Radio,
  Bell,
  Sparkles,
  Shield,
  Newspaper,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InpolLogo } from "@/components/inpol-logo";
import { useTheme } from "@/lib/theme";
import { DemoBanner } from "@/components/demo-banner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV_BASE = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/territory", label: "Território", icon: Map },
  { to: "/adversaries", label: "Adversários", icon: Swords },
  { to: "/people", label: "Pessoas", icon: Users },
  { to: "/sources", label: "Fontes", icon: Radio },
  { to: "/groups", label: "Grupos", icon: Users },
  { to: "/news", label: "Notícias", icon: Newspaper },
  { to: "/search", label: "Busca", icon: Search },
  { to: "/reports", label: "Relatórios", icon: FileText },
] as const;
const NAV_RESTRICTED = [
  { to: "/audit", label: "Auditoria LGPD", icon: ShieldCheck },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon },
] as const;
const NAV_ADMIN = [{ to: "/admin", label: "Admin", icon: Shield }] as const;

function AuthLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  const { orgId, setOrgId } = useCurrentOrg();
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();
  const createOrgValue = "__create_org__";
  const demoValue = "__enter_demo__";
  const isExplicitCreate = href.includes("create=1");

  const { data: orgs = [], isFetched } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => getMyOrgs(),
  });

  const currentMembership = orgs.find((o) => o.org.id === orgId);
  const currentOrg = currentMembership?.org;
  const isOrgOwner = currentMembership?.role === "owner";
  const showRestricted = isPlatformAdmin || isOrgOwner;
  const NAV = [
    ...NAV_BASE,
    ...(showRestricted ? NAV_RESTRICTED : []),
    ...(isPlatformAdmin ? NAV_ADMIN : []),
  ];

  const demoMut = useMutation({
    mutationFn: () => enterDemoMode(),
    onSuccess: async ({ orgId: newId }) => {
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      setOrgId(newId);
      toast.success("Modo demo ativado — Prefeitura de Jundiaí (DEMO)");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  useEffect(() => {
    if (orgs.length > 0 && !orgId) setOrgId(orgs[0].org.id);
    if (orgId && orgs.length > 0 && !orgs.some((o) => o.org.id === orgId)) {
      setOrgId(orgs[0].org.id);
    }
  }, [orgs, orgId, setOrgId]);

  useEffect(() => {
    if (isFetched && orgs.length === 0 && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [isFetched, orgs, pathname, navigate]);

  useEffect(() => {
    if (isFetched && orgs.length > 0 && pathname === "/onboarding" && !isExplicitCreate) {
      navigate({ to: "/dashboard" });
    }
  }, [isFetched, orgs, pathname, isExplicitCreate, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOrgId(null);
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <InpolLogo size="md" />
            <div className="label-mono mt-2 text-[10px]">inteligência política</div>
          </div>
          <ThemeToggle />
        </div>

        <div className="px-3 pb-3">
          <Select
            value={orgId ?? undefined}
            onValueChange={(v) => {
              if (v === createOrgValue) {
                setTimeout(() => {
                  navigate({ to: "/onboarding", search: { create: "1" } });
                }, 0);
                return;
              }
              if (v === demoValue) {
                demoMut.mutate();
                return;
              }
              setOrgId(v);
              if (pathname === "/onboarding") navigate({ to: "/dashboard" });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione organização" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.org.id} value={o.org.id}>
                  <span className="inline-flex items-center gap-2">
                    {o.org.is_demo && <Sparkles className="size-3 text-primary" />}
                    {o.org.name}
                  </span>
                </SelectItem>
              ))}
              {orgs.length > 0 && <SelectSeparator />}
              <SelectItem value={demoValue}>
                <span className="inline-flex items-center gap-2 text-primary">
                  <Sparkles className="size-4" /> Entrar no Modo Demo
                </span>
              </SelectItem>
              {isPlatformAdmin && (
                <SelectItem value={createOrgValue}>
                  <span className="inline-flex items-center gap-2">
                    <PlusCircle className="size-4" /> Criar organização
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {currentOrg?.is_demo && <DemoBanner orgName={currentOrg.name} />}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="size-8 shrink-0"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
