import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/v2/camara/$vereadorId")({
  head: () => ({ meta: [{ title: "Vereador — Inpol v2" }] }),
  component: Screen,
});

const TABS = [
  { id: "falas", label: "🎙 Falas", count: 48 },
  { id: "cobrancas", label: "📌 Cobranças", count: 5 },
  { id: "justificativas", label: "📄 Justificativas", count: 9 },
  { id: "entregas", label: "✅ Entregas", count: 3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** S15 — Câmara · Perfil do vereador: repositório de falas, cobranças com prazo, padrão de atuação. Demo data (João Parimoschi). */
function Screen() {
  const [tab, setTab] = useState<TabId>("falas");

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col">
      <Link to="/v2/camara" className="text-[13px] text-v2-ink-3 hover:text-v2-ink">
        ← Câmara Municipal
      </Link>

      {/* Identity header */}
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start">
        <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-v2-crit-bg text-[20px] font-semibold text-v2-crit">
          JP
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-[23px] font-[650] text-v2-ink">João Parimoschi</span>
            <span className="rounded bg-v2-crit-bg px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.06em] text-v2-crit">
              OPOSIÇÃO
            </span>
          </div>
          <div className="mt-1 text-[13px] text-v2-ink-3">
            Vereador · PL · 2º mandato · 8.412 votos (2024) · @parimoschi
          </div>
          <div className="mt-2 flex gap-1.5">
            <TagPill>zona norte</TagPill>
            <TagPill>enchentes</TagPill>
            <TagPill>saúde</TagPill>
          </div>
        </div>
        <div className="flex flex-none gap-3">
          <div className="w-[118px] rounded-xl border border-v2-line bg-v2-card px-[18px] py-[13px] text-center">
            <div className="font-mono text-[9.5px] font-semibold tracking-[0.1em] text-v2-faint">
              ALINHAMENTO
            </div>
            <div className="mt-1 text-[24px] font-[650] text-v2-crit">23%</div>
            <div className="mt-[7px] h-[5px] rounded-[3px] bg-v2-track">
              <div className="h-full rounded-[3px] bg-v2-crit" style={{ width: "23%" }} />
            </div>
            <div className="mt-[5px] font-mono text-[10px] text-v2-ink-3">
              votou c/ governo 7/30
            </div>
          </div>
          <div className="w-[118px] rounded-xl border border-v2-line bg-v2-card px-[18px] py-[13px] text-center">
            <div className="font-mono text-[9.5px] font-semibold tracking-[0.1em] text-v2-faint">
              GRAU DE RISCO
            </div>
            <div className="mt-1 text-[24px] font-[650] text-v2-crit">ALTO</div>
            <div className="mt-[9px] font-mono text-[10px] text-v2-ink-3">
              87 de atividade · pauta viral 2× no mês
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 mt-[22px] flex gap-1.5 overflow-x-auto border-b border-v2-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3.5 pb-2.5 pt-2 text-[13.5px] ${
              tab === t.id
                ? "-mb-px border-b-2 border-v2-green font-[650] text-v2-ink"
                : "font-semibold text-v2-ink-3 hover:text-v2-ink"
            }`}
          >
            {t.label} <span className="text-v2-faint">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: repositório */}
        <div className="self-start overflow-hidden rounded-[13px] border border-v2-line bg-v2-card">
          {tab === "falas" ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-v2-track px-[18px] py-3">
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-v2-track px-[11px] py-1.5 text-[12px] text-v2-ink-3">
                  ⌕ Buscar nas falas… ("galeria", "UBS", "IPTU")
                </div>
                <button className="whitespace-nowrap rounded-lg border border-v2-line px-[11px] py-1.5 text-[12px] font-semibold text-v2-ink-2">
                  Tema ⌄
                </button>
                <button className="whitespace-nowrap rounded-lg border border-v2-line px-[11px] py-1.5 text-[12px] font-semibold text-v2-ink-2">
                  Tom ⌄
                </button>
              </div>
              <FalaRow
                tone="TOM: ATAQUE"
                toneClass="text-v2-crit"
                session="32ª SESSÃO · 17 JUL"
                theme="enchentes"
                video="▶ vídeo 00:14:22"
                quote={
                  '"A Vila Rami alagou pela terceira vez e a galeria prometida em 2024 não saiu do papel. O prefeito vai esperar levarem um caixão pela enxurrada?"'
                }
                actions
              />
              <FalaRow
                tone="TOM: ATAQUE"
                toneClass="text-v2-crit"
                session="31ª SESSÃO · 10 JUL"
                theme="saúde"
                video="▶ vídeo 00:52:08"
                quote={
                  "\"Cinco horas de fila na UBS do Retiro. A Secretaria fala em 'reorganização de fluxo' — o povo chama de descaso.\""
                }
              />
              <FalaRow
                tone="TOM: COBRANÇA"
                toneClass="text-v2-warn"
                session="30ª SESSÃO · 03 JUL"
                theme="transporte"
                video="▶ vídeo 01:18:40"
                quote={
                  '"Reitero o requerimento 88/26: cadê o estudo da linha 653? Protocolei há 60 dias, sem resposta."'
                }
                last
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
              <div className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-v2-faint">
                {TABS.find((t) => t.id === tab)?.count} ITENS INDEXADOS
              </div>
              <div className="text-[13.5px] text-v2-ink-2">
                Repositório de{" "}
                {TABS.find((t) => t.id === tab)
                  ?.label.replace(/^\S+\s/, "")
                  .toLowerCase()}{" "}
                em consolidação — dados completos na próxima sincronização.
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              COBRANÇAS AO GOVERNO
            </div>
            <CobrancaRow
              tag="VENCE SEX"
              tagClass="bg-v2-crit-bg text-v2-crit"
              title="Req. 88/26 — estudo da linha 653"
              note={<>sem resposta há 60 dias</>}
            />
            <CobrancaRow
              tag="ABERTA"
              tagClass="bg-v2-warn-bg text-v2-warn"
              title="Cronograma da galeria Vila Rami"
              note={<>respondida parcialmente em jun</>}
            />
            <CobrancaRow
              tag="RESPONDIDA"
              tagClass="bg-v2-green-tint text-v2-green"
              title="Iluminação da praça do Retiro"
              note={
                <>
                  entrega concluída em mai — <b>usar como resposta</b>
                </>
              }
              last
            />
          </div>

          <div className="rounded-[13px] border border-v2-line bg-v2-card px-[18px] py-4">
            <div className="mb-2 font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              PADRÃO DE ATUAÇÃO
            </div>
            <div className="text-[12.5px] leading-[1.6] text-v2-ink-2">
              Fala 2,4× mais que a média · 78% das falas são ataque/cobrança · temas fixos: zona
              norte, saúde · publica no Instagram ~2h após picos negativos nos grupos.
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-[13px]">
            <span className="text-[14px]">✦</span>
            <span className="flex-1 text-[12.5px] leading-normal text-v2-green-ink">
              <b>Munição pronta:</b> das 5 cobranças dele, 2 já foram entregues pelo governo. A IA
              montou o contraponto.{" "}
              <button className="font-semibold text-v2-green">Ver rascunho →</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-v2-track px-[9px] py-[3px] text-[11.5px] text-v2-ink-2">
      {children}
    </span>
  );
}

function FalaRow({
  tone,
  toneClass,
  session,
  theme,
  video,
  quote,
  actions,
  last,
}: {
  tone: string;
  toneClass: string;
  session: string;
  theme: string;
  video: string;
  quote: string;
  actions?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`px-[18px] py-3.5 ${!last ? "border-b border-v2-track" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-v2-ink-3">
        <span className={toneClass}>{tone}</span>
        <span>{session}</span>
        <span>{theme}</span>
        <span className="text-v2-green">{video}</span>
      </div>
      <div className="mt-1.5 text-[13.5px] italic leading-[1.6] text-v2-ink">{quote}</div>
      {actions && (
        <div className="mt-2 flex gap-2.5">
          <button className="text-[12px] font-[650] text-v2-green">
            ＋ Anexar ao alerta Vila Rami
          </button>
          <button className="text-[12px] text-v2-ink-3">Copiar citação</button>
        </div>
      )}
    </div>
  );
}

function CobrancaRow({
  tag,
  tagClass,
  title,
  note,
  last,
}: {
  tag: string;
  tagClass: string;
  title: string;
  note: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5 py-2 ${!last ? "border-b border-v2-track" : ""}`}>
      <span
        className={`flex-none whitespace-nowrap rounded px-[7px] py-[3px] font-mono text-[9.5px] font-bold ${tagClass}`}
      >
        {tag}
      </span>
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold text-v2-ink">{title}</div>
        <div className="mt-px text-[11px] text-v2-ink-3">{note}</div>
      </div>
    </div>
  );
}
