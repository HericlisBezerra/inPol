import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

export const Route = createFileRoute("/site/lgpd")({
  head: () => ({ meta: [{ title: "Central LGPD — Inpol" }] }),
  component: Screen,
});

const REQUEST_TYPES = ["Acesso", "Correção", "Anonimização", "Exclusão"] as const;

/** W4 — Central LGPD + canal do titular (formulário visual, inerte). */
function Screen() {
  const [requestType, setRequestType] = useState<(typeof REQUEST_TYPES)[number]>("Acesso");
  return (
    <div className="text-v2-ink">
      <LegalHeader />

      <div className="mx-auto w-full max-w-[920px] px-6 py-12 md:px-14">
        {/* Cabeçalho */}
        <div className="mx-auto max-w-[620px] text-center">
          <span className="inline-block rounded-full border border-v2-green-border bg-v2-green-tint px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-v2-green">
            🛡 CENTRAL LGPD
          </span>
          <h1 className="mt-4 font-display text-[30px] font-[550] md:text-[36px]">
            Transparência sobre dados, para qualquer cidadão
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.7] text-v2-ink-2">
            Se você acredita que uma mensagem sua foi tratada pelo inPol, pode exercer seus direitos
            aqui — sem precisar de conta.
          </p>
        </div>

        {/* Direitos */}
        <div className="mt-8 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <RightCard
            icon="🔎"
            title="Saber se há dados meus"
            body="Confirmação de tratamento em até 15 dias."
          />
          <RightCard
            icon="✏️"
            title="Corrigir ou anonimizar"
            body="Correção de dados incompletos ou inexatos."
          />
          <RightCard
            icon="🗑"
            title="Excluir meus dados"
            body="Eliminação, salvo obrigação legal de guarda."
          />
        </div>

        {/* Canal do titular */}
        <form
          className="mx-auto mt-4 max-w-[560px] rounded-2xl border border-v2-line bg-v2-card p-[26px]"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="text-[15px] font-[650]">Canal do titular de dados</div>

          <Field label="Seu nome" className="mt-4">
            <input
              type="text"
              placeholder="Nome completo"
              className="w-full rounded-lg border border-v2-line-strong bg-v2-surface px-[13px] py-2.5 text-[13.5px] text-v2-ink outline-none placeholder:text-v2-faint focus:border-v2-green"
            />
          </Field>

          <Field label="E-mail ou telefone para resposta" className="mt-3">
            <input
              type="text"
              placeholder="voce@email.com"
              className="w-full rounded-lg border border-v2-line-strong bg-v2-surface px-[13px] py-2.5 text-[13.5px] text-v2-ink outline-none placeholder:text-v2-faint focus:border-v2-green"
            />
          </Field>

          <div className="mt-3" role="radiogroup" aria-label="Solicitação">
            <div className="mb-[5px] text-[12.5px] font-[650]">Solicitação</div>
            <div className="flex flex-wrap gap-1.5">
              {REQUEST_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={requestType === t}
                  onClick={() => setRequestType(t)}
                  className={
                    requestType === t
                      ? "rounded-full bg-v2-ink px-3 py-1.5 text-[12px] font-[650] text-white"
                      : "rounded-full border border-v2-line px-3 py-1.5 text-[12px] font-semibold text-v2-ink-2 transition-colors hover:border-v2-line-strong hover:text-v2-ink"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Field label="Detalhes (opcional)" className="mt-3">
            <textarea
              placeholder="Descreva o contexto — ex.: grupo, período…"
              className="h-16 w-full resize-none rounded-lg border border-v2-line-strong bg-v2-surface px-[13px] py-2.5 text-[13.5px] text-v2-ink outline-none placeholder:text-v2-faint focus:border-v2-green"
            />
          </Field>

          <button
            type="submit"
            className="mt-[18px] w-full rounded-[10px] bg-v2-green py-3 text-center text-[14px] font-[650] text-white transition-colors hover:bg-v2-green-hover"
          >
            Enviar solicitação
          </button>
          <div className="mt-2.5 text-center text-[11.5px] text-v2-faint">
            Protocolo gerado na hora · resposta em até 15 dias · DPO: dpo@inpol.com.br
          </div>
        </form>

        {/* Selos */}
        <div className="mt-7 flex flex-wrap justify-center gap-x-[22px] gap-y-2 font-mono text-[11px] text-v2-ink-3">
          <span>● dados hospedados no Brasil</span>
          <span>● criptografia em repouso e trânsito</span>
          <span>● trilha de auditoria imutável</span>
        </div>
      </div>
    </div>
  );
}

function RightCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-[13px] border border-v2-line bg-v2-card p-5">
      <div className="text-[20px]">{icon}</div>
      <div className="mt-2 text-[14.5px] font-[650]">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-v2-ink-2">{body}</p>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-[5px] text-[12.5px] font-[650]">{label}</div>
      {children}
    </label>
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
