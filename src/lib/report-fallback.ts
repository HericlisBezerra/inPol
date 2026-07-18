// Pure, dependency-free deterministic report builder (unit-testable).

/** Shape of the aggregated data block that both the AI prompt and the fallback consume. */
interface ReportData {
  org?: string | null;
  city?: string | null;
  counts: {
    messages_analyzed: number;
    alerts: { vermelho: number; laranja: number; amarelo: number };
    by_source: Record<string, number>;
  };
  top_topics: Array<{
    label: string;
    count: number;
    avg_sentiment: number;
    max_risk: number;
    samples: Array<{ text: string; neighborhood: string | null; source: string }>;
  }>;
  top_neighborhoods: Array<{
    label: string;
    count: number;
    avg_sentiment: number;
    top_topics: Array<{ label: string; count: number }>;
  }>;
  top_opponents: Array<[string, number]>;
  external_signals: Array<{
    source: string;
    label: string | null;
    title: string;
    url: string | null;
    excerpt: string;
    risk_score: number;
  }>;
  high_risk_messages: Array<{
    text: string;
    risk: number;
    topic: string;
    neighborhood: string | null;
    source: string;
    url: string | null;
  }>;
  sample_alerts: Array<{
    level: string;
    topic: string | null;
    neighborhood: string | null;
    summary: string | null;
  }>;
}

/**
 * Deterministic, data-backed report used when the AI narrative is unavailable. Built purely
 * from the aggregated real data — no invented content — so a period NEVER ends up without a
 * report. If there is genuinely no data, it says so and flags the ingestion pipeline.
 */
export function buildFallbackReport(title: string, kindLabel: string, d: ReportData): string {
  const q = (s: string) => `"${String(s).replace(/\s+/g, " ").trim().slice(0, 240)}"`;
  const sent = (n: number) => (n > 0.05 ? "positivo" : n < -0.05 ? "negativo" : "neutro");
  const L: string[] = [];
  L.push(`# ${title}`);
  L.push(
    `> ⚙️ **Relatório automático (modo contingência).** A narrativa por IA ficou indisponível neste ciclo, então este relatório foi montado diretamente a partir dos dados coletados — todos os números e citações abaixo são reais e completos. O texto analítico volta no próximo ciclo.`,
  );

  const totalMsgs = d.counts?.messages_analyzed ?? 0;
  if (totalMsgs === 0 && d.external_signals.length === 0) {
    L.push(`\n## ⚠️ Sem sinais no período (${kindLabel})`);
    L.push(
      `Nenhuma mensagem analisada e nenhum sinal externo foi coletado neste período. Isso normalmente indica um problema de **ingestão** — verifique o webhook do WhatsApp (Evolution), os scanners de imprensa/Instagram e o agendamento do cron. Não é ausência de assunto na cidade; é ausência de coleta.`,
    );
    return L.join("\n");
  }

  // Panorama quantitativo
  L.push(`\n## 📊 Panorama quantitativo`);
  const a = d.counts.alerts;
  L.push(
    `- **${totalMsgs}** mensagens analisadas · alertas: **${a.vermelho}** vermelhos, **${a.laranja}** laranjas, **${a.amarelo}** amarelos.`,
  );
  const bySource = Object.entries(d.counts.by_source ?? {});
  if (bySource.length) L.push(`- Por canal: ${bySource.map(([k, v]) => `${k} ${v}`).join(" · ")}.`);

  // Temas
  if (d.top_topics.length) {
    L.push(`\n## 🔥 Temas mais ativos`);
    for (const t of d.top_topics.slice(0, 8)) {
      L.push(
        `\n**${t.label}** — ${t.count} menções · sentimento médio ${t.avg_sentiment} (${sent(t.avg_sentiment)}) · risco máx ${t.max_risk}.`,
      );
      const sample = t.samples?.[0];
      if (sample?.text) {
        const where = sample.neighborhood ? ` — ${sample.neighborhood}` : "";
        L.push(`> ${q(sample.text)} (${sample.source}${where})`);
      }
    }
  }

  // Bairros
  if (d.top_neighborhoods.length) {
    L.push(`\n## 🗺️ Mapa por bairro`);
    for (const n of d.top_neighborhoods.slice(0, 8)) {
      const temas = n.top_topics.map((t) => `${t.label} (${t.count})`).join(", ");
      L.push(
        `- **${n.label}** — ${n.count} menções · sentimento ${n.avg_sentiment} (${sent(n.avg_sentiment)})${temas ? ` · temas: ${temas}` : ""}.`,
      );
    }
  }

  // Sinais externos
  if (d.external_signals.length) {
    L.push(`\n## 📰 Sinais externos de maior risco`);
    for (const s of d.external_signals.slice(0, 8)) {
      const url = s.url ? ` — ${s.url}` : "";
      L.push(`- **[${s.source}]** ${s.title} · risco ${s.risk_score}${url}`);
      if (s.excerpt) L.push(`  > ${q(s.excerpt)}`);
    }
  }

  // Mensagens de maior risco
  if (d.high_risk_messages.length) {
    L.push(`\n## ⚠️ Mensagens de maior risco`);
    for (const m of d.high_risk_messages.slice(0, 6)) {
      const where = m.neighborhood ? `, ${m.neighborhood}` : "";
      L.push(`- (risco ${m.risk} · ${m.topic}${where} · ${m.source}) ${q(m.text)}`);
    }
  }

  // Opositores
  L.push(`\n## 🎭 Opositores e narrativas`);
  if (d.top_opponents.length)
    L.push(
      d.top_opponents
        .slice(0, 8)
        .map(([name, c]) => `- **${name}** — ${c} menções`)
        .join("\n"),
    );
  else L.push(`Nenhum opositor do vocabulário foi mencionado no período.`);

  // Alertas
  const criticos = d.sample_alerts.filter((x) => x.level === "vermelho" || x.level === "laranja");
  if (criticos.length) {
    L.push(`\n## 🚨 Alertas críticos`);
    for (const al of criticos.slice(0, 10)) {
      const where = al.neighborhood ? ` (${al.neighborhood})` : "";
      L.push(
        `- **${al.level.toUpperCase()}** · ${al.topic ?? "geral"}${where} — ${al.summary ?? ""}`,
      );
    }
  }

  // Recomendações ancoradas em dado
  L.push(`\n## 🎯 Recomendações acionáveis`);
  const piorBairro = [...d.top_neighborhoods].sort((x, y) => x.avg_sentiment - y.avg_sentiment)[0];
  const temaQuente = [...d.top_topics].sort((x, y) => y.max_risk - x.max_risk)[0];
  const recs: string[] = [];
  if (temaQuente)
    recs.push(
      `- **Próximas 24h:** endereçar o tema de maior risco — **${temaQuente.label}** (risco máx ${temaQuente.max_risk}).`,
    );
  if (piorBairro && piorBairro.avg_sentiment < 0)
    recs.push(
      `- **Território:** **${piorBairro.label}** está com o pior sentimento (${piorBairro.avg_sentiment}) — priorizar presença/comunicação.`,
    );
  if (a.vermelho > 0)
    recs.push(
      `- **Crises:** ${a.vermelho} alerta(s) vermelho(s) aberto(s) — abrir roteiro de ação.`,
    );
  recs.push(
    `- **Monitorar:** reprocessar a narrativa por IA no próximo ciclo (este saiu em contingência).`,
  );
  L.push(recs.join("\n"));

  return L.join("\n");
}
