import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // Roteamento por hostname (client-only p/ ler window.location):
  //  - apex/www inpolapp.com → site de vendas (/site)
  //  - dash.inpolapp.com + *.workers.dev + localhost → painel (/painel)
  ssr: false,
  beforeLoad: () => {
    const host = typeof window !== "undefined" ? window.location.host.toLowerCase() : "";
    if (/^(www\.)?inpolapp\.com$/.test(host)) throw redirect({ to: "/site" });
    throw redirect({ to: "/painel" });
  },
});
