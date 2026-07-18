// Tests the resilience of callAi: retry on transient errors, model fallback, fail-fast on auth.
process.env.GEMINI_API_KEY = "test-key";
const { callAi } = await import("../src/lib/ai-gateway.server.ts");
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m));
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const okBody = (content) => ({ choices: [{ message: { content } }] });

// 1) retry on transient 503 until success (same model)
let calls = 0;
global.fetch = async () => { calls++; return calls < 3 ? res(503, {}) : res(200, okBody("ok")); };
const r1 = await callAi({ messages: [{ role: "user", content: "x" }], maxAttempts: 3 });
ok(r1.text === "ok" && calls === 3, `retry em 503 até sucesso (${calls} tentativas)`);

// 2) model fallback on 404 (preview deprecated) -> next model
const seen = [];
global.fetch = async (_u, init) => { const b = JSON.parse(init.body); seen.push(b.model); return b.model === "primary" ? res(404, {}) : res(200, okBody("fb")); };
const r2 = await callAi({ model: "primary", fallbackModels: ["backup"], messages: [{ role: "user", content: "x" }] });
ok(r2.text === "fb" && r2.model === "backup", `cai pro fallback em 404 (viu: ${seen.join(",")})`);

// 3) auth error 401 fails fast — no retry, no fallback
calls = 0;
global.fetch = async () => { calls++; return res(401, {}); };
let threw = false;
try { await callAi({ messages: [{ role: "user", content: "x" }], fallbackModels: ["b"], maxAttempts: 3 }); } catch { threw = true; }
ok(threw && calls === 1, `401 lança imediatamente sem retry/fallback (${calls} chamada)`);

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
