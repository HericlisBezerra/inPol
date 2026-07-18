import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/relatorios/$reportId")({
  head: () => ({ meta: [{ title: "Relatório — Inpol v2" }] }),
  component: Screen,
});

const REPORT_HEADERS: Record<string, { kicker: string; title: string }> = {
  "diario-18-jul": {
    kicker: "RELATÓRIO DIÁRIO · 18 JUL · 08:00",
    title: "Sexta, 18 de julho — dia de agir na Vila Rami",
  },
  "semanal-28": {
    kicker: "RELATÓRIO SEMANAL · SEMANA 28 · 08:00",
    title: "Semana 28 — sentimento em alta, zona norte em queda",
  },
  "mensal-junho": {
    kicker: "RELATÓRIO MENSAL · JUNHO · 08:00",
    title: "Junho — balanço do semestre e mapa de riscos",
  },
};

/** S8 — Relatório: leitura executiva. Decisão primeiro, dados depois; exporta PDF/WhatsApp. Demo data. */
function Screen() {
  const { reportId } = Route.useParams();
  const header = REPORT_HEADERS[reportId] ?? REPORT_HEADERS["diario-18-jul"];

  return (
    <div className="mx-auto w-full max-w-[780px]">
      {/* Top bar: back + export */}
      <div className="flex items-center justify-between">
        <Link to="/v2/relatorios" className="text-[13px] text-v2-ink-3 hover:text-v2-ink">
          ← Relatórios
        </Link>
        <div className="flex gap-2">
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-[13px] py-[7px] text-[12.5px] font-[650] text-v2-ink">
            ⇩ PDF
          </button>
          <button className="rounded-lg border border-v2-line-strong bg-v2-card px-[13px] py-[7px] text-[12.5px] font-[650] text-v2-ink">
            Enviar no WhatsApp
          </button>
        </div>
      </div>

      {/* Kicker + title (leitura executiva: serifa Fraunces) */}
      <div className="mt-[18px]">
        <span className="rounded bg-v2-green-tint px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.08em] text-v2-green">
          {header.kicker}
        </span>
      </div>
      <h1 className="mt-2.5 font-display text-[27px] font-[650] leading-[1.25] tracking-[-0.015em] text-v2-ink">
        {header.title}
      </h1>

      {/* SE VOCÊ SÓ LER UMA COISA */}
      <div className="mt-[18px] rounded-[13px] border border-v2-line bg-v2-card px-6 py-5">
        <div className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
          SE VOCÊ SÓ LER UMA COISA
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <TakeawayRow badge="AGIR" badgeClass="text-v2-crit bg-v2-crit-bg">
            <b>Enchente na Vila Rami</b> escala rápido (214 msgs, vídeo viral). Pronunciamento +
            visita da Defesa Civil <b>antes do meio-dia</b> inverte a manchete.{" "}
            <Link
              to="/v2/alertas/$alertId"
              params={{ alertId: "vila-rami" }}
              className="font-semibold text-v2-green hover:text-v2-green-hover"
            >
              Abrir roteiro →
            </Link>
          </TakeawayRow>
          <TakeawayRow badge="PREPARAR" badgeClass="text-v2-warn bg-v2-warn-bg">
            <b>UBS do Retiro</b>: 87 reclamações em 48h e oposição repostando. Deixar nota da Saúde
            pronta para sábado.
          </TakeawayRow>
          <TakeawayRow badge="APROVEITAR" badgeClass="text-v2-green bg-v2-green-tint">
            <b>Ciclovia</b> com 94% positivo é o melhor conteúdo do mês — impulsionar hoje à tarde
            alcança a zona norte.
          </TakeawayRow>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Mensagens analisadas" value="18.402" />
        <StatTile label="Alertas abertos" value="3" valueClass="text-v2-crit" />
        <StatTile label="Sentimento do dia" value="+0.14" valueClass="text-v2-green" />
        <StatTile label="Tema dominante" value="Enchentes" />
      </div>

      {/* Sentiment chart + temas do dia */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-[650] text-v2-ink">Sentimento · últimos 14 dias</span>
            <span className="font-mono text-[10.5px] text-v2-faint">0 = NEUTRO</span>
          </div>
          <svg width="100%" height="120" viewBox="0 0 460 120" className="mt-2.5">
            <line
              x1="0"
              y1="60"
              x2="460"
              y2="60"
              strokeWidth="1"
              strokeDasharray="3 4"
              className="stroke-v2-line"
            />
            <polyline
              points="0,72 35,66 70,74 105,58 140,52 175,60 210,44 245,40 280,48 315,34 350,30 385,42 420,64 460,70"
              fill="none"
              strokeWidth="2"
              className="stroke-v2-green"
            />
            <circle cx="460" cy="70" r="4" className="fill-v2-crit" />
            <text x="452" y="92" fontSize="9" textAnchor="end" className="fill-v2-crit font-mono">
              hoje: queda puxada pela Vila Rami
            </text>
          </svg>
        </div>
        <div className="rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-[18px]">
          <div className="text-[14px] font-[650] text-v2-ink">Temas do dia</div>
          <div className="mt-3 flex flex-col gap-[9px]">
            <ThemeRow label="Enchentes" meta="412 · ▲210%" metaClass="text-v2-crit" />
            <ThemeRow label="Saúde / UBS" meta="265 · ▲44%" metaClass="text-v2-warn" />
            <ThemeRow label="Ciclovia" meta="183 · ▲61%" metaClass="text-v2-green" />
            <ThemeRow label="Transporte" meta="127 · —2%" metaClass="text-v2-faint" />
          </div>
        </div>
      </div>

      {/* Expandable deep-dive sections */}
      <div className="mt-3.5 rounded-[13px] border border-v2-line bg-v2-card px-[22px] py-1.5">
        <ExpandRow title="📝 Narrativa completa da IA">
          <div className="font-display text-[14.5px] leading-[1.7] text-v2-ink-2">
            <p>
              A sexta-feira amanhece com um único assunto capaz de definir a semana: a{" "}
              <b className="text-v2-ink">enchente na Vila Rami</b>. Entre 05h40 e 07h30, 214
              mensagens em 6 grupos convergiram para a mesma leitura — a de que &ldquo;a prefeitura
              abandonou o bairro&rdquo; — e um vídeo de 41 segundos, já com 3,2 mil
              compartilhamentos, dá rosto e voz a essa narrativa. A janela para inverter a manchete
              fecha ao meio-dia, quando a imprensa local publica as matérias do fim de semana.
            </p>
            <p className="mt-3">
              Em segundo plano, a <b className="text-v2-ink">UBS do Retiro</b> acumula 87
              reclamações em 48 horas — ritmo que, mantido, transforma fila de espera em pauta de
              oposição até sábado. Já a <b className="text-v2-ink">ciclovia</b> segue como o ativo
              de imagem mais forte do mês: 94% de menções positivas e alcance orgânico crescente na
              zona norte, justamente onde o sentimento geral está em queda.
            </p>
          </div>
        </ExpandRow>
        <ExpandRow title="🔎 Citações reais por tema (28)">
          <div className="flex flex-col gap-3">
            <Quote source="WHATSAPP · GRUPO MORADORES VILA RAMI · 06:12" tone="text-v2-crit">
              &ldquo;terceira vez que alaga e ninguém aparece, cadê o prefeito que veio pedir voto
              aqui?&rdquo;
            </Quote>
            <Quote source="WHATSAPP · BAIRRO RETIRO UNIDO · ONTEM 19:44" tone="text-v2-warn">
              &ldquo;cheguei 6h na UBS e só fui atendida 11h, com criança no colo&rdquo;
            </Quote>
            <Quote source="INSTAGRAM · COMENTÁRIO EM @PREFEITURA · 13:12" tone="text-v2-green">
              &ldquo;a ciclovia ficou linda, agora vou de bike pro trabalho todo dia&rdquo;
            </Quote>
            <div className="font-mono text-[11px] text-v2-faint">
              + 25 citações no relatório completo
            </div>
          </div>
        </ExpandRow>
        <ExpandRow title="📍 Bairros × temas (6)" last>
          <div className="flex flex-col gap-2">
            <BairroRow
              bairro="Vila Rami"
              tema="Enchentes / drenagem"
              meta="214 msgs · −0.55"
              metaClass="text-v2-crit"
            />
            <BairroRow
              bairro="Retiro"
              tema="Saúde / UBS"
              meta="87 msgs · −0.31"
              metaClass="text-v2-warn"
            />
            <BairroRow
              bairro="Anhangabaú"
              tema="Boato da creche"
              meta="42 msgs · −0.12"
              metaClass="text-v2-obs"
            />
            <BairroRow
              bairro="Centro"
              tema="Ciclovia nova"
              meta="96 msgs · +0.48"
              metaClass="text-v2-green"
            />
            <BairroRow
              bairro="Eloy Chaves"
              tema="Ciclovia nova"
              meta="61 msgs · +0.41"
              metaClass="text-v2-green"
            />
            <BairroRow
              bairro="Zona Norte"
              tema="Transporte"
              meta="58 msgs · −0.04"
              metaClass="text-v2-obs"
            />
          </div>
        </ExpandRow>
      </div>

      {/* Footer meta */}
      <div className="mt-[18px] text-center font-mono text-[11px] text-v2-faint">
        gerado por Inpol IA · 18 jul 08:00 · fontes: 142 grupos, 8 portais, 12 perfis
      </div>
    </div>
  );
}

function TakeawayRow({
  badge,
  badgeClass,
  children,
}: {
  badge: string;
  badgeClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex-none rounded px-2 py-[3px] font-mono text-[12px] font-bold ${badgeClass}`}
      >
        {badge}
      </span>
      <span className="text-[14.5px] leading-[1.55] text-v2-ink">{children}</span>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[11px] border border-v2-line bg-v2-card px-[15px] py-[13px]">
      <div className="text-[11.5px] text-v2-ink-3">{label}</div>
      <div className={`mt-[3px] text-[19px] font-[650] ${valueClass ?? "text-v2-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function ThemeRow({ label, meta, metaClass }: { label: string; meta: string; metaClass: string }) {
  return (
    <div className="flex justify-between text-[13px] text-v2-ink">
      <span>{label}</span>
      <span className={`font-mono text-[11px] ${metaClass}`}>{meta}</span>
    </div>
  );
}

function ExpandRow({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={!last ? "border-b border-v2-track" : ""}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3.5 text-left"
      >
        <span className="whitespace-nowrap text-[13.5px] font-[650] text-v2-ink">{title}</span>
        <span className="text-[12px] text-v2-ink-3">{open ? "recolher ⌃" : "expandir ⌄"}</span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function Quote({ source, tone, children }: { source: string; tone: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-v2-line-strong pl-3.5">
      <div className={`font-mono text-[10px] font-semibold tracking-[0.06em] ${tone}`}>
        {source}
      </div>
      <div className="mt-1 font-display text-[14px] italic leading-relaxed text-v2-ink">
        {children}
      </div>
    </div>
  );
}

function BairroRow({
  bairro,
  tema,
  meta,
  metaClass,
}: {
  bairro: string;
  tema: string;
  meta: string;
  metaClass: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-[110px] flex-none font-semibold text-v2-ink">{bairro}</span>
      <span className="flex-1 text-v2-ink-2">{tema}</span>
      <span className={`font-mono text-[11px] ${metaClass}`}>{meta}</span>
    </div>
  );
}
