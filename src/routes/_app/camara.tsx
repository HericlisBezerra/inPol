import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/camara")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
