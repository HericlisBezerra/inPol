import { createFileRoute, Outlet } from "@tanstack/react-router";
import { V2AppShell } from "@/components/v2/shell";
import { V2ErrorComponent, V2NotFound } from "@/components/v2/error-boundary";

export const Route = createFileRoute("/v2")({
  head: () => ({
    meta: [{ title: "Inpol v2 — Sistema" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
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
