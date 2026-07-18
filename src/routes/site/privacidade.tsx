import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/site/privacidade")({
  head: () => ({ meta: [{ title: "Política de privacidade — Inpol" }] }),
  component: Screen,
});

const TOC = [
  { id: "coletamos", label: "1. O que coletamos" },
  { id: "porque", label: "2. Por que coletamos" },
  { id: "nunca", label: "3. O que nunca fazemos" },
  { id: "compartilhamento", label: "4. Compartilhamento" },
  { id: "retencao", label: "5. Retenção e exclusão" },
  { id: "direitos", label: "6. Seus direitos" },
  { id: "dpo", label: "7. Contato do DPO" },
];

/** W2 — Política de privacidade. */
function Screen() {
  const [active, setActive] = useState("coletamos");
  return (
    <div className="text-v2-ink">
      <LegalHeader label="Central de privacidade" />

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
            VIGENTE DESDE 01 JUL 2026 · V3.2
          </div>
          <h1 className="mt-2 font-display text-[30px] font-[550] md:text-[36px]">
            Política de privacidade
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.7] text-v2-ink-2">
            O inPol processa dados de comunicação pública e de grupos com participação legítima para
            gerar inteligência política. Esta política explica, sem juridiquês, o que entra, o que
            sai e o que nunca acontece com esses dados.
          </p>

          <div className="mt-5 rounded-xl border border-v2-green-border bg-v2-green-tint px-5 py-4">
            <div className="text-[13px] font-[650] text-v2-panel">Resumo em 30 segundos</div>
            <p className="mt-1.5 text-[13px] leading-[1.7] text-v2-green-ink">
              Coletamos mensagens de grupos em que o número da organização participa, conteúdo
              público de portais e redes, e dados de conta dos usuários. Usamos para detectar crises
              e gerar análises. Não vendemos dados, não coletamos conversas privadas, não fazemos
              perfilamento de eleitores individuais. Você pode pedir acesso, correção ou exclusão a
              qualquer momento.
            </p>
          </div>

          <h2 id="coletamos" className="mt-8 scroll-mt-6 text-[19px] font-[650]">
            1. O que coletamos
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            <b className="text-v2-ink">Mensagens de grupos:</b> texto, data, grupo de origem e autor
            (pseudonimizado por padrão) dos grupos de WhatsApp em que a organização participa
            legitimamente. <b className="text-v2-ink">Conteúdo público:</b> matérias de portais,
            posts públicos de perfis monitorados e sessões públicas da Câmara.{" "}
            <b className="text-v2-ink">Dados de conta:</b> nome, e-mail institucional, papel e
            registros de acesso dos usuários da plataforma.
          </p>

          <h2 id="porque" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            2. Por que coletamos
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            Base legal: legítimo interesse (art. 7º, IX da LGPD) para monitoramento de reputação
            institucional e interesse público, e execução de contrato para os dados de conta. A
            finalidade é única: inteligência agregada para gestão pública — detecção de crises,
            análise territorial e resumos.
          </p>

          <h2 id="nunca" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            3. O que nunca fazemos
          </h2>
          <div className="mt-2.5 rounded-xl border border-v2-crit/25 bg-v2-crit-bg/50 px-5 py-4 text-[14px] leading-[1.9] text-v2-ink-2">
            ✕ Ler conversas privadas (1:1) — tecnicamente bloqueado na ingestão
            <br />✕ Vender ou ceder dados a terceiros
            <br />✕ Perfilamento político de eleitores individuais
            <br />✕ Tratar dados sensíveis (art. 11) para segmentação
            <br />✕ Manter dados após o fim do contrato (expurgo em 30 dias)
          </div>

          <h2 id="direitos" className="mt-7 scroll-mt-6 text-[19px] font-[650]">
            6. Seus direitos como titular
          </h2>
          <p className="mt-2 text-[14px] leading-[1.75] text-v2-ink-2">
            Qualquer pessoa citada em dados tratados pelo inPol pode solicitar confirmação, acesso,
            correção, anonimização ou eliminação pelo canal do titular. Prazo de resposta: 15 dias.{" "}
            <Link to="/site/lgpd" className="font-[650] text-v2-green hover:text-v2-green-hover">
              Abrir canal do titular →
            </Link>
          </p>

          <div
            id="dpo"
            className="mt-8 scroll-mt-6 border-t border-v2-line pt-4 text-[13px] text-v2-ink-3"
          >
            Encarregado (DPO): dpo@inpol.com.br · inPol Tecnologia LTDA · CNPJ 00.000.000/0001-00
          </div>
        </article>
      </div>
    </div>
  );
}

/* Header enxuto das páginas legais */
function LegalHeader({ label }: { label?: string }) {
  return (
    <header className="flex items-center gap-[26px] border-b border-v2-line px-6 py-4 md:px-14">
      <Link to="/site" className="font-display text-[20px] font-semibold text-v2-ink">
        In<i className="text-v2-green">pol</i>
        <span className="text-v2-green">.</span>
      </Link>
      <div className="flex-1" />
      {label && <span className="hidden text-[13px] text-v2-ink-2 sm:inline">{label}</span>}
      <Link
        to="/entrar"
        className="rounded-lg bg-v2-green px-[15px] py-2 text-[13px] font-[650] text-white transition-colors hover:bg-v2-green-hover"
      >
        Entrar
      </Link>
    </header>
  );
}
