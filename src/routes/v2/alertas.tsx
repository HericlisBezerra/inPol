import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/alertas")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
