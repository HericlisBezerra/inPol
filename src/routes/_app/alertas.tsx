import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/alertas")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
