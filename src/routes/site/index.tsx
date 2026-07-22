import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/site/")({
  head: () => ({ meta: [{ title: "Inpol — Inteligência política para prefeituras" }] }),
  component: Screen,
});

// CTAs de contato — sem fluxo de agendamento ainda; e-mail é o destino reversível
// (trocar por form/Calendly quando existir).
const MAILTO_DEMO =
  "mailto:contato@inpol.com.br?subject=Quero%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20do%20inPol";
const MAILTO_SALES = "mailto:contato@inpol.com.br?subject=Falar%20com%20vendas%20%E2%80%94%20inPol";

/** W1 — Página de vendas. Foco: prefeituras · da manchete sofrida à manchete evitada. */
function Screen() {
  return (
    <div className="text-v2-ink">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1080px] px-6 pb-14 pt-16 text-center md:px-14">
        <span className="inline-block rounded-full border border-v2-green-border bg-v2-green-tint px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-v2-green">
          INTELIGÊNCIA POLÍTICA PARA PREFEITURAS
        </span>
        <h1 className="mx-auto mt-[22px] max-w-[820px] font-display text-[38px] font-[550] leading-[1.12] tracking-[-0.015em] md:text-[56px]">
          A crise avisa <span className="italic text-v2-green">72 horas antes</span> de virar
          manchete.
          <br />O inPol escuta o aviso.
        </h1>
        <p className="mx-auto mt-[18px] max-w-[640px] text-[17px] leading-[1.65] text-v2-ink-2">
          A IA lê os grupos de WhatsApp dos bairros, os portais da cidade, as redes e as sessões da
          Câmara — e transforma tudo em três coisas: <b>o que fazer, quando e onde</b>.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a
            href={MAILTO_DEMO}
            className="rounded-[10px] bg-v2-green px-[26px] py-[13px] text-[15px] font-[650] text-white transition-colors hover:bg-v2-green-hover"
          >
            Agendar demonstração
          </a>
          <Link
            to="/painel"
            className="rounded-[10px] border border-v2-line-strong bg-v2-card px-[26px] py-[13px] text-[15px] font-[650] text-v2-ink transition-colors hover:bg-v2-track"
          >
            Ver o painel de exemplo
          </Link>
        </div>
        <div className="mt-3.5 font-mono text-[11.5px] text-v2-faint">
          sem cartão · demo com dados fictícios de uma prefeitura real
        </div>

        {/* Browser mockup do painel */}
        <div className="mt-11 rounded-2xl border border-v2-line bg-v2-card p-[22px] text-left shadow-[0_16px_48px_rgba(33,31,28,0.1)]">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-v2-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-v2-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-v2-line" />
            <span className="ml-2 font-mono text-[10.5px] text-v2-faint">
              app.inpol.com.br/painel
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-v2-line">
              <div className="h-1 bg-v2-crit" />
              <div className="px-[18px] py-4">
                <div className="flex gap-2">
                  <span className="rounded bg-v2-crit-bg px-2 py-[3px] font-mono text-[10px] font-bold text-v2-crit">
                    CRÍTICO
                  </span>
                  <span className="self-center font-mono text-[10.5px] font-semibold text-v2-faint">
                    JANELA: ATÉ 12:00
                  </span>
                </div>
                <div className="mt-[9px] text-[17px] font-[650]">
                  Enchente na Vila Rami sem resposta da prefeitura
                </div>
                <div className="mt-[5px] text-[13px] leading-[1.55] text-v2-ink-2">
                  214 mensagens em 6 grupos · vídeo com 3,2 mil shares · imprensa sondando.
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-lg bg-v2-ink px-[13px] py-[7px] text-[12.5px] font-[650] text-white">
                    Abrir roteiro de ação
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 rounded-[11px] border border-v2-line px-3.5 py-3">
                <span className="rounded bg-v2-warn-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-warn">
                  ATENÇÃO
                </span>
                <span className="text-[12.5px] font-semibold">Fila de 5h na UBS do Retiro</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-[11px] border border-v2-line px-3.5 py-3">
                <span className="rounded bg-v2-obs-bg px-[7px] py-[3px] font-mono text-[9.5px] font-bold text-v2-obs">
                  OBSERVAR
                </span>
                <span className="text-[12.5px] font-semibold">Boato da creche no Anhangabaú</span>
              </div>
              <div className="rounded-[11px] border border-v2-green-border bg-v2-green-tint px-3.5 py-3 text-[12px] leading-normal text-v2-green-ink">
                <b>✦ Briefing IA 08h:</b> resolver Vila Rami até 12h; ampliar ciclovia à tarde.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Faixa de números ─────────────────────────────────── */}
      <section className="border-t border-v2-line bg-v2-card">
        <div className="mx-auto grid w-full max-w-[1080px] grid-cols-2 gap-6 px-6 py-[22px] text-center md:flex md:justify-between md:px-14">
          <Stat value="72h" label="de antecedência média sobre a imprensa" />
          <Stat value="18 mil" label="mensagens lidas pela IA por dia" />
          <Stat value="6s → 0s" label="tempo do assessor por mensagem" />
          <Stat value="100%" label="das sessões da Câmara resumidas" />
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────── */}
      <section id="produto" className="mx-auto w-full max-w-[1080px] px-6 py-14 md:px-14">
        <div className="mx-auto max-w-[620px] text-center">
          <div className="font-mono text-[11px] font-semibold tracking-[0.12em] text-v2-green">
            COMO FUNCIONA
          </div>
          <h2 className="mt-2.5 font-display text-[28px] font-[550] md:text-[34px]">
            Escuta tudo. Filtra o que importa.
            <br />
            Entrega a decisão.
          </h2>
        </div>
        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StepCard
            step="01 · ESCUTA"
            title="Grupos, portais, redes e Câmara"
            body="Grupos de bairro que seu número já participa, imprensa local varrida a cada 2h, perfis públicos e as sessões da Câmara com transcrição."
          />
          <StepCard
            step="02 · ENTENDE"
            title="IA classifica risco, tema e bairro"
            body="Cada sinal ganha nota de risco, sentimento, bairro e tema. Crises são detectadas no estágio “borbulhando” — 48–72h antes da manchete."
          />
          <StepCard
            step="03 · ENTREGA"
            title="Roteiro de ação, não relatório"
            body="Alertas com janela de ação e checklist pronto, briefing diário no WhatsApp do prefeito e relatórios que começam pela decisão."
          />
        </div>

        {/* Módulos */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div id="camara" className="rounded-2xl bg-v2-panel p-[26px] text-white">
            <div className="font-mono text-[12px] font-bold text-v2-mint">
              MÓDULO CÂMARA MUNICIPAL
            </div>
            <div className="mt-2.5 text-[17px] font-[650]">Cada sessão vira inteligência</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-v2-panel-ink">
              Pautas com recomendação de foco, quem falou o quê (com o minuto do vídeo), repositório
              de falas por vereador, cobranças com prazo e o placar de alinhamento da base.
            </p>
          </div>
          <div id="eleicao" className="rounded-2xl bg-v2-panel-gold p-[26px] text-white/90">
            <div className="font-mono text-[12px] font-bold text-v2-gold">MODO ELEIÇÃO</div>
            <div className="mt-2.5 text-[17px] font-[650]">O mesmo inPol, em pé de guerra</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-v2-gold-ink">
              Share of voice contra adversários, termômetro por zona eleitoral, radar de
              desinformação com kit resposta e conformidade automática com a Lei 9.504 — com dados
              separados da gestão, como exige a lei.
            </p>
          </div>
        </div>

        {/* LGPD */}
        <div
          id="lgpd"
          className="mt-4 flex flex-col items-start gap-5 rounded-2xl border border-v2-line bg-v2-card p-[26px] md:flex-row md:items-center md:gap-[26px]"
        >
          <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl bg-v2-green-tint text-[22px]">
            🛡
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-[650]">LGPD por construção, não por anexo</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-v2-ink-2">
              Só grupos com participação legítima · dados hospedados no Brasil · trilha de auditoria
              de todo acesso · anonimização em relatórios · canal do titular de dados.
            </p>
          </div>
          <Link
            to="/site/lgpd"
            className="whitespace-nowrap text-[13.5px] font-[650] text-v2-green hover:text-v2-green-hover"
          >
            Central de privacidade →
          </Link>
        </div>

        {/* ── Planos ─────────────────────────────────────────── */}
        <div id="planos" className="mt-14 text-center">
          <div className="font-mono text-[11px] font-semibold tracking-[0.12em] text-v2-green">
            PLANOS
          </div>
          <h2 className="mt-2.5 font-display text-[28px] font-[550] md:text-[34px]">
            Do gabinete à sala de guerra
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <PlanCard
            name="Gabinete"
            audience="cidades até 100 mil hab."
            price="Sob consulta"
            features={[
              "1 instância WhatsApp · 60 grupos",
              "Alertas + briefing diário",
              "Território e relatórios",
              "3 usuários",
            ]}
            cta="Falar com vendas"
          />
          <PlanCardFeatured />
          <PlanCard
            name="Guerra"
            audience="capitais e campanhas"
            price="Sob consulta"
            features={[
              "Tudo do Cidade, e mais:",
              "Modo Eleição completo",
              "Radar de desinformação",
              "Zonas eleitorais (TSE)",
              "Usuários ilimitados · SLA 24/7",
            ]}
            cta="Falar com vendas"
          />
        </div>
      </section>

      {/* ── CTA final + footer ───────────────────────────────── */}
      <section className="bg-v2-panel text-white">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-14 text-center md:px-14">
          <div className="font-display text-[28px] font-[550] leading-[1.2] md:text-[38px]">
            Toda semana uma manchete nasce
            <br />
            num grupo de bairro. <span className="italic text-v2-mint">Leia antes.</span>
          </div>
          <div className="mt-[26px] flex justify-center">
            <a
              href={MAILTO_DEMO}
              className="rounded-[10px] bg-v2-mint px-[26px] py-[13px] text-[15px] font-[650] text-v2-panel transition-opacity hover:opacity-90"
            >
              Agendar demonstração
            </a>
          </div>
        </div>
        <SiteFooter />
      </section>
    </div>
  );
}

