// Tests callAi resilience: retry, model fallback, fail-fast, multi-provider skip.
process.env.GEMINI_API_KEY = "gem-key";
delete process.env.DEEPSEEK_API_KEY; // deepseek intentionally unconfigured
const { callAi } = await import("../src/lib/ai-gateway.server.ts");
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m));
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const okBody = (content) => ({ choices: [{ message: { content } }] });

// 1) retry on transient 503 until success
let calls = 0;
global.fetch = async () => { calls++; return calls < 3 ? res(503, {}) : res(200, okBody("ok")); };
const r1 = await callAi({ messages: [{ role: "user", content: "x" }], maxAttempts: 3 });
ok(r1.text === "ok" && calls === 3, `retry em 503 até sucesso (${calls}x)`);

// 2) model fallback on 404 (both gemini models -> use gemini key)
const seen = [];
global.fetch = async (_u, init) => { const b = JSON.parse(init.body); seen.push(b.model); return b.model === "gemini-a" ? res(404, {}) : res(200, okBody("fb")); };
const r2 = await callAi({ model: "gemini-a", fallbackModels: ["gemini-b"], messages: [{ role: "user", content: "x" }] });
ok(r2.text === "fb" && r2.model === "gemini-b", `fallback de modelo em 404 (${seen.join(",")})`);

// 3) auth 401 fails fast
calls = 0;
global.fetch = async () => { calls++; return res(401, {}); };
let threw = false;
try { await callAi({ messages: [{ role: "user", content: "x" }], fallbackModels: ["gemini-x"], maxAttempts: 3 }); } catch { threw = true; }
ok(threw && calls === 1, `401 falha rápido, sem retry/fallback (${calls}x)`);

// 4) provider unconfigured (deepseek, no key) -> skip to gemini fallback, only 1 fetch (gemini)
let fetchUrls = [];
global.fetch = async (u) => { fetchUrls.push(u); return res(200, okBody("via-gemini")); };
const r4 = await callAi({ model: "deepseek-chat", fallbackModels: ["gemini-3.5-flash"], messages: [{ role: "user", content: "x" }] });
ok(r4.text === "via-gemini" && r4.model === "gemini-3.5-flash", "pula provedor sem chave (deepseek) e cai no gemini");
ok(fetchUrls.length === 1 && fetchUrls[0].includes("generativelanguage"), "não faz fetch no provedor sem chave (só gemini)");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
