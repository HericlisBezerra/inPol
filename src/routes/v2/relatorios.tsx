import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/relatorios")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
