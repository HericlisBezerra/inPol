// Unit tests do filtro matemático L0 (módulo puro). Verifica que resolve os casos inequívocos
// e devolve null (→ IA) nos ambíguos/arriscados — a garantia de que não degrada a qualidade.
const { preClassify } = await import("../src/lib/micro-heuristics.ts");
let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));
const M = (o = {}) => ({
  neighborhood: [],
  opponent: [],
  ally: [],
  department: [],
  facility: [],
  sensitive_term: [],
  focus_term: [],
  ...o,
});

// 1) reclamação negativa forte + tema claro + sem adversário -> classifica negativo, risco alto
const r1 = preClassify(
  "Terceira vez que a Vila Rami alaga e ninguém aparece, um descaso total, um absurdo!",
  M({ neighborhood: ["Vila Rami"] }),
  "whatsapp",
);
ok(
  r1 &&
    r1.sentiment < -0.5 &&
    r1.risk_score >= 45 &&
    r1.topic === "enchentes" &&
    r1.neighborhood === "Vila Rami",
  "negativo forte + tema -> classificado por regra",
);

// 2) elogio claro + tema -> positivo, risco baixo
const r2 = preClassify(
  "A nova ciclovia ficou ótima, adorei, parabéns pela obra!",
  M(),
  "instagram",
);
ok(
  r2 &&
    r2.sentiment > 0.4 &&
    r2.risk_score <= 20 &&
    (r2.topic === "mobilidade" || r2.topic === "obras"),
  "elogio claro -> positivo",
);

// 3) adversário citado -> null (nuance -> IA)
const r3 = preClassify(
  "O vereador Parimoschi disse que a UBS do Retiro é um descaso, um abandono total",
  M({ opponent: ["Parimoschi"], facility: ["UBS do Retiro"] }),
  "whatsapp",
);
ok(r3 === null, "adversário citado -> defere pra IA (null)");

// 4) sentimento misto -> null
const r4 = preClassify(
  "A obra ficou ótima mas ainda tem buraco e lixo, um descaso em parte",
  M(),
  "whatsapp",
);
ok(r4 === null, "sentimento misto -> null");

// 5) sem tema claro -> null (mesmo com sentimento)
const r5 = preClassify("Que absurdo, que descaso, um horror total isso aí", M(), "whatsapp");
ok(r5 === null, "sem tema claro -> null");

// 6) muito curto -> null
ok(preClassify("péssimo", M(), "whatsapp") === null, "muito curto -> null");

// 7) muito longo (provável artigo) -> null
ok(preClassify("descaso ".repeat(120) + " enchente", M(), "news") === null, "texto longo -> null");

// 8) neutro/factual -> null
ok(
  preClassify(
    "Alguém sabe o horário de funcionamento da UBS do Retiro?",
    M({ facility: ["UBS do Retiro"] }),
    "whatsapp",
  ) === null,
  "pergunta neutra -> null",
);

// 9) sarcasmo (positivo + palavra de problema) -> null (misto, "fechada" agora no léxico negativo)
ok(
  preClassify("Excelente, mais uma creche fechada, ótimo trabalho da gestão", M(), "whatsapp") ===
    null,
  "sarcasmo elogioso -> defere pra IA (null)",
);

// 10) sem double-count: negativo com foco -> risco BASE 45 (boosts só em buildAnalysisRow)
const r10 = preClassify(
  "A enchente na Vila Rami de novo, um descaso, um absurdo total",
  M({ neighborhood: ["Vila Rami"], focus_term: ["enchente"] }),
  "whatsapp",
);
ok(r10 && r10.risk_score === 45, "risco BASE (45), sem reaplicar boost de foco no L0");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
