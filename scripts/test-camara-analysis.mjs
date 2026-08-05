// Unit tests da agregação de sessão da Câmara (módulo puro, sem banco/IA).
// O que está sob teste é o contrato duro do módulo: os números batem, o recorte nunca é
// silencioso, a citação sai literal e menção duvidosa NÃO é inventada.
const { agregar, montarFalasPrompt, montarRelatorioFallback } =
  await import("../src/lib/camara-analysis.ts");
let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));

const fala = (i, at, nome, partido, texto, extra = {}) => ({
  id: `f${i}`,
  order_index: i,
  at_seconds: at,
  speaker_name: nome,
  speaker_party: partido,
  speaker_role: extra.role ?? "vereador",
  person_id: extra.person_id ?? null,
  content: texto,
  word_count: texto.split(/\s+/).filter(Boolean).length,
  topic: null,
  sentiment: null,
  risk_score: null,
  summary: null,
});

const falas = [
  fala(0, 60, "Henrique do Cardume", "PSOL", "A obra da avenida parou e o bairro está no escuro.", {
    person_id: "p1",
  }),
  fala(1, 300, "Ana Zeballos", "PT", "Concordo com o Cardume, a Prefeitura precisa responder.", {
    person_id: "p2",
  }),
  fala(2, 480, "Henrique do Cardume", "PSOL", "Obrigado pelo aparte, presidente.", {
    person_id: "p1",
  }),
  fala(3, 600, "José da Silva", "MDB", "Registro apenas os cumprimentos de praxe.", {
    role: "presidente",
  }),
];

const ag = agregar(falas, new Map([["p1", { id: "p1", stance: "adversario" }]]));

// 1) contagem por orador
const cardume = ag.por_vereador.find((o) => o.nome === "Henrique do Cardume");
ok(ag.cobertura.falas === 4, "cobertura: conta todas as falas");
ok(ag.cobertura.oradores === 3, "cobertura: agrupa o mesmo orador por person_id");
ok(cardume.falas === 2, "por_vereador: soma as duas falas do mesmo person_id");
ok(cardume.stance === "adversario", "por_vereador: stance vem da ficha, não da IA");
ok(
  ag.cobertura.primeiro_at_seconds === 60 && ag.cobertura.ultimo_at_seconds === 600,
  "cobertura: primeiro/último at_seconds",
);
ok(
  ag.cobertura.palavras === falas.reduce((a, f) => a + f.word_count, 0),
  "cobertura: palavras é a soma exata",
);
ok(
  Math.abs(ag.por_vereador.reduce((a, o) => a + o.pct_palavras, 0) - 100) < 0.5,
  "por_vereador: percentuais somam ~100",
);

// 2) papel de presidente prevalece sobre 'vereador'
ok(
  ag.por_vereador.find((o) => o.nome === "José da Silva").papel === "presidente",
  "por_vereador: papel presidente prevalece",
);

// 3) partido
ok(ag.por_partido.length === 3, "por_partido: um por sigla");

// 4) menções — 'Cardume' é token exclusivo; 'Silva'/'José' são genéricos e NÃO contam
const m = ag.mencoes.find((x) => x.de === "Ana Zeballos" && x.para === "Henrique do Cardume");
ok(!!m && m.ocorrencias === 1, "mencoes: detecta token exclusivo (Cardume)");
ok(
  !!m?.evidencias[0]?.trecho?.includes("Concordo"),
  "mencoes: evidência é trecho literal com minuto",
);
ok(
  !ag.mencoes.some((x) => x.para === "José da Silva"),
  "mencoes: sobrenome comum não vira menção (nada inventado)",
);
ok(!ag.mencoes.some((x) => x.de === x.para), "mencoes: orador citando o próprio nome não conta");

// 5) recorte — sessão pequena passa inteira
const r1 = montarFalasPrompt(falas);
ok(r1.recorte.aplicado === false, "recorte: sessão normal vai inteira");
ok(
  r1.itens.every((i) => i.integral),
  "recorte: todas as falas integrais",
);
ok(r1.itens[0].t === "00:01:00", "prompt: marcador de tempo em hh:mm:ss");

// 6) recorte — sessão gigante trunca, MAS avisa
const gigante = [];
for (let i = 0; i < 400; i++) {
  const palavras = i % 2 === 0 ? 300 : 5;
  gigante.push(fala(i, i * 30, `Vereador ${i % 10}`, "X", "palavra ".repeat(palavras).trim()));
}
const r2 = montarFalasPrompt(gigante);
ok(r2.recorte.aplicado === true, "recorte: sessão acima do teto marca aplicado=true");
ok(r2.recorte.falas_resumidas > 0, "recorte: informa quantas falas foram truncadas");
ok(r2.recorte.palavras_totais > r2.recorte.teto_palavras, "recorte: registra o total real");
ok(
  r2.itens.some((i) => !i.integral && i.texto.includes("[fala truncada]")),
  "recorte: fala truncada vem marcada no próprio texto",
);
ok(r2.itens.length === gigante.length, "recorte: nenhuma fala some — todas aparecem");

// 7) fallback determinístico
const analysis = {
  versao: 1,
  sessao: {
    id: "s1",
    data: "2026-07-30",
    numero: "62ª",
    legislatura: "19ª",
    tipo: "ordinária",
    title: "62ª Sessão Ordinária",
    video_id: "abc123",
    video_url: null,
  },
  ...ag,
  recorte: r1.recorte,
  modo: "fallback",
  gerado_em: new Date().toISOString(),
};
const md = montarRelatorioFallback(analysis, falas, (s) => `https://youtu.be/abc123?t=${s}`);
ok(md.includes("# 62ª Sessão Ordinária"), "fallback: título da sessão");
ok(md.toLowerCase().includes("contingência"), "fallback: declara que é contingência");
ok(md.includes("A obra da avenida parou"), "fallback: cita fala literal");
ok(md.includes("https://youtu.be/abc123?t="), "fallback: linka o minuto do vídeo");
ok(md.includes("não a ata"), "fallback: avisa que transcrição não é ata");
ok(
  md.includes("Sem cadastro de vereadores"),
  "fallback: sem base, diz que não sabe quem faltou (não afirma 'todos falaram')",
);

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
