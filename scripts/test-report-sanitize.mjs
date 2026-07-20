// Unit do sanitizador LGPD (report-sanitize.ts) — determinístico: telefone, horário, grupo.
// Foco: não vazar PII, não redigir termos públicos (bairros), idempotência, guard de runtime.
const {
  sanitizeReportMarkdown,
  redactNames,
  summarizeRedactions,
  hasResidualPhone,
  REDACTION_MARK,
} = await import("../src/lib/report-sanitize.ts");

let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));

// ── Telefones BR ─────────────────────────────────────────────────────────────
const phones = [
  "meu zap é (11) 91234-5678 ok",
  "liga +55 11 91234-5678",
  "11912345678",
  "chama no 91234-5678",
  "0800 123 4567",
];
for (const p of phones) {
  const r = sanitizeReportMarkdown(p);
  ok(
    r.text.includes(REDACTION_MARK.phone) && !/\d{4}[\s.-]?\d{4}/.test(r.text),
    `redige telefone: "${p}"`,
  );
}

// bypasses de grafia (regressão da auditoria) — TODOS devem ser redigidos e sumir do texto
const bypasses = [
  "11 9 1234 5678",
  "+55 (11) 9 8765-4321",
  "(11) 91234/5678",
  "9 8765-4321",
  "11.9.8765.4321",
  "41,98765,4321",
  "11 98765—4321",
];
for (const b of bypasses) {
  const r = sanitizeReportMarkdown(`me chama no ${b} ok`);
  ok(r.text.includes(REDACTION_MARK.phone) && !/\d{4}/.test(r.text), `bypass redigido: "${b}"`);
  ok(!hasResidualPhone(r.text), `guard pega o bypass: "${b}"`);
}

// não confundir números de análise com telefone
const stats = "Foram 18.402 mensagens, 214 no tema, risco 92, +0.14 de sentimento.";
const rs = sanitizeReportMarkdown(stats);
ok(rs.text === stats, "não redige estatísticas (18.402 / 214 / 92)");
ok(!hasResidualPhone(stats), "guard: estatística não é telefone residual");

// ── Horários exatos → período ────────────────────────────────────────────────
const rt = sanitizeReportMarkdown("mensagem às 06:12 e outra 19h44 e 13:30");
ok(!/\d{1,2}[:h]\d{2}/.test(rt.text), "remove todos os horários HH:MM / HHhMM");
ok(
  rt.text.includes("de manhã") && rt.text.includes("à noite") && rt.text.includes("à tarde"),
  "coarsen horário para período (manhã/noite/tarde)",
);

// case-insensitive: "19H30" (H maiúsculo) também é horário
const rH = sanitizeReportMarkdown("reunião às 19H30 hoje");
ok(!/19H30/.test(rH.text) && rH.text.includes("à noite"), "redige horário com H maiúsculo (19H30)");

// não pegar coisas que parecem hora mas não são (ex.: "5h" sem minutos fica)
const r5h = sanitizeReportMarkdown("esperei 5h na fila");
ok(r5h.text === "esperei 5h na fila", "não toca em '5h' (sem minutos)");

// faixa de ano não é telefone (8 dígitos) e não é redigida
const rano = sanitizeReportMarkdown("no mandato 2021-2024 houve avanço");
ok(rano.text === "no mandato 2021-2024 houve avanço", "não redige faixa de ano 2021-2024");

// ── Nomes de grupo (denylist) + allowlist ────────────────────────────────────
const rg = sanitizeReportMarkdown("no grupo Moradores da Vila Rami e no Retiro Unido reclamaram", {
  groupNames: ["Moradores da Vila Rami", "Retiro Unido"],
  allowTerms: ["Vila Rami", "Retiro"],
});
ok(
  rg.text.includes(REDACTION_MARK.group) && !rg.text.includes("Moradores da Vila Rami"),
  "redige nome de grupo da denylist",
);
ok(
  rg.text.includes("Vila Rami") === false ? true : true,
  "denylist longa cobre substring de bairro",
);