/* ── Header do site ─────────────────────────────────────────── */
function SiteHeader() {
  const nav = [
    { label: "Produto", href: "#produto" },
    { label: "Câmara Municipal", href: "#camara" },
    { label: "Modo Eleição", href: "#eleicao" },
    { label: "Segurança e LGPD", href: "#lgpd" },
    { label: "Planos", href: "#planos" },
  ];
  return (
    <header className="sticky top-0 z-50 flex items-center gap-[26px] border-b border-v2-line bg-v2-bg/90 px-6 py-4 backdrop-blur md:px-14">
      <SiteLogo />
      <nav className="hidden gap-[22px] text-[13.5px] lg:flex">
        {nav.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="text-v2-ink-2 transition-colors hover:text-v2-ink"
          >
            {n.label}
          </a>
        ))}
      </nav>
      <div className="flex-1" />
      <Link to="/entrar" className="text-[13.5px] font-[650] text-v2-ink hover:text-v2-green">
        Entrar
      </Link>
      <a
        href={MAILTO_DEMO}
        className="rounded-lg bg-v2-green px-[18px] py-[9px] text-[13.5px] font-[650] text-white transition-colors hover:bg-v2-green-hover"
      >
        Agendar demonstração
      </a>
    </header>
  );
}

function SiteLogo({ dark }: { dark?: boolean }) {
  const accent = dark ? "text-v2-mint" : "text-v2-green";
  return (
    <Link
      to="/site"
      className={`font-display text-[22px] font-semibold ${dark ? "text-white" : "text-v2-ink"}`}
    >
      In<i className={accent}>pol</i>
      <span className={accent}>.</span>
    </Link>
  );
}

