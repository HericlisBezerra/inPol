import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol v2" }] }),
  component: AjustesLayout,
});

/**
 * Layout de Ajustes (S12+): sidebar de sub-navegação à esquerda (210px, como no
 * design) + painel via <Outlet/>. Em telas pequenas a lista vira uma faixa
 * horizontal rolável. O item ativo usa fundo verde-claro (v2-green-tint) e
 * peso 650 — mesmo tratamento do design estático.
 */
// Ordem e nomes canônicos do design (s12/s17–s27).
const NAV_ITEMS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/v2/ajustes", label: "Vocabulário", exact: true },
  { to: "/v2/ajustes/whatsapp", label: "WhatsApp" },
  { to: "/v2/ajustes/fontes", label: "Fontes locais" },
  { to: "/v2/ajustes/eleitos", label: "Eleitos (TSE)" },
  { to: "/v2/ajustes/notificacoes", label: "Notificações" },
  { to: "/v2/ajustes/equipe", label: "Equipe e acesso" },
  { to: "/v2/ajustes/organizacoes", label: "Organizações" },
  { to: "/v2/ajustes/auditoria", label: "Auditoria LGPD" },
];

function AjustesLayout() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[210px_1fr] md:gap-7">
      <aside className="min-w-0">
        <h1 className="mb-3 text-[20px] font-[650] tracking-tight text-v2-ink md:mb-4">Ajustes</h1>
        <nav
          aria-label="Seções de ajustes"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] leading-none transition-colors md:leading-normal"
              inactiveProps={{
                className: "text-v2-ink-2 hover:bg-v2-track hover:text-v2-ink",
              }}
              activeProps={{
                className: "bg-v2-green-tint font-[650] text-v2-green",
                "aria-current": "page",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
