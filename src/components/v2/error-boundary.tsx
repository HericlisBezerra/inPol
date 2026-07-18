/** Shared v2 error + not-found boundaries (warm cream). Wired into the /v2 and /site layouts
 *  so a single broken screen degrades gracefully instead of white-screening the app. */
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="v2-root flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export function V2ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Frame>
      <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-crit">
        ALGO QUEBROU
      </div>
      <h1 className="mt-3 font-display text-[26px] font-semibold text-v2-ink">
        Esta tela não carregou
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-v2-ink-2">
        Um erro impediu a renderização. Você pode tentar de novo ou voltar ao painel.
      </p>
      <div className="mt-6 flex gap-2.5">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="rounded-lg bg-v2-ink px-4 py-2.5 text-[14px] font-semibold text-white"
        >
          Tentar de novo
        </button>
        <Link
          to="/v2"
          className="rounded-lg border border-v2-line-strong bg-v2-card px-4 py-2.5 text-[14px] font-semibold text-v2-ink"
        >
          Ir para o painel
        </Link>
      </div>
    </Frame>
  );
}

export function V2NotFound() {
  return (
    <Frame>
      <div className="font-display text-[64px] font-semibold leading-none text-v2-ink">404</div>
      <h1 className="mt-3 text-[20px] font-semibold text-v2-ink">Página não encontrada</h1>
      <p className="mt-2 text-[14px] text-v2-ink-2">
        O endereço não existe ou foi movido.
      </p>
      <Link
        to="/v2"
        className="mt-6 rounded-lg bg-v2-green px-4 py-2.5 text-[14px] font-semibold text-white"
      >
        Voltar ao painel
      </Link>
    </Frame>
  );
}
