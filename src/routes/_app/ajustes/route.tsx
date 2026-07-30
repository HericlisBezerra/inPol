import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol v2" }] }),
  component: AjustesLayout,
});

/**
 * Layout de Ajustes: sidebar de sub-navegação (210px) + painel via <Outlet/>.
 *
 * A navegação era uma lista plana de 9 itens nomeados pela tabela do banco
 * (Vocabulário, WhatsApp, Fontes, Eleitos, Equipe, Organizações…). Isso obrigava o
 * usuário a saber a modelagem para achar o que queria mudar. Agora os itens estão
 * agrupados por INTENÇÃO — o que eu escuto, quem eu acompanho, como a IA entende
 * minha cidade, quem acessa, conformidade — que é como a pergunta chega na cabeça
 * dele. As telas em si continuam as mesmas, só reagrupadas e realocadas.
 */
type NavItem = { to: string; label: string; exact?: boolean; external?: boolean; badge?: string };
type NavGroup = { heading: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "O que eu escuto",
    items: [
      { to: "/ajustes/escuta/whatsapp", label: "Grupos de WhatsApp" },
      { to: "/ajustes/escuta/imprensa", label: "Imprensa local" },
      { to: "/ajustes/escuta/instagram", label: "Instagram" },
    ],
  },
  {
    heading: "Quem eu acompanho",
    // Pessoas vivem na Rede e são editadas na ficha de pessoa. Duplicar aqui criaria
    // duas fontes de verdade para a mesma escrita — o item é um atalho declarado
    // como saída de Ajustes (↗), não uma tela paralela.
    items: [{ to: "/rede", label: "Pessoas e perfis ↗", external: true }],
  },
  {
    heading: "Como a IA entende minha cidade",
    items: [
      { to: "/ajustes/cidade/vocabulario", label: "Vocabulário" },
      { to: "/ajustes/cidade/eleitos", label: "Eleitos (TSE)" },
    ],
  },
  {
    heading: "Quem acessa",
    items: [
      { to: "/ajustes/acesso/equipe", label: "Equipe e papéis" },
      { to: "/ajustes/acesso/organizacoes", label: "Organizações" },
      { to: "/ajustes/acesso/perfil", label: "Meu perfil" },
    ],
  },
  {
    heading: "Conformidade",
    items: [{ to: "/ajustes/conformidade", label: "Auditoria e retenção" }],
  },
  {
    // Separado do resto de propósito: os toggles desta tela não têm backend e não
    // persistem. Enquanto isso for verdade, ela não pode ficar no caminho principal
    // fingindo que salva.
    heading: "Ainda sem backend",
    items: [{ to: "/ajustes/notificacoes", label: "Notificações", badge: "prévia" }],
  },
];

const ITEM_BASE =
  "block whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] leading-none transition-colors md:leading-normal";
const ITEM_INACTIVE = "text-v2-ink-2 hover:bg-v2-track hover:text-v2-ink";
const ITEM_ACTIVE = "bg-v2-green-tint font-[650] text-v2-green";

function AjustesLayout() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[210px_1fr] md:gap-7">
      <aside className="min-w-0">
        <h1 className="mb-3 text-[20px] font-[650] tracking-tight text-v2-ink md:mb-4">Ajustes</h1>
        <nav
          aria-label="Seções de ajustes"
          // Em telas pequenas os grupos viram uma faixa horizontal rolável; os títulos
          // de grupo só aparecem a partir de md, onde a coluna existe de fato.
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:gap-0 md:overflow-visible md:px-0 md:pb-0"
        >
          <Link
            to="/ajustes"
            activeOptions={{ exact: true }}
            className={ITEM_BASE}
            inactiveProps={{ className: ITEM_INACTIVE }}
            activeProps={{ className: ITEM_ACTIVE, "aria-current": "page" }}
          >
            Visão geral
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="contents md:mt-3 md:block md:first-of-type:mt-4">
              <div className="hidden px-3 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.09em] text-v2-faint md:block">
                {group.heading}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={ITEM_BASE}
                  inactiveProps={{ className: ITEM_INACTIVE }}
                  activeProps={
                    // Um atalho para fora de Ajustes nunca deve se pintar de ativo aqui.
                    item.external
                      ? { className: ITEM_INACTIVE }
                      : { className: ITEM_ACTIVE, "aria-current": "page" }
                  }
                >
                  {item.label}
                  {item.badge && (
                    <span className="ml-1.5 rounded bg-v2-track px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-v2-ink-3">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
