import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entrar")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Entrar — Inpol" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Screen,
});

/** S21 — Login: painel institucional + formulário e-mail/senha e link mágico ligados ao Supabase Auth. */
function Screen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isMagicPending, setIsMagicPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPending(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/painel" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha no login.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleMagicLink = async () => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage("Informe o e-mail para receber o link mágico.");
      return;
    }
    setIsMagicPending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/painel` },
      });
      if (error) throw error;
      toast.success("Link mágico enviado. Confira seu e-mail.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar o link mágico.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsMagicPending(false);
    }
  };

  return (
    <div className="v2-root flex min-h-screen flex-col text-v2-ink lg:flex-row">
      {/* Painel esquerdo — verde escuro institucional */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-v2-panel px-8 py-8 lg:flex-[1.1] lg:px-12 lg:py-11">
        <BrandMark dark />
        <div className="relative z-10 py-10 lg:py-0">
          <div className="max-w-[420px] font-display text-[32px] font-[550] leading-[1.2] text-white lg:text-[38px]">
            Saiba antes.
            <br />
            Aja antes da manchete.
          </div>
          <p className="mt-3.5 max-w-[400px] text-[14.5px] leading-[1.65] text-v2-panel-ink">
            Inteligência política para prefeituras: grupos, imprensa, redes e Câmara — lidos pela
            IA, entregues como decisão.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-5 font-mono text-[11px] text-v2-panel-ink/80">
          <span>🛡 LGPD by design</span>
          <span>● dados no Brasil</span>
          <span>◆ trilha de auditoria</span>
        </div>
        <RadarDecoration />
      </div>

      {/* Coluna do formulário */}
      <div className="grid flex-1 place-items-center bg-v2-surface px-6 py-10">
        <div className="w-full max-w-[360px]">
          <h1 className="text-[22px] font-[650] tracking-[-0.01em] text-v2-ink">Entrar no inPol</h1>
          <p className="mt-1.5 text-[13px] text-v2-ink-3">
            Use o e-mail institucional cadastrado pela sua organização.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mt-6">
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[12.5px] font-[650] text-v2-ink"
              >
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="voce@suaprefeitura.sp.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[10px] border-[1.5px] border-v2-green bg-v2-card px-3.5 py-[11px] text-[14px] text-v2-ink shadow-[0_0_0_3px_rgba(14,123,91,0.12)] outline-none"
              />
            </div>

            <div className="mt-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-senha" className="text-[12.5px] font-[650] text-v2-ink">
                  Senha
                </label>
                <button type="button" className="text-[12px] font-[650] text-v2-green">
                  Esqueci a senha
                </button>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-v2-line-strong bg-v2-card px-3.5 py-[11px]">
                <input
                  id="login-senha"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-[14px] text-v2-ink outline-none"
                />
                <span className="ml-2 select-none text-[14px]" aria-hidden>
                  👁
                </span>
              </div>
            </div>

            {errorMessage && (
              <p className="mt-3 text-[12.5px] leading-[1.5] text-v2-crit">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-5 block w-full rounded-[10px] bg-v2-ink py-3 text-center text-[14.5px] font-[650] text-white disabled:opacity-60"
            >
              {isPending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-v2-line" />
            <span className="text-[11.5px] text-v2-faint">ou</span>
            <div className="h-px flex-1 bg-v2-line" />
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={isMagicPending}
            className="w-full rounded-[10px] border border-v2-line-strong bg-v2-card py-3 text-center text-[14px] font-[650] text-v2-ink disabled:opacity-60"
          >
            {isMagicPending ? "Enviando…" : "✉ Receber link mágico por e-mail"}
          </button>

          <p className="mt-5 text-center text-[11.5px] leading-[1.6] text-v2-faint">
            Acesso monitorado e registrado (LGPD). Ao entrar você aceita os{" "}
            <Link to="/site/termos" className="text-v2-green">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link to="/site/privacidade" className="text-v2-green">
              Política de privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandMark({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`relative z-10 font-display text-[26px] font-semibold ${dark ? "text-white" : "text-v2-ink"}`}
    >
      In
      <i className={dark ? "text-v2-mint" : "text-v2-green"}>pol</i>
      <span className={dark ? "text-v2-mint" : "text-v2-green"}>.</span>
    </span>
  );
}

/** Radar concêntrico decorativo do painel esquerdo (opacidade baixa, como no design). */
function RadarDecoration() {
  return (
    <svg
      width="420"
      height="420"
      viewBox="0 0 420 420"
      aria-hidden
      className="pointer-events-none absolute -right-[140px] top-[110px] opacity-[0.14]"
    >
      <circle
        cx="210"
        cy="210"
        r="200"
        fill="none"
        stroke="var(--color-v2-mint)"
        strokeWidth="1.5"
      />
      <circle
        cx="210"
        cy="210"
        r="140"
        fill="none"
        stroke="var(--color-v2-mint)"
        strokeWidth="1.5"
      />
      <circle
        cx="210"
        cy="210"
        r="80"
        fill="none"
        stroke="var(--color-v2-mint)"
        strokeWidth="1.5"
      />
      <line x1="210" y1="10" x2="210" y2="410" stroke="var(--color-v2-mint)" strokeWidth="1" />
      <line x1="10" y1="210" x2="410" y2="210" stroke="var(--color-v2-mint)" strokeWidth="1" />
      <circle cx="150" cy="120" r="5" fill="var(--color-v2-mint)" />
      <circle cx="290" cy="260" r="5" fill="var(--color-v2-gold)" />
      <circle cx="250" cy="150" r="5" fill="var(--color-v2-crit)" />
    </svg>
  );
}
