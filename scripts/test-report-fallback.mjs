// import the pure builder directly (no server deps)
const mod = await import("../src/lib/report-fallback.ts");
const { buildFallbackReport } = mod;
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m));

// Case 1: real data
const data = {
  org: "Prefeitura de Jundiaí", city: "Jundiaí",
  counts: { messages_analyzed: 4564, alerts: { vermelho: 1, laranja: 2, amarelo: 3 }, by_source: { whatsapp: 4000, news: 500, instagram: 64 } },
  top_topics: [{ label: "Enchentes", count: 214, avg_sentiment: -0.55, max_risk: 92, samples: [{ text: "terceira vez que alaga e ninguém aparece", neighborhood: "Vila Rami", source: "whatsapp" }] }],
  top_neighborhoods: [{ label: "Vila Rami", count: 438, avg_sentiment: -0.6, top_topics: [{ label: "Enchentes", count: 200 }] }],
  top_opponents: [["Parimoschi", 320]],
  external_signals: [{ source: "news", label: "Tribuna", title: "Enchente na Vila Rami", url: "https://x", excerpt: "moradores relatam abandono", risk_score: 88 }],
  high_risk_messages: [{ text: "esperei 5 horas na UBS", risk: 71, topic: "Saúde", neighborhood: "Retiro", source: "whatsapp", url: null }],
  sample_alerts: [{ level: "vermelho", topic: "Enchentes", neighborhood: "Vila Rami", summary: "sem resposta da prefeitura" }],
};
const r1 = buildFallbackReport("Relatório diário — 2026-07-18", "diário (últimas 24h)", data);
ok(r1.includes("# Relatório diário"), "tem título");
ok(r1.includes("4564") && r1.includes("Enchentes") && r1.includes("Vila Rami"), "traz números e dados reais");
ok(r1.includes("terceira vez que alaga"), "traz citação real de mensagem");
ok(r1.includes("Parimoschi"), "traz opositor");
ok(r1.includes("VERMELHO"), "traz alerta crítico");
ok(r1.length > 600, "tem tamanho de relatório real ("+r1.length+" chars)");
ok(r1.includes("contingência"), "sinaliza modo contingência (honesto)");

// Case 2: empty data -> flags ingestion, never crashes
const empty = { org: null, city: null, counts: { messages_analyzed: 0, alerts: { vermelho: 0, laranja: 0, amarelo: 0 }, by_source: {} }, top_topics: [], top_neighborhoods: [], top_opponents: [], external_signals: [], high_risk_messages: [], sample_alerts: [] };
const r2 = buildFallbackReport("Relatório diário — vazio", "diário (últimas 24h)", empty);
ok(r2.includes("Sem sinais no período"), "caso vazio: título de sem-sinais");
ok(r2.toLowerCase().includes("ingest"), "caso vazio: aponta problema de ingestão (não some)");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
