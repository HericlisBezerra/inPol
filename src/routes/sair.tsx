import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sair")({
  head: () => ({
    meta: [{ title: "Sessão encerrada — Inpol" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Screen,
});

/** S22 — Logoff (standalone): sessão encerrada com resumo de segurança. */
function Screen() {
  return (
    <div className="v2-root grid min-h-screen place-items-center bg-v2-surface px-6 py-10 text-v2-ink">
      <div className="w-full max-w-[420px] text-center">
        <span className="font-display text-[24px] font-semibold text-v2-ink">
          In<i className="text-v2-green">pol</i>
          <span className="text-v2-green">.</span>
        </span>

        <div className="mx-auto mt-[22px] grid h-14 w-14 place-items-center rounded-full bg-v2-green-tint text-[22px] text-v2-green">
          ✓
        </div>

        <h1 className="mt-3.5 text-[21px] font-[650] text-v2-ink">
          Sessão encerrada com segurança
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-v2-ink-3">
          Até logo, Marina. Se algo crítico acontecer, avisamos pelo WhatsApp e pelo push do
          celular.
        </p>

        <div className="mt-5 rounded-xl border border-v2-line bg-v2-card px-[18px] py-3.5 text-left">
          <SummaryRow label="Duração da sessão" value="2h 14min" />
          <SummaryRow label="Dispositivo" value="MacBook · São Paulo, BR" border />
          <SummaryRow label="Registro LGPD" value="✓ trilha gravada" tone="green" border />
        </div>

        <Link
          to="/entrar"
          className="mt-[18px] block rounded-[10px] bg-v2-ink py-3 text-center text-[14px] font-[650] text-white"
        >
          Entrar novamente
        </Link>

        <p className="mt-3.5 text-[12px] text-v2-faint">
          Não foi você?{" "}
          <button type="button" className="font-medium text-v2-green">
            Encerrar todas as sessões
          </button>
        </p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  border,
}: {
  label: string;
  value: string;
  tone?: "green";
  border?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-[5px] text-[12.5px] ${border ? "border-t border-v2-track" : ""}`}
    >
      <span className="text-v2-ink-3">{label}</span>
      <span
        className={`font-mono text-[12px] ${tone === "green" ? "text-v2-green" : "text-v2-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
