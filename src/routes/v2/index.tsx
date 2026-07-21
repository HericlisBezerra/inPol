import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { useCurrentOrg } from "@/lib/use-current-org";
import { V2Eyebrow } from "@/components/v2/shell";

export const Route = createFileRoute("/v2/")({
  head: () => ({ meta: [{ title: "Painel — Inpol v2" }] }),
  component: Painel,
});

type Tone = "crit" | "warn" | "obs" | "green" | "flat";

const LEVEL_META: Record<string, { label: string; tone: Tone; order: number }> = {
  vermelho: { label: "CRÍTICO", tone: "crit", order: 0 },
  critical: { label: "CRÍTICO", tone: "crit", order: 0 },
  laranja: { label: "ATENÇÃO", tone: "warn", order: 1 },
  high: { label: "ATENÇÃO", tone: "warn", order: 1 },
  amarelo: { label: "OBSERVAR", tone: "obs", order: 2 },
  medium: { label: "OBSERVAR", tone: "obs", order: 2 },
};

function levelMeta(level: string | null | undefined) {
  return (
    LEVEL_META[level ?? ""] ?? {
      label: (level ?? "ALERTA").toUpperCase(),
      tone: "obs" as Tone,
      order: 3,
    }
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diffMs / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const CARD_TONE: Record<Tone, { bar: string; badgeBg: string; badgeText: string }> = {
  crit: { bar: "bg-v2-crit", badgeBg: "bg-v2-crit-bg", badgeText: "text-v2-crit" },
  warn: { bar: "bg-v2-warn-strong", badgeBg: "bg-v2-warn-bg", badgeText: "text-v2-warn" },
  obs: { bar: "bg-v2-obs", badgeBg: "bg-v2-obs-bg", badgeText: "text-v2-obs" },
  green: { bar: "bg-v2-green", badgeBg: "bg-v2-green-tint", badgeText: "text-v2-green" },
  flat: { bar: "bg-v2-line-strong", badgeBg: "bg-v2-track", badgeText: "text-v2-ink-3" },
};

/** S1 — Painel: single focus + zones. Dados reais via getDashboard(orgId). */
function Painel() {
  const { orgId } = useCurrentOrg();

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => getDashboard({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
  });

  if (!orgId) {
    return <div className="p-6 text-[13px] text-v2-ink-3">Selecione uma organização.</div>;
  }

  const alerts = data?.alerts ?? [];
  const sortedAlerts = [...alerts].sort(
    (a, b) => levelMeta(a.level).order - levelMeta(b.level).order,
  );
  const primary = sortedAlerts[0];
  const secondary = sortedAlerts.slice(1, 3);

  const topics = data?.topics ?? [];
  const themeItems = topics.slice(0, 4).map((t) => {
    const risk = t.max_risk ?? 0;
    const sentiment = t.avg_sentiment ?? 0;
    const tone: Tone =
      risk >= 70 && sentiment < -0.3
        ? "crit"
        : risk >= 55 || sentiment < -0.4
          ? "warn"
          : sentiment > 0
            ? "green"
            : "flat";
    return {
      label: t.label,
      metric: `${(t.message_count ?? 0).toLocaleString("pt-BR")} msgs`,
      tone,
      pct: clamp(risk, 0, 100),
    };
  });

  // Território: agrega top_neighborhoods reportados pelos temas dos últimos 7d.
  const neighMap = new Map<
    string,
    { label: string; count: number; riskSum: number; riskN: number }
  >();
  for (const t of topics) {
    const list = Array.isArray(t.top_neighborhoods)
      ? (t.top_neighborhoods as Array<{ label?: string; count?: number }>)
      : [];
    for (const n of list) {
      if (!n?.label) continue;
      const cur = neighMap.get(n.label) ?? { label: n.label, count: 0, riskSum: 0, riskN: 0 };
      cur.count += n.count ?? 0;
      cur.riskSum += t.max_risk ?? 0;
      cur.riskN += 1;
      neighMap.set(n.label, cur);
    }
  }
  const neighborhoods = [...neighMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = Math.max(1, ...neighborhoods.map((n) => n.count));
  const zoneItems = neighborhoods.map((n) => {
    const avgRisk = n.riskN ? n.riskSum / n.riskN : 0;
    const tone: Tone =
      avgRisk >= 70
        ? "crit"
        : avgRisk >= 55
          ? "warn"
          : avgRisk > 0 && avgRisk < 30
            ? "green"
            : "flat";
    return { label: n.label, pct: clamp(Math.round((n.count / maxCount) * 100), 0, 100), tone };
  });

  const recentCritical = data?.recentCritical ?? [];
  const signalItems = recentCritical.slice(0, 3).map((m) => {
    const message = Array.isArray(m.message) ? m.message[0] : m.message;
    const group = message
      ? Array.isArray(message.group)
        ? message.group[0]
        : message.group
      : null;
    const srcLabel = (group?.subject ?? "Mensagem").toString().toUpperCase();
    const when = timeAgo(message?.posted_at ?? m.created_at);
    const risk = m.risk_score ?? 0;
    const tone: Tone = risk >= 70 ? "crit" : risk >= 50 ? "warn" : "green";
    return {
      id: m.id,
      src: when ? `${srcLabel} · ${when}` : srcLabel,
      tone,
      text: m.summary ? `"${m.summary}"` : "Sem resumo disponível.",
    };
  });

  const openCount = alerts.length;
  const syncLabel = dataUpdatedAt
    ? `SINCRONIZADO ${timeAgo(new Date(dataUpdatedAt).toISOString())}`
    : "";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date())
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-v2-faint">
          {dateLabel}
          {syncLabel ? ` · ${syncLabel}` : ""}
        </div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-v2-ink">
          {isLoading ? (
            "Carregando o painel…"
          ) : openCount > 0 ? (
            <>
              Bom dia.{" "}
              <span className="text-v2-crit">
                {openCount} assunto{openCount > 1 ? "s" : ""}
              </span>{" "}
              precisa{openCount > 1 ? "m" : ""} de você agora.
            </>
          ) : (
            "Bom dia. Nenhum alerta em aberto no momento."
          )}
        </h1>
        {isError && (
          <div className="mt-2 text-[12.5px] text-v2-crit">
            Não foi possível carregar o painel. Tente novamente.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* Critical focus card */}
        <div className="overflow-hidden rounded-2xl border border-v2-line bg-v2-card shadow-[0_1px_2px_rgba(33,31,28,0.04)]">
          <div
            className={`h-1 ${CARD_TONE[primary ? levelMeta(primary.level).tone : "green"].bar}`}
          />
          <div className="p-6">
            {primary ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] ${
                      CARD_TONE[levelMeta(primary.level).tone].badgeBg
                    } ${CARD_TONE[levelMeta(primary.level).tone].badgeText}`}
                  >
                    {levelMeta(primary.level).label}
                  </span>
                  <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-v2-faint">
                    ABERTO {timeAgo(primary.created_at).toUpperCase()}
                  </span>
                </div>
                <h2 className="mt-3 text-[21px] font-semibold tracking-tight text-v2-ink">
                  {primary.topic ?? "Alerta sem tema"}
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-v2-ink-2">
                  {primary.summary ?? "Sem resumo disponível."}
                </p>
                <div className="mt-3 flex items-center gap-4 font-mono text-[12px] text-v2-ink-3">
                  {primary.neighborhood && <span>📍 {primary.neighborhood}</span>}
                </div>
                <div className="mt-4 flex gap-2.5">
                  <Link
                    to="/v2/alertas/$alertId"
                    params={{ alertId: primary.id }}
                    className="rounded-lg bg-v2-ink px-4 py-2.5 text-[14px] font-semibold text-white"
                  >
                    Abrir roteiro de ação
                  </Link>
                  <Link
                    to="/v2/sinais"
                    className="rounded-lg border border-v2-line-strong bg-v2-card px-4 py-2.5 text-[14px] font-semibold text-v2-ink"
                  >
                    Ver mensagens
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className="rounded bg-v2-green-tint px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-[0.08em] text-v2-green">
                  TRANQUILO
                </span>
                <h2 className="mt-3 text-[21px] font-semibold tracking-tight text-v2-ink">
                  {isLoading ? "Carregando…" : "Nenhum alerta crítico no momento"}
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-v2-ink-2">
                  Assim que a IA detectar um assunto que precise de atenção, ele aparece aqui.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Depois disso */}
        <div className="flex flex-col gap-2">
          <div className="mb-0.5 flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-v2-ink-3">Depois disso</span>
            <div className="h-px flex-1 bg-v2-line" />
          </div>
          {secondary.map((a) => (
            <SecondaryRow
              key={a.id}
              level={levelMeta(a.level).label}
              tone={levelMeta(a.level).tone}
              title={a.topic ?? "Alerta sem tema"}
              window={timeAgo(a.created_at)}
            />
          ))}
          {!isLoading && secondary.length === 0 && (
            <div className="rounded-xl border border-v2-line bg-v2-card px-4 py-3.5 text-[12.5px] text-v2-faint">
              Nenhum outro alerta em aberto.
            </div>
          )}
          {topics[0] ? (
            <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-3.5">
              <span className="text-[14px]">✦</span>
              <span className="flex-1 text-[12.5px] leading-snug text-v2-green-ink">
                <b>Tema em alta:</b> {topics[0].label} —{" "}
                {(topics[0].message_count ?? 0).toLocaleString("pt-BR")} mensagens nos últimos 7
                dias.
              </span>
            </div>
          ) : (
            !isLoading && (
              <div className="flex items-center gap-3 rounded-xl border border-v2-green-border bg-v2-green-tint px-4 py-3.5">
                <span className="text-[14px]">✦</span>
                <span className="flex-1 text-[12.5px] leading-snug text-v2-green-ink">
                  Sem temas identificados nos últimos 7 dias.
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Understand / follow grid */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <div className="min-w-0">
          <V2Eyebrow dot="green" className="mb-2.5">
            ENTENDER · TEMAS 7D
          </V2Eyebrow>
          <div className="rounded-xl border border-v2-line bg-v2-card p-[18px]">
            <div className="flex flex-col gap-3">
              {isLoading && <span className="text-[12.5px] text-v2-ink-3">Carregando…</span>}
              {!isLoading && themeItems.length === 0 && (
                <span className="text-[12.5px] text-v2-faint">
                  Nenhum tema identificado nos últimos 7 dias.
                </span>
              )}
              {themeItems.map((t) => (
                <ThemeBar
                  key={t.label}
                  label={t.label}
                  delta={t.metric}
                  tone={t.tone}
                  pct={t.pct}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-v2-green" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-v2-ink-3">
              ENTENDER · TERRITÓRIO
            </span>
            <Link to="/v2/territorio" className="ml-auto text-[12px] font-semibold text-v2-green">
              mapa →
            </Link>
          </div>
          <div className="rounded-xl border border-v2-line bg-v2-card p-[18px]">
            <div className="flex flex-col gap-2">
              {isLoading && <span className="text-[12.5px] text-v2-ink-3">Carregando…</span>}
              {!isLoading && zoneItems.length === 0 && (
                <span className="text-[12.5px] text-v2-faint">
                  Sem dados territoriais nos últimos 7 dias.
                </span>
              )}
              {zoneItems.map((z) => (
                <ZoneBar key={z.label} label={z.label} pct={z.pct} tone={z.tone} />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <V2Eyebrow dot="faint" className="mb-2.5">
            ACOMPANHAR · SINAIS
          </V2Eyebrow>
          <div className="rounded-xl border border-v2-line bg-v2-card px-[18px] py-2">
            {isLoading && <div className="py-2.5 text-[12.5px] text-v2-ink-3">Carregando…</div>}
            {!isLoading && signalItems.length === 0 && (
              <div className="py-2.5 text-[12.5px] text-v2-faint">Nenhum sinal recente.</div>
            )}
            {signalItems.map((s, i) => (
              <SignalRow
                key={s.id}
                src={s.src}
                tone={s.tone}
                text={s.text}
                border={i < signalItems.length - 1}
                last={i === signalItems.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryRow({
  level,
  tone,
  title,
  window,
}: {
  level: string;
  tone: Tone;
  title: string;
  window: string;
}) {
  const t = CARD_TONE[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-v2-line bg-v2-card px-4 py-3">
      <span
        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] ${t.badgeBg} ${t.badgeText}`}
      >
        {level}
      </span>
      <span className="flex-1 text-[13.5px] font-semibold text-v2-ink">{title}</span>
      <span className="font-mono text-[11px] text-v2-faint">{window}</span>
    </div>
  );
}

const BAR_TONE: Record<Tone, string> = {
  crit: "bg-v2-crit",
  warn: "bg-v2-warn-strong",
  obs: "bg-v2-obs",
  green: "bg-v2-green",
  flat: "bg-v2-line-strong",
};
const DELTA_TONE: Record<Tone, string> = {
  crit: "text-v2-crit",
  warn: "text-v2-warn",
  obs: "text-v2-obs",
  green: "text-v2-green",
  flat: "text-v2-faint",
};

function ThemeBar({
  label,
  delta,
  tone,
  pct,
}: {
  label: string;
  delta: string;
  tone: Tone;
  pct: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-[13px] text-v2-ink">
        <span>{label}</span>
        <span className={`font-mono text-[11px] ${DELTA_TONE[tone]}`}>{delta}</span>
      </div>
      <div className="mt-1.5 h-[5px] rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${BAR_TONE[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ZoneBar({ label, pct, tone }: { label: string; pct: number; tone: Tone }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px]">
      <span className="w-[86px] truncate text-v2-ink">{label}</span>
      <div className="h-[5px] flex-1 rounded-[3px] bg-v2-track">
        <div className={`h-full rounded-[3px] ${BAR_TONE[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-[30px] text-right font-mono text-[11px] ${DELTA_TONE[tone]}`}>
        {pct}%
      </span>
    </div>
  );
}

function SignalRow({
  src,
  text,
  tone,
  border,
  last,
}: {
  src: string;
  text: string;
  tone: Tone;
  border?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`py-2.5 ${!last ? "border-b border-v2-track" : ""}`}>
      <div className={`font-mono text-[10px] ${DELTA_TONE[tone]}`}>{src}</div>
      <div className="mt-1 text-[13px] leading-snug text-v2-ink">{text}</div>
    </div>
  );
}
