import { createFileRoute, Outlet } from "@tanstack/react-router";
import { V2ErrorComponent, SiteNotFound } from "@/components/v2/error-boundary";

export const Route = createFileRoute("/site")({
  head: () => ({
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap",
      },
    ],
  }),
  component: SiteLayout,
  errorComponent: V2ErrorComponent,
  notFoundComponent: SiteNotFound,
});

function SiteLayout() {
  return (
    <div className="v2-site min-h-screen">
      <Outlet />
    </div>
  );
}
