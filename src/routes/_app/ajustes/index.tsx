import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ajustes/")({
  head: () => ({ meta: [{ title: "Ajustes — Inpol v2" }] }),
  component: VisaoGeral,
});

/**
 * Ajustes · Visão geral.
 *
 * Antes esta rota era a tela de Vocabulário (que foi para /ajustes/cidade/vocabulario).
 * Virou um mapa por intenção porque a pergunta que traz alguém aqui nunca é "qual
 * tabela eu edito?" — é "como eu faço o inPol escutar tal coisa?". Cada cartão diz o
 * EFEITO do grupo, não o nome do dado.
 */
type Card = {
  to: string;
  icon: string;
  title: string;
  effect: string;
  links: { to: string; label: string }[];
};

const CARDS: Card[] = [
  {
    to: "/ajustes/escuta/whatsapp",
    icon: "📡",
    title: "O que eu escuto",
    effect:
      "Define de onde o inPol tira sinal. O que não estiver ligado aqui simplesmente não é coletado — não aparece em Sinais, não vira alerta e não entra em relatório.",
    links: [
      { to: "/ajustes/escuta/whatsapp", label: "Grupos de WhatsApp" },
      { to: "/ajustes/escuta/imprensa", label: "Imprensa local" },
      { to: "/ajustes/escuta/instagram", label: "Instagram" },
    ],
  },
  {
    to: "/rede",
    icon: "👥",
    title: "Quem eu acompanho",
    effect:
      "Pessoas monitoradas — adversários, aliados, autoridades. Ligar alguém faz a IA reconhecer o nome nas mensagens e citá-lo nas análises. Isso se edita na ficha da pessoa, na Rede.",
    links: [{ to: "/rede", label: "Abrir a Rede ↗" }],
  },
  {
    to: "/ajustes/cidade/vocabulario",
    icon: "🧠",
    title: "Como a IA entende minha cidade",
    effect:
      "Bairros, secretarias, termos sensíveis e eleitos. É este vocabulário que a IA procura no texto: sem o bairro cadastrado, a menção a ele não é reconhecida nem mapeada no Território.",
    links: [
      { to: "/ajustes/cidade/vocabulario", label: "Vocabulário" },
      { to: "/ajustes/cidade/eleitos", label: "Eleitos (TSE)" },
    ],
  },
  {
    to: "/ajustes/acesso/equipe",
    icon: "🔑",
    title: "Quem acessa",
    effect:
      "Papéis da equipe, organizações e seu perfil. O papel decide quem vê conteúdo bruto de mensagem — e todo acesso a conteúdo bruto fica registrado na trilha LGPD.",
    links: [
      { to: "/ajustes/acesso/equipe", label: "Equipe e papéis" },
      { to: "/ajustes/acesso/organizacoes", label: "Organizações" },
      { to: "/ajustes/acesso/perfil", label: "Meu perfil" },
    ],
  },
  {
    to: "/ajustes/conformidade",
    icon: "🛡",
    title: "Conformidade",
    effect:
      "Trilha imutável de acessos, prazo de retenção e atendimento a titulares. O prazo de retenção apaga mensagens de verdade: o que passa do prazo some do app e dos relatórios futuros.",
    links: [{ to: "/ajustes/conformidade", label: "Auditoria e retenção" }],
  },
];

function VisaoGeral() {
  return (
    <div>
      <div>
        <div className="text-[16px] font-[650] text-v2-ink">Visão geral</div>
        <div className="mt-[3px] max-w-[64ch] text-[13px] text-v2-ink-3">
          Quase tudo que você muda aqui tem efeito no que o inPol coleta, no que a IA entende e no
          que aparece nas outras telas. Cada bloco abaixo diz qual é esse efeito.
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="flex flex-col rounded-[13px] border border-v2-line bg-v2-card px-5 py-[18px]"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-v2-green-tint text-[15px]"
              >
                {card.icon}
              </span>
              <Link
                to={card.to}
                className="text-[14.5px] font-[650] text-v2-ink hover:text-v2-green"
              >
                {card.title}
              </Link>
            </div>
            <p className="mt-3 flex-1 text-[12.5px] leading-normal text-v2-ink-2">{card.effect}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-v2-track pt-3">
              {card.links.map((l) => (
                <Link
                  key={l.to + l.label}
                  to={l.to}
                  className="text-[12.5px] font-[650] text-v2-green hover:text-v2-green-hover"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-v2-line bg-v2-surface px-4 py-[13px]">
        <span aria-hidden className="mt-px flex-none">
          ⚙
        </span>
        <span className="flex-1 text-[12.5px] leading-normal text-v2-ink-2">
          <b className="text-v2-ink">Notificações</b> ainda não têm backend: a tela existe, mas as
          preferências não são salvas.{" "}
          <Link
            to="/ajustes/notificacoes"
            className="font-[650] text-v2-green hover:text-v2-green-hover"
          >
            Ver a prévia →
          </Link>
        </span>
      </div>
    </div>
  );
}
