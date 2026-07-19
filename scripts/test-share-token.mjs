// Unit do token de share público — força, formato, unicidade, e o token especial "demo".
const { generateShareToken, isValidTokenFormat } = await import("../src/lib/share-token.ts");
let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));

const t = generateShareToken();
ok(typeof t === "string" && t.length >= 30, `gera token forte (${t.length} chars)`);
ok(/^[A-Za-z0-9_-]+$/.test(t), "token é base64url (URL-safe, sem +/= )");
ok(isValidTokenFormat(t), "token gerado passa no isValidTokenFormat");

// unicidade (1000 tokens, zero colisão)
const set = new Set();
for (let i = 0; i < 1000; i++) set.add(generateShareToken());
ok(set.size === 1000, `1000 tokens únicos (${set.size})`);

// formato
ok(isValidTokenFormat("demo"), "'demo' é válido (fixture)");
ok(!isValidTokenFormat(""), "vazio é inválido");
ok(!isValidTokenFormat("curto"), "token curto (<20) é inválido");
ok(!isValidTokenFormat("tem espaço aqui dentro do token"), "token com espaço é inválido");
ok(!isValidTokenFormat("../../etc/passwd/aaaaaaaaaaaa"), "path traversal é inválido");
ok(!isValidTokenFormat("a".repeat(65)), "token longo demais (>64) é inválido");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
