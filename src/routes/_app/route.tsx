import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { V2AppShell } from "@/components/v2/shell";
import { V2ErrorComponent, V2NotFound } from "@/components/v2/error-boundary";

export const Route = createFileRoute("/_app")({
  // Client-only + guarda de auth (mesmo padrão do app antigo `_authenticated`): sessão vive no
  // client, então checar no server derrubaria usuário logado. Deslogado → tela de login v2.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/entrar" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Inpol v2 — Sistema" }],
    links: [
      {
        // Exact variable axes the design doc uses — real 550/650 weights + true mono bold.
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap",
      },
    ],
  }),
  component: V2Layout,
  errorComponent: V2ErrorComponent,
  notFoundComponent: V2NotFound,
});

function V2Layout() {
  return (
    <V2AppShell>
      <Outlet />
    </V2AppShell>
  );
}