/* ── Footer escuro (dentro da seção verde) ──────────────────── */
function SiteFooter() {
  return (
    <div className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center gap-x-[22px] gap-y-2 px-6 py-6 text-[12.5px] text-v2-panel-ink md:px-14">
        <SiteLogo dark />
        <span>© 2026 inPol Tecnologia LTDA</span>
        <div className="flex-1" />
        <Link to="/site/privacidade" className="text-v2-panel-ink hover:text-white">
          Privacidade
        </Link>
        <Link to="/site/termos" className="text-v2-panel-ink hover:text-white">
          Termos de uso
        </Link>
        <Link to="/site/lgpd" className="text-v2-panel-ink hover:text-white">
          LGPD
        </Link>
        <span>contato@inpol.com.br</span>
      </div>
    </div>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[30px] font-[550]">{value}</div>
      <div className="mt-0.5 text-[12px] text-v2-ink-3">{label}</div>
    </div>
  );
}

function StepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-v2-line bg-v2-card p-6">
      <div className="font-mono text-[12px] font-bold text-v2-green">{step}</div>
      <div className="mt-2.5 text-[16px] font-[650]">{title}</div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-v2-ink-2">{body}</p>
    </div>
  );
}

function PlanCard({
  name,
  audience,
  price,
  per,
  features,
  cta,
}: {
  name: string;
  audience: string;
  price: string;
  per?: string;
  features: string[];
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-v2-line bg-v2-card p-[26px]">
      <div className="text-[15px] font-[650]">{name}</div>
      <div className="mt-[3px] text-[12.5px] text-v2-ink-3">{audience}</div>
      <div className="mt-3.5 flex items-baseline gap-1">
        <span className="font-display text-[34px] font-[550]">{price}</span>
        {per && <span className="text-[12.5px] text-v2-ink-3">{per}</span>}
      </div>
      <ul className="mt-3 text-[13px] leading-8 text-v2-ink-2">
        {features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      <a
        href={MAILTO_SALES}
        className="mt-[18px] block w-full rounded-lg border border-v2-line-strong py-2.5 text-center text-[13.5px] font-[650] text-v2-ink transition-colors hover:bg-v2-track"
      >
        {cta}
      </a>
    </div>
  );
}

function PlanCardFeatured() {
  const features = [
    "Tudo do Gabinete, e mais:",
    "3 instâncias · 200 grupos",
    "Módulo Câmara Municipal",
    "Adversários + rede monitorada",
    "10 usuários + trilha LGPD",
  ];
  return (
    <div className="relative rounded-2xl bg-v2-panel p-[26px] text-white">
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-v2-gold px-3 py-1 font-mono text-[9.5px] font-bold tracking-[0.08em] text-v2-panel-gold">
        MAIS ESCOLHIDO
      </span>
      <div className="text-[15px] font-[650]">Cidade</div>
      <div className="mt-[3px] text-[12.5px] text-v2-panel-ink">100 mil a 500 mil hab.</div>
      <div className="mt-3.5 flex items-baseline gap-1">
        <span className="font-display text-[34px] font-[550]">Sob consulta</span>
      </div>
      <ul className="mt-3 text-[13px] leading-8 text-white/80">
        {features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      <a
        href={MAILTO_DEMO}
        className="mt-[18px] block w-full rounded-lg bg-v2-mint py-2.5 text-center text-[13.5px] font-[650] text-v2-panel transition-opacity hover:opacity-90"
      >
        Agendar demonstração
      </a>
    </div>
  );
}
