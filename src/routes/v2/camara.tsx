import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/camara")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