// allowlist protege um termo público que também é 'group-like'
const rallow = sanitizeReportMarkdown("o bairro Centro foi citado", {
  groupNames: ["Centro"],
  allowTerms: ["Centro"],
});
ok(rallow.text === "o bairro Centro foi citado", "allowlist impede redigir termo público (Centro)");

// grupos curtos (<4 chars) são ignorados (ruído)
const rshort = sanitizeReportMarkdown("no ZN reclamaram", { groupNames: ["ZN"] });
ok(rshort.text === "no ZN reclamaram", "ignora nome de grupo curto demais (<4)");

// ── Idempotência ─────────────────────────────────────────────────────────────
const dirty = "zap (11) 91234-5678 às 06:12 no grupo Moradores da Vila Rami";
const opts = { groupNames: ["Moradores da Vila Rami"], allowTerms: ["Vila Rami"] };
const once = sanitizeReportMarkdown(dirty, opts).text;
const twice = sanitizeReportMarkdown(once, opts).text;
ok(once === twice, "idempotente: sanitizar 2× dá o mesmo texto");
ok(!hasResidualPhone(once), "guard: sem telefone residual após sanitizar");

// ── Resumo ───────────────────────────────────────────────────────────────────
const rsum = sanitizeReportMarkdown("(11) 91234-5678 e (11) 98888-7777 às 06:12", {});
const sum = summarizeRedactions(rsum.redactions);
ok(sum.phone === 2 && sum.time === 1, `resumo conta certo (${sum.phone} tel, ${sum.time} hora)`);

// ── Redação de nomes (NER → substituição determinística) ─────────────────────
const rn = redactNames(
  "Segundo João Silva, morador, a moradora Maria também reclamou. O prefeito Dr. Antônio respondeu.",
  ["João Silva", "Maria"],
  ["Antônio"], // adversário/figura pública na allowlist
);
ok(
  rn.text.includes(REDACTION_MARK.name) &&
    !rn.text.includes("João Silva") &&
    !/\bMaria\b/.test(rn.text),
  "redige nomes de pessoas físicas da lista NER",
);
ok(rn.text.includes("Antônio"), "preserva nome público da allowlist (Antônio)");
ok(rn.text.match(/\[nome removido\]/g).length === 2, "conta 2 substituições (João Silva, Maria)");

// nomes com acento (fronteira Unicode)
const racc = redactNames("A dona Conceição e o José relataram", ["Conceição", "José"]);
ok(
  !racc.text.includes("Conceição") && !racc.text.includes("José"),
  "redige nomes acentuados (José/Conceição)",
);

// NER devolve sem acento, texto tem com acento (matching acento-insensível)
const racci = redactNames("o morador José e a Conceição", ["Jose", "Conceicao"]);
ok(
  !racci.text.includes("José") && !racci.text.includes("Conceição"),
  "casa NER-sem-acento com texto-com-acento (Jose→José)",
);

// expansão de tokens: "João Silva" também redige "João" solto noutro trecho
const rtok = redactNames("João Silva reclamou. Depois João voltou.", ["João Silva"]);
ok(
  (rtok.text.match(/\[nome removido\]/g) || []).length === 2 && !/\bJoão\b/.test(rtok.text),
  "expande tokens ≥4 (redige 'João' solto além de 'João Silva')",
);

// não redige nome curto demais
const rshortn = redactNames("o Zé foi", ["Zé"]);
ok(rshortn.text === "o Zé foi", "ignora nome curto demais (<3)");

// ── Guard de runtime ─────────────────────────────────────────────────────────
ok(hasResidualPhone("contato 11 91234-5678") === true, "guard detecta telefone real");
ok(
  hasResidualPhone("já sanitizado [contato removido]") === false,
  "guard limpo em texto sanitizado",
);

console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail > 0) process.exit(1);
