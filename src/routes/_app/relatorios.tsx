import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/relatorios")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
