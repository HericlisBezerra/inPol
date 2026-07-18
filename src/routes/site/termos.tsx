import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/site/termos")({
  head: () => ({ meta: [{ title: "Termos de uso — Inpol" }] }),
  component: Screen,
});

const TOC = [
  { id: "servico", label: "1. O serviço" },
  { id: "uso-aceitavel", label: "2. Uso aceitável" },
  { id: "responsabilidades", label: "3. Responsabilidades" },
  { id: "modo-eleicao", label: "4. Modo Eleição" },
  { id: "pagamento", label: "5. Pagamento e cancelamento" },
  { id: "limitacoes", label: "6. Limitações" },
  { id: "foro", label: "7. Foro" },
];

/** W3 — Termos de uso. */
function Screen() {
  const [active, setActive] = useState("servico");
  return (
    <div className="text-v2-ink">
      <LegalHeader />

      <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-10 px-6 py-12 md:grid-cols-[200px_1fr] md:px-14">
        {/* Sumário lateral */}
        <aside className="top-6 self-start md:sticky">
          <div className="mb-2.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-faint">
            NESTA PÁGINA
          </div>
          <nav className="flex flex-col gap-2 text-[12.5px]">
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={() => setActive(t.id)}
                className={
                  active === t.id
                    ? "font-[650] text-v2-green"
                    : "text-v2-ink-2 transition-colors hover:text-v2-ink"
                }
              >
                {t.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Corpo */}
        <article>
          <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
            VIGENTE DESDE 01 JUL 2026 · V2.1
          </div>
          <h1 className="mt-2 font-display text-[30px] font-[550] md:text-[36px]">Termos de uso</h1>
          <p id="servico" className="mt-3 scroll-mt-6 text-[14.5px] leading-[1.7] text-v2-ink-2">
            Contrato entre a inPol Tecnologia LTDA e a organização contratante (prefeitura, gabinete
            ou campanha).
          </p>

          <h2 id="uso-aceitavel" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            2. Uso aceitável
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            O inPol destina-se a monitoramento de reputação institucional, gestão de crises e
            inteligência legislativa. É <b className="text-v2-crit">vedado</b>: usar a plataforma
            para assédio ou perseguição de cidadãos; adicionar o número monitor a grupos sem
            participação legítima; usar dados para disparo em massa; e qualquer uso que viole a Lei
            9.504/97, a LGPD ou o Marco Civil da Internet. Violações ensejam suspensão imediata.
          </p>

          <h2 id="modo-eleicao" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            4. Modo Eleição
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            Organizações de campanha são contratadas separadamente das organizações de gestão, com
            faturamento próprio (prestável ao TSE), dados isolados e equipes distintas. A ativação
            do Modo Eleição em organização de gestão apenas ativa os avisos de conformidade — não
            converte recursos públicos em ferramenta de campanha.
          </p>

          <h2 id="limitacoes" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            6. Limitações
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            As análises de IA são apoio à decisão, não aconselhamento jurídico ou garantia de
            resultado eleitoral. Escores de risco e sentimento são estimativas estatísticas sujeitas
            a erro.
          </p>

          <div
            id="foro"
            className="mt-8 scroll-mt-6 border-t border-v2-line pt-4 text-[13px] text-v2-ink-3"
          >
            Foro: comarca de São Paulo/SP · juridico@inpol.com.br
          </div>
        </article>
      </div>
    </div>
  );
}

/* Header enxuto das páginas legais */
function LegalHeader() {
  return (
    <header className="flex items-center gap-[26px] border-b border-v2-line px-6 py-4 md:px-14">
      <Link to="/site" className="font-display text-[20px] font-semibold text-v2-ink">
        In<i className="text-v2-green">pol</i>
        <span className="text-v2-green">.</span>
      </Link>
      <div className="flex-1" />
      <Link
        to="/entrar"
        className="rounded-lg bg-v2-green px-[15px] py-2 text-[13px] font-[650] text-white transition-colors hover:bg-v2-green-hover"
      >
        Entrar
      </Link>
    </header>
  );
}
