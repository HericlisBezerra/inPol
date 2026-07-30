import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/casos")({
  component: Layout,
});

function Layout() {
  return <Outlet />;
}
